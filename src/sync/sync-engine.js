/**
 * OST Player - Sync Engine (src/sync/sync-engine.js)
 * Synchronizes playback state, MIDI mixer params, and remote control events
 */

(function(global) {
    class SyncEngine {
        constructor(session, playerApi) {
            this.session = session;
            this.api = playerApi; // Interface to single mode audio player
            this.isRemoteControl = false; // If smartphone is acting as remote
            this.isAuxGranted = false; // If listener has DJ privileges
            this.lastSyncTimestamp = 0;
            this.isSyncingLocally = false;
            this.bufferReady = false;

            this.setupSessionListeners();
        }

        setupSessionListeners() {
            this.session.on('message', (msg, fromPeer) => {
                this.handleIncomingMessage(msg, fromPeer);
            });

            this.session.on('file_ready', ({ buffer, metadata }) => {
                this.handleIncomingFile(buffer, metadata);
            });

            this.session.on('reaction', (reaction) => {
                if (this.api && typeof this.api.triggerReactionEffect === 'function') {
                    this.api.triggerReactionEffect(reaction);
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
                    if (this.api && typeof this.api.setLoopMode === 'function') {
                        this.api.setLoopMode(msg.loopMode);
                    }
                    break;

                case 'sync_midi_params':
                    if (this.api && typeof this.api.applyMidiMixerParams === 'function') {
                        this.api.applyMidiMixerParams(msg.params);
                    }
                    break;

                case 'sync_remote_cmd':
                    // Host receives remote command from listener/phone
                    if (this.session.role === 'host' || this.isAuxGranted) {
                        this.executeRemoteCommand(msg);
                    }
                    break;

                case 'sync_aux_pass':
                    this.isAuxGranted = (msg.targetPeerId === this.session.myPeerId);
                    if (this.api && typeof this.api.notifyAuxStatus === 'function') {
                        this.api.notifyAuxStatus(this.isAuxGranted);
                    }
                    break;
            }
        }

        async handleIncomingFile(buffer, metadata) {
            if (!buffer || !this.api) return;
            this.bufferReady = true;

            const blob = new Blob([buffer], { type: metadata.mimeType || 'audio/mpeg' });
            const file = new File([blob], metadata.name || 'P2P_Track', { type: metadata.mimeType || 'audio/mpeg' });

            const trackObj = {
                name: metadata.name || 'P2P Track',
                artist: metadata.artist || 'DJ Room',
                album: metadata.album || 'Sync Session',
                tagTitle: metadata.tagTitle || metadata.name,
                isMidi: !!metadata.isMidi,
                file: file,
                blobUrl: URL.createObjectURL(blob),
                duration: metadata.duration || 0,
                gameLoop: metadata.gameLoop || null
            };

            this.isSyncingLocally = true;
            if (typeof this.api.loadTrackDirectly === 'function') {
                await this.api.loadTrackDirectly(trackObj);
            }
            this.isSyncingLocally = false;

            // Notify host that listener is ready
            this.session.broadcast({ type: 'sync_client_ready', peerId: this.session.myPeerId });
        }

        handleTrackChange(msg) {
            if (this.session.role === 'host') return; // Host is source of truth
            if (this.api && typeof this.api.displayIncomingTrackInfo === 'function') {
                this.api.displayIncomingTrackInfo(msg);
            }
        }

        handlePlaybackState(msg) {
            if (this.session.role === 'host') return;
            if (!this.api) return;

            const { isPlaying, currentTime, timestamp, playbackRate } = msg;
            const nowHostTime = Date.now() + this.session.clockOffset;
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

        executeRemoteCommand(msg) {
            if (!this.api) return;
            switch (msg.action) {
                case 'toggle_play':
                    if (typeof this.api.togglePlay === 'function') this.api.togglePlay();
                    break;
                case 'next_track':
                    if (typeof this.api.nextTrack === 'function') this.api.nextTrack();
                    break;
                case 'prev_track':
                    if (typeof this.api.prevTrack === 'function') this.api.prevTrack();
                    break;
                case 'seek':
                    if (typeof this.api.seekToPercent === 'function') this.api.seekToPercent(msg.percent);
                    break;
                case 'volume':
                    if (typeof this.api.setVolume === 'function') this.api.setVolume(msg.volume);
                    break;
            }
        }

        // --- Host Outgoing Broadcast Methods ---
        broadcastTrack(track, arrayBuffer) {
            if (!this.session || this.session.role !== 'host') return;
            if (!track) return;

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

            // 1. Send track metadata packet
            this.session.broadcast({
                type: 'sync_track',
                ...meta,
                timestamp: Date.now()
            });

            // 2. Stream arrayBuffer to connected listeners
            if (arrayBuffer) {
                this.session.sendFile(arrayBuffer, meta);
            }
        }

        broadcastPlayback(isPlaying, currentTime, playbackRate = 1.0) {
            if (!this.session || (this.session.role !== 'host' && !this.isAuxGranted)) return;
            if (this.isSyncingLocally) return;

            this.session.broadcast({
                type: 'sync_playback',
                isPlaying,
                currentTime,
                playbackRate,
                timestamp: Date.now()
            });
        }

        broadcastSeek(targetTime) {
            if (!this.session || (this.session.role !== 'host' && !this.isAuxGranted)) return;
            if (this.isSyncingLocally) return;

            this.session.broadcast({
                type: 'sync_seek',
                targetTime,
                timestamp: Date.now()
            });
        }

        broadcastLoopMode(loopMode) {
            if (!this.session || this.session.role !== 'host') return;
            this.session.broadcast({
                type: 'sync_loop_mode',
                loopMode
            });
        }

        broadcastMidiParams(params) {
            if (!this.session || this.session.role !== 'host') return;
            this.session.broadcast({
                type: 'sync_midi_params',
                params
            });
        }

        sendRemoteCommand(action, payload = {}) {
            if (!this.session || this.session.role !== 'listener') return;
            this.session.sendToHost({
                type: 'sync_remote_cmd',
                action,
                ...payload,
                timestamp: Date.now()
            });
        }
    }

    global.SyncEngine = SyncEngine;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = SyncEngine;
    }
})(typeof window !== 'undefined' ? window : globalThis);
