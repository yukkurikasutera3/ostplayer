/**
 * OST Player - Desktop (Electron) Platform Bridge
 * Wraps Discord Rich Presence, SSP SSTP, In-Place Auto Updater, and Native OS features.
 */
(function(window) {
    'use strict';

    function getApi() {
        return window.electronAPI || {};
    }

    window.DesktopBridge = {
        get isAvailable() {
            return !!window.electronAPI;
        },

        // Discord Rich Presence
        updateDiscordPresence: function(data) {
            const api = getApi();
            if (api.updateDiscordPresence) api.updateDiscordPresence(data);
        },
        testDiscord: function(data) {
            const api = getApi();
            if (api.testDiscord) api.testDiscord(data);
        },
        getDiscordStatus: function() {
            const api = getApi();
            if (api.getDiscordStatus) return api.getDiscordStatus();
            return Promise.resolve({ enabled: false, connected: false, user: null });
        },
        onDiscordStatusUpdated: function(callback) {
            const api = getApi();
            if (api.onDiscordStatusUpdated) api.onDiscordStatusUpdated(callback);
        },

        // SSP (伺か) SSTP
        notifySstpTrack: function(options) {
            const api = getApi();
            if (api.notifySstpTrack) api.notifySstpTrack(options);
        },
        testSstp: function(options) {
            const api = getApi();
            if (api.testSstp) api.testSstp(options);
        },

        // Window & Navigation
        toggleFullscreen: function() {
            const api = getApi();
            if (api.toggleFullscreen) api.toggleFullscreen();
        },
        toggleMiniMode: function(isMini) {
            const api = getApi();
            if (api.toggleMiniMode) api.toggleMiniMode(isMini);
        },
        openExternal: function(url) {
            const api = getApi();
            if (api.openExternal) {
                api.openExternal(url);
            } else {
                window.open(url, '_blank', 'noopener,noreferrer');
            }
        },

        // File system (Playlist JSON restore)
        readLocalFile: function(filePath) {
            const api = getApi();
            if (api.readLocalFile) return api.readLocalFile(filePath);
            return Promise.resolve(null);
        },

        // Auto Updater
        performAutoUpdate: function(downloadUrl, opts) {
            const api = getApi();
            if (api.performAutoUpdate) return api.performAutoUpdate(downloadUrl, opts);
            return Promise.resolve({ success: false, error: 'Auto-updater is only available on desktop' });
        },
        onUpdateProgress: function(callback) {
            const api = getApi();
            if (api.onUpdateProgress) api.onUpdateProgress(callback);
        }
    };
})(window);
