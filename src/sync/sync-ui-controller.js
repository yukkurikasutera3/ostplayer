/**
 * OST Player - P2P Sync & DJ Room UI Controller (src/sync/sync-ui-controller.js)
 * High-Precision WebRTC Playback Sync, Connection Manager & Live DJ Chat
 */

(function(global) {
    let p2pSession = null;
    let syncEngine = null;
    let currentMembers = new Map();
    let isDjAnnounceTickerTimer = null;

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
                    global.resyncCurrentTrackToPeer(clientPeerId);
                }
            },
            handleIncomingChat: (chatData) => {
                appendChatMessage(chatData);
                if (chatData.isAnnouncement) {
                    showDjTicker(chatData.text);
                }
            },
            handleIncomingRadarStats: (radarData) => {
                updateRadarUI(radarData.stats);
            }
        };

        syncEngine = new SyncEngine(p2pSession, playerApi);
        global.p2pSession = p2pSession;
        global.syncEngine = syncEngine;

        setupSessionEvents();
    }

    function setupSessionEvents() {
        if (!p2pSession) return;

        p2pSession.on('status', (info) => {
            updateStatusUI(info);
        });

        p2pSession.on('peer_joined', ({ peerId, count }) => {
            currentMembers.set(peerId, { role: 'Listener', ping: 0, lastSeen: Date.now() });
            updateMembersUI();
            appendSystemChat(`リスナー (ID: ...${peerId.slice(-4)}) が参加しました`);
            // Host sends current track
            if (p2pSession.role === 'host' && typeof global.resyncCurrentTrackToPeer === 'function') {
                global.resyncCurrentTrackToPeer(peerId);
            }
        });

        p2pSession.on('peer_left', ({ peerId, count }) => {
            currentMembers.delete(peerId);
            updateMembersUI();
            appendSystemChat(`リスナー (ID: ...${peerId.slice(-4)}) が退出しました`);
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
        });

        p2pSession.on('file_progress', ({ pct, metadata }) => {
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
                    global.showNotification('ルームコードをコピーしました: ' + code);
                } else {
                    alert('ルームコードをコピーしました: ' + code);
                }
            }).catch(() => {});
        }
    }

    async function startHostRoom() {
        if (!p2pSession) initSyncController();
        if (typeof global.initAudio === 'function') global.initAudio();

        const codeEl = document.getElementById('sync-generated-code');
        const code = codeEl ? codeEl.textContent.trim() : null;

        const btn = document.getElementById('sync-create-room-btn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'ルーム開設中...';
        }

        try {
            const roomCode = await p2pSession.createRoom(code !== '------' ? code : null);
            document.getElementById('sync-setup-view').classList.add('hidden');
            document.getElementById('sync-active-view').classList.remove('hidden');
            document.getElementById('sync-active-room-code').textContent = roomCode;
            document.getElementById('sync-active-role-badge').textContent = '[DJ Host]';
            document.getElementById('sync-active-role-badge').className = 'text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-950 text-emerald-300 border border-emerald-700 font-mono';

            const hostAnnounceChk = document.getElementById('sync-host-announce-toggle');
            if (hostAnnounceChk) hostAnnounceChk.classList.remove('hidden');

            updateMembersUI();
            appendSystemChat(`DJ ルームを開設しました (ルームコード: ${roomCode})`);

            if (typeof global.triggerAchievement === 'function') {
                global.triggerAchievement('sync_dj_room');
            }

            // If a track is already loaded/playing, broadcast it
            if (typeof global.resyncCurrentTrackToPeer === 'function') {
                global.resyncCurrentTrackToPeer(null);
            }
        } catch (err) {
            alert('ルーム開設に失敗しました: ' + err.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'DJ ルームを開設';
            }
        }
    }

    async function joinListenerRoom() {
        if (!p2pSession) initSyncController();
        if (typeof global.initAudio === 'function') global.initAudio();

        const input = document.getElementById('sync-join-code-input');
        const code = input ? input.value.trim() : '';

        if (!code || code.length !== 6 || isNaN(Number(code))) {
            alert('6桁の半角数字のルームコードを入力してください');
            return;
        }

        const btn = document.getElementById('sync-join-room-btn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = '接続中...';
        }

        try {
            await p2pSession.joinRoom(code);
            document.getElementById('sync-setup-view').classList.add('hidden');
            document.getElementById('sync-active-view').classList.remove('hidden');
            document.getElementById('sync-active-room-code').textContent = code;
            document.getElementById('sync-active-role-badge').textContent = '[Listener]';
            document.getElementById('sync-active-role-badge').className = 'text-[10px] px-2 py-0.5 rounded-full font-bold bg-cyan-950 text-cyan-300 border border-cyan-700 font-mono';

            const hostAnnounceChk = document.getElementById('sync-host-announce-toggle');
            if (hostAnnounceChk) hostAnnounceChk.classList.add('hidden');

            updateMembersUI();
            appendSystemChat(`DJ ルーム (${code}) に接続しました。Host からの楽曲配信を待機中...`);

            if (typeof global.triggerAchievement === 'function') {
                global.triggerAchievement('sync_dj_room');
            }
        } catch (err) {
            alert('ルームへの接続に失敗しました。コードを確認してください: ' + err.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'ルームに接続';
            }
        }
    }

    function leaveSyncSession() {
        if (p2pSession) {
            p2pSession.close();
        }
        currentMembers.clear();

        document.getElementById('sync-active-view').classList.add('hidden');
        document.getElementById('sync-setup-view').classList.remove('hidden');
        updateMembersUI();

        appendSystemChat('セッションを切断しました');
    }

    function updateStatusUI(info) {
        const statusEl = document.getElementById('sync-setup-status');
        if (statusEl && info && info.status) {
            statusEl.classList.remove('hidden');
            statusEl.textContent = 'ステータス: ' + info.status;
        }
    }

    function updateMembersUI() {
        const countEl = document.getElementById('sync-members-count');
        const listEl = document.getElementById('sync-members-list');
        if (!listEl) return;

        const total = (p2pSession && p2pSession.role) ? (currentMembers.size + 1) : 0;
        if (countEl) countEl.textContent = total;

        listEl.innerHTML = '';

        if (!p2pSession || !p2pSession.role) {
            listEl.innerHTML = '<div class="text-center text-gray-500 py-3 text-[11px]">未接続</div>';
            return;
        }

        // My Self
        const isHost = p2pSession.role === 'host';
        const myItem = document.createElement('div');
        myItem.className = 'flex items-center justify-between bg-gray-900/80 px-2.5 py-1.5 rounded-lg border border-gray-800 text-[11px]';
        myItem.innerHTML = `
            <div class="flex items-center space-x-2">
                <span class="w-2 h-2 rounded-full ${isHost ? 'bg-emerald-400' : 'bg-cyan-400'} shadow-[0_0_6px_rgba(52,211,153,0.8)]"></span>
                <span class="font-mono text-gray-200">あなた (${p2pSession.myPeerId ? p2pSession.myPeerId.slice(-4) : 'Me'})</span>
            </div>
            <span class="text-[9px] ${isHost ? 'text-emerald-400' : 'text-cyan-400'} font-mono font-bold">${isHost ? 'DJ Host' : 'Listener'}</span>
        `;
        listEl.appendChild(myItem);

        // Connected Peers
        for (let [peerId, data] of currentMembers.entries()) {
            const item = document.createElement('div');
            item.className = 'flex items-center justify-between bg-gray-900/60 px-2.5 py-1.5 rounded-lg border border-gray-800 text-[11px]';
            item.innerHTML = `
                <div class="flex items-center space-x-2">
                    <span class="w-2 h-2 rounded-full bg-gray-400"></span>
                    <span class="font-mono text-gray-300">User-${peerId.slice(-4)}</span>
                </div>
                <div class="flex items-center space-x-2">
                    <span class="text-[9px] text-gray-400 font-mono">${data.role || 'Listener'}</span>
                    ${isHost ? `<button onclick="toggleAuxPass('${peerId}')" class="text-[9px] px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700">AUX</button>` : ''}
                </div>
            `;
            listEl.appendChild(item);
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
                    <span>📢 DJ ANNOUNCEMENT</span>
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
        sysDiv.textContent = `[System] ${text}`;
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

    // Export API to global window
    global.initSyncController = initSyncController;
    global.copyGeneratedCode = copyGeneratedCode;
    global.startHostRoom = startHostRoom;
    global.joinListenerRoom = joinListenerRoom;
    global.leaveSyncSession = leaveSyncSession;
    global.sendSyncChat = sendSyncChat;

    // Auto initialize on load
    if (typeof window !== 'undefined') {
        window.addEventListener('DOMContentLoaded', () => {
            initSyncController();
        });
    }

})(typeof window !== 'undefined' ? window : globalThis);
