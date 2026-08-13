const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    toggleMiniMode: (isMini) => ipcRenderer.send('toggle-mini-mode', isMini),
    getRemoteInfo: () => ipcRenderer.invoke('get-remote-info'),
    updateRemoteStatus: (status) => ipcRenderer.send('update-remote-status', status),
    onRemoteCommand: (callback) => ipcRenderer.on('remote-command', (event, cmd) => callback(cmd))
});
