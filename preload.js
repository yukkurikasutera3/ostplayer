const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    toggleMiniMode: (isMini) => ipcRenderer.send('toggle-mini-mode', isMini),
    updateDiscordPresence: (data) => ipcRenderer.send('update-discord-presence', data),
    getDiscordStatus: () => ipcRenderer.invoke('get-discord-status')
});
