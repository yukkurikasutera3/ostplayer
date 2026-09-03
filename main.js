const { app, BrowserWindow, Menu, ipcMain } = require('electron');
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

// --- SSP (伺か) SSTP Sender ---
function sendSstpMessage(options) {
    if (!options) return;
    const port = parseInt(options.port) || 9801;
    const host = '127.0.0.1';
    const client = new net.Socket();
    client.setTimeout(1200);

    const title = options.title || 'Unknown Track';
    const artist = options.artist || '';
    const album = options.album || '';
    
    let script = options.script || `\\0\\s[0]『${title}』を再生中だよ！\\e`;
    script = script.replace(/\{title\}/g, title)
                   .replace(/\{artist\}/g, artist)
                   .replace(/\{album\}/g, album);

    const sstpPacket = [
        'NOTIFY SSTP/1.1',
        'Sender: OST Player',
        'Event: OnMusicPlay',
        `Reference0: ${title}`,
        `Reference1: ${artist}`,
        `Reference2: ${album}`,
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

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
