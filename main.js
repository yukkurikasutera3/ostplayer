const { app, BrowserWindow, Menu, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const net = require('net');
const os = require('os');
const { spawn, execFile } = require('child_process');

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
        this.rxBuffer = Buffer.alloc(0);
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
            // 接続に失敗したときだけ次のパイプを試す。接続成功後はこのリスナーを外す(後のエラーで別のパイプへ接続してソケットが漏れるのを防ぐ)
            const onError = () => {
                socket.destroy();
                this.findPipe(pipeIndex + 1).then(resolve);
            };
            const socket = net.connect(pipePath, () => {
                socket.removeListener('error', onError);
                resolve({ socket, pipePath });
            });
            socket.once('error', onError);
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
        // IPC のフレーム(8バイトのヘッダ + JSON)は、1回の受信で完結するとは限らない。溜めてから1フレームずつ切り出す
        this.rxBuffer = Buffer.concat([this.rxBuffer, chunk]);
        while (this.rxBuffer.length >= 8) {
            const len = this.rxBuffer.readInt32LE(4);
            if (len < 0 || len > 1024 * 1024) {
                this.rxBuffer = Buffer.alloc(0);
                this.handleDisconnect();
                return;
            }
            if (this.rxBuffer.length < 8 + len) break;
            const dataStr = this.rxBuffer.toString('utf8', 8, 8 + len);
            this.rxBuffer = this.rxBuffer.subarray(8 + len);
            this.handleMessage(dataStr);
        }
    }

    handleMessage(dataStr) {
        try {
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
        this.rxBuffer = Buffer.alloc(0);
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
// SSTP のヘッダ値: 改行や NUL を含めない(ヘッダ注入の防止)・長さを制限する
function sstpHeaderValue(v, max = 500) {
    return String(v == null ? '' : v).replace(/[\r\n\u0000]+/g, ' ').trim().slice(0, max);
}

// SakuraScript に埋め込む値: \ と % をエスケープし、値の中のタグが実行されないようにする
function sakuraEscape(v) {
    return sstpHeaderValue(v, 300).replace(/\\/g, '\\\\').replace(/%/g, '\\%');
}

function sendSstpMessage(options) {
    if (!options) return;
    const portNum = parseInt(options.port, 10);
    const port = (portNum >= 1024 && portNum <= 65535) ? portNum : 9801;
    const host = '127.0.0.1';
    const client = new net.Socket();
    client.setTimeout(1200);

    const title = sstpHeaderValue(options.title) || 'Unknown Track';
    const artist = sstpHeaderValue(options.artist);
    const album = sstpHeaderValue(options.album);
    const fileName = sstpHeaderValue(options.fileName) || title;

    // スクリプトの雛形は利用者が設定したもの(バックスラッシュはそのまま)。差し込む曲情報は sakuraEscape を通す。
    // 置換は関数で行う(文字列だと曲名の $& や $$ が展開されてしまう)
    let script = sstpHeaderValue(options.script, 2000) || `\\0\\s[0]『{title}』({artist})を再生中だよ！\\e`;

    if (!artist) {
        script = script.replace(/\(\{artist\}\)/g, '')
                       .replace(/（\{artist\}）/g, '')
                       .replace(/ - \{artist\}/g, '')
                       .replace(/\{artist\}/g, '');
    } else {
        script = script.replace(/\{artist\}/g, () => sakuraEscape(artist));
    }

    if (!album) {
        script = script.replace(/\(\{album\}\)/g, '')
                       .replace(/（\{album\}）/g, '')
                       .replace(/ - \{album\}/g, '')
                       .replace(/\{album\}/g, '');
    } else {
        script = script.replace(/\{album\}/g, () => sakuraEscape(album));
    }

    script = script.replace(/\{filename\}/gi, () => sakuraEscape(fileName));
    script = script.replace(/\{title\}/gi, () => sakuraEscape(title));

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
            // 注意: webSecurity を true にすると、file:// 上で行う fetch('./spessasynth_processor.js')(SoundFont 合成の読み込み)が動かなくなる。
            // 独自プロトコルへ移行する場合は、保存元(オリジン)が変わって IndexedDB のライブラリが見えなくなるため、移行処理が必要。
            webSecurity: false,
            allowRunningInsecureContent: true
        }
    });

    // 新しいウィンドウは開かない。http(s) のリンクだけ既定のブラウザで開く
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (/^https?:\/\//i.test(url)) shell.openExternal(url);
        return { action: 'deny' };
    });
    // このウィンドウは index.html 以外へ遷移させない
    mainWindow.webContents.on('will-navigate', (event, url) => {
        if (url !== mainWindow.webContents.getURL()) {
            event.preventDefault();
            if (/^https?:\/\//i.test(url)) shell.openExternal(url);
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
    if (url && typeof url === 'string' && /^https?:\/\//i.test(url)) {
        shell.openExternal(url);
    }
});

// IPC Handler to Read Local Files for Playlist JSON Import
// 読み込めるのは音声・動画・MIDI・SoundFont の拡張子だけ(renderer が乗っ取られても、鍵や設定ファイルなどを読めないようにする)
const READABLE_EXTS = new Set(['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac', '.opus', '.wma', '.aiff', '.weba', '.mid', '.midi',
    '.mp4', '.webm', '.mov', '.mkv', '.m4v', '.avi', '.ts', '.ogv', '.sf2', '.sf3']);
const READABLE_MAX_BYTES = 1.5 * 1024 * 1024 * 1024;
const READABLE_MIME = {
    '.mp3': 'audio/mp3', '.wav': 'audio/wav', '.flac': 'audio/flac', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.aac': 'audio/mp4',
    '.mid': 'audio/midi', '.midi': 'audio/midi', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mkv': 'video/x-matroska'
};

ipcMain.handle('read-local-file', async (event, filePath) => {
    try {
        if (!filePath || typeof filePath !== 'string' || filePath.length >= 1024 || filePath.includes('\0')) return null;
        const ext = path.extname(filePath).toLowerCase();
        if (!READABLE_EXTS.has(ext)) {
            console.warn('read-local-file: 許可されていない拡張子のため拒否しました:', ext);
            return null;
        }
        const stat = await fs.promises.stat(filePath);
        if (!stat.isFile() || stat.size > READABLE_MAX_BYTES) return null;
        const buffer = await fs.promises.readFile(filePath);
        return {
            name: path.basename(filePath),
            path: filePath,
            data: buffer,
            size: stat.size,
            mime: READABLE_MIME[ext] || 'application/octet-stream'
        };
    } catch (e) {
        console.error('Error reading local file:', e);
        return null;
    }
});

// --- One-Click In-App Auto Updater IPC Handler ---
// ===== 自動更新(安全対策つき) =====
// ・更新元(リポジトリ)はこの main プロセスで決める。renderer から渡された URL は使わない
// ・https のみ / ホストは許可リスト / リダイレクト先も許可リスト内だけ / サイズ上限あり
// ・GitHub API が返す sha256 と照合し、一致しなければ中止
// ・展開前に zip の中身(.. や絶対パス)を確認 / 適用に失敗したらバックアップから復元
const DEFAULT_UPDATE_REPO = 'yukkurikasutera3/ostplayer';
const UPDATE_ALLOWED_HOSTS = new Set([
    'api.github.com', 'github.com', 'codeload.github.com',
    'objects.githubusercontent.com', 'release-assets.githubusercontent.com', 'github-releases.githubusercontent.com'
]);
const UPDATE_MAX_BYTES = 1.5 * 1024 * 1024 * 1024;
const REPO_RE = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const TAG_RE = /^[A-Za-z0-9._-]{1,64}$/;
let updateInProgress = false;

function isAllowedUpdateUrl(u) {
    try {
        const x = new URL(u);
        return x.protocol === 'https:' && UPDATE_ALLOWED_HOSTS.has(x.hostname) && !x.username && !x.password;
    } catch (e) {
        return false;
    }
}

// 標準の更新元。環境変数 OST_UPDATE_REPO か、userData の update-repo.txt で上書きできる(renderer からは変更できない)
function getTrustedUpdateRepo() {
    const env = process.env.OST_UPDATE_REPO;
    if (env && REPO_RE.test(env.trim())) return env.trim();
    try {
        const f = path.join(app.getPath('userData'), 'update-repo.txt');
        if (fs.existsSync(f)) {
            const v = fs.readFileSync(f, 'utf8').trim();
            if (REPO_RE.test(v)) return v;
        }
    } catch (e) {}
    return DEFAULT_UPDATE_REPO;
}

function httpsGetJson(url, redirects = 3) {
    return new Promise((resolve, reject) => {
        if (!isAllowedUpdateUrl(url)) return reject(new Error('許可されていない更新元です'));
        const req = https.get(url, { headers: { 'User-Agent': 'OST-Player-AutoUpdater', 'Accept': 'application/vnd.github+json' } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                res.resume();
                if (redirects <= 0) return reject(new Error('リダイレクト回数が上限を超えました'));
                let next;
                try { next = new URL(res.headers.location, url).href; } catch (e) { return reject(e); }
                return httpsGetJson(next, redirects - 1).then(resolve, reject);
            }
            if (res.statusCode !== 200) {
                res.resume();
                return reject(new Error('更新情報の取得に失敗しました: HTTP ' + res.statusCode));
            }
            let size = 0;
            const chunks = [];
            res.on('data', (c) => {
                size += c.length;
                if (size > 5 * 1024 * 1024) { req.destroy(new Error('更新情報が大きすぎます')); return; }
                chunks.push(c);
            });
            res.on('end', () => {
                try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (e) { reject(e); }
            });
            res.on('error', reject);
        });
        req.on('error', reject);
        req.setTimeout(20000, () => req.destroy(new Error('更新情報の取得がタイムアウトしました')));
    });
}

// 戻り値: { path, sha256, bytes }
function downloadFileWithRedirects(url, destPath, progressCb, maxRedirects = 5) {
    return new Promise((resolve, reject) => {
        if (maxRedirects <= 0) return reject(new Error('リダイレクト回数が上限を超えました'));
        if (!isAllowedUpdateUrl(url)) return reject(new Error('許可されていないダウンロード先です'));

        const req = https.get(url, { headers: { 'User-Agent': 'OST-Player-AutoUpdater' } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                res.resume();
                let next;
                try { next = new URL(res.headers.location, url).href; } catch (e) { return reject(e); }
                return downloadFileWithRedirects(next, destPath, progressCb, maxRedirects - 1).then(resolve, reject);
            }
            if (res.statusCode !== 200) {
                res.resume();
                return reject(new Error(`ダウンロード失敗: HTTP ${res.statusCode}`));
            }

            const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
            if (totalBytes > UPDATE_MAX_BYTES) {
                res.resume();
                return reject(new Error('ファイルが大きすぎます'));
            }
            let receivedBytes = 0;
            const hash = crypto.createHash('sha256');
            const fileStream = fs.createWriteStream(destPath);
            let failed = false;
            const fail = (err) => {
                if (failed) return;
                failed = true;
                try { res.destroy(); } catch (e) {}
                fileStream.destroy();
                fs.unlink(destPath, () => {});
                reject(err);
            };

            res.on('data', (chunk) => {
                receivedBytes += chunk.length;
                if (receivedBytes > UPDATE_MAX_BYTES) return fail(new Error('ファイルが大きすぎます'));
                hash.update(chunk);
                if (typeof progressCb === 'function') progressCb(receivedBytes, totalBytes);
            });
            res.on('error', fail);
            res.on('aborted', () => fail(new Error('ダウンロードが中断されました')));
            res.pipe(fileStream);

            fileStream.on('finish', () => {
                if (failed) return;
                if (totalBytes > 0 && receivedBytes !== totalBytes) return fail(new Error('ダウンロードが途中で終了しました'));
                fileStream.close(() => resolve({ path: destPath, sha256: hash.digest('hex'), bytes: receivedBytes }));
            });
            fileStream.on('error', fail);
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

// リリースから、展開できる .zip のアセットを選ぶ(.exe 等は対象外。名前に win を含むものを優先)
function pickUpdateAsset(release) {
    const assets = Array.isArray(release && release.assets) ? release.assets : [];
    const zips = assets.filter(a => a && typeof a.name === 'string' && /\.zip$/i.test(a.name) && typeof a.browser_download_url === 'string');
    return zips.find(a => /win/i.test(a.name)) || zips[0] || null;
}

// GitHub API の digest ("sha256:<64桁>") を取り出す。形式が違えば null
function parseDigest(d) {
    const m = /^sha256:([0-9a-f]{64})$/i.exec(typeof d === 'string' ? d : '');
    return m ? m[1].toLowerCase() : null;
}

// zip の中身のパスが安全か(.. を含む / 絶対パス / ドライブ指定 を拒否)
function validateZipEntryNames(names) {
    for (const n of names) {
        if (typeof n !== 'string' || n.includes('\0')) return false;
        if (/(^|[\\/])\.\.([\\/]|$)/.test(n) || /^[\\/]/.test(n) || /^[A-Za-z]:/.test(n)) return false;
    }
    return true;
}

// .bat に埋め込むパス: 引用符・改行・NUL は拒否し、% は %% にする
function batPathArg(p) {
    if (typeof p !== 'string' || /["\r\n\0]/.test(p)) throw new Error('パスに使用できない文字が含まれています');
    return p.replace(/%/g, '%%');
}

// 更新を適用する .bat を作る。現在のプロセス(PID)の終了だけを待ち、他の Electron アプリは終了させない。
// robocopy が失敗(終了コード 8 以上)したら、バックアップがあれば復元してから起動する
function buildUpdateBatch({ pid, source, target, backup, execPath, startArgs, tempDir, excludeDirs }) {
    if (!Number.isInteger(pid) || pid <= 0) throw new Error('PID が不正です');
    const q = batPathArg;
    const xd = (excludeDirs && excludeDirs.length) ? ' /XD ' + excludeDirs.join(' ') : '';
    const lines = [
        '@echo off',
        'chcp 65001 > NUL',
        'setlocal',
        'set /a TRIES=0',
        ':waitloop',
        `tasklist /FI "PID eq ${pid}" 2>NUL | find "${pid}" > NUL`,
        'if errorlevel 1 goto apply',
        'set /a TRIES+=1',
        'if %TRIES% GEQ 30 goto force',
        'timeout /t 1 /nobreak > NUL',
        'goto waitloop',
        ':force',
        `taskkill /PID ${pid} /F > NUL 2>&1`,
        'timeout /t 2 /nobreak > NUL',
        ':apply'
    ];
    if (backup) lines.push(`robocopy "${q(target)}" "${q(backup)}" /E /NP /R:1 /W:1 /XD dist .git node_modules > NUL`);
    lines.push(`robocopy "${q(source)}" "${q(target)}" /E /IS /IT /NP /R:5 /W:1${xd} > NUL`);
    lines.push('if errorlevel 8 goto rollback', 'goto launch', ':rollback');
    if (backup) lines.push(`robocopy "${q(backup)}" "${q(target)}" /E /IS /IT /NP /R:5 /W:1 > NUL`);
    lines.push(':launch', `start "" "${q(execPath)}"${startArgs ? ' "' + q(startArgs) + '"' : ''}`, 'timeout /t 3 /nobreak > NUL', `rmdir /S /Q "${q(tempDir)}" > NUL 2>&1`, 'exit', '');
    return lines.join('\r\n');
}

function runPowerShell(command, env) {
    return new Promise((resolve, reject) => {
        execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command', command], {
            env: Object.assign({}, process.env, env),
            windowsHide: true,
            maxBuffer: 64 * 1024 * 1024,
            encoding: 'utf8'
        }, (err, stdout, stderr) => {
            if (err) return reject(new Error(stderr || err.message));
            resolve(stdout);
        });
    });
}

ipcMain.handle('perform-auto-update', async (event, opts) => {
    if (mainWindow && event.sender !== mainWindow.webContents) {
        return { success: false, error: '許可されていない呼び出し元です' };
    }
    if (process.platform !== 'win32') {
        return { success: false, error: '自動更新は Windows のみ対応しています' };
    }
    if (updateInProgress) {
        return { success: false, error: '更新を実行中です' };
    }
    updateInProgress = true;
    try {
        // 更新元: 標準(main 側の設定)。renderer が別のリポジトリを指定した場合は、ネイティブのダイアログで本人に確認する
        let repo = getTrustedUpdateRepo();
        const requestedRepo = (opts && typeof opts === 'object' && typeof opts.repo === 'string') ? opts.repo.trim() : '';
        if (requestedRepo && requestedRepo !== repo) {
            if (!REPO_RE.test(requestedRepo)) return { success: false, error: '更新元の指定が不正です' };
            const r = await dialog.showMessageBox(mainWindow, {
                type: 'warning',
                buttons: ['このリポジトリで更新する', 'キャンセル'],
                defaultId: 1,
                cancelId: 1,
                title: '更新元の確認',
                message: `更新元が標準と異なります: ${requestedRepo}`,
                detail: `標準の更新元: ${repo}\nこのリポジトリのリリースを取得してアプリに適用します。心当たりがない場合はキャンセルしてください。`
            });
            if (r.response !== 0) return { success: false, error: '更新をキャンセルしました' };
            repo = requestedRepo;
        }

        event.sender.send('update-progress', { stage: 'downloading', percent: 0, text: '最新リリースの情報を確認中...' });
        const release = await httpsGetJson(`https://api.github.com/repos/${repo}/releases/latest`);
        const tag = String((release && release.tag_name) || '');
        if (!TAG_RE.test(tag)) throw new Error('リリースのタグが不正です');

        const asset = pickUpdateAsset(release);
        let downloadUrl;
        let expectedSha = null;
        if (asset) {
            downloadUrl = asset.browser_download_url;
            if (!downloadUrl.startsWith(`https://github.com/${repo}/`)) throw new Error('リリースのダウンロード先が、更新元のリポジトリと一致しません');
            expectedSha = parseDigest(asset.digest);
            if (!expectedSha) {
                throw new Error('リリースのチェックサム(sha256)が取得できないため、安全のため自動更新を中止しました。GitHub から手動で更新してください。');
            }
        } else {
            // 配布用 zip が無いときは、タグのソースアーカイブを使う(チェックサムは無いが、更新元とホストは固定)
            downloadUrl = `https://github.com/${repo}/archive/refs/tags/${tag}.zip`;
        }

        const tempDir = path.join(os.tmpdir(), 'ostplayer-update-' + Date.now());
        fs.mkdirSync(tempDir, { recursive: true });
        const zipPath = path.join(tempDir, 'update.zip');
        const extractDir = path.join(tempDir, 'extracted');
        const backupDir = path.join(tempDir, 'backup');
        fs.mkdirSync(extractDir, { recursive: true });

        event.sender.send('update-progress', { stage: 'downloading', percent: 0, text: '最新パッケージをダウンロード中...' });
        const dl = await downloadFileWithRedirects(downloadUrl, zipPath, (received, total) => {
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

        event.sender.send('update-progress', { stage: 'extracting', percent: 100, text: 'チェックサムと内容を検証中...' });
        if (expectedSha && dl.sha256 !== expectedSha) {
            throw new Error('ダウンロードしたファイルのチェックサムが一致しません。更新を中止しました。');
        }

        // 展開前に zip の中身を確認する(.. や絶対パスで、意図しない場所へ書き込まれるのを防ぐ)
        const listing = await runPowerShell(
            "Add-Type -AssemblyName System.IO.Compression.FileSystem; $z=[IO.Compression.ZipFile]::OpenRead($env:OST_ZIP); try { $z.Entries | ForEach-Object { $_.FullName }; 'TOTAL:' + ($z.Entries | Measure-Object -Property Length -Sum).Sum } finally { $z.Dispose() }",
            { OST_ZIP: zipPath }
        );
        const rows = listing.split(/\r?\n/).filter(Boolean);
        const totalRow = rows.pop() || '';
        const totalSize = parseInt(totalRow.replace('TOTAL:', ''), 10);
        if (!/^TOTAL:/.test(totalRow) || !(totalSize >= 0) || totalSize > UPDATE_MAX_BYTES * 2) {
            throw new Error('アーカイブの内容を確認できないか、展開後のサイズが大きすぎます');
        }
        if (rows.length > 200000 || !validateZipEntryNames(rows)) {
            throw new Error('アーカイブに安全でないパスが含まれているため、更新を中止しました');
        }

        await runPowerShell('Expand-Archive -LiteralPath $env:OST_ZIP -DestinationPath $env:OST_DEST -Force', { OST_ZIP: zipPath, OST_DEST: extractDir })
            .catch((e) => { throw new Error('アーカイブ展開に失敗しました: ' + e.message); });

        event.sender.send('update-progress', { stage: 'applying', percent: 100, text: '更新を適用してアプリを再起動します...' });

        // 展開したものの種類(配布一式 / アプリのソース)を判定する
        function findUpdatePayload(rootDir) {
            let fullBundleDir = null;
            let appSourceDir = null;

            function scan(dir, depth = 0) {
                if (depth > 4) return;
                try {
                    const entries = fs.readdirSync(dir);
                    const hasResources = entries.includes('resources');
                    const hasExe = entries.some(e => e.toLowerCase().endsWith('.exe'));
                    const hasIndexHtml = entries.includes('index.html');
                    const hasPackageJson = entries.includes('package.json');

                    if (hasResources && hasExe && !fullBundleDir) {
                        fullBundleDir = dir;
                    }
                    if ((hasIndexHtml || hasPackageJson) && !appSourceDir && !hasResources) {
                        appSourceDir = dir;
                    }

                    for (const entry of entries) {
                        const fullPath = path.join(dir, entry);
                        const st = fs.lstatSync(fullPath);
                        if (st.isDirectory() && !st.isSymbolicLink() && entry !== 'node_modules' && entry !== '.git') {
                            scan(fullPath, depth + 1);
                        }
                    }
                } catch (e) {}
            }

            scan(rootDir, 0);

            if (fullBundleDir) return { type: 'full_bundle', path: fullBundleDir };
            if (appSourceDir) return { type: 'app_source', path: appSourceDir };
            return { type: 'unknown', path: rootDir };
        }

        const isPackaged = app.isPackaged;
        const appDir = isPackaged ? path.dirname(process.execPath) : app.getAppPath();
        const execPath = process.execPath;

        const payload = findUpdatePayload(extractDir);
        if (payload.type === 'unknown') {
            throw new Error('更新パッケージの構成を判別できないため、更新を中止しました');
        }
        const sourceDir = payload.path;
        let targetDir = appDir;
        if (isPackaged && payload.type === 'app_source') {
            const packagedAppDir = path.join(appDir, 'resources', 'app');
            targetDir = fs.existsSync(packagedAppDir) ? packagedAppDir : appDir;
        }

        // アプリのソースだけを差し替える場合はバックアップを取り、失敗したら復元する(配布一式の入れ替えは大きいのでバックアップしない)
        const needBackup = payload.type === 'app_source';
        const batPath = path.join(tempDir, 'apply_update.bat');
        const batScript = buildUpdateBatch({
            pid: process.pid,
            source: sourceDir,
            target: targetDir,
            backup: needBackup ? backupDir : null,
            execPath,
            startArgs: isPackaged ? null : targetDir,
            tempDir,
            excludeDirs: isPackaged ? [] : ['dist', '.git', 'node_modules']
        });
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
    } finally {
        // 成功時はアプリが終了するので、実質的に失敗したときだけ再実行できるようにする
        updateInProgress = false;
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
