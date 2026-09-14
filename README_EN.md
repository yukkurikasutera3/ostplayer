# OST Player

[ [日本語](README.md) | English | [简体中文](README_ZH.md) | [한국어](README_KO.md) ]

High-performance Multi-Mode Desktop Audio Player & DJ Mixer (Desktop Audio Player with 3D Spatial Audio, SoundFont Synth, Spotify Integration & Visualizers)

---

## Overview

**OST Player** is a next-generation desktop audio player built on Electron and the Web Audio API.
It integrates local audio and video playback, high-fidelity SoundFont (.sf2 / .sf3) MIDI synthesis, native Spotify Web Playback SDK streaming, 3D Spatial Audio (8D Orbit), a 5-band graphic equalizer with studio reverb, immersive fullscreen visualizers, Discord Rich Presence (RPC), and SSP (Ukagaka) SSTP speech integration into a unified, glassmorphic user interface.

---

## Key Features

### 1. 5+1 Playback & DJ Modes
- **Single Mode**: Standard player featuring turntable artwork animation, auto crossfade, video background synchronization, and Spotify playback support.
- **Dual Mode**: Real-time DJ mixer with two independent decks (Deck A / Deck B), crossfader, and simultaneous playback (Play Both).
- **Multi Mode**: Multi-deck player allowing unlimited concurrent tracks with synchronized start/stop and per-deck volume controls.
- **Studio FX Mode**: Real-time audio processing with a 5-band EQ, bass boost, spatial reverb, distortion, delay, tremolo, speed/pitch lock (0.5x - 2.0x), and WAV export.
- **Visual Mode**: Dynamic fullscreen visualizers reacting in real-time to audio frequencies (Quantum Orb, Neon Spectrum, Laser Wave, Radial Vortex, Starfield 3D Galaxy).
- **Help View**: Integrated control center for external services (Spotify, Discord RPC, SSP SSTP, Software Updates), update log, and keyboard shortcuts.

### 2. Native Spotify Web API & Web Playback SDK Integration
- **Secure OAuth 2.0 PKCE Authentication**: Zero-secret PKCE flow with local loopback callback (`http://127.0.0.1:8888/callback`) for seamless in-app authentication.
- **Direct In-App Streaming**: Playback via Spotify Web Playback SDK (Premium) with automatic 30s preview and Spotify Connect fallback for Free accounts.
- **Library & Playlist Synchronization**: One-click sync for Liked Songs and user playlists with dedicated "Spotify" filter buttons.

### 3. MIDI & SoundFont (.sf2 / .sf3) Synthesis Engine
- **SpessaSynth Core & WebAudioTinySynth**: High-quality SoundFont rendering combined with ultra-lightweight fallback synthesis.
- **SoundFont Hot-Swapping**: Instant SoundFont switching during runtime without needing an application restart.
- **16-Channel MIDI Mixer**: Real-time control of volume, mute, solo, and instrument selection (Program Change) per channel with active note LEDs.
- **Instant Instrument Reflection & Preset Lock**: Instant voice cutoff and immediate new instrument triggering, protected from MIDI sequence override.
- **Track-Specific Mixer Persistence**: Automatic saving and restoration of 16-channel mixing balance for each MIDI track.
- **High-Speed Piano Roll**: Neon waterfall visualizer displaying active notes in real-time.
- **MIDI to WAV Export**: Offline high-speed rendering of SoundFont MIDI playback into lossless WAV audio files.

### 4. Video Playback & Background Synchronization
- **Hardware-Level 0ms Latency**: Direct Web Audio routing from video elements for zero audio-video desync.
- **Video Background Mode**: Seamless projection of video tracks across the entire application background.
- **Real-Time Visual Filters**: Dynamic background blur, dark overlay opacity, and card opacity sliders.

### 5. 3D Spatial Audio & 8D Orbit
- **HRTF 3D PannerNode**: Web Audio API binaural positioning.
- **8D Auto-Orbit Mode**: Automated 360-degree rotational audio orbiting around the listener.
- **2D Panner Pad**: Interactive drag-and-drop spatial positioner.

### 6. Discord Rich Presence & SSP (Ukagaka) SSTP Integration
- **Discord RPC**: Native Windows Named Pipe IPC displaying track name, artist, elapsed/total time live progress bar, and listening activity.
- **SSP (Ukagaka) SSTP**: DirectSSTP 1.1 support with ID3 tag priority resolution, customizable SakuraScript templates, and port configuration.

### 7. Trophy Room & Hidden Achievements System
- 40 unique achievements across playback, MIDI, audio FX, DJing, visual themes, and secrets.
- Real-time toast notifications on unlock with custom chime synthesis and 6-tier player title progression.

### 8. In-App Update Checker
- Automated GitHub Releases API integration with version comparison.
- In-app release notes viewer and direct one-click Windows ZIP package downloads.

---

## Supported Formats

| Category | Supported Extensions |
| :--- | :--- |
| **Audio** | `.mp3`, `.wav`, `.ogg`, `.flac`, `.aac`, `.m4a`, `.wma` |
| **MIDI** | `.mid`, `.midi` |
| **SoundFont** | `.sf2`, `.sf3` |
| **Video** | `.mp4`, `.webm`, `.mov`, `.mkv`, `.m4v`, `.avi`, `.ts`, `.ogv` |
| **Streaming** | Spotify (Web Playback SDK / Web API) |
| **Playlist** | JSON Backup (Import / Export) |

---

## Requirements

- **Operating System**: Windows 10 / 11 (64-bit)
- **Node.js**: v18.0.0 or higher (when building from source)
- **Electron**: v31.x
- **For Spotify Integration**: A Spotify Account (Spotify Premium recommended for full playback) and a Client ID from Spotify Developer Dashboard

---

## Getting Started

### 1. Using Prebuilt Release (Recommended)
Download the latest `OST-Player-vX.X.X-win32-x64.zip` from [GitHub Releases](https://github.com/yukkurikasutera3/ostplayer/releases), extract the archive to your desired directory, and launch `OST Player.exe`.

### 2. Running from Source

```bash
# Clone the repository
git clone https://github.com/yukkurikasutera3/ostplayer.git
cd ostplayer

# Install dependencies
npm install

# Start the application
npm start
```

### 3. Building Packages

```bash
# Build portable Windows 64-bit binary
npm run pack
```
Packaged binaries will be located in `dist/OST Player-win32-x64/`.

---

## Keyboard Shortcuts

| Key | Action |
| :--- | :--- |
| `Space` | Play / Pause (All modes) |
| `F11` | Toggle Fullscreen |
| `1` - `6` | Switch Player Mode (1: Single, 2: Dual, 3: Multi, 4: FX, 5: Visual, 6: Help) |
| `←` / `→` | Previous / Next Track (Single / FX / Visual) |
| `↑` / `↓` | Adjust Master Volume |
| `[` / `]` | Move Dual Mode Crossfader |
| `M` | Toggle Master Mute |

---

## External Services Setup Guide

### Spotify Setup
1. Log in to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and create a new application.
2. In the app settings, add `http://127.0.0.1:8888/callback` under Redirect URIs and save.
3. Copy the **Client ID**.
4. In OST Player, go to the Help View -> Spotify Integration card, paste your Client ID, and click "Login (OAuth PKCE)".

### Discord Rich Presence Setup
- Simply launch OST Player while Discord is running; the application will automatically connect via local Named Pipes.
- You can customize display templates and timer options in the Help View.

### SSP (Ukagaka) SSTP Setup
- Launch your Ukagaka ghost (SSP) and turn on "SSP SSTP Integration" in the OST Player Help View.
- Customize SakuraScript templates (e.g., `\0\s[0]Now playing: {title} by {artist}\e`) as desired.

---

## License

This project is licensed under the [MIT License](LICENSE).
Third-party libraries including SpessaSynth and WebAudioTinySynth are distributed under their respective open-source licenses.
