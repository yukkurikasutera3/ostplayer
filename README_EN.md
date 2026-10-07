# OST Player

[![GitHub release](https://img.shields.io/github/v/release/yukkurikasutera3/ostplayer)](https://github.com/yukkurikasutera3/ostplayer/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Web%20%7C%20Android-green.svg)](https://github.com/yukkurikasutera3/ostplayer)

> [!NOTE]
> **Multilingual Documentation**:
> - [日本語 (Japanese) README](README.md)
> - [한국어 (Korean) README](README_KO.md)
> - [中文 (Chinese) README](README_ZH.md)

**OST Player** is a high-performance, cross-platform audio player crafted for video game soundtracks and local audio libraries. Featuring studio-grade SoundFont MIDI synthesis (SpessaSynth), seamless video background synchronization, 3D spatial audio, 10-band graphic EQ, Circle of Fifths chord analyzer, and serverless WebRTC P2P mesh synchronization for synchronized listening (DJ Room), wireless smartphone remote control, and high-speed Wi-Fi playlist batch transfers.

---

## Key Features

### 1. Multi-Player Engine Modes
- **Single Mode**: Intuitive turntable interface with rich tag metadata and playlist navigation.
- **Dual Mode**: Dual deck (Deck A / B) mixing with smooth crossfading for DJ performances.
- **Multi Mode**: Simultaneous 4-track playback with real-time individual volume balancing.
- **FX Mode**: Real-time audio processing with Reverb, Delay, Distortion, and Parametric Filter.
- **Sync Mode (DJ Room & Remote)**: Instant serverless WebRTC P2P sync listening, wireless remote control, and Wi-Fi playlist transfers.

### 2. Multi-UI Layout Switching System
Switch between 7 curated layouts from Settings (Album and Now playing have been consolidated into Library and Split):
1. **Split**: Classic dual-pane layout.
2. **Library**: 3-pane media library with playlists, track table, and bottom player bar.
3. **Cover wall**: Responsive album artwork grid with customizable zoom levels.
4. **Shelf**: CD/vinyl spine-shelf browsing experience.
5. **Stage**: Cinematic backdrop with prominent audio visualizers.
6. **Terminal**: Cyberpunk CLI terminal with Vim keybindings (j/k/g/G/Enter//).
7. **Retro LCD**: Vintage 20-band green LCD audio spectrum and telemetry display.

### 3. Studio Sound & Harmonic Analysis
- **10-Band Graphic Equalizer**: Independent frequency sliders from 31Hz to 16kHz (5-Band / 10-Band toggling).
- **Center Vocal Cut / Karaoke Mode**: Phase-inverted vocal cancellation.
- **Stereo Imaging**: Left/Right balance pan, Swap L/R, and Mono Mixdown.
- **Circle of Fifths Chord Wheel**: Real-time chord visualizer with Channel 10 drum exclusion.
- **0ms Seamless Game Loop**: Automatic loop point detection for endless game soundtrack loops.

### 4. Real-time Audio Visualizers
- **Visualizer Modes**: Bars, Oscilloscope Wave, Circular Spectrum, Orbit Particles, Mirror Bars, and Quantum Orb.
- **Customizable Rendering**: 30 / 60 / 120 FPS target frame rates, FFT resolution, and smoothing.

### 5. High-Fidelity SoundFont MIDI Engine
- **SpessaSynth & WebAudioTinySynth**: High-fidelity SoundFont synthesis.
- **Hot-Swapping**: Switch `.sf2` / `.sf3` banks instantly without interrupting audio sessions.
- **16-Channel Mixer**: Real-time control of volume, pan, mute, solo, and program changes.
- **Preset Lock & State Persistence**: Prevents unintended MIDI program changes and remembers channel balance per track.
- **Neon Piano Roll**: Waterfall visualizer of live MIDI notes.

### 6. P2P Sync Listening & DJ Room (Sync Mode)
Serverless WebRTC mesh synchronized listening:
- **6-Digit Room Codes**: Connect instantly without port forwarding.
- **Millisecond Precision Sync**: Clock offset and RTT latency compensation.
- **Live Chat & DJ Announcements**: Real-time ticker banner and inline timeline.
- **Pass the AUX**: Transfer DJ control privileges seamlessly.

### 7. Wireless Smartphone Remote Control [NEW]
- **Bi-directional Real-time Sync**: Control PC playback (Play/Pause, Seek, Prev/Next, Volume, Loop, and Mode) from your phone over local Wi-Fi / P2P.
- **Touch-Optimized Controls**: Oversized buttons, responsive seek bar, volume slider, and haptic feedback.
- **Quick Track Browser**: Browse PC playlist directly from your mobile device and switch tracks on demand.

### 8. Wi-Fi Playlist Batch Transfer [NEW]
- **High-Speed Streaming**: Transfer complete playlists and audio/MIDI files from PC to mobile over Wi-Fi.
- **16KB Chunking & ACK Verification**: Prevents buffer overflow and memory bottlenecks.
- **Complete Offline Storage**: Transferred tracks are automatically saved into mobile IndexedDB, allowing offline playback anytime.

### 9. MediaSession & Native OS Controls
- Full support for OS media keys, Bluetooth headset hardware buttons, and system notification flyouts.

### 10. One-Click In-App Auto Updater
- GitHub Releases integration with 1-click in-place background update, checksum verification, and automatic restart.

---

## Supported Formats

| Type | Extensions |
| :--- | :--- |
| **Audio Files** | `.mp3`, `.wav`, `.ogg`, `.flac`, `.aac`, `.m4a`, `.wma`, `.opus` |
| **MIDI Files** | `.mid`, `.midi` |
| **SoundFonts** | `.sf2`, `.sf3` |
| **Video Files** | `.mp4`, `.webm`, `.mov`, `.mkv`, `.m4v`, `.avi`, `.ts`, `.ogv` |
| **Playlists** | JSON backup (with full local file restoration) |

---

## System Requirements

### 1. Desktop Environment (Windows Electron Application)
- **Supported OS**: Windows 10 (64-bit) / Windows 11 (64-bit) (Version 1903 / Build 18362 or higher)
- **CPU**: Intel Core i3 equivalent or higher / AMD Ryzen 3 equivalent or higher (x86_64 architecture)
- **Memory (RAM)**:
  - Minimum: 4 GB RAM
  - Recommended: 8 GB RAM or higher (for large SoundFont banks, 3D audio processing, and heavy visualizers)
- **Storage**:
  - Application footprint: 350 MB free space
  - Library data: Additional storage depending on audio and SoundFont files
- **Audio Output**: DirectSound / WASAPI compatible audio hardware or interface
- **Desktop Integrations (Optional)**:
  - Discord Rich Presence: Discord Desktop client with IPC enabled
  - SSP (Ukagaka): Ghost environment supporting DirectSSTP 1.1
- **Development Build (From Source)**:
  - Node.js: v18.0.0 or higher
  - Electron: v31.x

### 2. Mobile Environment (Android & Mobile Browsers)
- **Supported OS**: Android 8.0 (Oreo / API Level 26) or higher (Android 10+ recommended)
- **Runtime**: Capacitor 8.x native APK or Modern Mobile Browsers
- **Recommended Browsers**: Google Chrome Mobile (v90+), Samsung Internet (v15+), Firefox Mobile
- **Hardware Features**:
  - Capacitive multi-touch display (swipe and double-tap gesture support)
  - Haptic vibration motor (for tactile touch feedback)
- **Background Playback**:
  - MediaSession API (Lock screen and notification shade controls)
  - Screen WakeLock API (Screen on during music visualization)

### 3. Web Environment (Cross-Platform Browsers)
- **Supported Browsers**:
  - Google Chrome (v90+)
  - Microsoft Edge (v90+)
  - Mozilla Firefox (v88+)
  - Apple Safari (v15+)
- **Required Web APIs**:
  - Web Audio API & AudioWorklet (Low-latency audio pipeline and SpessaSynth synthesis)
  - WebRTC & RTCDataChannel (P2P synchronization, remote control, Wi-Fi batch file transfer)
  - IndexedDB & Web Storage (Local persistent offline caching)

### 4. Network Requirements (P2P Sync / Remote / Wi-Fi Transfer)
- **Protocol**: 6-digit room code direct encrypted peer-to-peer communication (WebRTC PeerJS)
- **Local Wi-Fi Transfer / LAN Sync**: High-speed direct link on same Wi-Fi / LAN (AP isolation disabled)
- **Internet P2P Sync**: NAT traversal via STUN servers (compatible with standard residential broadband and mobile networks)
- **Bandwidth**:
  - Remote control commands: Minimal (few KB/s)
  - Audio streaming / playlist batch sync: 10 Mbps+ recommended on local Wi-Fi

---

## Getting Started

### 1. Using Release Binaries (Recommended)
Download the latest `OST-Player-vX.X.X-win32-x64.zip` from [GitHub Releases](https://github.com/yukkurikasutera3/ostplayer/releases), extract it, and launch `OST Player.exe`.

### 2. Running from Source

```bash
git clone https://github.com/yukkurikasutera3/ostplayer.git
cd ostplayer
npm install
npm start
```

### 3. Packaging

```bash
npm run pack
```
Binaries will be output to `dist/OST Player-win32-x64/`.

---

## Keyboard Shortcuts

| Key | Action |
| :--- | :--- |
| `Space` | Play / Pause (Universal) |
| `F11` | Toggle Fullscreen |
| `1` - `6` | Mode Switching (1: Single, 2: Dual, 3: Multi, 4: FX, 5: Sync, 6: Help) |
| `Left` / `Right` | Previous / Next Track (Single / FX / Sync) |
| `Up` / `Down` | Adjust Master Volume |
| `[` / `]` | Move Crossfader (Dual Mode) |
| `M` | Master Mute Toggle |
| Media Keys | Play / Pause, Previous Track, Next Track (MediaSession Integration) |

---

## License

This project is licensed under the [MIT License](LICENSE).
Third-party libraries (SpessaSynth, WebAudioTinySynth, etc.) belong to their respective open-source licenses.
