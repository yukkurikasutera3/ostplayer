/**
 * OST Player - Desktop (Electron) Platform Bridge
 * Wraps Discord Rich Presence, SSP SSTP, In-Place Auto Updater, and Native OS features.
 */
(function(window) {
    'use strict';

    const api = window.electronAPI || {};

    window.DesktopBridge = {
        isAvailable: !!window.electronAPI,

        // Discord Rich Presence
        updateDiscordPresence: function(data) {
            if (api.updateDiscordPresence) api.updateDiscordPresence(data);
        },
        testDiscord: function(data) {
            if (api.testDiscord) api.testDiscord(data);
        },
        getDiscordStatus: function() {
            if (api.getDiscordStatus) return api.getDiscordStatus();
            return Promise.resolve({ enabled: false, connected: false, user: null });
        },
        onDiscordStatusUpdated: function(callback) {
            if (api.onDiscordStatusUpdated) api.onDiscordStatusUpdated(callback);
        },

        // SSP (伺か) SSTP
        notifySstpTrack: function(options) {
            if (api.notifySstpTrack) api.notifySstpTrack(options);
        },
        testSstp: function(options) {
            if (api.testSstp) api.testSstp(options);
        },

        // Window & Navigation
        toggleFullscreen: function() {
            if (api.toggleFullscreen) api.toggleFullscreen();
        },
        toggleMiniMode: function(isMini) {
            if (api.toggleMiniMode) api.toggleMiniMode(isMini);
        },
        openExternal: function(url) {
            if (api.openExternal) {
                api.openExternal(url);
            } else {
                window.open(url, '_blank', 'noopener,noreferrer');
            }
        },

        // File system (Playlist JSON restore)
        readLocalFile: function(filePath) {
            if (api.readLocalFile) return api.readLocalFile(filePath);
            return Promise.resolve(null);
        },

        // Auto Updater
        performAutoUpdate: function(downloadUrl) {
            if (api.performAutoUpdate) return api.performAutoUpdate(downloadUrl);
            return Promise.resolve({ success: false, error: 'Auto-updater is only available on desktop' });
        },
        onUpdateProgress: function(callback) {
            if (api.onUpdateProgress) api.onUpdateProgress(callback);
        }
    };
})(window);
