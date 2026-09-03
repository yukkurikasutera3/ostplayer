const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    toggleMiniMode: (isMini) => ipcRenderer.send('toggle-mini-mode', isMini),
    notifySstpTrack: (options) => ipcRenderer.send('notify-sstp-track', options),
    testSstp: (options) => ipcRenderer.send('test-sstp', options)
});
