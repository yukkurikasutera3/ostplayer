/**
 * OST Player - P2P Sync Session Core (src/sync/p2p-session.js)
 * High-precision WebRTC P2P mesh & client-server engine using PeerJS
 */

(function(global) {
    const ROOM_PREFIX = 'ost-room-';
    const CHUNK_SIZE = 16384; // 16KB for ultra-reliable RTCDataChannel chunking

    class P2PSession {
        constructor() {
            this.peer = null;
            this.role = null; // 'host' | 'listener'
            this.roomCode = null;
            this.myPeerId = null;
            this.hostConn = null; // If listener
            this.connections = new Map(); // If host: peerId -> conn
            this.pingStats = new Map(); // peerId -> { ping, lastSeen }
            this.clockOffset = 0; // ms offset relative to host
            this.listeners = {};
            this.incomingChunks = new Map(); // transferId -> { chunks: [], totalChunks, metadata }
            this.activeTransferId = null;
            this.heartbeatTimer = null;
        }

        on(event, callback) {
            if (!this.listeners[event]) this.listeners[event] = [];
            this.listeners[event].push(callback);
        }

        emit(event, data, extra) {
            const list = this.listeners[event];
            if (list) {
                for (let cb of list) {
                    try { cb(data, extra); } catch(e) { console.error(`P2P event [${event}] error:`, e); }
                }
            }
        }

        // --- Host: Create a DJ Room with 6-digit Code ---
        async createRoom(preferredCode = null) {
            this.close();
            this.role = 'host';

            if (typeof Peer === 'undefined') {
                throw new Error("PeerJS ライブラリが読み込まれていません");
            }

            const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();
            let code = preferredCode || generateCode();
            let peerId = ROOM_PREFIX + code;

            return new Promise((resolve, reject) => {
                let initPeer = (targetId) => {
                    const peer = new Peer(targetId, {
                        debug: 1,
                        config: {
                            iceServers: [
                                { urls: 'stun:stun.l.google.com:19302' },
                                { urls: 'stun:stun1.l.google.com:19302' }
                            ]
                        }
                    });

                    peer.on('open', (id) => {
                        this.peer = peer;
                        this.myPeerId = id;
                        this.roomCode = code;
                        this.startHeartbeat();
                        this.emit('status', { status: 'host_ready', roomCode: code, peerId: id });
                        resolve(code);
                    });

                    peer.on('connection', (conn) => {
                        this.handleIncomingConnection(conn);
                    });

                    peer.on('error', (err) => {
                        if (err.type === 'unavailable-id' && !preferredCode) {
                            // Retry with another 6-digit code
                            code = generateCode();
                            initPeer(ROOM_PREFIX + code);
                        } else {
                            this.emit('error', err);
                            reject(err);
                        }
                    });
                };

                initPeer(peerId);
            });
        }

        // --- Listener: Join a Room with 6-digit Code ---
        async joinRoom(code) {
            this.close();
            this.role = 'listener';
            this.roomCode = code.toString().trim();

            if (typeof Peer === 'undefined') {
                throw new Error("PeerJS ライブラリが読み込まれていません");
            }

            const targetHostId = ROOM_PREFIX + this.roomCode;

            return new Promise((resolve, reject) => {
                const peer = new Peer({
                    debug: 1,
                    config: {
                        iceServers: [
                            { urls: 'stun:stun.l.google.com:19302' },
                            { urls: 'stun:stun1.l.google.com:19302' }
                        ]
                    }
                });

                peer.on('open', (myId) => {
                    this.peer = peer;
                    this.myPeerId = myId;
                    this.emit('status', { status: 'connecting_host', roomCode: this.roomCode });

                    const conn = peer.connect(targetHostId, {
                        reliable: true,
                        metadata: { clientName: 'Listener ' + myId.slice(-4) }
                    });

                    this.hostConn = conn;

                    conn.on('open', () => {
                        this.startHeartbeat();
                        this.emit('status', { status: 'connected', roomCode: this.roomCode, hostId: targetHostId });
                        // Send initial ping to sync clock
                        this.sendToHost({ type: 'ping', clientTime: Date.now() });
                        resolve(conn);
                    });

                    conn.on('data', (data) => {
                        this.handleDataMessage(data, conn);
                    });

                    conn.on('close', () => {
                        this.emit('status', { status: 'disconnected', reason: 'Host closed connection' });
                        this.close();
                    });

                    conn.on('error', (err) => {
                        this.emit('error', err);
                        reject(err);
                    });
                });

                peer.on('error', (err) => {
                    this.emit('error', err);
                    reject(err);
                });
            });
        }

        handleIncomingConnection(conn) {
            conn.on('open', () => {
                const peerId = conn.peer;
                this.connections.set(peerId, conn);
                this.pingStats.set(peerId, { ping: 0, lastSeen: Date.now() });
                this.emit('peer_joined', { peerId, count: this.connections.size });
                this.emit('status', { status: 'client_connected', peerId, totalMembers: this.connections.size });
            });

            conn.on('data', (data) => {
                this.handleDataMessage(data, conn);
            });

            conn.on('close', () => {
                const peerId = conn.peer;
                this.connections.delete(peerId);
                this.pingStats.delete(peerId);
                this.emit('peer_left', { peerId, count: this.connections.size });
            });
        }

        handleDataMessage(data, conn) {
            if (!data || typeof data !== 'object') return;

            // Ping / Pong & Latency Sync
            if (data.type === 'ping') {
                conn.send({
                    type: 'pong',
                    clientTime: data.clientTime,
                    hostTime: Date.now()
                });
                return;
            }

            if (data.type === 'pong') {
                const now = Date.now();
                const rtt = now - data.clientTime;
                const latency = rtt / 2;
                // Clock Offset: hostTime - (clientTime + latency)
                this.clockOffset = (data.hostTime + latency) - now;
                this.emit('latency_update', { rtt, latency, clockOffset: this.clockOffset });
                return;
            }

            // Binary Chunk Transfer
            if (data.type === 'file_chunk') {
                this.handleFileChunk(data);
                return;
            }

            // In-Room Chat & DJ Announcement
            if (data.type === 'chat') {
                this.emit('chat', data);
                if (this.role === 'host') {
                    this.broadcast(data, conn.peer);
                }
                return;
            }

            // Track Request & Upvote Queue
            if (data.type === 'request_queue' || data.type === 'track_request' || data.type === 'upvote_request') {
                this.emit('request_queue', data, conn ? conn.peer : null);
                if (this.role === 'host') {
                    this.broadcast(data, conn.peer);
                }
                return;
            }

            // Sync Health Radar Stats
            if (data.type === 'radar_stats') {
                this.emit('radar_stats', data);
                return;
            }

            // Sync Commands & General Messages
            this.emit('message', data, conn ? conn.peer : null);
        }

        // --- Large File & MIDI ArrayBuffer Chunking ---
        async sendFile(arrayBuffer, metadata = {}) {
            if (!arrayBuffer) return;
            const transferId = 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
            const totalBytes = arrayBuffer.byteLength;
            const totalChunks = Math.ceil(totalBytes / CHUNK_SIZE);

            const metaPacket = {
                type: 'file_chunk',
                transferId,
                stage: 'start',
                totalBytes,
                totalChunks,
                metadata
            };

            this.broadcast(metaPacket);

            const uint8 = new Uint8Array(arrayBuffer);
            for (let i = 0; i < totalChunks; i++) {
                const start = i * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, totalBytes);
                // Send raw slice / TypedArray directly
                const chunkSlice = uint8.slice(start, end);

                const chunkPacket = {
                    type: 'file_chunk',
                    transferId,
                    stage: 'chunk',
                    chunkIndex: i,
                    totalChunks,
                    data: chunkSlice
                };

                this.broadcast(chunkPacket);
                this.emit('send_progress', { pct: Math.round(((i + 1) / totalChunks) * 100), transferId });
                // Slight tick yielding to prevent data channel choking
                if (i % 16 === 0) await new Promise(r => setTimeout(r, 0));
            }

            const endPacket = {
                type: 'file_chunk',
                transferId,
                stage: 'end',
                metadata
            };
            this.broadcast(endPacket);
        }

        handleFileChunk(packet) {
            const { transferId, stage, totalChunks, chunkIndex, data, metadata } = packet;

            if (stage === 'start') {
                this.incomingChunks.set(transferId, {
                    chunks: new Array(totalChunks),
                    receivedCount: 0,
                    totalChunks,
                    metadata: metadata || {}
                });
                this.emit('file_progress', { pct: 0, transferId, metadata });
                return;
            }

            const transfer = this.incomingChunks.get(transferId);
            if (!transfer) return;

            if (stage === 'chunk') {
                if (data instanceof Uint8Array) {
                    transfer.chunks[chunkIndex] = data;
                } else if (data instanceof ArrayBuffer) {
                    transfer.chunks[chunkIndex] = new Uint8Array(data);
                } else if (data && data.buffer instanceof ArrayBuffer) {
                    transfer.chunks[chunkIndex] = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
                } else if (Array.isArray(data)) {
                    transfer.chunks[chunkIndex] = new Uint8Array(data);
                } else {
                    transfer.chunks[chunkIndex] = new Uint8Array(data);
                }
                transfer.receivedCount++;
                const pct = Math.round((transfer.receivedCount / transfer.totalChunks) * 100);
                this.emit('file_progress', { pct, transferId, metadata: transfer.metadata });
            }

            if (stage === 'end' || transfer.receivedCount >= transfer.totalChunks) {
                // Reassemble array buffer
                let totalLen = 0;
                for (let c of transfer.chunks) {
                    if (c) totalLen += c.length;
                }
                const merged = new Uint8Array(totalLen);
                let offset = 0;
                for (let c of transfer.chunks) {
                    if (c) {
                        merged.set(c, offset);
                        offset += c.length;
                    }
                }
                this.incomingChunks.delete(transferId);
                this.emit('file_ready', {
                    buffer: merged.buffer,
                    metadata: transfer.metadata || metadata || {}
                });
            }
        }

        // --- Broadcast & Direct Sending ---
        broadcast(data, excludePeerId = null) {
            if (this.role === 'host') {
                for (let [peerId, conn] of this.connections.entries()) {
                    if (peerId !== excludePeerId && conn && conn.open) {
                        try { conn.send(data); } catch(e) {}
                    }
                }
            } else if (this.role === 'listener' && this.hostConn && this.hostConn.open) {
                this.hostConn.send(data);
            }
        }

        sendToHost(data) {
            if (this.hostConn && this.hostConn.open) {
                this.hostConn.send(data);
            }
        }

        sendChatMessage(text, isAnnouncement = false) {
            if (!text || !text.trim()) return;
            const chatData = {
                type: 'chat',
                text: text.trim(),
                isAnnouncement: !!isAnnouncement,
                sender: this.myPeerId ? (this.role === 'host' ? '[DJ Host]' : 'User-' + this.myPeerId.slice(-4)) : 'User',
                timestamp: Date.now()
            };
            this.broadcast(chatData);
            this.emit('chat', chatData);
        }

        sendTrackRequest(title, artist = '') {
            if (!title || !title.trim()) return;
            const reqData = {
                type: 'track_request',
                id: 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                title: title.trim(),
                artist: artist.trim(),
                upvotes: 1,
                voters: [this.myPeerId || 'local'],
                requester: this.myPeerId ? 'User-' + this.myPeerId.slice(-4) : 'User',
                timestamp: Date.now()
            };
            if (this.role === 'host') {
                this.emit('request_queue', reqData);
                this.broadcast(reqData);
            } else {
                this.sendToHost(reqData);
            }
        }

        sendUpvote(requestId) {
            if (!requestId) return;
            const upvoteData = {
                type: 'upvote_request',
                requestId,
                voter: this.myPeerId || 'local',
                timestamp: Date.now()
            };
            if (this.role === 'host') {
                this.emit('request_queue', upvoteData);
                this.broadcast(upvoteData);
            } else {
                this.sendToHost(upvoteData);
            }
        }

        broadcastRadarStats(statsList) {
            if (this.role !== 'host') return;
            const radarData = {
                type: 'radar_stats',
                stats: statsList,
                timestamp: Date.now()
            };
            this.broadcast(radarData);
        }

        startHeartbeat() {
            this.stopHeartbeat();
            this.heartbeatTimer = setInterval(() => {
                if (this.role === 'listener' && this.hostConn && this.hostConn.open) {
                    this.sendToHost({ type: 'ping', clientTime: Date.now() });
                } else if (this.role === 'host') {
                    for (let [peerId, conn] of this.connections.entries()) {
                        if (conn && conn.open) {
                            conn.send({ type: 'ping', clientTime: Date.now() });
                        }
                    }
                }
            }, 4000);
        }

        stopHeartbeat() {
            if (this.heartbeatTimer) {
                clearInterval(this.heartbeatTimer);
                this.heartbeatTimer = null;
            }
        }

        close() {
            this.stopHeartbeat();
            if (this.connections) {
                for (let conn of this.connections.values()) {
                    try { conn.close(); } catch(e){}
                }
                this.connections.clear();
            }
            if (this.hostConn) {
                try { this.hostConn.close(); } catch(e){}
                this.hostConn = null;
            }
            if (this.peer) {
                try { this.peer.destroy(); } catch(e){}
                this.peer = null;
            }
            this.role = null;
            this.roomCode = null;
            this.myPeerId = null;
            this.emit('status', { status: 'idle' });
        }
    }

    global.P2PSession = P2PSession;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = P2PSession;
    }
})(typeof window !== 'undefined' ? window : globalThis);
