const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const net = require('net');
const os = require('os');
const { spawn, exec } = require('child_process');

let mainWindow;

// --- Restore User Data Directory (Preserve Playlist & Background Data) ---
const appData = app.getPath('appData');
const ultimatePath = path.join(appData, 'ost-player-ultimate');
const stdPath = path.join(appData, 'ost-player');

if (fs.existsSync(ultimatePath)) {
    app.setPath('userData', ultimatePath);
} else if (fs.existsSync(stdPath)) {
    app.setPath('userData', stdPath);
}
app.name = "OST Player";

// --- Native Zero-Dependency Discord Rich Presence IPC Manager ---
const DEFAULT_DISCORD_CLIENT_ID = '1546206603496390656'; // OST Player Dedicated Application ID

class DiscordRPC {
    constructor() {
        this.clientId = DEFAULT_DISCORD_CLIENT_ID;
        this.client = null;
        this.connected = false;
        this.connecting = false;
        this.user = null;
        this.currentActivity = null;
        this.enabled = false;
        this.reconnectTimer = null;
    }

    setClientId(newId) {
        const targetId = (newId && newId.trim()) ? newId.trim() : DEFAULT_DISCORD_CLIENT_ID;
        if (this.clientId !== targetId) {
            this.clientId = targetId;
            if (this.connected) {
                this.disconnect();
                if (this.enabled) {
                    this.connect();
                }
            }
        }
    }

    findPipe(pipeIndex = 0) {
        if (pipeIndex > 9) return Promise.resolve(null);
        const pipePath = process.platform === 'win32'
            ? `\\\\.\\pipe\\discord-ipc-${pipeIndex}`
            : path.join(process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || process.env.TMP || '/tmp', `discord-ipc-${pipeIndex}`);

        return new Promise((resolve) => {
            const socket = net.connect(pipePath, () => {
                resolve({ socket, pipePath });
            });
            socket.on('error', () => {
                socket.destroy();
                this.findPipe(pipeIndex + 1).then(resolve);
            });
        });
    }

    connect() {
        if (this.connected || this.connecting) return Promise.resolve(this.connected);
        this.connecting = true;

        return this.findPipe().then((result) => {
            this.connecting = false;
            if (!result) {
                this.connected = false;
                this.notifyStatus();
                return false;
            }

            this.client = result.socket;
            this.sendHandshake();

            this.client.on('data', (chunk) => {
                this.handleData(chunk);
            });

            this.client.on('error', (err) => {
                this.handleDisconnect();
            });

            this.client.on('close', () => {
                this.handleDisconnect();
            });

            return true;
        });
    }

    handleData(chunk) {
        try {
            if (chunk.length < 8) return;
            const op = chunk.readInt32LE(0);
            const len = chunk.readInt32LE(4);
            const dataStr = chunk.toString('utf8', 8, 8 + len);
            const json = JSON.parse(dataStr);

            if (json.evt === 'READY' && json.data) {
                this.connected = true;
                this.user = json.data.user || null;
                this.notifyStatus();
                if (this.currentActivity && this.enabled) {
                    this.sendActivityPacket(this.currentActivity);
                }
            } else if (json.code === 4000) {
                // Invalid Client ID error from Discord
                console.warn('[DiscordRPC] Invalid Client ID:', this.clientId);
                this.connected = false;
                this.user = null;
                this.notifyStatus();
            }
        } catch (e) {}
    }

    handleDisconnect() {
        this.connected = false;
        this.user = null;
        if (this.client) {
            try { this.client.destroy(); } catch (e) {}
            this.client = null;
        }
        this.notifyStatus();
    }

    disconnect() {
        this.handleDisconnect();
    }

    sendHandshake() {
        const payload = JSON.stringify({ v: 1, client_id: this.clientId });
        this.sendPacket(0, payload);
    }

    setActivity(activity) {
        this.currentActivity = activity;
        if (!this.enabled) return;

        if (!this.connected) {
            this.connect().then(ok => {
                if (ok && this.currentActivity) {
                    this.sendActivityPacket(this.currentActivity);
                }
            });
            return;
        }

        this.sendActivityPacket(activity);
    }

    sendActivityPacket(activity, cb) {
        if (!this.connected || !this.client) {
            if (cb) cb();
            return;
        }
        const payload = JSON.stringify({
            cmd: 'SET_ACTIVITY',
            args: {
                pid: process.pid,
                activity: activity
            },
            nonce: Date.now().toString()
        });
        this.sendPacket(1, payload, cb);
    }

    clearActivity(cb) {
        this.currentActivity = null;
        if (this.connected && this.client) {
            this.sendActivityPacket(null, cb);
        } else if (cb) {
            cb();
        }
    }

    clearAndDisconnect() {
        return new Promise((resolve) => {
            this.enabled = false;
            this.currentActivity = null;
            if (!this.connected || !this.client) {
                this.disconnect();
                resolve();
                return;
            }
            this.clearActivity(() => {
                setTimeout(() => {
                    this.disconnect();
                    resolve();
                }, 150);
            });
            // Fallback safety timeout
            setTimeout(() => {
                this.disconnect();
                resolve();
            }, 500);
        });
    }

    sendPacket(op, payload, cb) {
        if (!this.client) {
            if (cb) cb();
            return;
        }
        try {
            const len = Buffer.byteLength(payload);
            const buf = Buffer.alloc(8 + len);
            buf.writeInt32LE(op, 0);
            buf.writeInt32LE(len, 4);
            buf.write(payload, 8);
            this.client.write(buf, () => {
                if (cb) cb();
            });
        } catch (e) {
            if (cb) cb();
        }
    }

    notifyStatus() {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('discord-status-updated', {
                enabled: this.enabled,
                connected: this.connected,
                user: this.user,
                clientId: this.clientId
            });
        }
    }

    startAutoReconnect() {
        if (this.reconnectTimer) clearInterval(this.reconnectTimer);
        this.reconnectTimer = setInterval(() => {
            if (this.enabled && !this.connected && !this.connecting) {
                this.connect();
            }
        }, 6000);
    }
}

const discordRpc = new DiscordRPC();
discordRpc.startAutoReconnect();

// --- SSP (伺か) SSTP Sender ---
function sendSstpMessage(options) {
    if (!options) return;
    const port = parseInt(options.port) || 9801;
    const host = '127.0.0.1';
    const client = new net.Socket();
    client.setTimeout(1200);

    const title = options.title || 'Unknown Track';
    const artist = (options.artist && options.artist.trim()) ? options.artist.trim() : '';
    const album = (options.album && options.album.trim()) ? options.album.trim() : '';
    const fileName = (options.fileName && options.fileName.trim()) ? options.fileName.trim() : title;
    
    let script = options.script || `\\0\\s[0]『{title}』({artist})を再生中だよ！\\e`;
    
    if (!artist) {
        script = script.replace(/\(\{artist\}\)/g, '')
                       .replace(/（\{artist\}）/g, '')
                       .replace(/ - \{artist\}/g, '')
                       .replace(/\{artist\}/g, '');
    } else {
        script = script.replace(/\{artist\}/g, artist);
    }

    if (!album) {
        script = script.replace(/\(\{album\}\)/g, '')
                       .replace(/（\{album\}）/g, '')
                       .replace(/ - \{album\}/g, '')
                       .replace(/\{album\}/g, '');
    } else {
        script = script.replace(/\{album\}/g, album);
    }

    script = script.replace(/\{filename\}/gi, fileName);
    script = script.replace(/\{title\}/gi, title);

    const sstpPacket = [
        'NOTIFY SSTP/1.1',
        'Sender: OST Player',
        'Event: OnMusicPlay',
        `Reference0: ${title}`,
        `Reference1: ${artist}`,
        `Reference2: ${album}`,
        `Reference3: ${fileName}`,
        `Script: ${script}`,
        'Option: nodescript',
        'Charset: UTF-8',
        '',
        ''
    ].join('\r\n');

    client.connect(port, host, () => {
        client.write(Buffer.from(sstpPacket, 'utf8'));
    });

    client.on('data', () => {
        client.destroy();
    });

    client.on('error', () => {
        client.destroy();
    });

    client.on('timeout', () => {
        client.destroy();
    });
}

ipcMain.on('notify-sstp-track', (event, options) => {
    if (options && typeof options === 'object') {
        sendSstpMessage(options);
    }
});

ipcMain.on('test-sstp', (event, options) => {
    const port = (options && options.port) || 9801;
    const script = (options && options.script) || '\\0\\s[0]OST Player と SSP(伺か)の連携テスト成功だよ！\\e';
    sendSstpMessage({
        port: port,
        title: 'テスト楽曲',
        artist: 'OST Player',
        album: 'Ultimate',
        fileName: 'test_track',
        script: script
    });
});

let isQuitting = false;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1300,
        height: 880,
        minWidth: 950,
        minHeight: 700,
        title: "OST Player",
        backgroundColor: "#0d0f17",
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false,
            allowRunningInsecureContent: true
        }
    });

    Menu.setApplicationMenu(null);

    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.type === 'keyDown') {
            if (input.key === 'F12' || (input.control && input.shift && input.key.toUpperCase() === 'I')) {
                mainWindow.webContents.toggleDevTools();
                event.preventDefault();
            } else if (input.key === 'F11') {
                mainWindow.setFullScreen(!mainWindow.isFullScreen());
                event.preventDefault();
            }
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    mainWindow.on('close', (e) => {
        if (discordRpc.connected && !isQuitting) {
            e.preventDefault();
            isQuitting = true;
            discordRpc.clearAndDisconnect().finally(() => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.destroy();
                }
                app.quit();
            });
            setTimeout(() => {
                if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy();
                app.quit();
            }, 500);
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// IPC Listener for Fullscreen Toggle
ipcMain.on('toggle-fullscreen', () => {
    if (mainWindow) {
        mainWindow.setFullScreen(!mainWindow.isFullScreen());
    }
});

// IPC Listener for Mini Player Window Toggle
ipcMain.on('toggle-mini-mode', (event, isMini) => {
    if (!mainWindow) return;
    if (isMini) {
        mainWindow.setMinimumSize(400, 90);
        mainWindow.setSize(460, 110);
        mainWindow.setAlwaysOnTop(true);
    } else {
        mainWindow.setMinimumSize(950, 700);
        mainWindow.setSize(1300, 880);
        mainWindow.setAlwaysOnTop(false);
    }
});

// IPC Listener for Discord Rich Presence Update
ipcMain.on('update-discord-presence', (event, data) => {
    if (!data) return;

    discordRpc.enabled = !!data.enabled;
    if (data.clientId !== undefined) {
        discordRpc.setClientId(data.clientId);
    }

    if (!data.enabled) {
        discordRpc.clearActivity();
        discordRpc.disconnect();
        return;
    }

    // Auto-connect to Discord named pipe if enabled
    if (!discordRpc.connected && !discordRpc.connecting) {
        discordRpc.connect();
    }

    if (!data.isPlaying) {
        discordRpc.clearActivity();
        return;
    }

    const details = data.details || 'OST Player';
    const state = data.state || (data.artist ? `${data.title} - ${data.artist}` : (data.title || '再生中'));

    const activity = {
        type: 2, // 2 = Listening to
        details: details,
        state: state,
        assets: {
            large_image: 'app_icon',
            large_text: 'OST Player'
        }
    };

    if (data.showTime !== false && data.startTime) {
        const startSec = (data.startTime > 1e11) ? Math.floor(data.startTime / 1000) : Math.floor(data.startTime);
        if (data.endTime && data.endTime > data.startTime) {
            const endSec = (data.endTime > 1e11) ? Math.floor(data.endTime / 1000) : Math.floor(data.endTime);
            activity.timestamps = {
                start: startSec,
                end: endSec
            };
        } else {
            activity.timestamps = { start: startSec };
        }
    }

    discordRpc.setActivity(activity);
});

// IPC Listener to query Discord connection status
ipcMain.handle('get-discord-status', async () => {
    return {
        enabled: discordRpc.enabled,
        connected: discordRpc.connected,
        user: discordRpc.user,
        clientId: discordRpc.clientId
    };
});

// IPC Listener for Test Discord Status
ipcMain.on('test-discord', (event, data) => {
    discordRpc.enabled = true;
    if (data && data.clientId !== undefined) {
        discordRpc.setClientId(data.clientId);
    }

    const now = Math.floor(Date.now() / 1000);
    const activity = {
        type: 2,
        details: (data && data.details) || 'OST Player',
        state: (data && data.state) || (data && data.title) || 'テスト楽曲 (Test Track)',
        timestamps: {
            start: now - 45,
            end: now + 195
        },
        assets: {
            large_image: 'app_icon',
            large_text: 'OST Player'
        }
    };

    discordRpc.setActivity(activity);
});

// IPC Listener for Opening External URLs Safely
ipcMain.on('open-external', (event, url) => {
    if (url && typeof url === 'string' && /^(https?:\/\/|spotify:)/i.test(url)) {
        shell.openExternal(url);
    }
});

// IPC Handler to Read Local Files for Playlist JSON Import
ipcMain.handle('read-local-file', async (event, filePath) => {
    try {
        if (!filePath || typeof filePath !== 'string' || !fs.existsSync(filePath)) return null;
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) return null;
        const buffer = fs.readFileSync(filePath);
        const fileName = path.basename(filePath);
        const ext = path.extname(filePath).toLowerCase();
        let mime = 'application/octet-stream';
        if (ext === '.mp3') mime = 'audio/mp3';
        else if (ext === '.wav') mime = 'audio/wav';
        else if (ext === '.flac') mime = 'audio/flac';
        else if (ext === '.ogg') mime = 'audio/ogg';
        else if (ext === '.m4a' || ext === '.aac') mime = 'audio/mp4';
        else if (ext === '.mid' || ext === '.midi') mime = 'audio/midi';
        else if (ext === '.mp4') mime = 'video/mp4';
        else if (ext === '.webm') mime = 'video/webm';
        else if (ext === '.mov') mime = 'video/quicktime';
        else if (ext === '.mkv') mime = 'video/x-matroska';
        else if (ext === '.sf2' || ext === '.sf3') mime = 'application/octet-stream';
        return {
            name: fileName,
            path: filePath,
            data: buffer,
            size: stat.size,
            mime: mime
        };
    } catch (e) {
        console.error('Error reading local file:', e);
        return null;
    }
});

// --- Spotify OAuth 2.0 PKCE Manager ---
let spotifyAuthServer = null;
let currentSpotifyVerifier = null;

function base64UrlEncode(buffer) {
    return buffer.toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

function sha256(str) {
    return crypto.createHash('sha256').update(str).digest();
}

ipcMain.handle('spotify-login', async (event, clientId) => {
    if (!clientId || typeof clientId !== 'string' || !clientId.trim()) {
        return { success: false, error: 'Client ID が指定されていません' };
    }
    const cleanClientId = clientId.trim();
    const port = 8888;
    const redirectUri = `http://127.0.0.1:${port}/callback`;

    // Clean up any existing auth server
    if (spotifyAuthServer) {
        try { spotifyAuthServer.close(); } catch (e) {}
        spotifyAuthServer = null;
    }

    // Generate PKCE code_verifier and code_challenge
    const verifierBuffer = crypto.randomBytes(48);
    currentSpotifyVerifier = base64UrlEncode(verifierBuffer);
    const challenge = base64UrlEncode(sha256(currentSpotifyVerifier));

    const scopes = [
        'user-read-playback-state',
        'user-modify-playback-state',
        'user-read-currently-playing',
        'streaming',
        'playlist-read-private',
        'playlist-read-collaborative',
        'user-library-read',
        'user-read-email',
        'user-read-private'
    ].join(' ');

    const authUrl = `https://accounts.spotify.com/authorize?client_id=${encodeURIComponent(cleanClientId)}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge_method=S256&code_challenge=${encodeURIComponent(challenge)}&scope=${encodeURIComponent(scopes)}`;

    return new Promise((resolve) => {
        let isResolved = false;

        const cleanup = () => {
            if (spotifyAuthServer) {
                try { spotifyAuthServer.close(); } catch (e) {}
                spotifyAuthServer = null;
            }
        };

        const timer = setTimeout(() => {
            if (!isResolved) {
                isResolved = true;
                cleanup();
                resolve({ success: false, error: '認証がタイムアウトしました (120秒)' });
            }
        }, 120000);

        spotifyAuthServer = http.createServer(async (req, res) => {
            try {
                const reqUrl = new URL(req.url, `http://127.0.0.1:${port}`);
                if (reqUrl.pathname === '/callback') {
                    const code = reqUrl.searchParams.get('code');
                    const error = reqUrl.searchParams.get('error');

                    if (error) {
                        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
                        res.end('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Spotify 認証エラー</title></head><body style="background:#121212;color:#ff6b6b;font-family:sans-serif;padding:40px;text-align:center;"><h2>Spotify 認証エラー</h2><p>' + error + '</p><p style="color:#888;">このウィンドウを閉じて OST Player に戻ってください。</p></body></html>');
                        if (!isResolved) {
                            isResolved = true;
                            clearTimeout(timer);
                            cleanup();
                            resolve({ success: false, error: `Spotify 認証がキャンセルされました: ${error}` });
                        }
                        return;
                    }

                    if (code) {
                        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                        res.end('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Spotify 連携完了</title></head><body style="background:#121212;color:#1ed760;font-family:sans-serif;padding:40px;text-align:center;"><h2>Spotify 連携完了</h2><p>認証に成功しました。OST Player に戻ってください。</p><p style="color:#aaa;font-size:12px;">このウィンドウは閉じて構いません。</p><script>setTimeout(function(){ window.close(); }, 3000);</script></body></html>');

                        // Exchange auth code for tokens
                        try {
                            const tokenParams = new URLSearchParams({
                                client_id: cleanClientId,
                                grant_type: 'authorization_code',
                                code: code,
                                redirect_uri: redirectUri,
                                code_verifier: currentSpotifyVerifier
                            });

                            const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/x-www-form-urlencoded'
                                },
                                body: tokenParams.toString()
                            });

                            const tokenData = await tokenRes.json();
                            if (!isResolved) {
                                isResolved = true;
                                clearTimeout(timer);
                                cleanup();
                                if (tokenData.access_token) {
                                    resolve({ success: true, tokens: tokenData, tokenData });
                                } else {
                                    resolve({ success: false, error: tokenData.error_description || tokenData.error || 'トークンの取得に失敗しました' });
                                }
                            }
                        } catch (tokenErr) {
                            console.error('Spotify token exchange error:', tokenErr);
                            if (!isResolved) {
                                isResolved = true;
                                clearTimeout(timer);
                                cleanup();
                                resolve({ success: false, error: 'トークン交換通信エラー: ' + tokenErr.message });
                            }
                        }
                    }
                }
            } catch (handleErr) {
                console.error('Request handling error:', handleErr);
            }
        });

        spotifyAuthServer.on('error', (err) => {
            console.error('Spotify auth server error:', err);
            if (!isResolved) {
                isResolved = true;
                clearTimeout(timer);
                cleanup();
                resolve({ success: false, error: `ローカルサーバー起動エラー (ポート ${port}): ${err.message}` });
            }
        });

        spotifyAuthServer.listen(port, '127.0.0.1', () => {
            shell.openExternal(authUrl);
        });
    });
});

ipcMain.handle('spotify-logout', async () => {
    if (spotifyAuthServer) {
        try { spotifyAuthServer.close(); } catch (e) {}
        spotifyAuthServer = null;
    }
    currentSpotifyVerifier = null;
    return { success: true };
});

ipcMain.handle('spotify-refresh-token', async (event, { refreshToken, clientId }) => {
    if (!refreshToken || !clientId) {
        return { success: false, error: 'パラメーターが不足しています' };
    }
    try {
        const params = new URLSearchParams({
            client_id: clientId.trim(),
            grant_type: 'refresh_token',
            refresh_token: refreshToken.trim()
        });

        const res = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params.toString()
        });

        const data = await res.json();
        if (data.access_token) {
            return { success: true, tokens: data, tokenData: data };
        } else {
            return { success: false, error: data.error_description || data.error || 'トークン更新に失敗しました' };
        }
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// --- One-Click In-App Auto Updater IPC Handler ---
function downloadFileWithRedirects(url, destPath, progressCb, maxRedirects = 10) {
    return new Promise((resolve, reject) => {
        if (maxRedirects <= 0) return reject(new Error('リダイレクト回数が上限を超えました'));

        const client = url.startsWith('https') ? https : http;
        const options = {
            headers: {
                'User-Agent': 'OST-Player-AutoUpdater/3.3.2'
            }
        };

        const req = client.get(url, options, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                let redirectUrl = res.headers.location;
                if (!redirectUrl.startsWith('http')) {
                    const parsedUrl = new URL(url);
                    redirectUrl = new URL(redirectUrl, parsedUrl.origin).href;
                }
                return downloadFileWithRedirects(redirectUrl, destPath, progressCb, maxRedirects - 1)
                    .then(resolve)
                    .catch(reject);
            }

            if (res.statusCode !== 200) {
                return reject(new Error(`ダウンロード失敗: HTTP ${res.statusCode}`));
            }

            const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
            let receivedBytes = 0;
            const fileStream = fs.createWriteStream(destPath);

            res.on('data', (chunk) => {
                receivedBytes += chunk.length;
                if (typeof progressCb === 'function') {
                    progressCb(receivedBytes, totalBytes);
                }
            });

            res.pipe(fileStream);

            fileStream.on('finish', () => {
                fileStream.close(() => resolve(destPath));
            });

            fileStream.on('error', (err) => {
                fs.unlink(destPath, () => {});
                reject(err);
            });
        });

        req.on('error', (err) => {
            fs.unlink(destPath, () => {});
            reject(err);
        });

        req.setTimeout(120000, () => {
            req.destroy(new Error('ダウンロードがタイムアウトしました (120秒)'));
        });
    });
}

ipcMain.handle('perform-auto-update', async (event, downloadUrl) => {
    try {
        if (!downloadUrl || typeof downloadUrl !== 'string') {
            return { success: false, error: 'ダウンロードURLが無効です' };
        }

        const tempDir = path.join(os.tmpdir(), 'ostplayer-update-' + Date.now());
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        const zipPath = path.join(tempDir, 'update.zip');
        const extractDir = path.join(tempDir, 'extracted');
        fs.mkdirSync(extractDir, { recursive: true });

        event.sender.send('update-progress', { stage: 'downloading', percent: 0, text: '最新パッケージをダウンロード中...' });

        await downloadFileWithRedirects(downloadUrl, zipPath, (received, total) => {
            const percent = total > 0 ? Math.min(100, Math.round((received / total) * 100)) : 0;
            const receivedMB = (received / 1024 / 1024).toFixed(1);
            const totalMB = total > 0 ? (total / 1024 / 1024).toFixed(1) : '?';
            event.sender.send('update-progress', {
                stage: 'downloading',
                percent,
                received,
                total,
                text: `ダウンロード中... (${receivedMB} MB / ${totalMB} MB [${percent}%])`
            });
        });

        event.sender.send('update-progress', { stage: 'extracting', percent: 100, text: 'アーカイブを展開中...' });

        await new Promise((resolve, reject) => {
            const psCmd = `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${extractDir.replace(/'/g, "''")}' -Force`;
            exec(`powershell -NoProfile -NonInteractive -Command "${psCmd}"`, (err, stdout, stderr) => {
                if (err) {
                    console.error('Extraction error:', err, stderr);
                    return reject(new Error('アーカイブ展開に失敗しました: ' + (stderr || err.message)));
                }
                resolve();
            });
        });

        event.sender.send('update-progress', { stage: 'applying', percent: 100, text: '更新を適用してアプリを再起動します...' });

        const isPackaged = app.isPackaged;
        const appDir = isPackaged ? path.dirname(process.execPath) : app.getAppPath();
        const execPath = process.execPath;
        const currentPid = process.pid;

        // Check if extracted folder has a root wrapper directory
        let sourceDir = extractDir;
        const items = fs.readdirSync(extractDir);
        if (items.length === 1 && fs.statSync(path.join(extractDir, items[0])).isDirectory()) {
            sourceDir = path.join(extractDir, items[0]);
        }

        const batPath = path.join(tempDir, 'apply_update.bat');
        let batScript = '';

        if (isPackaged) {
            batScript = `@echo off
chcp 65001 > NUL
timeout /t 1 /nobreak > NUL
taskkill /PID ${currentPid} /F > NUL 2>&1
timeout /t 1 /nobreak > NUL

robocopy "${sourceDir}" "${appDir}" /E /IS /IT /NP /R:3 /W:1 > NUL

start "" "${execPath}"
timeout /t 3 /nobreak > NUL
rmdir /S /Q "${tempDir}" > NUL 2>&1
exit
`;
        } else {
            batScript = `@echo off
chcp 65001 > NUL
timeout /t 1 /nobreak > NUL
taskkill /PID ${currentPid} /F > NUL 2>&1
timeout /t 1 /nobreak > NUL

robocopy "${sourceDir}" "${appDir}" /E /IS /IT /NP /R:3 /W:1 /XD dist .git node_modules > NUL

start "" "${execPath}" "${appDir}"
timeout /t 3 /nobreak > NUL
rmdir /S /Q "${tempDir}" > NUL 2>&1
exit
`;
        }

        fs.writeFileSync(batPath, batScript, 'utf8');

        const child = spawn('cmd.exe', ['/c', batPath], {
            detached: true,
            stdio: 'ignore',
            windowsHide: true
        });
        child.unref();

        setTimeout(() => {
            isQuitting = true;
            if (discordRpc.connected) {
                discordRpc.clearAndDisconnect().finally(() => {
                    app.quit();
                });
            } else {
                app.quit();
            }
        }, 600);

        return { success: true };
    } catch (error) {
        console.error('Auto update error:', error);
        return { success: false, error: error.message || String(error) };
    }
});

app.whenReady().then(createWindow);

app.on('before-quit', (e) => {
    if (discordRpc.connected && !isQuitting) {
        e.preventDefault();
        isQuitting = true;
        discordRpc.clearAndDisconnect().finally(() => {
            app.quit();
        });
        setTimeout(() => { app.quit(); }, 500);
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        if (discordRpc.connected && !isQuitting) {
            isQuitting = true;
            discordRpc.clearAndDisconnect().finally(() => {
                app.quit();
            });
            setTimeout(() => { app.quit(); }, 500);
        } else {
            app.quit();
        }
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
