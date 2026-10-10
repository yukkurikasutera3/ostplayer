/**
 * OST Player - Sync Engine (src/sync/sync-engine.js)
 * Synchronizes playback state, MIDI mixer params, remote control events,
 * and high-speed Wi-Fi batch playlist transfers.
 */

(function(global) {
    class SyncEngine {
        constructor(session, playerApi) {
            this.session = session;
            this.api = playerApi; // Interface to player controller
            this.isRemoteControl = false; // If device is acting as a remote
            this.allowRemoteControl = true; // Host setting: accept remote control commands
            this.isAuxGranted = false; // If listener has DJ privileges
            this.auxPeerId = null; // Currently assigned AUX peer ID
            this.lastSyncTimestamp = 0;
            this.isSyncingLocally = false;
            this.bufferReady = false;
            this.pendingPlaybackState = null;

            // Playlist batch transfer state
            this.batchQueue = [];
            this.isBatchTransferring = false;
            this.batchTargetPeerId = null;
            this.batchPlaylistName = '';
            this.batchTotalCount = 0;
            this.batchCurrentIndex = 0;
            this.batchAckTimeout = null;

            // Track file resync rate limiting to prevent duplicate concurrent transfers on join
            this.recentClientSyncMap = new Map();

            // Callback listeners for UI controllers
            this.onRemoteStateUpdate = null;
            this.onPlaylistBatchProgress = null;

            this.setupSessionListeners();
        }

        setupSessionListeners() {
            this.session.on('message', (msg, fromPeer) => {
                this.handleIncomingMessage(msg, fromPeer);
            });

            this.session.on('file_ready', ({ buffer, metadata }) => {
                // Host does not accept files from listeners
                if (this.session.role === 'host') return;
                this.handleIncomingFile(buffer, metadata);
            });

            this.session.on('chat', (chatData) => {
                if (this.api && typeof this.api.handleIncomingChat === 'function') {
                    this.api.handleIncomingChat(chatData);
                }
            });

            this.session.on('request_queue', (queueData, fromPeer) => {
                if (this.api && typeof this.api.handleIncomingRequestQueue === 'function') {
                    this.api.handleIncomingRequestQueue(queueData, fromPeer);
                }
            });

            this.session.on('radar_stats', (radarData) => {
                if (this.api && typeof this.api.handleIncomingRadarStats === 'function') {
                    this.api.handleIncomingRadarStats(radarData);
                }
            });
        }

        handleIncomingMessage(msg, fromPeer) {
            if (!msg || !msg.type) return;

            switch (msg.type) {
                case 'sync_track':
                    this.handleTrackChange(msg);
                    break;

                case 'sync_playback':
                    this.handlePlaybackState(msg);
                    break;

                case 'sync_seek':
                    this.handleSeekState(msg);
                    break;

                case 'sync_loop_mode':
                    if (this.session.role !== 'listener') break;
                    if (this.api && typeof this.api.setLoopMode === 'function') {
                        this.api.setLoopMode(msg.loopMode);
                    }
                    break;

                case 'sync_midi_params':
                    if (this.session.role !== 'listener') break;
                    if (this.api && typeof this.api.applyMidiMixerParams === 'function') {
                        this.api.applyMidiMixerParams(msg.params);
                    }
                    break;

                case 'sync_client_ready':
                    // Listener is fully ready: Host sends current playback state immediately
                    if (this.session.role === 'host') {
                        const targetId = fromPeer || msg.peerId;
                        if (this.api && typeof this.api.resyncPlaybackStateOnly === 'function') {
                            this.api.resyncPlaybackStateOnly(targetId);
                        } else if (this.api && typeof this.api.resyncToNewClient === 'function') {
                            this.api.resyncToNewClient(targetId);
                        }
                    }
                    break;

                case 'sync_request_initial_state':
                    // Listener requests initial room state (members + current track)
                    if (this.session.role === 'host') {
                        const targetId = fromPeer || msg.peerId;
                        if (this.api && typeof this.api.broadcastMembersList === 'function') {
                            this.api.broadcastMembersList();
                        }
                        const lastSyncTime = this.recentClientSyncMap.get(targetId) || 0;
                        const now = Date.now();
                        if (now - lastSyncTime < 4000) {
                            // If track file was already sent to this peer recently (e.g. from peer_joined), only resync playback state
                            if (this.api && typeof this.api.resyncPlaybackStateOnly === 'function') {
                                this.api.resyncPlaybackStateOnly(targetId);
                            }
                        } else {
                            this.recentClientSyncMap.set(targetId, now);
                            if (this.api && typeof this.api.resyncToNewClient === 'function') {
                                this.api.resyncToNewClient(targetId);
                            }
                        }
                        // Also provide immediate remote status
                        this.broadcastRemoteStatus(targetId);
                    }
                    break;

                case 'sync_members_list':
                    if (this.session.role !== 'listener') break;
                    if (this.api && typeof this.api.applyMembersList === 'function') {
                        this.api.applyMembersList(msg.members, msg.totalCount);
                    }
                    break;

                case 'sync_remote_cmd':
                    // Host accepts command if AUX is held or if remote control is enabled
                    if (this.session.role === 'host') {
                        const isAuthorized = (fromPeer && fromPeer === this.auxPeerId) || this.allowRemoteControl || msg.isRemote;
                        if (isAuthorized) {
                            this.executeRemoteCommand(msg);
                        }
                    } else if (this.isAuxGranted) {
                        this.executeRemoteCommand(msg);
                    }
                    break;

                case 'sync_request_remote_status':
                    if (this.session.role === 'host') {
                        this.broadcastRemoteStatus(fromPeer);
                    }
                    break;

                case 'sync_remote_status':
                    // Smartphone / remote receiver updates its display
                    this.handleRemoteStatus(msg);
                    break;

                case 'sync_aux_pass':
                    if (this.session.role !== 'listener') break;
                    this.isAuxGranted = (msg.targetPeerId === this.session.myPeerId);
                    if (this.api && typeof this.api.notifyAuxStatus === 'function') {
                        this.api.notifyAuxStatus(this.isAuxGranted);
                    }
                    break;

                // --- Wi-Fi Batch Playlist Transfer Protocol ---
                case 'sync_playlist_batch_start':
                    if (this.session.role !== 'listener') break;
                    if (this.api && typeof this.api.handlePlaylistBatchStart === 'function') {
                        this.api.handlePlaylistBatchStart(msg);
                    }
                    if (typeof this.onPlaylistBatchProgress === 'function') {
                        this.onPlaylistBatchProgress({
                            status: 'start',
                            playlistName: msg.playlistName,
                            totalTracks: msg.totalTracks,
                            currentIndex: 0
                        });
                    }
                    break;

                case 'sync_playlist_item_ack':
                    if (this.session.role === 'host') {
                        this.handlePlaylistItemAck(msg);
                    }
                    break;

                case 'sync_playlist_batch_end':
                    if (this.session.role !== 'listener') break;
                    if (this.api && typeof this.api.handlePlaylistBatchEnd === 'function') {
                        this.api.handlePlaylistBatchEnd(msg);
                    }
                    if (typeof this.onPlaylistBatchProgress === 'function') {
                        this.onPlaylistBatchProgress({
                            status: 'complete',
                            playlistName: msg.playlistName,
                            totalTracks: msg.totalTracks,
                            currentIndex: msg.totalTracks
                        });
                    }
                    break;
            }
        }

        async handleIncomingFile(buffer, metadata) {
            if (!buffer || !this.api || this.session.role === 'host') return;
            metadata = metadata || {};

            const mimeType = metadata.mimeType || (metadata.isMidi ? 'audio/midi' : 'audio/mpeg');
            const blob = new Blob([buffer], { type: mimeType });
            const file = new File([blob], metadata.name || 'P2P_Track', { type: mimeType });

            const trackObj = {
                name: metadata.name || 'P2P Track',
                artist: metadata.artist || 'DJ Room',
                album: metadata.album || 'Sync Session',
                tagTitle: metadata.tagTitle || metadata.name,
                isMidi: !!metadata.isMidi,
                file: file,
                blob: blob,
                blobUrl: URL.createObjectURL(blob),
                arrayBuffer: buffer,
                duration: metadata.duration || 0,
                gameLoop: metadata.gameLoop || null
            };

            // Case A: Part of a batch playlist transfer
            if (metadata.isPlaylistItem === true) {
                if (typeof this.api.importPlaylistItem === 'function') {
                    await this.api.importPlaylistItem(trackObj, metadata);
                }
                // Send ACK back to host to request next file
                this.session.sendToHost({
                    type: 'sync_playlist_item_ack',
                    itemIndex: metadata.itemIndex,
                    trackName: metadata.name,
                    timestamp: Date.now()
                });
                if (typeof this.onPlaylistBatchProgress === 'function') {
                    this.onPlaylistBatchProgress({
                        status: 'progress',
                        playlistName: metadata.playlistName,
                        totalTracks: metadata.totalTracks,
                        currentIndex: (metadata.itemIndex || 0) + 1,
                        currentTrackName: metadata.name
                    });
                }
                return;
            }

            // Case B: Live DJ Track stream (immediate load & play)
            this.bufferReady = true;
            this.isSyncingLocally = true;
            if (typeof this.api.loadTrackDirectly === 'function') {
                await this.api.loadTrackDirectly(trackObj);
            }
            this.isSyncingLocally = false;

            // If a playback state arrived while downloading, apply it immediately
            if (this.pendingPlaybackState) {
                this.handlePlaybackState(this.pendingPlaybackState);
            }

            // Notify host that listener has loaded file and is ready for playback
            this.session.broadcast({ type: 'sync_client_ready', peerId: this.session.myPeerId });
        }

        handleTrackChange(msg) {
            if (this.session.role === 'host') return;
            if (this.api && typeof this.api.displayIncomingTrackInfo === 'function') {
                this.api.displayIncomingTrackInfo(msg);
            }
        }

        handlePlaybackState(msg) {
            if (this.session.role === 'host') return;
            this.pendingPlaybackState = msg;
            if (!this.api) return;

            const { isPlaying, currentTime, timestamp, playbackRate } = msg;
            const nowHostTime = Date.now() + (this.session.clockOffset || 0);
            const timeElapsedSec = Math.max(0, (nowHostTime - timestamp) / 1000) * (playbackRate || 1.0);
            const targetTime = currentTime + (isPlaying ? timeElapsedSec : 0);

            this.isSyncingLocally = true;
            if (typeof this.api.syncPlayPause === 'function') {
                this.api.syncPlayPause(isPlaying, targetTime);
            }
            this.isSyncingLocally = false;
        }

        handleSeekState(msg) {
            if (this.session.role === 'host') return;
            if (!this.api) return;

            const { targetTime } = msg;
            this.isSyncingLocally = true;
            if (typeof this.api.syncSeek === 'function') {
                this.api.syncSeek(targetTime);
            }
            this.isSyncingLocally = false;
        }

        // --- Wireless Remote Control: Status Updates ---
        handleRemoteStatus(msg) {
            if (typeof this.onRemoteStateUpdate === 'function') {
                this.onRemoteStateUpdate(msg);
            }
            if (this.api && typeof this.api.applyRemoteStatus === 'function') {
                this.api.applyRemoteStatus(msg);
            }
        }

        // Host: Broadcast full player state to remote(s)
        broadcastRemoteStatus(targetPeerId = null) {
            if (!this.session || this.session.role !== 'host') return;
            if (!this.api || typeof this.api.getCurrentPlaybackState !== 'function') return;

            const state = this.api.getCurrentPlaybackState();
            if (!state) return;

            const packet = {
                type: 'sync_remote_status',
                ...state,
                timestamp: Date.now()
            };

            if (targetPeerId) {
                this.session.sendToPeer(targetPeerId, packet);
            } else {
                this.session.broadcast(packet);
            }
        }

        // Host: Execute command sent from wireless remote
        executeRemoteCommand(msg) {
            if (!this.api) return;
            switch (msg.action) {
                case 'toggle_play':
                    if (typeof this.api.togglePlay === 'function') this.api.togglePlay();
                    break;
                case 'play':
                    if (typeof this.api.play === 'function') this.api.play();
                    break;
                case 'pause':
                    if (typeof this.api.pause === 'function') this.api.pause();
                    break;
                case 'next_track':
                    if (typeof this.api.nextTrack === 'function') this.api.nextTrack();
                    break;
                case 'prev_track':
                    if (typeof this.api.prevTrack === 'function') this.api.prevTrack();
                    break;
                case 'seek':
                    if (typeof this.api.seekToPercent === 'function' && Number.isFinite(Number(msg.percent))) {
                        this.api.seekToPercent(Math.min(100, Math.max(0, Number(msg.percent))));
                    }
                    break;
                case 'volume':
                    if (typeof this.api.setVolume === 'function' && Number.isFinite(Number(msg.volume))) {
                        let vol = Number(msg.volume);
                        if (vol > 1.0) vol = vol / 100;
                        this.api.setVolume(Math.min(1.0, Math.max(0, vol)));
                    }
                    break;
                case 'toggle_mute':
                    if (typeof this.api.toggleMute === 'function') this.api.toggleMute();
                    break;
                case 'toggle_loop':
                    if (typeof this.api.toggleLoopMode === 'function') this.api.toggleLoopMode();
                    break;
                case 'set_mode':
                    if (typeof this.api.setPlayerMode === 'function' && typeof msg.mode === 'string') {
                        this.api.setPlayerMode(msg.mode);
                    }
                    break;
                case 'select_track':
                    if (typeof this.api.selectTrackByIndex === 'function' && Number.isInteger(Number(msg.index))) {
                        this.api.selectTrackByIndex(Number(msg.index));
                    }
                    break;
            }

            // Immediately broadcast refreshed state back to remotes
            setTimeout(() => {
                this.broadcastRemoteStatus();
            }, 50);
        }

        // Listener: Send remote control command to host
        sendRemoteCommand(action, payload = {}) {
            if (!this.session || this.session.role !== 'listener') return;
            this.session.sendToHost({
                type: 'sync_remote_cmd',
                isRemote: true,
                action,
                ...payload,
                timestamp: Date.now()
            });
        }

        // Listener: Request immediate status from host
        requestRemoteStatus() {
            if (!this.session || this.session.role !== 'listener') return;
            this.session.sendToHost({
                type: 'sync_request_remote_status',
                timestamp: Date.now()
            });
        }

        // --- Wi-Fi Batch Playlist Transfer Methods ---
        async startPlaylistBatchTransfer(playlistName, trackList, targetPeerId = null) {
            if (!this.session || this.session.role !== 'host') return false;
            if (!trackList || trackList.length === 0) return false;
            if (this.isBatchTransferring) {
                console.warn('[SyncEngine] A playlist batch transfer is already in progress.');
                return false;
            }

            this.isBatchTransferring = true;
            this.batchQueue = [...trackList];
            this.batchPlaylistName = playlistName || 'Transferred Playlist';
            this.batchTotalCount = trackList.length;
            this.batchCurrentIndex = 0;
            this.batchTargetPeerId = targetPeerId;

            // 1. Send batch start packet
            const startPacket = {
                type: 'sync_playlist_batch_start',
                playlistName: this.batchPlaylistName,
                totalTracks: this.batchTotalCount,
                timestamp: Date.now()
            };

            if (targetPeerId) {
                this.session.sendToPeer(targetPeerId, startPacket);
            } else {
                this.session.broadcast(startPacket);
            }

            if (typeof this.onPlaylistBatchProgress === 'function') {
                this.onPlaylistBatchProgress({
                    status: 'start',
                    playlistName: this.batchPlaylistName,
                    totalTracks: this.batchTotalCount,
                    currentIndex: 0
                });
            }

            // 2. Start sending first item
            await this.sendNextBatchItem();
            return true;
        }

        async sendNextBatchItem() {
            if (!this.isBatchTransferring) return;
            if (this.batchCurrentIndex >= this.batchTotalCount || this.batchQueue.length === 0) {
                this.finishPlaylistBatchTransfer();
                return;
            }

            const currentTrack = this.batchQueue[this.batchCurrentIndex];
            if (!currentTrack) {
                this.batchCurrentIndex++;
                await this.sendNextBatchItem();
                return;
            }

            // Extract ArrayBuffer
            let arrayBuffer = currentTrack.arrayBuffer;
            if (!arrayBuffer && this.api && typeof this.api.getTrackBuffer === 'function') {
                try {
                    arrayBuffer = await this.api.getTrackBuffer(currentTrack);
                } catch (e) {
                    console.warn('[SyncEngine] Failed to get buffer for track:', currentTrack.name, e);
                }
            }

            if (!arrayBuffer && currentTrack.file && typeof currentTrack.file.arrayBuffer === 'function') {
                try {
                    arrayBuffer = await currentTrack.file.arrayBuffer();
                } catch (e) {
                    console.warn('[SyncEngine] Failed to read File arrayBuffer:', e);
                }
            }

            if (!arrayBuffer) {
                console.warn('[SyncEngine] Skipping unreadable track:', currentTrack.name);
                this.batchCurrentIndex++;
                await this.sendNextBatchItem();
                return;
            }

            const metadata = {
                name: currentTrack.name || 'Track',
                tagTitle: currentTrack.tagTitle || currentTrack.name || '',
                artist: currentTrack.artist || '',
                album: currentTrack.album || '',
                isMidi: !!currentTrack.isMidi,
                duration: currentTrack.duration || 0,
                gameLoop: currentTrack.gameLoop || null,
                mimeType: currentTrack.file ? currentTrack.file.type : (currentTrack.isMidi ? 'audio/midi' : 'audio/mpeg'),
                playlistName: this.batchPlaylistName,
                isPlaylistItem: true,
                itemIndex: this.batchCurrentIndex,
                totalTracks: this.batchTotalCount
            };

            if (typeof this.onPlaylistBatchProgress === 'function') {
                this.onPlaylistBatchProgress({
                    status: 'sending',
                    playlistName: this.batchPlaylistName,
                    totalTracks: this.batchTotalCount,
                    currentIndex: this.batchCurrentIndex + 1,
                    currentTrackName: metadata.name
                });
            }

            // Stream file chunked via P2P session
            await this.session.sendFile(arrayBuffer, metadata, this.batchTargetPeerId);

            // Safety timeout: if listener ACK is dropped/delayed, auto-advance to prevent stall
            if (this.batchAckTimeout) clearTimeout(this.batchAckTimeout);
            this.batchAckTimeout = setTimeout(async () => {
                if (this.isBatchTransferring) {
                    console.warn('[SyncEngine] ACK timeout for item', this.batchCurrentIndex, '- advancing to next track');
                    this.batchCurrentIndex++;
                    await this.sendNextBatchItem();
                }
            }, 15000);
        }

        async handlePlaylistItemAck(ack) {
            if (!this.isBatchTransferring) return;
            if (this.batchAckTimeout) {
                clearTimeout(this.batchAckTimeout);
                this.batchAckTimeout = null;
            }
            this.batchCurrentIndex++;

            if (typeof this.onPlaylistBatchProgress === 'function') {
                this.onPlaylistBatchProgress({
                    status: 'progress',
                    playlistName: this.batchPlaylistName,
                    totalTracks: this.batchTotalCount,
                    currentIndex: this.batchCurrentIndex,
                    currentTrackName: ack.trackName || ''
                });
            }

            // Yield slightly to prevent network starvation before starting next track
            setTimeout(async () => {
                await this.sendNextBatchItem();
            }, 60);
        }

        finishPlaylistBatchTransfer() {
            if (!this.isBatchTransferring) return;
            this.isBatchTransferring = false;
            if (this.batchAckTimeout) {
                clearTimeout(this.batchAckTimeout);
                this.batchAckTimeout = null;
            }

            const endPacket = {
                type: 'sync_playlist_batch_end',
                playlistName: this.batchPlaylistName,
                totalTracks: this.batchTotalCount,
                timestamp: Date.now()
            };

            if (this.batchTargetPeerId) {
                this.session.sendToPeer(this.batchTargetPeerId, endPacket);
            } else {
                this.session.broadcast(endPacket);
            }

            if (typeof this.onPlaylistBatchProgress === 'function') {
                this.onPlaylistBatchProgress({
                    status: 'complete',
                    playlistName: this.batchPlaylistName,
                    totalTracks: this.batchTotalCount,
                    currentIndex: this.batchTotalCount
                });
            }

            this.batchQueue = [];
            this.batchTargetPeerId = null;
        }

        cancelPlaylistTransfer() {
            this.isBatchTransferring = false;
            if (this.batchAckTimeout) {
                clearTimeout(this.batchAckTimeout);
                this.batchAckTimeout = null;
            }
            this.batchQueue = [];
            this.batchTargetPeerId = null;
            if (typeof this.onPlaylistBatchProgress === 'function') {
                this.onPlaylistBatchProgress({
                    status: 'cancelled',
                    playlistName: this.batchPlaylistName,
                    totalTracks: this.batchTotalCount,
                    currentIndex: this.batchCurrentIndex
                });
            }
        }

        // --- Host Outgoing Broadcast Methods (Live Sync) ---
        broadcastTrack(track, arrayBuffer, targetPeerId = null) {
            if (!this.session || this.session.role !== 'host') return;
            if (!track) return;

            // If no target peer and no listeners are connected, update remote status and return early
            if (!targetPeerId && (!this.session.connections || this.session.connections.size === 0)) {
                this.broadcastRemoteStatus();
                return;
            }

            const meta = {
                name: track.name,
                tagTitle: track.tagTitle || track.name,
                artist: track.artist || '',
                album: track.album || '',
                isMidi: !!track.isMidi,
                duration: track.duration || 0,
                gameLoop: track.gameLoop || null,
                mimeType: track.file ? track.file.type : 'audio/mpeg'
            };

            const trackPacket = {
                type: 'sync_track',
                ...meta,
                timestamp: Date.now()
            };

            if (targetPeerId) {
                this.session.sendToPeer(targetPeerId, trackPacket);
            } else {
                this.session.broadcast(trackPacket);
            }

            if (arrayBuffer) {
                this.session.sendFile(arrayBuffer, meta, targetPeerId);
            }

            // Keep remote control views refreshed
            this.broadcastRemoteStatus();
        }

        broadcastPlayback(isPlaying, currentTime, playbackRate = 1.0, targetPeerId = null) {
            if (!this.session || (this.session.role !== 'host' && !this.isAuxGranted)) return;
            if (this.isSyncingLocally) return;

            const packet = {
                type: 'sync_playback',
                isPlaying,
                currentTime,
                playbackRate,
                timestamp: Date.now()
            };

            if (targetPeerId) {
                this.session.sendToPeer(targetPeerId, packet);
            } else {
                this.session.broadcast(packet);
            }

            this.broadcastRemoteStatus();
        }

        broadcastSeek(targetTime) {
            if (!this.session || (this.session.role !== 'host' && !this.isAuxGranted)) return;
            if (this.isSyncingLocally) return;

            this.session.broadcast({
                type: 'sync_seek',
                targetTime,
                timestamp: Date.now()
            });

            this.broadcastRemoteStatus();
        }

        broadcastLoopMode(loopMode) {
            if (!this.session || this.session.role !== 'host') return;
            this.session.broadcast({
                type: 'sync_loop_mode',
                loopMode
            });

            this.broadcastRemoteStatus();
        }

        broadcastMidiParams(params) {
            if (!this.session || this.session.role !== 'host') return;
            this.session.broadcast({
                type: 'sync_midi_params',
                params
            });
        }

        requestInitialState() {
            if (!this.session || this.session.role !== 'listener') return;
            this.session.sendToHost({
                type: 'sync_request_initial_state',
                peerId: this.session.myPeerId,
                timestamp: Date.now()
            });
        }
    }

    global.SyncEngine = SyncEngine;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = SyncEngine;
    }
})(typeof window !== 'undefined' ? window : globalThis);
