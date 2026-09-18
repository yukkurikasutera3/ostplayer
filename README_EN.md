# OST Player

[ [日本語](README.md) | English | [简体中文](README_ZH.md) | [한국어](README_KO.md) ]

High-performance Multi-Mode Desktop Audio Player & DJ Mixer (Desktop Audio Player with 3D Spatial Audio, SoundFont Synth, Studio EQ & Visualizers)

---

## Overview

**OST Player** is a next-generation desktop audio player built on Electron and the Web Audio API.
It integrates local audio and video playback, high-fidelity SoundFont (.sf2 / .sf3) MIDI synthesis, a 10-band studio graphic EQ with vocal cut (karaoke mode), 0ms seamless game OST looping, Circle of Fifths chord analysis, 3D Spatial Audio (8D Orbit), immersive fullscreen visualizers, Discord Rich Presence (RPC), and SSP (Ukagaka) SSTP speech integration into a unified, glassmorphic user interface.

---

## Key Features

### 1. 5+1 Playback & DJ Modes
- **Single Mode**: Standard player featuring turntable artwork animation, auto crossfade, video background synchronization, 0ms game loop, and Circle of Fifths chord wheel display.
- **Dual Mode**: Dual independent decks (Deck A / Deck B) for real-time DJ mixing, crossfader, and simultaneous playback (Play Both).
- **Multi Mode**: Add unlimited decks for layered playback and individual volume controls.
- **Studio FX Mode**: 10-band studio EQ (5/10 band toggle), center channel vocal remover (karaoke), stereo pan (L/R balance), Swap L/R, Mono Mix, Bitcrusher, tape delay, ambient sound effects (rain/vinyl noise), pitch-locked tempo adjustments (0.5x–2.0x), and WAV export.
- **Visual Mode**: Fullscreen dynamic audio visualizers reactive to spectrum and beat (Quantum Orb, Neon Spectrum, Laser Wave, Radial Vortex, Starfield 3D Galaxy).
- **Help View**: Integrated control center for external services (Discord RPC, SSP SSTP, Software Updates), update log, and keyboard shortcuts.

### 2. Studio Sound & Center Channel Vocal Remover
- **10-Band Graphic Equalizer**: 31Hz to 16kHz independent frequency sliders with 5-Band / 10-Band switchable modes.
- **Center Channel Vocal Remover (Vocal Cut)**: Removes centered vocal frequencies via out-of-phase stereo cancellation with an adjustable intensity slider (0%–100%).
- **Stereo Pan & Channel Routing**: Stereo balance slider, Swap L/R channel inversion, and Mono Mix for single-earphone monitoring.

### 3. Game OST 0ms Seamless Loop Point Engine
- Automatically parses `LOOPSTART`, `LOOPLENGTH`, and `LOOPEND` tags from OGG, FLAC, MP3, and WAV files.
- 0ms hardware buffer seek when reaching the loop end point, creating seamless infinite background music.
- 4-way loop toggle: Off, All, 1, and Game OST Infinite Loop.

### 4. Circle of Fifths Chord Wheel Visualizer
- Real-time chord progression and note breakdown analysis during MIDI playback.
- Geometric neon polygon rendering and chord name identification directly on the Circle of Fifths wheel.

### 5. MIDI & SoundFont (.sf2 / .sf3) Synthesis Engine
- **SpessaSynth Core & WebAudioTinySynth**: High-fidelity SoundFont rendering and lightweight MIDI synthesis.
- **Hot-Swappable SoundFonts**: Switch custom SoundFonts during active sessions with immediate voice re-binding.
- **16-Channel MIDI Mixer**: Real-time per-channel volume, mute, solo, and instrument (Program Change) control.
- **Instant Instrument Switching & Preset Lock**: Instant voice clearing when changing instruments; protected against accidental MIDI program change overrides.
- **Per-Track Preset Persistence**: Automatically saves and restores 16-channel mixing configurations per song.
- **High-Performance Piano Roll**: Sharp, waterfall neon note visualization.
- **Fast MIDI-to-WAV Export**: Direct audio rendering to high-quality `.wav` files.

### 6. Video Playback & Background Synchronization
- **Zero Latency (0ms Hardware Sync)**: Direct Web Audio API stream routing for perfectly synced audio and video.
- **Background Video Mode**: Projections of video playback behind the UI cards.
- **Dynamic Background FX**: Real-time Blur, Darkness Overlay, and Glass Card Opacity sliders.

### 7. 3D Spatial Audio & 8D Orbit
- **HRTF 3D PannerNode**: Web Audio binaural positioning.
- **8D Auto-Orbit**: Automatic 360-degree sound rotation around the listener.
- **2D Panner Pad**: Interactive X/Y drag pad for positioning sound in 2D space.

### 8. Discord Rich Presence (RPC) & SSP (Ukagaka) SSTP Integration
- **Discord RPC**: Zero-dependency Windows Named Pipe IPC. Broadcasts track title, artist, and elapsed/total duration progress bars.
- **SSP (Ukagaka) SSTP Integration**: DirectSSTP 1.1 compliant. Parses ID3 tags and triggers ghost speech with customizable SakuraScript templates.

### 9. Trophy Room & Achievement System
- 40 hidden achievements spanning playback, MIDI, audio FX, DJing, visualizer stages, and easter eggs.
- Achievement unlock toast notifications and a 6-tier player title progression system.

### 10. One-Click In-App Auto Updater
- Connects to GitHub Releases API to detect updates automatically.
- One-click in-place automatic downloading, unzipping, file replacement, and restart directly within the app.

---

## Supported Formats

| Type | Extensions |
| :--- | :--- |
| **Audio Files** | `.mp3`, `.wav`, `.ogg`, `.flac`, `.aac`, `.m4a`, `.wma` |
| **MIDI Files** | `.mid`, `.midi` |
| **SoundFonts** | `.sf2`, `.sf3` |
| **Video Files** | `.mp4`, `.webm`, `.mov`, `.mkv`, `.m4v`, `.avi`, `.ts`, `.ogv` |
| **Playlists** | JSON backup (with full local file restoration) |

---

## System Requirements

- **OS**: Windows 10 / 11 (64-bit)
- **Node.js**: v18.0.0 or higher (when building from source)
- **Electron**: v31.x

---

## Getting Started

### 1. Using the Release Package (Recommended)
Download the latest `OST-Player-vX.X.X-win32-x64.zip` from [GitHub Releases](https://github.com/yukkurikasutera3/ostplayer/releases), extract it, and run `OST Player.exe`.

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
| `Space` | Play / Pause |
| `F11` | Toggle Fullscreen |
| `1` – `6` | Mode Switching (1: Single, 2: Dual, 3: Multi, 4: FX, 5: Visual, 6: Help) |
| `←` / `→` | Previous / Next Track |
| `↑` / `↓` | Adjust Master Volume |
| `[` / `]` | Move Crossfader (Dual Mode) |
| `M` | Master Mute Toggle |

---

## License

This project is licensed under the [MIT License](LICENSE).
Third-party libraries (SpessaSynth, WebAudioTinySynth, etc.) belong to their respective open-source licenses.
