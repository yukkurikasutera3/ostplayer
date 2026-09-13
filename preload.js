const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
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
    readLocalFile: (filePath) => ipcRenderer.invoke('read-local-file', filePath)
});

