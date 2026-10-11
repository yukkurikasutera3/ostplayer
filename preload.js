const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getAppVersion: () => {
        try {
            return ipcRenderer.sendSync('get-app-version') || '3.9.1';
        } catch (e) {
            return '3.9.1';
        }
    },
    toggleMiniMode: (isMini) => ipcRenderer.send('toggle-mini-mode', isMini),
    toggleFullScreen: () => ipcRenderer.send('toggle-fullscreen'),
    notifySstpTrack: (options) => ipcRenderer.send('notify-sstp-track', options),
    testSstp: (options) => ipcRenderer.send('test-sstp', options),
    updateDiscordPresence: (data) => ipcRenderer.send('update-discord-presence', data),
    getDiscordStatus: () => ipcRenderer.invoke('get-discord-status'),
    testDiscord: (data) => ipcRenderer.send('test-discord', data),
    onDiscordStatusUpdated: (cb) => {
        ipcRenderer.on('discord-status-updated', (event, status) => {
            if (typeof cb === 'function') cb(status);
        });
    },
    openExternal: (url) => ipcRenderer.send('open-external', url),
    readLocalFile: (filePath) => ipcRenderer.invoke('read-local-file', filePath),
    // 更新実行: downloadUrl または opts ({ repo, downloadUrl }) のどちらの引数形式でも透過的に処理
    performAutoUpdate: (arg1, arg2) => {
        let opts = {};
        if (typeof arg1 === 'string') {
            opts.downloadUrl = arg1;
            if (arg2 && typeof arg2 === 'object') Object.assign(opts, arg2);
        } else if (arg1 && typeof arg1 === 'object') {
            Object.assign(opts, arg1);
        }
        return ipcRenderer.invoke('perform-auto-update', opts);
    },
    onUpdateProgress: (cb) => {
        ipcRenderer.on('update-progress', (event, data) => {
            if (typeof cb === 'function') cb(data);
        });
    }
});

