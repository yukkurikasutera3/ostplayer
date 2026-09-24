/**
 * OST Player - P2P Sync & DJ Room UI Controller (src/sync/sync-ui-controller.js)
 * Phase 2: High-Precision WebRTC Playback Sync, Request Queue, Chat & Radar
 */

(function(global) {
    let p2pSession = null;
    let syncEngine = null;
    let currentQueue = [];
    let currentMembers = new Map();
    let isDjAnnounceTickerTimer = null;

    // --- Initialization ---
    function initSyncController() {
        if (typeof P2PSession === 'undefined' || typeof SyncEngine === 'undefined') {
            console.warn('[SyncUI] P2PSession or SyncEngine is not loaded.');
            return;
        }

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
            handleIncomingChat: (chatData) => {
                appendChatMessage(chatData);
                if (chatData.isAnnouncement) {
                    showDjTicker(chatData.text);
                }
            },
            handleIncomingRequestQueue: (data) => {
                handleQueueData(data);
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
            appendSystemChat(`リスナー (ID: ...${peerId.slice(-4)}) が入室しました`);
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
                setTimeout(() => container.classList.add('hidden'), 1000);
            }
            appendSystemChat(`楽曲データ受信完了: ${metadata.name || 'Track'}`);
        });
    }

    // --- Modal Controls ---
    function openSyncModal() {
        const modal = document.getElementById('sync-session-modal');
        if (!modal) return;
        modal.classList.remove('hidden');

        // Generate initial random code if idle
        if (!p2pSession || !p2pSession.role) {
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            const codeEl = document.getElementById('sync-generated-code');
            if (codeEl) codeEl.textContent = code;
        }
    }

    function closeSyncModal() {
        const modal = document.getElementById('sync-session-modal');
        if (modal) modal.classList.add('hidden');
    }

    function copyGeneratedCode() {
        const codeEl = document.getElementById('sync-generated-code');
        if (!codeEl) return;
        const code = codeEl.textContent.trim();
        if (code && code !== '------') {
            navigator.clipboard.writeText(code).then(() => {
                alert('ルームコードをコピーしました: ' + code);
            }).catch(() => {});
        }
    }

    async function startHostRoom() {
        if (!p2pSession) initSyncController();
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
            document.getElementById('sync-active-role-badge').className = 'text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-950 text-emerald-300 border border-emerald-700';

            const hostAnnounceChk = document.getElementById('sync-host-announce-toggle');
            if (hostAnnounceChk) hostAnnounceChk.classList.remove('hidden');

            updateHeaderButtonState(true, 'Host: ' + roomCode);
            appendSystemChat(`DJ ルームを開設しました (コード: ${roomCode})`);
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
            document.getElementById('sync-active-role-badge').className = 'text-[10px] px-2 py-0.5 rounded-full font-bold bg-cyan-950 text-cyan-300 border border-cyan-700';

            const hostAnnounceChk = document.getElementById('sync-host-announce-toggle');
            if (hostAnnounceChk) hostAnnounceChk.classList.add('hidden');

            updateHeaderButtonState(true, 'Sync: ' + code);
            appendSystemChat(`DJ ルーム (${code}) に接続しました`);
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
        currentQueue = [];

        document.getElementById('sync-active-view').classList.add('hidden');
        document.getElementById('sync-setup-view').classList.remove('hidden');
        updateHeaderButtonState(false, 'Sync');
        updateMembersUI();
        renderQueueList();

        appendSystemChat('セッションを切断しました');
    }

    function updateHeaderButtonState(isActive, label) {
        const btn = document.getElementById('sync-room-btn');
        const dot = document.getElementById('sync-status-dot');
        const lbl = document.getElementById('sync-btn-label');

        if (lbl) lbl.textContent = label || 'Sync';
        if (dot) {
            if (isActive) {
                dot.className = 'w-2 h-2 rounded-full bg-emerald-400 inline-block shadow-[0_0_8px_rgba(52,211,153,0.9)]';
            } else {
                dot.className = 'w-2 h-2 rounded-full bg-gray-500 inline-block';
            }
        }
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

        const total = (p2pSession && p2pSession.role === 'host') ? (currentMembers.size + 1) : (currentMembers.size + 1);
        if (countEl) countEl.textContent = total;

        listEl.innerHTML = '';

        // My Self
        const isHost = p2pSession && p2pSession.role === 'host';
        const myItem = document.createElement('div');
        myItem.className = 'flex items-center justify-between bg-gray-900/80 px-2.5 py-1.5 rounded-lg border border-gray-800 text-[11px]';
        myItem.innerHTML = `
            <div class="flex items-center space-x-2">
                <span class="w-2 h-2 rounded-full ${isHost ? 'bg-emerald-400' : 'bg-cyan-400'}"></span>
                <span class="font-mono text-gray-200">あなた (${p2pSession ? (p2pSession.myPeerId ? p2pSession.myPeerId.slice(-4) : 'Me') : 'Me'})</span>
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

    // --- Tab Switching ---
    function switchSyncTab(tabName) {
        const tabs = ['radar', 'queue', 'chat'];
        tabs.forEach(t => {
            const btn = document.getElementById('sync-tab-' + t + '-btn');
            const panel = document.getElementById('sync-tab-' + t);
            if (btn && panel) {
                if (t === tabName) {
                    btn.className = 'px-3 py-1.5 border-b-2 border-emerald-400 text-emerald-300 font-bold transition';
                    panel.classList.remove('hidden');
                } else {
                    btn.className = 'px-3 py-1.5 border-b-2 border-transparent text-gray-400 hover:text-gray-200 font-bold transition';
                    panel.classList.add('hidden');
                }
            }
        });
    }

    // --- Track Request & Upvote Queue ---
    function submitTrackRequest() {
        const titleInput = document.getElementById('sync-req-title-input');
        const artistInput = document.getElementById('sync-req-artist-input');
        if (!titleInput) return;

        const title = titleInput.value.trim();
        const artist = artistInput ? artistInput.value.trim() : '';

        if (!title) {
            alert('曲名を入力してください');
            return;
        }

        if (p2pSession) {
            p2pSession.sendTrackRequest(title, artist);
            titleInput.value = '';
            if (artistInput) artistInput.value = '';
        }
    }

    function handleQueueData(data) {
        if (data.type === 'track_request') {
            currentQueue.push({
                id: data.id,
                title: data.title,
                artist: data.artist,
                upvotes: data.upvotes || 1,
                voters: data.voters || [data.requester],
                requester: data.requester
            });
            sortAndRenderQueue();
            appendSystemChat(`新着リクエスト: 『${data.title}』(by ${data.requester})`);
        } else if (data.type === 'upvote_request') {
            const item = currentQueue.find(q => q.id === data.requestId);
            if (item) {
                if (!item.voters.includes(data.voter)) {
                    item.voters.push(data.voter);
                    item.upvotes = item.voters.length;
                    sortAndRenderQueue();
                }
            }
        }
    }

    function sortAndRenderQueue() {
        currentQueue.sort((a, b) => b.upvotes - a.upvotes);
        renderQueueList();
    }

    function renderQueueList() {
        const list = document.getElementById('sync-queue-list');
        const countBadge = document.getElementById('sync-queue-count');
        if (countBadge) countBadge.textContent = currentQueue.length;
        if (!list) return;

        if (currentQueue.length === 0) {
            list.innerHTML = `<div class="text-center text-gray-500 py-6 text-xs">現在リクエストされている曲はありません</div>`;
            return;
        }

        list.innerHTML = '';
        const isHost = p2pSession && p2pSession.role === 'host';
        const myPeerId = p2pSession ? p2pSession.myPeerId : 'local';

        currentQueue.forEach((req, idx) => {
            const hasUpvoted = req.voters && req.voters.includes(myPeerId);
            const item = document.createElement('div');
            item.className = 'flex items-center justify-between bg-gray-900/80 px-3 py-2 rounded-xl border border-gray-800 hover:border-emerald-500/40 transition text-xs';
            item.innerHTML = `
                <div class="flex items-center space-x-2.5 flex-1 min-w-0 pr-2">
                    <span class="font-mono font-bold text-gray-400 text-[11px] w-5">#${idx + 1}</span>
                    <div class="truncate">
                        <div class="font-bold text-gray-100 truncate">${req.title}</div>
                        <div class="text-[10px] text-gray-400 truncate">${req.artist ? req.artist + ' - ' : ''}by ${req.requester}</div>
                    </div>
                </div>
                <div class="flex items-center space-x-2 shrink-0">
                    <button onclick="upvoteTrack('${req.id}')" class="px-2 py-1 rounded text-[11px] font-bold font-mono transition flex items-center space-x-1 ${hasUpvoted ? 'bg-emerald-950 text-emerald-300 border border-emerald-600' : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700'}">
                        <span>+</span><span>${req.upvotes}</span>
                    </button>
                    ${isHost ? `<button onclick="playNextFromQueue('${req.id}')" class="px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-[10px] transition">再生</button>` : ''}
                </div>
            `;
            list.appendChild(item);
        });
    }

    function upvoteTrack(requestId) {
        if (p2pSession) {
            p2pSession.sendUpvote(requestId);
        }
    }

    function playNextFromQueue(requestId) {
        const itemIdx = currentQueue.findIndex(q => q.id === requestId);
        if (itemIdx >= 0) {
            const item = currentQueue[itemIdx];
            currentQueue.splice(itemIdx, 1);
            renderQueueList();
            appendSystemChat(`キューの曲を再生準備: 『${item.title}』`);
            // Trigger search in playlist if possible
            if (typeof global.searchAndPlayTrack === 'function') {
                global.searchAndPlayTrack(item.title);
            }
        }
    }

    // --- DJ Announce & In-Room Chat ---
    function sendSyncChat() {
        const input = document.getElementById('sync-chat-input');
        const chk = document.getElementById('sync-is-announce-chk');
        if (!input) return;

        const text = input.value.trim();
        if (!text) return;

        const isAnnounce = chk && chk.checked;
        if (p2pSession) {
            p2pSession.sendChatMessage(text, isAnnounce);
            input.value = '';
            if (chk) chk.checked = false;
        }
    }

    function appendChatMessage(chat) {
        const timeline = document.getElementById('sync-chat-timeline');
        if (!timeline) return;

        const row = document.createElement('div');
        row.className = chat.isAnnouncement 
            ? 'p-2 rounded-lg bg-emerald-950/80 border border-emerald-500/50 text-xs shadow-md space-y-0.5' 
            : 'px-2 py-1.5 rounded-lg bg-gray-900/60 border border-gray-800 text-xs space-y-0.5';

        row.innerHTML = `
            <div class="flex items-center justify-between text-[10px]">
                <span class="font-bold ${chat.isAnnouncement ? 'text-emerald-300' : 'text-cyan-300'}">${chat.sender}</span>
                <span class="text-gray-500 font-mono">${new Date(chat.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
            <div class="${chat.isAnnouncement ? 'text-white font-medium' : 'text-gray-200'} select-text">${escapeHtml(chat.text)}</div>
        `;

        timeline.appendChild(row);
        timeline.scrollTop = timeline.scrollHeight;
    }

    function appendSystemChat(text) {
        const timeline = document.getElementById('sync-chat-timeline');
        if (!timeline) return;

        const row = document.createElement('div');
        row.className = 'text-center text-[10px] text-gray-500 font-mono py-1';
        row.textContent = `[System] ${text}`;

        timeline.appendChild(row);
        timeline.scrollTop = timeline.scrollHeight;
    }

    function showDjTicker(text) {
        const ticker = document.getElementById('dj-announcement-ticker');
        const textEl = document.getElementById('dj-ticker-text');
        if (!ticker || !textEl) return;

        textEl.textContent = text;
        ticker.classList.remove('hidden');

        if (isDjAnnounceTickerTimer) clearTimeout(isDjAnnounceTickerTimer);
        isDjAnnounceTickerTimer = setTimeout(() => {
            closeDjTicker();
        }, 7000);
    }

    function closeDjTicker() {
        const ticker = document.getElementById('dj-announcement-ticker');
        if (ticker) ticker.classList.add('hidden');
        if (isDjAnnounceTickerTimer) {
            clearTimeout(isDjAnnounceTickerTimer);
            isDjAnnounceTickerTimer = null;
        }
    }

    function escapeHtml(str) {
        return (str || '').replace(/[&<>"']/g, m => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[m]));
    }

    // Expose to window
    global.initSyncController = initSyncController;
    global.openSyncModal = openSyncModal;
    global.closeSyncModal = closeSyncModal;
    global.copyGeneratedCode = copyGeneratedCode;
    global.startHostRoom = startHostRoom;
    global.joinListenerRoom = joinListenerRoom;
    global.leaveSyncSession = leaveSyncSession;
    global.switchSyncTab = switchSyncTab;
    global.submitTrackRequest = submitTrackRequest;
    global.upvoteTrack = upvoteTrack;
    global.playNextFromQueue = playNextFromQueue;
    global.sendSyncChat = sendSyncChat;
    global.closeDjTicker = closeDjTicker;

    // Auto-init when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSyncController);
    } else {
        initSyncController();
    }
})(typeof window !== 'undefined' ? window : globalThis);
