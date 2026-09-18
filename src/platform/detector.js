/**
 * OST Player - Platform Detection & Abstract Bridge Layer
 * Supports: Desktop (Electron), Mobile (Android/Capacitor/PWA), Web (Standard Browser)
 */
(function(window) {
    'use strict';

    const isElectron = !!(window.electronAPI || (window.process && window.process.type === 'renderer'));
    const isCapacitor = !!(window.Capacitor || (window.capacitor && window.capacitor.isNativePlatform && window.capacitor.isNativePlatform()));
    const isMobileBrowser = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');

    const platformType = isElectron ? 'desktop' : (isCapacitor ? 'android' : (isMobileBrowser ? 'mobile_web' : 'web'));

    window.OST_PLATFORM = {
        type: platformType,
        isDesktop: isElectron,
        isMobile: isCapacitor || isMobileBrowser,
        isAndroidNative: isCapacitor,
        isWeb: !isElectron && !isCapacitor
    };

    console.log(`[OST Platform] Initialized Runtime Environment: ${platformType.toUpperCase()}`);
})(window);
