/**
 * OST Player - Mobile Navigation & Touch Gesture Controller
 * Handles bottom navigation tab switching, viewport transitions, and touch swipe gestures.
 */
(function(window) {
    'use strict';

    let currentMobileTab = 'player'; // 'player' | 'playlist' | 'fx' | 'help'

    function getRightPanel() {
        return document.getElementById('player-right-panel') || document.getElementById('playlist-right-panel');
    }

    function getLeftPanel() {
        return document.getElementById('player-left-panel');
    }

    function setMobileTab(tab) {
        currentMobileTab = tab;

        const leftPanel = getLeftPanel();
        const rightPanel = getRightPanel();
        const navBtns = document.querySelectorAll('.mobile-nav-btn');

        navBtns.forEach(btn => {
            if (btn.dataset.tab === tab) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Update body class for pure CSS styling
        document.body.classList.remove('tab-player', 'tab-playlist', 'tab-fx', 'tab-help');
        document.body.classList.add('tab-' + tab);

        // If on small screen, toggle panel visibility
        if (window.innerWidth <= 768) {
            if (tab === 'playlist') {
                if (leftPanel) {
                    leftPanel.classList.add('hidden');
                    leftPanel.style.display = 'none';
                }
                if (rightPanel) {
                    rightPanel.classList.remove('hidden');
                    rightPanel.style.display = 'flex';
                }
            } else {
                if (rightPanel) {
                    rightPanel.classList.add('hidden');
                    rightPanel.style.display = 'none';
                }
                if (leftPanel) {
                    leftPanel.classList.remove('hidden');
                    leftPanel.style.display = 'flex';
                }

                if (tab === 'player') {
                    if (typeof window.setPlayerMode === 'function') window.setPlayerMode('single');
                } else if (tab === 'fx') {
                    if (typeof window.setPlayerMode === 'function') window.setPlayerMode('fx');
                } else if (tab === 'help') {
                    if (typeof window.setPlayerMode === 'function') window.setPlayerMode('help');
                }
            }
        }

        if (window.MobileBridge && window.MobileBridge.hapticFeedback) {
            window.MobileBridge.hapticFeedback('light');
        }
    }

    // Handle resize to restore desktop dual-panel layout or apply mobile state
    window.addEventListener('resize', () => {
        const leftPanel = getLeftPanel();
        const rightPanel = getRightPanel();
        if (window.innerWidth > 768) {
            document.body.classList.remove('tab-player', 'tab-playlist', 'tab-fx', 'tab-help');
            if (leftPanel) {
                leftPanel.classList.remove('hidden');
                leftPanel.style.display = '';
            }
            if (rightPanel) {
                rightPanel.classList.remove('hidden');
                rightPanel.style.display = '';
            }
        } else {
            setMobileTab(currentMobileTab);
        }
    });

    // Touch Swipe & Gesture Controls on Turntable / Artwork
    function initTouchGestures() {
        const artworkArea = document.getElementById('single-artwork-area') || document.getElementById('single-artwork');
        if (!artworkArea) return;

        let touchStartX = 0;
        let touchStartY = 0;
        let touchStartTime = 0;
        let lastTapTime = 0;

        artworkArea.addEventListener('touchstart', (e) => {
            if (e.touches && e.touches.length === 1) {
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
                touchStartTime = Date.now();
            }
        }, { passive: true });

        artworkArea.addEventListener('touchend', (e) => {
            if (!e.changedTouches || e.changedTouches.length === 0) return;

            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            const diffX = touchEndX - touchStartX;
            const diffY = touchEndY - touchStartY;
            const duration = Date.now() - touchStartTime;

            // Swipe detection (> 50px horizontal movement within 400ms)
            if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY) * 1.5 && duration < 400) {
                if (diffX < 0) {
                    // Swipe Left -> Next Track
                    if (typeof window.playNextTrack === 'function') {
                        window.playNextTrack();
                        if (window.MobileBridge && window.MobileBridge.hapticFeedback) {
                            window.MobileBridge.hapticFeedback('medium');
                        }
                    }
                } else {
                    // Swipe Right -> Previous Track
                    if (typeof window.playPreviousTrack === 'function') {
                        window.playPreviousTrack();
                        if (window.MobileBridge && window.MobileBridge.hapticFeedback) {
                            window.MobileBridge.hapticFeedback('medium');
                        }
                    }
                }
            } else if (Math.abs(diffX) < 15 && Math.abs(diffY) < 15 && duration < 300) {
                // Tap / Double Tap detection
                const now = Date.now();
                if (now - lastTapTime < 300) {
                    // Double Tap -> Toggle Play/Pause
                    if (typeof window.togglePlay === 'function') {
                        window.togglePlay();
                        if (window.MobileBridge && window.MobileBridge.hapticFeedback) {
                            window.MobileBridge.hapticFeedback('heavy');
                        }
                    }
                    lastTapTime = 0;
                } else {
                    lastTapTime = now;
                }
            }
        }, { passive: true });
    }

    // Auto-initialize mobile tab on startup immediately
    function autoInitMobile() {
        if (window.innerWidth <= 768) {
            setMobileTab('player');
        }
        initTouchGestures();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoInitMobile);
    } else {
        autoInitMobile();
    }

    window.addEventListener('load', () => {
        autoInitMobile();
    });

    window.MobileNav = {
        setTab: setMobileTab,
        getCurrentTab: () => currentMobileTab
    };
})(window);
