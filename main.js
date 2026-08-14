const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

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
