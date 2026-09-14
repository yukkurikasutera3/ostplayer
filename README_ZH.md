# OST Player

[ [日本語](README.md) | [English](README_EN.md) | 简体中文 | [한국어](README_KO.md) ]

高性能多模式桌面音频播放器 & DJ混音器 (Desktop Audio Player with 3D Spatial Audio, SoundFont Synth, Spotify Integration & Visualizers)

---

## 概述 (Overview)

**OST Player** 是一款基于 Electron 和 Web Audio API 构建的现代化桌面音频播放器。
它集成了本地音频与视频播放、SoundFont (.sf2 / .sf3) 高保真 MIDI 合成、Spotify Web Playback SDK 原生串流、3D 空间音频 (8D Orbit)、5 段图示均衡器与空间混响、沉浸式全屏可视化效果、Discord Rich Presence (RPC) 状态同步以及 SSP (伺か) SSTP 联动，所有功能均整合在优雅流畅的毛玻璃拟态 UI 之中。

---

## 主要特性 (Key Features)

### 1. 5+1 播放与 DJ 模式 (Playback & DJ Modes)
- **Single Mode (单曲模式)**: 支持黑胶唱片封面动画、自动交叉淡入淡出、视频背景同步播放与 Spotify 歌曲播放。
- **Dual Mode (双轨模式)**: 具备 Deck A / Deck B 两个独立通道的实时 DJ 混音器，支持无极交叉推子与同时播放 (Play Both)。
- **Multi Mode (多轨模式)**: 自由添加多个独立音轨，支持多曲重叠播放与独立音量/进度控制。
- **Studio FX Mode (特效模式)**: 实时 5 段均衡器、低音增强 (Bass Boost)、空间混响、失真、延迟、颤音、音调锁定变速 (0.5x - 2.0x) 以及 WAV 格式即时导出。
- **Visual Mode (大屏视觉模式)**: 随音频频率与节拍动态变化的震撼全屏可视化舞台 (Quantum Orb, Neon Spectrum, Laser Wave, Radial Vortex, Starfield 3D Galaxy)。
- **Help View (帮助与设置)**: Spotify、Discord RPC、SSP SSTP、软件更新等外部服务的统一管理面板。

### 2. Spotify Web API & Web Playback SDK 原生接入
- **安全的 OAuth 2.0 PKCE 认证**: 无需客户端密钥的 PKCE 认证引擎，通过本地回环地址 (`http://127.0.0.1:8888/callback`) 实现一键登录。
- **软件内原生流媒体播放**: 基于 Spotify Web Playback SDK 实现应用内直接流式播放（支持 Premium 完整播放，Free 账户自动回退至 30 秒试听或 Connect 遥控）。
- **资料库与播放列表一键同步**: 快速导入收藏歌曲 (Liked Songs) 与自定义播放列表，专属 "Spotify" 筛选标签。

### 3. MIDI 与 SoundFont (.sf2 / .sf3) 合成引擎
- **SpessaSynth Core 与 WebAudioTinySynth**: 兼顾高品质 SoundFont 合成与超轻量即时播放。
- **SoundFont 实时热替换 (Hot-Swapping)**: 播放过程中随时更换音源，无需重启播放器即可即时生效。
- **16 通道 MIDI 混音台**: 独立控制每个通道的音量、静音 (Mute)、独奏 (Solo)、音色分配 (Program Change)，配备实时发音 LED。
- **音色即时切换与预设锁定**: 切换乐器时立即切断旧发音并实时应用新音色，锁定机制防止 MIDI 序列重置音色。
- **单曲独立混音配置持久化**: 自动保存每首 MIDI 歌曲的 16 通道均衡设置。
- **高速钢琴卷帘 (Piano Roll)**: 16 通道霓虹瀑布流实时音符可视化。
- **MIDI 转 WAV 高速离线导出**: 将 SoundFont 演奏直接高速渲染保存为高质量 WAV 音频。

### 4. 视频播放与背景动态同步 (Video Playback)
- **硬件级 0ms 超低延迟**: 视频音频直连 Web Audio API，音画绝对同步无偏差。
- **全屏视频背景模式**: 视频播放时画面自动作为应用背景平铺投影。
- **实时背景滤镜调节**: 虚化程度 (Blur)、遮罩暗度 (Overlay)、面板透明度 (Card Opacity) 实时调节。

### 5. 3D 空间音频与 8D 环绕声
- **HRTF 3D PannerNode**: Web Audio API 高精度双耳三维空间定位。
- **8D Auto-Orbit 环绕模式**: 声源围绕听者头部 360 度自动旋转。
- **2D Panner 控制面板**: 拖拽自由调整声源前后左右方位。

### 6. Discord Rich Presence 与 SSP (伺か) SSTP 联动
- **Discord RPC**: Windows 原生 Named Pipe IPC 通信，实时显示曲名、艺术家、进度条与播放状态。
- **SSP (伺か) SSTP**: 遵循 DirectSSTP 1.1 协议，自动解析 ID3 标签并向人格 (Ghost) 发送当前播放歌曲信息，支持自定义 SakuraScript 模板。

### 7. 奖杯陈列室与隐藏成就系统 (Achievements)
- 内置 40 种独特隐藏成就（播放、MIDI、音频特效、DJ、视觉、彩蛋）。
- 解锁时弹出右上角提示并合成提示音，拥有 6 个阶段的玩家称号进阶体系。

### 8. 应用内更新检查器 (In-App Update Checker)
- 自动对接 GitHub Releases API 检测最新版本。
- 内置更新日志阅读器，支持一键直链下载最新 Windows ZIP 安装包。

---

## 支持格式 (Supported Formats)

| 类别 | 支持格式扩展名 |
| :--- | :--- |
| **音频** | `.mp3`, `.wav`, `.ogg`, `.flac`, `.aac`, `.m4a`, `.wma` |
| **MIDI** | `.mid`, `.midi` |
| **SoundFont** | `.sf2`, `.sf3` |
| **视频** | `.mp4`, `.webm`, `.mov`, `.mkv`, `.m4v`, `.avi`, `.ts`, `.ogv` |
| **流媒体** | Spotify (Web Playback SDK / Web API) |
| **播放列表** | JSON 格式备份 (导入 / 导出) |

---

## 运行环境与系统要求 (Requirements)

- **操作系统**: Windows 10 / 11 (64-bit)
- **Node.js**: v18.0.0 或更高版本 (从源码构建时)
- **Electron**: v31.x
- **使用 Spotify 联动**: Spotify 账户（完整流媒体播放推荐 Spotify Premium）及 Spotify Developer Dashboard 创建的 Client ID

---

## 安装与启动 (Getting Started)

### 1. 使用预编译版本 (推荐)
从 [GitHub Releases](https://github.com/yukkurikasutera3/ostplayer/releases) 下载最新的 `OST-Player-vX.X.X-win32-x64.zip`，解压至任意目录后运行 `OST Player.exe` 即可。

### 2. 从源码运行

```bash
# 克隆仓库
git clone https://github.com/yukkurikasutera3/ostplayer.git
cd ostplayer

# 安装依赖项
npm install

# 启动应用程序
npm start
```

### 3. 打包构建

```bash
# 构建 Windows 64-bit 便携版
npm run pack
```
打包输出路径为 `dist/OST Player-win32-x64/`。

---

## 键盘快捷键 (Shortcuts)

| 按键 | 功能 |
| :--- | :--- |
| `Space` | 播放 / 暂停 (所有模式通用) |
| `F11` | 全屏显示切换 |
| `1` - `6` | 切换播放模式 (1: Single, 2: Dual, 3: Multi, 4: FX, 5: Visual, 6: Help) |
| `←` / `→` | 上一曲 / 下一曲 (Single / FX / Visual) |
| `↑` / `↓` | 调节主音量 |
| `[` / `]` | 调整 Dual 模式交叉推子 |
| `M` | 静音切换 |

---

## 外部服务配置指南

### Spotify 联动设置
1. 访问 [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) 并创建新应用。
2. 在应用设置中的 Redirect URIs 添加 `http://127.0.0.1:8888/callback` 并保存。
3. 复制 **Client ID**。
4. 打开 OST Player 的 "Help" 页面 -> "Spotify 联动" 卡片，粘贴 Client ID 并点击 "登录 (OAuth PKCE)"。

### Discord Rich Presence 设置
- 启动 OST Player 时只要 Discord 在运行，程序将通过本地管道自动连接。
- 可在 Help 界面自定义状态显示模板和计时器样式。

### SSP (伺か) SSTP 联动设置
- 启动伺か人格 (SSP) 后，在 OST Player 的 Help 页面开启 "SSP SSTP 联动"。
- 可自定义 SakuraScript 脚本模板（如 `\0\s[0]正在播放：{title} ({artist})\e`）。

---

## 开源许可证 (License)

本项目遵循 [MIT License](LICENSE) 开源协议。
SpessaSynth、WebAudioTinySynth 等第三方依赖库遵循其各自的开源许可证。
