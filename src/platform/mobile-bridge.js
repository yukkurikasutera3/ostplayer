/**
 * OST Player - Mobile (Android / Capacitor / PWA) Platform Bridge
 * Handles MediaSession API (Lock screen / Notification bar controls),
 * Haptic Vibration, Screen WakeLock, and Native Touch interactions.
 */
(function(window) {
    'use strict';

    let wakeLock = null;

    window.MobileBridge = {
        isAvailable: typeof navigator !== 'undefined' && ('mediaSession' in navigator || 'vibrate' in navigator),

        // Android / OS MediaSession (Notification / Lock Screen Controls)
        updateMetadata: function(track) {
            if (!('mediaSession' in navigator) || !track) return;

            try {
                const artworkList = [];
                if (track.coverArt) {
                    artworkList.push({ src: track.coverArt, sizes: '512x512', type: 'image/jpeg' });
                }

                navigator.mediaSession.metadata = new MediaMetadata({
                    title: track.name || track.title || 'Unknown Track',
                    artist: track.artist || 'OST Player',
                    album: track.album || '',
                    artwork: artworkList
                });
            } catch (e) {
                console.warn('[MobileBridge] MediaMetadata update error:', e);
            }
        },

        setPlaybackState: function(isPlaying) {
            if (!('mediaSession' in navigator)) return;
            try {
                navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
            } catch (e) {}
        },

        setPositionState: function(state) {
            if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
            try {
                if (state && state.duration && !isNaN(state.duration) && state.duration > 0) {
                    navigator.mediaSession.setPositionState({
                        duration: Math.max(1, state.duration),
                        playbackRate: state.playbackRate || 1.0,
                        position: Math.min(state.position || 0, state.duration)
                    });
                }
            } catch (e) {}
        },

        initMediaActionHandlers: function(callbacks) {
            if (!('mediaSession' in navigator) || !callbacks) return;

            const actions = [
                ['play', callbacks.onPlay],
                ['pause', callbacks.onPause],
                ['previoustrack', callbacks.onPrev],
                ['nexttrack', callbacks.onNext],
                ['seekto', callbacks.onSeek]
            ];

            actions.forEach(([action, handler]) => {
                if (handler && typeof handler === 'function') {
                    try {
                        navigator.mediaSession.setActionHandler(action, handler);
                    } catch (e) {}
                }
            });
        },

        // Haptic Feedback for Mobile Touch
        hapticFeedback: function(intensity = 'light') {
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
                try {
                    if (intensity === 'light') navigator.vibrate(10);
                    else if (intensity === 'medium') navigator.vibrate(25);
                    else if (intensity === 'heavy') navigator.vibrate(50);
                } catch (e) {}
            }
        },

        // Screen WakeLock (Keep screen on during active visualizer / music playback)
        requestWakeLock: async function() {
            if ('wakeLock' in navigator && !wakeLock) {
                try {
                    wakeLock = await navigator.wakeLock.request('screen');
                    wakeLock.addEventListener('release', () => {
                        wakeLock = null;
                    });
                } catch (e) {}
            }
        },

        releaseWakeLock: function() {
            if (wakeLock) {
                try {
                    wakeLock.release();
                    wakeLock = null;
                } catch (e) {}
            }
        }
    };
})(window);
