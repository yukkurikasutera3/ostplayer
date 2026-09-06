const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const net = require('net');

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
const DEFAULT_DISCORD_CLIENT_ID = '1038970224050962582'; // Nuclear Music Player (Free OSS Music Player ID)

class DiscordRPC {
    constructor() {
        this.clientId = DEFAULT_DISCORD_CLIENT_ID;
        this.client = null;
        this.connected = false;
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

    sendActivityPacket(activity) {
        if (!this.connected || !this.client) return;
        const payload = JSON.stringify({
            cmd: 'SET_ACTIVITY',
            args: {
                pid: process.pid,
                activity: activity
            },
            nonce: Date.now().toString()
        });
        this.sendPacket(1, payload);
    }

    clearActivity() {
        this.currentActivity = null;
        if (this.connected && this.client) {
            this.sendActivityPacket(null);
        }
    }

    sendPacket(op, payload) {
        if (!this.client) return;
        try {
            const len = Buffer.byteLength(payload);
            const buf = Buffer.alloc(8 + len);
            buf.writeInt32LE(op, 0);
            buf.writeInt32LE(len, 4);
            buf.write(payload, 8);
            this.client.write(buf);
        } catch (e) {}
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

    const details = data.details || data.title || '再生中';
    const state = data.state || (data.artist ? `${data.artist} | ${data.mode || 'OST Player'}` : 'OST Player');

    const activity = {
        details: details,
        state: state,
        assets: {
            large_image: 'app_icon',
            large_text: 'OST Player'
        }
    };

    if (data.showTime !== false && data.startTime) {
        if (data.endTime && data.endTime > data.startTime) {
            activity.timestamps = {
                start: Math.floor(data.startTime / 1000),
                end: Math.floor(data.endTime / 1000)
            };
        } else {
            activity.timestamps = { start: Math.floor(data.startTime / 1000) };
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
        details: (data && data.title) || 'OST Player - Ultimate',
        state: (data && data.artist) ? `${data.artist} | OST Player` : 'Test Playing Track | OST Player',
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

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    discordRpc.clearActivity();
    discordRpc.disconnect();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
