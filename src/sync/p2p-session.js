/**
 * OST Player - P2P Sync Session Core (src/sync/p2p-session.js)
 * High-precision WebRTC P2P mesh & client-server engine using PeerJS
 */

(function(global) {
    const ROOM_PREFIX = 'ost-room-';
    const CHUNK_SIZE = 16384; // 16KB for ultra-reliable RTCDataChannel chunking

    // --- 受信データの安全対策(相手から届く値は信用しない) ---
    const MAX_FILE_BYTES = 512 * 1024 * 1024;                    // 1ファイルの上限
    const MAX_CHUNKS = Math.ceil(MAX_FILE_BYTES / CHUNK_SIZE);   // チャンク数の上限
    const MAX_CONCURRENT_TRANSFERS = 2;                          // 同時に受信できる転送数
    const TRANSFER_TIMEOUT_MS = 15 * 60 * 1000;                  // 終わらない転送は破棄
    const MAX_PEERS = 32;                                        // ホストが受け入れる接続数
    const ROOM_CODE_RE = /^\d{6}$/;
    const PEER_ID_RE = /^[A-Za-z0-9_-]{1,100}$/;
    const TRANSFER_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

    function cleanText(v, max) {
        return typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max) : '';
    }

    // 部屋コード: 推測しにくいよう暗号用の乱数を使う(Math.random は使わない)
    function secureRoomCode() {
        const buf = new Uint32Array(1);
        (globalThis.crypto || global.crypto).getRandomValues(buf);
        return String(100000 + (buf[0] % 900000));
    }

    function toUint8(d) {
        if (!d) return null;
        if (d instanceof Uint8Array) return d;
        if (d instanceof ArrayBuffer) return new Uint8Array(d);
        if (ArrayBuffer.isView(d)) return new Uint8Array(d.buffer, d.byteOffset, d.byteLength);
        if (d.buffer instanceof ArrayBuffer && typeof d.byteLength === 'number') {
            return new Uint8Array(d.buffer, d.byteOffset || 0, d.byteLength);
        }
        // 環境によって配列や { "0": 1, "1": 2 } の形で届くことがある(3.6.x の互換対応)。長さに上限を付けて受け付ける
        if (Array.isArray(d)) return d.length <= CHUNK_SIZE ? Uint8Array.from(d) : null;
        if (typeof d === 'object') {
            const keys = Object.keys(d);
            return keys.length <= CHUNK_SIZE ? Uint8Array.from(keys.map(k => d[k])) : null;
        }
        return null; // 数値・文字列などは受け付けない(以前は数値で巨大なメモリを確保できた)
    }

    // 転送開始時に届くメタデータを、使うフィールドだけに絞って検証する
    function sanitizeFileMetadata(m) {
        m = (m && typeof m === 'object') ? m : {};
        const out = {
            name: cleanText(m.name, 300),
            tagTitle: cleanText(m.tagTitle, 300),
            artist: cleanText(m.artist, 300),
            album: cleanText(m.album, 300),
            isMidi: m.isMidi === true,
            duration: (typeof m.duration === 'number' && isFinite(m.duration) && m.duration >= 0 && m.duration <= 86400) ? m.duration : 0,
            mimeType: (typeof m.mimeType === 'string' && /^(audio|video)\/[A-Za-z0-9.+-]{1,60}$/.test(m.mimeType)) ? m.mimeType : '',
            gameLoop: null
        };
        if (m.gameLoop && typeof m.gameLoop === 'object') {
            const g = {};
            for (const k of Object.keys(m.gameLoop).slice(0, 10)) {
                const v = m.gameLoop[k];
                if (k === '__proto__' || k === 'constructor' || !/^[A-Za-z0-9_]{1,30}$/.test(k)) continue;
                if ((typeof v === 'number' && isFinite(v)) || typeof v === 'boolean') g[k] = v;
            }
            out.gameLoop = g;
        }
        return out;
    }

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
            this.currentLiveTransferId = null;
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

            const generateCode = () => secureRoomCode();
            let code = ROOM_CODE_RE.test(String(preferredCode == null ? '' : preferredCode)) ? String(preferredCode) : generateCode();
            let peerId = ROOM_PREFIX + code;

            return new Promise((resolve, reject) => {
                let initPeer = (targetId) => {
                    const peer = new Peer(targetId, {
                        debug: 1,
                        config: {
                            iceServers: [
                                { urls: 'stun:stun.l.google.com:19302' },
                                { urls: 'stun:stun1.l.google.com:19302' },
                                { urls: 'stun:stun2.l.google.com:19302' },
                                { urls: 'stun:stun.cloudflare.com:3478' }
                            ]
                        }
                    });

                    peer.on('open', (id) => {
                        this.peer = peer;
                        this.myPeerId = id;
                        this.roomCode = code;
                        this.startHeartbeat();
                        this.emit('status', { status: 'host_ready', roomCode: code, peerId: id });
                        
                        // 呼び出し側で単一文字列(code)としても分割代入({ roomCode, peerId })としても
                        // どちらで受け取っても undefined にならないよう互換プロパティ付き文字列オブジェクトを解決
                        const codeResult = new String(code);
                        codeResult.roomCode = code;
                        codeResult.peerId = id;
                        codeResult.code = code;
                        resolve(codeResult);
                    });

                    peer.on('disconnected', () => {
                        console.warn('[P2P] Host disconnected from signaling server, attempting reconnect...');
                        if (this.peer && !this.peer.destroyed) {
                            try { this.peer.reconnect(); } catch(e){}
                        }
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
            const trimmedCode = String(code == null ? '' : code).trim();
            if (!ROOM_CODE_RE.test(trimmedCode)) {
                throw new Error('部屋コードは6桁の数字で入力してください');
            }
            this.close();
            this.role = 'listener';
            this.roomCode = trimmedCode;

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
                            { urls: 'stun:stun1.l.google.com:19302' },
                            { urls: 'stun:stun2.l.google.com:19302' },
                            { urls: 'stun:stun.cloudflare.com:3478' }
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

                peer.on('disconnected', () => {
                    console.warn('[P2P] Listener disconnected from signaling server, attempting reconnect...');
                    if (this.peer && !this.peer.destroyed) {
                        try { this.peer.reconnect(); } catch(e){}
                    }
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
                // 不正な ID や、接続数の上限を超える相手は受け入れない
                if (!PEER_ID_RE.test(String(peerId)) || (this.connections.size >= MAX_PEERS && !this.connections.has(peerId))) {
                    try { conn.close(); } catch (e) {}
                    return;
                }
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
                this._dropTransfersFrom(peerId);
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
                // ファイルを送ってくるのはホストだけ。ホストはリスナーからのファイルを受け取らない
                if (this.role === 'host') return;
                this.handleFileChunk(data, conn.peer);
                return;
            }

            // In-Room Chat & DJ Announcement
            if (data.type === 'chat') {
                const chat = this.sanitizeChat(data, conn.peer);
                if (!chat) return;
                this.emit('chat', chat);
                if (this.role === 'host') {
                    this.broadcast(chat, conn.peer);
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

        // DataChannel backpressure flow control: wait for bufferedAmount to drain
        async _waitForBufferDrain(targetPeerId = null, threshold = 256 * 1024) {
            const conns = [];
            if (this.role === 'host') {
                if (targetPeerId) {
                    const c = this.connections.get(targetPeerId);
                    if (c && c.open) conns.push(c);
                } else {
                    for (const c of this.connections.values()) {
                        if (c && c.open) conns.push(c);
                    }
                }
            } else if (this.role === 'listener' && this.hostConn && this.hostConn.open) {
                conns.push(this.hostConn);
            }

            if (conns.length === 0) return;

            const waits = conns.map(conn => {
                const dc = conn.dataChannel;
                if (!dc || dc.readyState !== 'open') return Promise.resolve();
                if (dc.bufferedAmount <= threshold) return Promise.resolve();

                return new Promise(resolve => {
                    let timer = null;
                    const onLow = () => {
                        if (timer) clearTimeout(timer);
                        try { dc.removeEventListener('bufferedamountlow', onLow); } catch (e) {}
                        resolve();
                    };
                    try {
                        dc.bufferedAmountLowThreshold = threshold;
                        dc.addEventListener('bufferedamountlow', onLow, { once: true });
                    } catch (e) {}

                    timer = setTimeout(() => {
                        try { dc.removeEventListener('bufferedamountlow', onLow); } catch (e) {}
                        resolve();
                    }, 120);
                });
            });

            await Promise.all(waits);
        }

        // --- Large File & MIDI ArrayBuffer Chunking ---
        async sendFile(arrayBuffer, metadata = {}, targetPeerId = null) {
            if (!arrayBuffer) return;
            const isLive = !metadata.isPlaylistItem;
            const transferId = 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
            if (isLive) {
                this.currentLiveTransferId = transferId;
            }
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

            const sendPacket = (pkt) => {
                if (targetPeerId) {
                    this.sendToPeer(targetPeerId, pkt);
                } else {
                    this.broadcast(pkt);
                }
            };

            sendPacket(metaPacket);

            const uint8 = new Uint8Array(arrayBuffer);
            for (let i = 0; i < totalChunks; i++) {
                if (isLive && this.currentLiveTransferId !== transferId) {
                    // Superseded by newer track selection; abort sending old track chunks
                    return;
                }

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

                sendPacket(chunkPacket);
                this.emit('send_progress', { pct: Math.round(((i + 1) / totalChunks) * 100), transferId });

                // Flow control: wait for DataChannel buffer to drain every 4 chunks (64KB)
                if (i % 4 === 0) {
                    await this._waitForBufferDrain(targetPeerId, 256 * 1024);
                }
            }

            if (isLive && this.currentLiveTransferId !== transferId) return;

            const endPacket = {
                type: 'file_chunk',
                transferId,
                stage: 'end',
                metadata
            };
            sendPacket(endPacket);
        }

        // チャット: 文字数を制限し、リスナーが「ホストの発言」や「アナウンス」を装えないようにする
        sanitizeChat(data, fromPeerId) {
            const text = cleanText(data.text, 500);
            if (!text) return null;
            const fromListener = (this.role === 'host');
            return {
                type: 'chat',
                text,
                isAnnouncement: fromListener ? false : data.isAnnouncement === true,
                sender: fromListener ? ('User-' + String(fromPeerId).slice(-4)) : (cleanText(data.sender, 40) || '[DJ Host]'),
                timestamp: (typeof data.timestamp === 'number' && isFinite(data.timestamp)) ? data.timestamp : Date.now()
            };
        }

        // 終わらない転送を破棄する
        _pruneTransfers() {
            const now = Date.now();
            for (const [id, t] of this.incomingChunks.entries()) {
                if (now - t.startedAt > TRANSFER_TIMEOUT_MS) this.incomingChunks.delete(id);
            }
        }

        // 切断した相手の転送を破棄する
        _dropTransfersFrom(peerId) {
            for (const [id, t] of this.incomingChunks.entries()) {
                if (t.fromPeer === peerId) this.incomingChunks.delete(id);
            }
        }

        handleFileChunk(packet, fromPeerId) {
            if (!packet || typeof packet !== 'object') return;
            const { transferId, stage } = packet;
            if (typeof transferId !== 'string' || !TRANSFER_ID_RE.test(transferId)) return;
            this._pruneTransfers();

            if (stage === 'start') {
                const totalChunks = packet.totalChunks;
                if (!Number.isInteger(totalChunks) || totalChunks < 1 || totalChunks > MAX_CHUNKS) return;
                if (packet.totalBytes !== undefined) {
                    const tb = packet.totalBytes;
                    if (!Number.isInteger(tb) || tb < 1 || tb > MAX_FILE_BYTES || Math.ceil(tb / CHUNK_SIZE) !== totalChunks) return;
                }
                if (this.incomingChunks.has(transferId)) return;
                const metadata = sanitizeFileMetadata(packet.metadata);

                // 新しいライブトラックを受信した場合、未完了の古いライブトラック転送を破棄
                if (!metadata.isPlaylistItem) {
                    for (const [id, t] of this.incomingChunks.entries()) {
                        if (t && t.metadata && !t.metadata.isPlaylistItem) {
                            this.incomingChunks.delete(id);
                        }
                    }
                }

                if (this.incomingChunks.size >= MAX_CONCURRENT_TRANSFERS) return;
                this.incomingChunks.set(transferId, {
                    chunks: new Array(totalChunks),
                    receivedCount: 0,
                    totalChunks,
                    bytes: 0,
                    fromPeer: fromPeerId || null,
                    startedAt: Date.now(),
                    metadata,
                    endReceived: false
                });
                this.emit('file_progress', { pct: 0, transferId, metadata });
                return;
            }

            const transfer = this.incomingChunks.get(transferId);
            if (!transfer) return;
            if (transfer.fromPeer !== (fromPeerId || null)) return; // 開始した相手以外からは受け付けない

            if (stage === 'chunk') {
                const idx = packet.chunkIndex;
                if (!Number.isInteger(idx) || idx < 0 || idx >= transfer.totalChunks) return;
                if (transfer.chunks[idx]) return; // 重複したチャンクは無視(受信数を水増しできない)
                const chunk = toUint8(packet.data);
                if (!chunk || chunk.length === 0 || chunk.length > CHUNK_SIZE) return;
                transfer.bytes += chunk.length;
                if (transfer.bytes > MAX_FILE_BYTES) { this.incomingChunks.delete(transferId); return; }
                transfer.chunks[idx] = chunk;
                transfer.receivedCount++;
                const pct = Math.round((transfer.receivedCount / transfer.totalChunks) * 100);
                this.emit('file_progress', { pct, transferId, metadata: transfer.metadata });
            } else if (stage !== 'end') {
                return;
            }

            if (stage === 'end') {
                transfer.endReceived = true;
            }

            // 全チャンクが揃ったときだけ組み立てる('end' が最後のチャンクより先に届いても、揃うまで待つ)
            if (transfer.receivedCount >= transfer.totalChunks) {
                const merged = new Uint8Array(transfer.bytes);
                let offset = 0;
                for (const c of transfer.chunks) {
                    merged.set(c, offset);
                    offset += c.length;
                }
                this.incomingChunks.delete(transferId);
                this.emit('file_ready', { buffer: merged.buffer, metadata: transfer.metadata });
            }
        }

        // --- Broadcast & Direct Sending ---
        sendToPeer(peerId, data) {
            if (this.role === 'host') {
                const conn = this.connections.get(peerId);
                if (conn && conn.open) {
                    try { conn.send(data); } catch(e) { console.warn('[P2P] sendToPeer error:', e); }
                }
            } else if (this.role === 'listener' && this.hostConn && this.hostConn.open) {
                this.hostConn.send(data);
            }
        }

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
                // Keep signaling server connection alive if device woke from sleep
                if (this.peer && this.peer.disconnected && !this.peer.destroyed) {
                    try { this.peer.reconnect(); } catch(e){}
                }

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
            if (this.incomingChunks) this.incomingChunks.clear();
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
