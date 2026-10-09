/**
 * OST Player - P2P Sync & DJ Room UI Controller (src/sync/sync-ui-controller.js)
 * High-Precision WebRTC Playback Sync, Wireless Remote Control,
 * Wi-Fi Batch Playlist Transfer, Connection Manager & Live DJ Chat
 */

(function(global) {
    let p2pSession = null;
    let syncEngine = null;
    let currentMembers = new Map();
    let isDjAnnounceTickerTimer = null;
    let initialSyncTimeout = null;
    let currentSubTab = 'dj'; // 'dj' | 'remote' | 'transfer'
    let lastRemoteState = null;

    // --- Initialization ---
    function initSyncController() {
        if (typeof P2PSession === 'undefined' || typeof SyncEngine === 'undefined') {
            console.warn('[SyncUI] P2PSession or SyncEngine is not loaded.');
            return;
        }

        if (p2pSession) return; // Already initialized

        p2pSession = new P2PSession();

        // Define player API bridge
        const playerApi = {
            loadTrackDirectly: async (trackObj) => {
                console.log('[SyncEngine] Loading incoming P2P track:', trackObj.name);
                if (initialSyncTimeout) {
                    clearTimeout(initialSyncTimeout);
                    initialSyncTimeout = null;
                }
                if (typeof global.loadP2PTrack === 'function') {
                    await global.loadP2PTrack(trackObj);
                }
            },
            syncPlayPause: (isPlaying, targetTime) => {
                if (typeof global.applySyncPlayPause === 'function') {
                    global.applySyncPlayPause(isPlaying, targetTime);
                }
            },
            syncSeek: (targetTime) => {
                if (typeof global.applySyncSeek === 'function') {
                    global.applySyncSeek(targetTime);
                }
            },
            setLoopMode: (mode) => {
                if (typeof global.setLoopModeDirect === 'function') {
                    global.setLoopModeDirect(mode);
                }
            },
            applyMidiMixerParams: (params) => {
                if (typeof global.applyMidiParamsDirect === 'function') {
                    global.applyMidiParamsDirect(params);
                }
            },
            resyncToNewClient: (clientPeerId) => {
                // Host auto-syncs currently playing track to the newly joined peer
                if (typeof global.resyncCurrentTrackToPeer === 'function') {
                    global.resyncCurrentTrackToPeer(clientPeerId, false);
                }
            },
            resyncPlaybackStateOnly: (clientPeerId) => {
                // Host syncs current playback state only (client already has file)
                if (typeof global.resyncCurrentTrackToPeer === 'function') {
                    global.resyncCurrentTrackToPeer(clientPeerId, true);
                }
            },
            broadcastMembersList: () => {
                broadcastMembersList();
            },
            applyMembersList: (members, totalCount) => {
                applyMembersList(members, totalCount);
            },
            displayIncomingTrackInfo: (trackMeta) => {
                if (!trackMeta) return;
                console.log('[SyncUI] Incoming track:', trackMeta.name);
                if (typeof global.showNotification === 'function') {
                    global.showNotification(`[受信中] ${trackMeta.name}${trackMeta.isMidi ? ' (MIDI)' : ''}`);
                }
            },
            handleIncomingChat: (chatData) => {
                appendChatMessage(chatData);
                if (chatData.isAnnouncement) {
                    showDjTicker(chatData.text);
                }
            },
            handleIncomingRadarStats: (radarData) => {
                if (typeof updateRadarUI === 'function') {
                    updateRadarUI(radarData.stats);
                }
            },
            togglePlay: () => {
                if (typeof global.toggleSinglePlay === 'function') global.toggleSinglePlay();
            },
            play: () => {
                if (typeof global.playSingleDirect === 'function') global.playSingleDirect();
                else if (typeof global.toggleSinglePlay === 'function') global.toggleSinglePlay();
            },
            pause: () => {
                if (typeof global.pauseSingleDirect === 'function') global.pauseSingleDirect();
                else if (typeof global.toggleSinglePlay === 'function') global.toggleSinglePlay();
            },
            nextTrack: () => {
                if (typeof global.changeSingleTrack === 'function') global.changeSingleTrack(1);
            },
            prevTrack: () => {
                if (typeof global.changeSingleTrack === 'function') global.changeSingleTrack(-1);
            },
            seekToPercent: (pct) => {
                if (typeof global.seekSingle === 'function') global.seekSingle(pct);
            },
            setVolume: (vol) => {
                if (typeof global.updateSingleVolume === 'function') global.updateSingleVolume(vol);
            },
            toggleMute: () => {
                if (typeof global.toggleSingleMute === 'function') global.toggleSingleMute();
            },
            toggleLoopMode: () => {
                if (typeof global.toggleLoop === 'function') global.toggleLoop();
            },
            setPlayerMode: (mode) => {
                if (typeof global.setPlayerMode === 'function') global.setPlayerMode(mode);
            },
            selectTrackByIndex: (idx) => {
                if (typeof global.loadSingleTrackDirect === 'function') global.loadSingleTrackDirect(idx);
            },
            getCurrentPlaybackState: () => {
                if (typeof global.getCurrentPlayerStateForRemote === 'function') {
                    return global.getCurrentPlayerStateForRemote();
                }
                return null;
            },
            getTrackBuffer: async (track) => {
                if (typeof global.getTrackArrayBufferForTransfer === 'function') {
                    return await global.getTrackArrayBufferForTransfer(track);
                }
                return null;
            },
            importPlaylistItem: async (trackObj, meta) => {
                if (typeof global.importTransferredPlaylistItem === 'function') {
                    await global.importTransferredPlaylistItem(trackObj, meta);
                    if (typeof global.triggerAchievement === 'function') {
                        global.triggerAchievement('sync_playlist_transfer');
                    }
                }
            },
            handlePlaylistBatchStart: (msg) => {
                if (typeof global.notifyPlaylistBatchStart === 'function') {
                    global.notifyPlaylistBatchStart(msg);
                }
            },
            handlePlaylistBatchEnd: (msg) => {
                if (typeof global.notifyPlaylistBatchEnd === 'function') {
                    global.notifyPlaylistBatchEnd(msg);
                }
            },
            applyRemoteStatus: (msg) => {
                updateRemotePanelUI(msg);
            },
            notifyAuxStatus: (isGranted) => {
                if (isGranted) {
                    appendSystemChat('Host から DJ AUX (操作権限) が付与されました');
                    if (typeof global.showNotification === 'function') {
                        global.showNotification('[AUX] DJ 操作権限が付与されました');
                    }
                } else {
                    appendSystemChat('DJ AUX 権限が解除されました');
                }
            }
        };

        syncEngine = new SyncEngine(p2pSession, playerApi);

        // Bind callbacks to SyncEngine
        syncEngine.onRemoteStateUpdate = (state) => {
            updateRemotePanelUI(state);
        };

        syncEngine.onPlaylistBatchProgress = (prog) => {
            updateBatchProgressUI(prog);
        };

        global.p2pSession = p2pSession;
        global.syncEngine = syncEngine;

        setupSessionEvents();
    }

    function setupSessionEvents() {
        if (!p2pSession) return;

        p2pSession.on('status', (info) => {
            updateStatusUI(info);

            // Listener: When connection to host opens, request initial room state immediately
            if (info && info.status === 'connected' && p2pSession.role === 'listener') {
                if (syncEngine) {
                    syncEngine.requestInitialState();
                    syncEngine.requestRemoteStatus();
                }
                if (initialSyncTimeout) clearTimeout(initialSyncTimeout);
                initialSyncTimeout = setTimeout(() => {
                    if (p2pSession && p2pSession.role === 'listener' && syncEngine && !syncEngine.bufferReady) {
                        console.log('[SyncUI] Retrying initial state request to host...');
                        syncEngine.requestInitialState();
                        syncEngine.requestRemoteStatus();
                    }
                }, 3000);
            }

            // Host: When room is ready, establish member list
            if (info && info.status === 'host_ready') {
                broadcastMembersList();
                if (typeof refreshTransferPlaylistOptions === 'function') {
                    refreshTransferPlaylistOptions();
                }
            }
        });

        p2pSession.on('peer_joined', ({ peerId, count }) => {
            appendSystemChat(`参加者 (ID: ...${peerId.slice(-4)}) が接続しました`);
            broadcastMembersList();
            if (typeof global.triggerAchievement === 'function') {
                global.triggerAchievement('sync_group_session');
            }

            // Host resyncs current track after a brief DataChannel settling delay (250ms)
            setTimeout(() => {
                if (p2pSession && p2pSession.role === 'host' && typeof global.resyncCurrentTrackToPeer === 'function') {
                    global.resyncCurrentTrackToPeer(peerId);
                }
                if (syncEngine) {
                    syncEngine.broadcastRemoteStatus(peerId);
                }
            }, 250);
        });

        p2pSession.on('peer_left', ({ peerId, count }) => {
            appendSystemChat(`参加者 (ID: ...${peerId.slice(-4)}) が切断しました`);
            if (syncEngine && syncEngine.auxPeerId === peerId) {
                syncEngine.auxPeerId = null;
            }
            if (p2pSession && p2pSession.role === 'host') {
                broadcastMembersList();
            }
        });

        p2pSession.on('latency_update', ({ rtt, latency, clockOffset }) => {
            const badge = document.getElementById('sync-latency-badge');
            if (badge) {
                badge.textContent = `Ping: ${Math.round(rtt)}ms | Offset: ${clockOffset >= 0 ? '+' : ''}${Math.round(clockOffset)}ms`;
            }
            const pingVal = document.getElementById('sync-radar-ping-val');
            if (pingVal) {
                pingVal.textContent = `${Math.round(rtt)} ms`;
            }
            const remotePingVal = document.getElementById('remote-ping-val');
            if (remotePingVal) {
                remotePingVal.textContent = `${Math.round(rtt)}ms`;
            }
        });

        p2pSession.on('file_progress', ({ pct, metadata }) => {
            if (metadata && metadata.isPlaylistItem) {
                // Batch progress handled separately in updateBatchProgressUI
                return;
            }

            if (initialSyncTimeout) {
                clearTimeout(initialSyncTimeout);
                initialSyncTimeout = null;
            }
            const container = document.getElementById('sync-file-progress-container');
            const bar = document.getElementById('sync-file-progress-bar');
            const pctLabel = document.getElementById('sync-file-progress-pct');
            const label = document.getElementById('sync-file-progress-label');

            if (container && bar && pctLabel) {
                container.classList.remove('hidden');
                bar.style.width = pct + '%';
                pctLabel.textContent = pct + '%';
                if (label && metadata && metadata.name) {
                    label.textContent = `楽曲データ受信中: ${metadata.name}`;
                }
            }
        });

        p2pSession.on('file_ready', ({ metadata }) => {
            if (metadata && metadata.isPlaylistItem) return;

            if (initialSyncTimeout) {
                clearTimeout(initialSyncTimeout);
                initialSyncTimeout = null;
            }
            const container = document.getElementById('sync-file-progress-container');
            if (container) {
                setTimeout(() => container.classList.add('hidden'), 1200);
            }
            appendSystemChat(`楽曲データ受信完了: ${metadata.name || 'Track'}`);
        });
    }

    function copyGeneratedCode() {
        const codeEl = document.getElementById('sync-generated-code');
        if (!codeEl) return;
        const code = codeEl.textContent.trim();
        if (code && code !== '------') {
            navigator.clipboard.writeText(code).then(() => {
                if (typeof global.showNotification === 'function') {
                    global.showNotification(`[コピー完了] ルームコード: ${code}`);
                }
            }).catch(() => {
                if (typeof global.showNotification === 'function') {
                    global.showNotification(`コード: ${code}`);
                }
            });
        }
    }

    async function startHostRoom() {
        initSyncController();
        if (!p2pSession) return;

        const btn = document.getElementById('sync-create-room-btn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'ルーム開設中...';
        }

        try {
            const result = await p2pSession.createRoom();
            const roomCode = (result && typeof result === 'object' && result.roomCode)
                ? result.roomCode
                : (result ? String(result) : (p2pSession.roomCode || ''));
            const peerId = (result && typeof result === 'object' && result.peerId)
                ? result.peerId
                : (p2pSession.myPeerId || '');
            const codeEl = document.getElementById('sync-generated-code');
            const activeCodeEl = document.getElementById('sync-active-room-code');
            const roleBadge = document.getElementById('sync-active-role-badge');

            if (codeEl) codeEl.textContent = roomCode;
            if (activeCodeEl) activeCodeEl.textContent = roomCode;
            if (roleBadge) {
                roleBadge.textContent = '[Host]';
                roleBadge.className = 'text-[9px] px-2 py-0.5 rounded-full font-bold bg-emerald-950 text-emerald-300 border border-emerald-700 font-mono';
            }

            document.getElementById('sync-setup-view')?.classList.add('hidden');
            document.getElementById('sync-active-view')?.classList.remove('hidden');

            appendSystemChat(`DJ Room を開設しました (コード: ${roomCode})`);
            showDjTicker(`DJ Room 開設完了: コード ${roomCode}`);

            if (typeof refreshTransferPlaylistOptions === 'function') {
                refreshTransferPlaylistOptions();
            }

            if (typeof global.triggerAchievement === 'function') {
                global.triggerAchievement('sync_dj_room');
            }
        } catch (err) {
            console.error('[SyncUI] Failed to create room:', err);
            if (typeof global.showNotification === 'function') {
                global.showNotification('[エラー] ルーム開設に失敗しました');
            }
            const statusEl = document.getElementById('sync-setup-status');
            if (statusEl) {
                statusEl.textContent = '接続エラー: ' + (err.message || '通信タイムアウト');
                statusEl.classList.remove('hidden');
            }
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'ルームを開設 (Host)';
            }
        }
    }

    async function joinListenerRoom() {
        initSyncController();
        if (!p2pSession) return;

        const input = document.getElementById('sync-join-code-input');
        if (!input) return;
        let code = input.value.trim();
        // 全角数字を半角に変換し、数字のみ抽出
        code = code.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)).replace(/\D/g, '').slice(0, 6);
        input.value = code;

        if (!/^\d{6}$/.test(code)) {
            if (typeof global.showNotification === 'function') {
                global.showNotification('[警告] 6桁の数字コードを入力してください');
            }
            input.focus();
            return;
        }

        const btn = document.getElementById('sync-join-room-btn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = '接続中...';
        }

        try {
            await p2pSession.joinRoom(code);
            const activeCodeEl = document.getElementById('sync-active-room-code');
            const roleBadge = document.getElementById('sync-active-role-badge');

            if (activeCodeEl) activeCodeEl.textContent = code;
            if (roleBadge) {
                roleBadge.textContent = '[Listener]';
                roleBadge.className = 'text-[9px] px-2 py-0.5 rounded-full font-bold bg-cyan-950 text-cyan-300 border border-cyan-700 font-mono';
            }

            document.getElementById('sync-setup-view')?.classList.add('hidden');
            document.getElementById('sync-active-view')?.classList.remove('hidden');

            appendSystemChat(`DJ Room (${code}) に参加しました`);
            showDjTicker(`DJ Room (${code}) に接続`);

            if (typeof global.triggerAchievement === 'function') {
                global.triggerAchievement('sync_dj_room');
            }
        } catch (err) {
            console.error('[SyncUI] Failed to join room:', err);
            if (typeof global.showNotification === 'function') {
                global.showNotification('[エラー] ルーム接続に失敗しました');
            }
            const statusEl = document.getElementById('sync-setup-status');
            if (statusEl) {
                statusEl.textContent = '接続失敗: コードが正しいか確認してください';
                statusEl.classList.remove('hidden');
            }
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'ルームに参加 (Listener)';
            }
        }
    }

    function leaveSyncSession() {
        if (syncEngine && syncEngine.isBatchTransferring) {
            syncEngine.cancelPlaylistTransfer();
        }
        if (p2pSession) {
            p2pSession.close();
        }
        currentMembers.clear();

        document.getElementById('sync-active-view')?.classList.add('hidden');
        document.getElementById('sync-setup-view')?.classList.remove('hidden');
        const statusEl = document.getElementById('sync-setup-status');
        if (statusEl) statusEl.classList.add('hidden');

        if (typeof global.showNotification === 'function') {
            global.showNotification('[通知] セッションから切断しました');
        }
    }

    function updateStatusUI(info) {
        if (!info) return;
        const statusEl = document.getElementById('sync-setup-status');

        if (info.status === 'disconnected') {
            leaveSyncSession();
            if (typeof global.showNotification === 'function') {
                global.showNotification('[切断] ホストとの接続が切断されました: ' + (info.reason || '通信終了'));
            }
            if (statusEl) {
                statusEl.textContent = '切断されました: ' + (info.reason || '通信終了');
                statusEl.classList.remove('hidden');
            }
            return;
        }

        if (!statusEl) return;

        if (info.status === 'connecting') {
            statusEl.textContent = 'P2P 接続を確立中...';
            statusEl.classList.remove('hidden');
        } else if (info.status === 'error') {
            statusEl.textContent = 'エラー: ' + (info.error || '通信エラー');
            statusEl.classList.remove('hidden');
        }
    }

    function broadcastMembersList() {
        if (!p2pSession || p2pSession.role !== 'host') return;
        const membersList = [];

        // 1. Host entry
        membersList.push({
            peerId: p2pSession.myPeerId,
            name: 'DJ Host',
            isHost: true,
            isAux: false
        });

        // 2. Active connected peers
        for (const [peerId, conn] of p2pSession.connections.entries()) {
            if (conn.open) {
                const isAux = (syncEngine && syncEngine.auxPeerId === peerId);
                membersList.push({
                    peerId: peerId,
                    name: 'User-' + peerId.slice(-4),
                    isHost: false,
                    isAux: isAux
                });
            }
        }

        // Apply locally to host UI
        applyMembersList(membersList, membersList.length);

        // Broadcast to all peers
        p2pSession.broadcast({
            type: 'sync_members_list',
            members: membersList,
            totalCount: membersList.length
        });
    }

    function applyMembersList(membersList, totalCount) {
        currentMembers.clear();
        if (Array.isArray(membersList)) {
            membersList.forEach(m => currentMembers.set(m.peerId, m));
        }

        const countBadge = document.getElementById('sync-members-count');
        if (countBadge) {
            countBadge.textContent = totalCount || currentMembers.size || 1;
        }

        const remoteCountBadge = document.getElementById('remote-members-count');
        if (remoteCountBadge) {
            remoteCountBadge.textContent = totalCount || currentMembers.size || 1;
        }

        updateMembersUI();
    }

    function updateMembersUI() {
        const listEl = document.getElementById('sync-members-list');
        if (!listEl) return;

        listEl.innerHTML = '';
        const myPeerId = p2pSession ? p2pSession.myPeerId : null;
        const isHost = p2pSession && p2pSession.role === 'host';

        for (const [peerId, m] of currentMembers.entries()) {
            const isMe = (peerId === myPeerId);
            const item = document.createElement('div');
            item.className = 'flex items-center justify-between bg-gray-900/70 px-2.5 py-1.5 rounded-lg border border-gray-800 text-[11px]';

            let dotClass = 'bg-gray-400';
            let roleBadge = 'Listener';
            let roleBadgeClass = 'text-gray-400';

            if (m.isHost) {
                dotClass = 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]';
                roleBadge = 'DJ Host';
                roleBadgeClass = 'text-emerald-400 font-bold';
            } else if (m.isAux) {
                dotClass = 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]';
                roleBadge = 'AUX DJ';
                roleBadgeClass = 'text-amber-400 font-bold';
            } else if (isMe) {
                dotClass = 'bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.8)]';
                roleBadge = 'Listener';
                roleBadgeClass = 'text-cyan-400 font-bold';
            }

            const displayName = isMe ? `あなた (${m.isHost ? 'DJ Host' : m.peerId.slice(-4)})` : (m.isHost ? 'DJ Host' : m.name);

            item.innerHTML = `
                <div class="flex items-center space-x-2 min-w-0">
                    <span class="w-2 h-2 rounded-full shrink-0 ${dotClass}"></span>
                    <span class="font-mono text-gray-200 truncate">${escapeHtml(displayName)}</span>
                </div>
                <div class="flex items-center space-x-2 shrink-0">
                    <span class="text-[9px] font-mono ${roleBadgeClass}">${roleBadge}</span>
                    <span class="aux-slot"></span>
                </div>
            `;
            if (isHost && !m.isHost) {
                const auxBtn = document.createElement('button');
                auxBtn.type = 'button';
                auxBtn.className = 'text-[9px] px-1.5 py-0.5 rounded ' + (m.isAux ? 'bg-amber-900/80 text-amber-200 border border-amber-600' : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700') + ' transition cursor-pointer';
                auxBtn.textContent = m.isAux ? 'AUX解除' : 'AUX';
                const targetId = m.peerId;
                auxBtn.addEventListener('click', () => toggleAuxPass(targetId));
                item.querySelector('.aux-slot').appendChild(auxBtn);
            }
            listEl.appendChild(item);
        }
    }

    function requestResyncFromHost() {
        if (!p2pSession || !p2pSession.role) return;
        if (p2pSession.role === 'listener') {
            if (syncEngine) {
                syncEngine.requestInitialState();
                syncEngine.requestRemoteStatus();
                if (typeof global.showNotification === 'function') {
                    global.showNotification('[同期要求] Hostへ楽曲再送をリクエストしました');
                }
            }
        } else if (p2pSession.role === 'host') {
            broadcastMembersList();
            if (typeof global.resyncCurrentTrackToPeer === 'function') {
                global.resyncCurrentTrackToPeer(null);
                if (typeof global.showNotification === 'function') {
                    global.showNotification('[配信] 全参加者へ楽曲データを再配信しました');
                }
            }
        }
    }

    // --- Sub-Tab Switching (DJ Room / Remote Control / Wi-Fi Transfer) ---
    function switchSyncSubTab(tabName) {
        currentSubTab = tabName;

        const tabs = ['dj', 'remote', 'transfer'];
        tabs.forEach(t => {
            const btn = document.getElementById(`sync-subtab-${t}-btn`);
            const view = document.getElementById(`sync-subview-${t}`);
            if (btn) {
                if (t === tabName) {
                    btn.classList.add('bg-emerald-600', 'text-white', 'border-emerald-400');
                    btn.classList.remove('bg-gray-900', 'text-gray-400', 'border-gray-800');
                } else {
                    btn.classList.remove('bg-emerald-600', 'text-white', 'border-emerald-400');
                    btn.classList.add('bg-gray-900', 'text-gray-400', 'border-gray-800');
                }
            }
            if (view) {
                if (t === tabName) view.classList.remove('hidden');
                else view.classList.add('hidden');
            }
        });

        if (tabName === 'remote') {
            if (typeof global.triggerAchievement === 'function') {
                global.triggerAchievement('sync_remote_control');
            }
            if (p2pSession && p2pSession.role === 'listener' && syncEngine) {
                syncEngine.requestRemoteStatus();
            } else if (p2pSession && p2pSession.role === 'host' && syncEngine) {
                syncEngine.broadcastRemoteStatus();
            }
        } else if (tabName === 'transfer') {
            if (p2pSession && p2pSession.role === 'host') {
                refreshTransferPlaylistOptions();
            }
        }
    }

    // --- Wireless Remote Control UI Management ---
    function updateRemotePanelUI(state) {
        if (!state) return;
        lastRemoteState = state;

        const titleEl = document.getElementById('remote-track-title');
        const artistEl = document.getElementById('remote-track-artist');
        const albumEl = document.getElementById('remote-track-album');
        const coverEl = document.getElementById('remote-track-cover');
        const playBtn = document.getElementById('remote-play-toggle-btn');
        const loopBtn = document.getElementById('remote-loop-mode-btn');
        const timeCurEl = document.getElementById('remote-time-current');
        const timeTotEl = document.getElementById('remote-time-total');
        const seekSlider = document.getElementById('remote-seek-slider');
        const volSlider = document.getElementById('remote-volume-slider');

        if (titleEl) titleEl.textContent = state.title || '再生停止中';
        if (artistEl) artistEl.textContent = state.artist || 'OST Player';
        if (albumEl) albumEl.textContent = state.album || '';

        if (coverEl) {
            if (state.coverUrl) {
                coverEl.src = state.coverUrl;
                coverEl.classList.remove('hidden');
            } else {
                coverEl.src = '';
                coverEl.classList.add('hidden');
            }
        }

        if (playBtn) {
            playBtn.textContent = state.isPlaying ? '一時停止 [Pause]' : '再生 [Play]';
            if (state.isPlaying) {
                playBtn.className = 'flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm rounded-xl transition shadow-lg active:scale-95 cursor-pointer';
            } else {
                playBtn.className = 'flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl transition shadow-lg active:scale-95 cursor-pointer';
            }
        }

        const loopNames = ['Loop: Off', 'Loop: All', 'Loop: 1', 'Loop: Game'];
        if (loopBtn && Number.isInteger(state.loopMode)) {
            loopBtn.textContent = loopNames[state.loopMode] || 'Loop: Off';
        }

        const formatTime = (sec) => {
            if (!sec || isNaN(sec) || sec < 0) return '00:00';
            const m = Math.floor(sec / 60);
            const s = Math.floor(sec % 60);
            return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
        };

        if (timeCurEl) timeCurEl.textContent = formatTime(state.currentTime);
        if (timeTotEl) timeTotEl.textContent = formatTime(state.duration);

        if (seekSlider && state.duration > 0 && !seekSlider.dataset.isDragging) {
            const pct = Math.min(100, Math.max(0, (state.currentTime / state.duration) * 100));
            seekSlider.value = pct;
        }

        if (volSlider && Number.isFinite(state.volume) && !volSlider.dataset.isDragging) {
            volSlider.value = Math.round(state.volume * 100);
        }

        // Update mode toggle buttons
        if (state.playerMode) {
            const modeBtns = document.querySelectorAll('.remote-mode-select-btn');
            modeBtns.forEach(btn => {
                if (btn.dataset.mode === state.playerMode) {
                    btn.classList.add('bg-emerald-600', 'text-white', 'border-emerald-400');
                    btn.classList.remove('bg-gray-900', 'text-gray-400', 'border-gray-800');
                } else {
                    btn.classList.remove('bg-emerald-600', 'text-white', 'border-emerald-400');
                    btn.classList.add('bg-gray-900', 'text-gray-400', 'border-gray-800');
                }
            });
        }

        // Render Quick Track Browser list
        if (Array.isArray(state.playlistSummary)) {
            renderRemotePlaylistQuickList(state.playlistSummary, state.currentIndex);
        }
    }

    function renderRemotePlaylistQuickList(list, currentIdx) {
        const container = document.getElementById('remote-playlist-quick-list');
        if (!container) return;

        container.innerHTML = '';
        if (list.length === 0) {
            container.innerHTML = '<div class="text-gray-500 text-[10px] text-center py-2">プレイリストが空です</div>';
            return;
        }

        list.forEach((track, idx) => {
            const item = document.createElement('div');
            const isPlayingThis = (idx === currentIdx);
            item.className = `flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition ${isPlayingThis ? 'bg-emerald-950/80 border border-emerald-600/70 text-emerald-200' : 'bg-gray-900/60 hover:bg-gray-800/80 border border-gray-800/60 text-gray-300'}`;
            item.innerHTML = `
                <div class="flex items-center space-x-2 truncate">
                    <span class="font-mono text-[10px] ${isPlayingThis ? 'text-emerald-400 font-bold' : 'text-gray-500'}">${idx + 1}.</span>
                    <span class="truncate font-medium">${escapeHtml(track.name)}</span>
                </div>
                <div class="shrink-0 flex items-center space-x-1">
                    ${track.isMidi ? '<span class="text-[9px] bg-purple-950 text-purple-300 border border-purple-800 px-1 rounded font-mono">MIDI</span>' : ''}
                    ${isPlayingThis ? '<span class="text-[9px] bg-emerald-900 text-emerald-300 border border-emerald-700 px-1 rounded font-mono">[再生中]</span>' : ''}
                </div>
            `;
            item.addEventListener('click', () => {
                sendRemoteCommand('select_track', { index: idx });
                if (window.MobileBridge && window.MobileBridge.hapticFeedback) {
                    window.MobileBridge.hapticFeedback('medium');
                }
            });
            container.appendChild(item);
        });
    }

    // Remote Command Dispatchers (called by UI buttons)
    function sendRemoteCommand(action, payload = {}) {
        if (!syncEngine) return;
        syncEngine.sendRemoteCommand(action, payload);
        if (typeof global.triggerAchievement === 'function') {
            global.triggerAchievement('sync_remote_control');
        }
    }

    function sendRemotePlayToggle() {
        sendRemoteCommand('toggle_play');
        if (window.MobileBridge && window.MobileBridge.hapticFeedback) {
            window.MobileBridge.hapticFeedback('light');
        }
    }

    function sendRemotePrev() {
        sendRemoteCommand('prev_track');
        if (window.MobileBridge && window.MobileBridge.hapticFeedback) {
            window.MobileBridge.hapticFeedback('medium');
        }
    }

    function sendRemoteNext() {
        sendRemoteCommand('next_track');
        if (window.MobileBridge && window.MobileBridge.hapticFeedback) {
            window.MobileBridge.hapticFeedback('medium');
        }
    }

    let remoteSeekThrottleTimer = null;
    function sendRemoteSeek(pct) {
        if (remoteSeekThrottleTimer) clearTimeout(remoteSeekThrottleTimer);
        remoteSeekThrottleTimer = setTimeout(() => {
            sendRemoteCommand('seek', { percent: Number(pct) });
            remoteSeekThrottleTimer = null;
        }, 60);
    }

    function sendRemoteSeekImmediate(pct) {
        if (remoteSeekThrottleTimer) {
            clearTimeout(remoteSeekThrottleTimer);
            remoteSeekThrottleTimer = null;
        }
        sendRemoteCommand('seek', { percent: Number(pct) });
    }

    let remoteVolumeThrottleTimer = null;
    function sendRemoteVolume(volPct) {
        if (remoteVolumeThrottleTimer) clearTimeout(remoteVolumeThrottleTimer);
        remoteVolumeThrottleTimer = setTimeout(() => {
            sendRemoteCommand('volume', { volume: Number(volPct) / 100 });
            remoteVolumeThrottleTimer = null;
        }, 50);
    }

    function sendRemoteVolumeImmediate(volPct) {
        if (remoteVolumeThrottleTimer) {
            clearTimeout(remoteVolumeThrottleTimer);
            remoteVolumeThrottleTimer = null;
        }
        sendRemoteCommand('volume', { volume: Number(volPct) / 100 });
    }

    function sendRemoteLoop() {
        sendRemoteCommand('toggle_loop');
        if (window.MobileBridge && window.MobileBridge.hapticFeedback) {
            window.MobileBridge.hapticFeedback('light');
        }
    }

    function sendRemoteMode(mode) {
        sendRemoteCommand('set_mode', { mode });
        if (window.MobileBridge && window.MobileBridge.hapticFeedback) {
            window.MobileBridge.hapticFeedback('light');
        }
    }

    // --- Wi-Fi Batch Playlist Transfer UI Management ---
    function refreshTransferPlaylistOptions() {
        const select = document.getElementById('sync-transfer-playlist-select');
        if (!select) return;

        select.innerHTML = '';
        const allOption = document.createElement('option');
        allOption.value = '__ALL__';
        allOption.textContent = 'すべての楽曲 (All Tracks)';
        select.appendChild(allOption);

        if (typeof global.getAvailablePlaylistsList === 'function') {
            const list = global.getAvailablePlaylistsList();
            if (Array.isArray(list)) {
                list.forEach(plName => {
                    if (plName && plName !== 'All Tracks') {
                        const opt = document.createElement('option');
                        opt.value = plName;
                        opt.textContent = `プレイリスト: ${plName}`;
                        select.appendChild(opt);
                    }
                });
            }
        }
    }

    async function startPlaylistTransferFromUI() {
        if (!syncEngine || !p2pSession || p2pSession.role !== 'host') {
            if (typeof global.showNotification === 'function') {
                global.showNotification('[エラー] ホスト端末からのみ転送を開始できます');
            }
            return;
        }

        const select = document.getElementById('sync-transfer-playlist-select');
        const selectedVal = select ? select.value : '__ALL__';

        if (typeof global.getTracksForPlaylistTransfer !== 'function') {
            console.warn('[SyncUI] getTracksForPlaylistTransfer is missing');
            return;
        }

        const tracks = global.getTracksForPlaylistTransfer(selectedVal);
        if (!tracks || tracks.length === 0) {
            if (typeof global.showNotification === 'function') {
                global.showNotification('[通知] 転送対象の楽曲がありません');
            }
            return;
        }

        const playlistName = (selectedVal === '__ALL__') ? 'All Tracks' : selectedVal;
        const btn = document.getElementById('sync-start-transfer-btn');
        if (btn) btn.disabled = true;

        const success = await syncEngine.startPlaylistBatchTransfer(playlistName, tracks);
        if (success && typeof global.triggerAchievement === 'function') {
            global.triggerAchievement('sync_playlist_transfer');
        }
        if (!success && btn) {
            btn.disabled = false;
        }
    }

    function cancelPlaylistTransferFromUI() {
        if (syncEngine) {
            syncEngine.cancelPlaylistTransfer();
            const btn = document.getElementById('sync-start-transfer-btn');
            if (btn) btn.disabled = false;
        }
    }

    function updateBatchProgressUI(prog) {
        if (!prog) return;

        const container = document.getElementById('sync-transfer-progress-card');
        const label = document.getElementById('sync-transfer-progress-label');
        const bar = document.getElementById('sync-transfer-progress-bar');
        const pctEl = document.getElementById('sync-transfer-progress-pct');
        const countEl = document.getElementById('sync-transfer-progress-count');
        const cancelBtn = document.getElementById('sync-cancel-transfer-btn');

        if (!container) return;

        if (prog.status === 'start' || prog.status === 'sending' || prog.status === 'progress') {
            container.classList.remove('hidden');
            const total = prog.totalTracks || 1;
            const current = prog.currentIndex || 0;
            const pct = Math.min(100, Math.round((current / total) * 100));

            if (bar) bar.style.width = pct + '%';
            if (pctEl) pctEl.textContent = pct + '%';
            if (countEl) countEl.textContent = `${current} / ${total} 曲`;
            if (label) {
                const prefix = (p2pSession && p2pSession.role === 'host') ? '一括送信中: ' : '一括受信中: ';
                label.textContent = `${prefix}${prog.currentTrackName || prog.playlistName || '楽曲'}`;
            }
            if (cancelBtn) {
                if (p2pSession && p2pSession.role === 'host') cancelBtn.classList.remove('hidden');
                else cancelBtn.classList.add('hidden');
            }
        } else if (prog.status === 'complete') {
            if (bar) bar.style.width = '100%';
            if (pctEl) pctEl.textContent = '100%';
            if (label) label.textContent = `[完了] プレイリスト '${prog.playlistName}' (${prog.totalTracks}曲) 転送完了`;
            if (typeof global.showNotification === 'function') {
                global.showNotification(`[転送完了] プレイリスト '${prog.playlistName}' (${prog.totalTracks}曲) の転送が完了しました`);
            }
            const startBtn = document.getElementById('sync-start-transfer-btn');
            if (startBtn) startBtn.disabled = false;
            setTimeout(() => {
                container.classList.add('hidden');
            }, 3000);
        } else if (prog.status === 'cancelled') {
            if (label) label.textContent = '[中止] 転送がキャンセルされました';
            const startBtn = document.getElementById('sync-start-transfer-btn');
            if (startBtn) startBtn.disabled = false;
            setTimeout(() => {
                container.classList.add('hidden');
            }, 2000);
        }
    }

    // --- DJ Chat & Announce ---
    function sendSyncChat() {
        const input = document.getElementById('sync-chat-input');
        if (!input) return;
        const text = input.value.trim();
        if (!text) return;

        const isAnnounce = document.getElementById('sync-is-announce-chk')?.checked;

        if (p2pSession) {
            p2pSession.sendChatMessage(text, isAnnounce);
            input.value = '';
            const chk = document.getElementById('sync-is-announce-chk');
            if (chk) chk.checked = false;

            if (typeof global.triggerAchievement === 'function') {
                global.triggerAchievement('sync_dj_announce');
            }
        }
    }

    function appendChatMessage(data) {
        const timeline = document.getElementById('sync-chat-timeline');
        if (!timeline) return;

        const msgDiv = document.createElement('div');
        const isMe = (p2pSession && p2pSession.myPeerId && data.sender.includes(p2pSession.myPeerId.slice(-4))) || (p2pSession && p2pSession.role === 'host' && data.sender === '[DJ Host]');

        if (data.isAnnouncement) {
            msgDiv.className = 'bg-emerald-950/80 border border-emerald-500/60 rounded-lg p-2 text-xs text-emerald-200 shadow-md';
            msgDiv.innerHTML = `
                <div class="flex items-center space-x-1 font-bold text-emerald-400 text-[10px] uppercase mb-0.5">
                    <span>[DJ ANNOUNCEMENT]</span>
                </div>
                <div class="font-bold">${escapeHtml(data.text)}</div>
            `;
        } else {
            msgDiv.className = `p-2 rounded-lg text-xs ${isMe ? 'bg-indigo-950/70 border border-indigo-700/50 text-indigo-100 ml-4' : 'bg-gray-900/80 border border-gray-800 text-gray-200 mr-4'}`;
            msgDiv.innerHTML = `
                <div class="flex items-center justify-between text-[10px] text-gray-400 mb-0.5 font-mono">
                    <span class="font-bold ${data.sender.includes('Host') ? 'text-emerald-400' : 'text-cyan-400'}">${escapeHtml(data.sender)}</span>
                    <span>${new Date(data.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div>${escapeHtml(data.text)}</div>
            `;
        }

        timeline.appendChild(msgDiv);
        timeline.scrollTop = timeline.scrollHeight;
    }

    function appendSystemChat(text) {
        const timeline = document.getElementById('sync-chat-timeline');
        if (!timeline) return;

        const sysDiv = document.createElement('div');
        sysDiv.className = 'text-center text-[10px] text-gray-400 font-mono py-1';
        sysDiv.textContent = `[SYSTEM] ${text}`;
        timeline.appendChild(sysDiv);
        timeline.scrollTop = timeline.scrollHeight;
    }

    function showDjTicker(text) {
        const ticker = document.getElementById('sync-dj-ticker');
        const tickerText = document.getElementById('sync-dj-ticker-text');
        if (!ticker || !tickerText) return;

        tickerText.textContent = text;
        ticker.classList.remove('hidden');

        if (isDjAnnounceTickerTimer) clearTimeout(isDjAnnounceTickerTimer);
        isDjAnnounceTickerTimer = setTimeout(() => {
            ticker.classList.add('hidden');
        }, 10000);
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>"']/g, m => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[m]));
    }

    function toggleAuxPass(peerId) {
        if (!p2pSession || p2pSession.role !== 'host') return;
        if (!currentMembers.has(peerId)) return;
        if (syncEngine) {
            syncEngine.auxPeerId = (syncEngine.auxPeerId === peerId) ? null : peerId;
            broadcastMembersList();
            p2pSession.broadcast({
                type: 'sync_aux_pass',
                targetPeerId: syncEngine.auxPeerId
            });
            const isGranted = (syncEngine.auxPeerId === peerId);
            appendSystemChat(isGranted ? `参加者 (ID: ...${peerId.slice(-4)}) に AUX (操作権限) を譲渡しました` : `参加者 (ID: ...${peerId.slice(-4)}) の AUX 権限を解除しました`);
            showDjTicker(isGranted ? `DJ AUX: Listener (${peerId.slice(-4)})` : 'DJ AUX: Host');
        }
    }

    // Export API to global window
    global.initSyncController = initSyncController;
    global.copyGeneratedCode = copyGeneratedCode;
    global.startHostRoom = startHostRoom;
    global.joinListenerRoom = joinListenerRoom;
    global.leaveSyncSession = leaveSyncSession;
    global.sendSyncChat = sendSyncChat;
    global.toggleAuxPass = toggleAuxPass;
    global.requestResyncFromHost = requestResyncFromHost;
    global.broadcastMembersList = broadcastMembersList;

    // Phase 3 Sub-tab and Remote & Transfer exports
    global.switchSyncSubTab = switchSyncSubTab;
    global.sendRemotePlayToggle = sendRemotePlayToggle;
    global.sendRemotePrev = sendRemotePrev;
    global.sendRemoteNext = sendRemoteNext;
    global.sendRemoteSeek = sendRemoteSeek;
    global.sendRemoteSeekImmediate = sendRemoteSeekImmediate;
    global.sendRemoteVolume = sendRemoteVolume;
    global.sendRemoteVolumeImmediate = sendRemoteVolumeImmediate;
    global.sendRemoteLoop = sendRemoteLoop;
    global.sendRemoteMode = sendRemoteMode;
    global.startPlaylistTransferFromUI = startPlaylistTransferFromUI;
    global.cancelPlaylistTransferFromUI = cancelPlaylistTransferFromUI;
    global.refreshTransferPlaylistOptions = refreshTransferPlaylistOptions;

    // Auto initialize on load
    if (typeof window !== 'undefined') {
        window.addEventListener('DOMContentLoaded', () => {
            initSyncController();
        });
    }

})(typeof window !== 'undefined' ? window : globalThis);
