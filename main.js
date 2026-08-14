const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');

let mainWindow;

// --- Restore User Data Directory (Fix Playlist & Background Missing Issue) ---
const appData = app.getPath('appData');
const ultimatePath = path.join(appData, 'ost-player-ultimate');
const stdPath = path.join(appData, 'ost-player');

if (fs.existsSync(ultimatePath)) {
    app.setPath('userData', ultimatePath);
} else if (fs.existsSync(stdPath)) {
    app.setPath('userData', stdPath);
}
app.name = "OST Player";

// --- Native Discord Rich Presence IPC Manager ---
class DiscordRPC {
    constructor(clientId) {
        this.clientId = clientId;
        this.client = null;
        this.connected = false;
        this.currentActivity = null;
    }

    connect() {
        if (this.connected) return Promise.resolve(true);

        return new Promise((resolve) => {
            const pipePath = process.platform === 'win32' ? '\\\\.\\pipe\\discord-ipc-0' : `${process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || '/tmp'}/discord-ipc-0`;
            
            try {
                this.client = net.connect(pipePath, () => {
                    this.connected = true;
                    this.sendHandshake();
                    if (this.currentActivity) {
                        setTimeout(() => this.sendActivityPacket(this.currentActivity), 200);
                    }
                    resolve(true);
                });

                this.client.on('error', () => {
                    this.connected = false;
                    resolve(false);
                });

                this.client.on('close', () => {
                    this.connected = false;
                });
            } catch (e) {
                this.connected = false;
                resolve(false);
            }
        });
    }

    sendHandshake() {
        const payload = JSON.stringify({ v: 1, client_id: this.clientId });
        this.sendPacket(0, payload);
    }

    setActivity(activity) {
        this.currentActivity = activity;
        if (!this.connected) {
            this.connect();
            return;
        }
        this.sendActivityPacket(activity);
    }

    sendActivityPacket(activity) {
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
        this.sendActivityPacket(null);
    }

    sendPacket(op, payload) {
        if (!this.client || !this.connected) return;
        try {
            const len = Buffer.byteLength(payload);
            const buf = Buffer.alloc(8 + len);
            buf.writeInt32LE(op, 0);
            buf.writeInt32LE(len, 4);
            buf.write(payload, 8);
            this.client.write(buf);
        } catch (e) {}
    }
}

// Registered Discord Application Client ID for OST Player
const discordRpc = new DiscordRPC('1045050532296069151');

function initDiscordRPC() {
    discordRpc.connect();
    // Auto-retry connection every 10 seconds if Discord is started later
    setInterval(() => {
        if (!discordRpc.connected) {
            discordRpc.connect();
        }
    }, 10000);
}

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
            }
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

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

    if (!data.enabled || !data.isPlaying) {
        discordRpc.clearActivity();
        return;
    }

    const activity = {
        details: data.title || '再生中',
        state: `Mode: ${data.mode ? data.mode.toUpperCase() : 'SINGLE'} | ${data.artist || 'OST Player'}`,
        assets: {
            large_image: 'app_logo',
            large_text: 'OST Player v3.0'
        }
    };

    if (data.isPlaying && data.startTime) {
        activity.timestamps = { start: Math.floor(data.startTime / 1000) };
    }

    discordRpc.setActivity(activity);
});

// IPC Listener to query Discord connection status
ipcMain.handle('get-discord-status', async () => {
    return { connected: discordRpc.connected };
});

app.whenReady().then(() => {
    initDiscordRPC();
    createWindow();
});

app.on('window-all-closed', () => {
    discordRpc.clearActivity();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
