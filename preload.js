const { contextBridge, ipcRenderer } = require('electron');
const pkg = require('./package.json');

contextBridge.exposeInMainWorld('electronAPI', {
    getAppVersion: () => pkg.version,
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
    // ダウンロード先 URL は main 側で決める(第1引数は互換のために残すが使わない)。renderer は更新元リポジトリの希望(opts.repo)だけを伝える
    performAutoUpdate: (downloadUrl, opts) => ipcRenderer.invoke('perform-auto-update', opts),
    onUpdateProgress: (cb) => {
        ipcRenderer.on('update-progress', (event, data) => {
            if (typeof cb === 'function') cb(data);
        });
    }
});

