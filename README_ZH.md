# OST Player

[ [日本語](README.md) | [English](README_EN.md) | 简体中文 | [한국어](README_KO.md) ]

高性能多模式桌面音频播放器 & DJ混音器 (Desktop Audio Player with 3D Spatial Audio, SoundFont Synth, Studio EQ & Visualizers)

---

## 概述 (Overview)

**OST Player** 是一款基于 Electron 和 Web Audio API 构建的现代化桌面音频播放器。
它集成了本地音频与视频播放、SoundFont (.sf2 / .sf3) 高保真 MIDI 合成、10 段专业图示均衡器、人声消除 (卡拉OK模式)、游戏原声 0ms 无缝循环、五度圈和弦分析、3D 空间音频 (8D Orbit)、沉浸式全屏可视化效果、Discord Rich Presence (RPC) 状态同步以及 SSP (伺か) SSTP 联动，所有功能均整合在优雅流畅的毛玻璃拟态 UI 之中。

---

## 主要特性 (Key Features)

### 1. 播放与 DJ 模式 (Playback & DJ Modes)
- **Single Mode (单曲模式)**: 支持黑胶唱片封面动画、自动交叉淡入淡出、视频背景同步播放、游戏原声无缝循环与五度圈和弦轮盘显示。
- **Dual Mode (双轨模式)**: 具备 Deck A / Deck B 两个独立通道的实时 DJ 混音器，支持无极交叉推子与同时播放 (Play Both)。
- **Multi Mode (多轨模式)**: 自由添加多个独立音轨，支持多曲重叠播放与独立音量/进度控制。
- **Studio FX Mode (特效模式)**: 10 段专业均衡器 (5/10段切换)、人声消除器 (卡拉OK伴奏)、立体声声相平衡 (L/R 定位)、Swap L/R (声道反转)、Mono Mix (单声道合成)、Bitcrusher、环境音 (雨声/黑胶噪点)、音调锁定变速 (0.5x - 2.0x) 以及 WAV 格式即时导出。
- **Sync Mode (P2P 同步听歌与 DJ 派对模式)**: 纯去中心化 WebRTC 连接，凭 6 位房间代码一键互联，具备毫秒级播放同步、实时点歌排队与投票点赞、DJ 跑马灯公告及房间聊天功能。
- **Help View (帮助与设置)**: Discord RPC、SSP SSTP、软件更新等外部服务的统一管理面板。
- **Visual Mode (大屏视觉模式，※当前版本暂未启用 / 计划于后续大版本重构重返)**: 随音频频率与节拍动态变化的震撼全屏可视化舞台 (Quantum Orb, Neon Spectrum, Laser Wave, Radial Vortex, Starfield 3D Galaxy)。注：在当前版本中因底层架构重构与性能深度调优暂时下线，将在未来的大型版本更新中以全新面貌重装回归。

### 2. 专业录音室音效与人声消除 (Studio Audio & Vocal Cut)
- **10 段图示均衡器**: 31Hz 至 16kHz 独立频段调节滑块，支持 5 段与 10 段一键切换。
- **中置人声消除器 (Vocal Cut)**: 实时消除立体声音源的中央人声成分（0% - 100% 无级强度调节），一键生成伴奏。
- **立体声控制**: 左右平衡调节、左右声道反转 (Swap L/R) 与单声道混合 (Mono Mix)。

### 3. 游戏原声 0ms 无缝循环 (Game OST Loop)
- 自动解析 OGG、FLAC、MP3、WAV 内部嵌入的 `LOOPSTART`、`LOOPLENGTH`、`LOOPEND` 循环标签。
- 到达循环终点时以 0ms 超低延迟硬件级跳转至循环起点，完美再现游戏内无休止背景音乐。
- 4 种循环模式一键切换：关闭 (Off)、列表循环 (All)、单曲循环 (1)、游戏原声循环 (Game Loop)。

### 4. 五度圈和弦轮盘 (Circle of Fifths Visualizer)
- MIDI 播放期间实时解析当前发音音符与和弦成分。
- 在五度圈轮盘上动态绘制霓虹多边形与和弦名称。

### 5. MIDI 与 SoundFont (.sf2 / .sf3) 合成引擎
- **SpessaSynth Core 与 WebAudioTinySynth**: 兼顾高品质 SoundFont 合成与超轻量即时播放。
- **SoundFont 实时热替换 (Hot-Swapping)**: 播放过程中随时更换音源，无需重启播放器即可即时生效。
- **16 通道 MIDI 混音台**: 独立控制每个通道的音量、静音 (Mute)、独奏 (Solo)、音色分配 (Program Change)，配备实时发音 LED。
- **音色即时切换与预设锁定**: 切换乐器时立即切断旧发音并实时应用新音色，锁定机制防止 MIDI 序列重置音色。
- **单曲独立混音配置持久化**: 自动保存每首 MIDI 歌曲的 16 通道均衡设置。
- **高速钢琴卷帘 (Piano Roll)**: 16 通道霓虹瀑布流实时音符可视化。
- **MIDI 转 WAV 高速离线导出**: 将 SoundFont 演奏直接高速渲染保存为高质量 WAV 音频。

### 6. 视频播放与背景动态同步 (Video Playback)
- **硬件级 0ms 超低延迟**: 视频音频直连 Web Audio API，音画绝对同步无偏差。
- **全屏视频背景模式**: 视频播放时画面自动作为应用背景平铺投影。
- **实时背景滤镜调节**: 虚化程度 (Blur)、遮罩暗度 (Overlay)、面板透明度 (Card Opacity) 实时调节。

### 7. 3D 空间音频与 8D 环绕声
- **HRTF 3D PannerNode**: Web Audio API 高精度双耳三维空间定位。
- **8D Auto-Orbit 环绕模式**: 声源围绕听者头部 360 度自动旋转。
- **2D Panner 控制面板**: 拖拽自由调整声源前后左右方位。

### 8. Discord Rich Presence 与 SSP (伺か) SSTP 联动
- **Discord RPC**: Windows 原生 Named Pipe IPC 通信，实时显示曲名、艺术家、进度条与播放状态。
- **SSP (伺か) SSTP**: 遵循 DirectSSTP 1.1 协议，自动解析 ID3 标签并向人格 (Ghost) 发送当前播放歌曲信息，支持自定义 SakuraScript 模板。

### 9. 奖杯陈列室与隐藏成就系统 (Achievements)
- 内置 40 种独特隐藏成就（播放、MIDI、音频特效、DJ、视觉、彩蛋）。
- 解锁时弹出右上角提示并合成提示音，拥有 6 个阶段的玩家称号进阶体系。

### 10. P2P 同步听歌与 DJ 派对模式 (Sync Mode)
基于 WebRTC (PeerJS) 技术的完全去中心化实时共同听歌与派对系统。
- **6 位数字房间代码快速互联**: 主机发起房间生成 6 位代码，受邀者输入代码即可瞬间完成穿透 NAT 的端到端加密 P2P 连接，无需配置端口映射或购买中继服务器。
- **毫秒级播放状态同步**: 自动测量并动态补偿参与者之间的网络往返延迟 (RTT)，实现各端播放、暂停与进度跳转的毫秒级高精度同步。
- **实时点歌队列与点赞投票 (Upvote)**: 房间成员可随时从本地曲库向公共队列点歌，队列根据全员点赞数自动动态调序播放。
- **DJ 跑马灯字幕与即时聊天**: 房主/DJ 可推送醒目的曲目介绍横幅，全员可在房间聊天频道中实时畅聊交流音乐心得。
- **权限管理**: 支持房主独占控歌模式与全员自由切歌模式的一键切换。

### 11. 迷你悬浮播放器 (Mini Player Mode)
- **轻巧画中画置顶窗口**: 极致压缩的常驻屏幕边缘小窗，游戏、办公或日常浏览网页时的极佳伴侣。
- **集成核心操作**: 浓缩播放/暂停、曲目切换、滑动进度条、音量控制及歌曲信息显示。

### 12. MediaSession 与系统媒体键全面支持
- **操作系统硬件媒体键响应**: 完全适配键盘上的播放/暂停、上一首、下一首等多媒体硬件按键。
- **蓝牙设备联动**: 支持无线耳机、车载音响及外部音响设备的按键切歌与播放控制。
- **系统通知与浮层联动**: 在 Windows 锁屏界面、任务栏浮层及音量控制悬浮条中展示曲目元数据与交互按键。

### 13. 一键就地自动更新 (One-Click In-App Auto Updater)
- 自动对接 GitHub Releases API 检测最新版本。
- 点击更新弹窗中的“立即一键更新（自动重启）”，全自动完成下载、解压、覆盖与平滑重启。

---

## 支持格式 (Supported Formats)

| 类别 | 支持格式扩展名 |
| :--- | :--- |
| **音频** | `.mp3`, `.wav`, `.ogg`, `.flac`, `.aac`, `.m4a`, `.wma` |
| **MIDI** | `.mid`, `.midi` |
| **SoundFont** | `.sf2`, `.sf3` |
| **视频** | `.mp4`, `.webm`, `.mov`, `.mkv`, `.m4v`, `.avi`, `.ts`, `.ogv` |
| **播放列表** | JSON 格式备份 (支持完整本地文件还原) |

---

## 运行环境与系统要求 (Requirements)

- **操作系统**: Windows 10 / 11 (64-bit)
- **Node.js**: v18.0.0 或更高版本 (从源码构建时)
- **Electron**: v31.x

---

## 安装与启动 (Getting Started)

### 1. 使用预编译版本 (推荐)
从 [GitHub Releases](https://github.com/yukkurikasutera3/ostplayer/releases) 下载最新的 `OST-Player-vX.X.X-win32-x64.zip`，解压至任意目录后运行 `OST Player.exe` 即可。

### 2. 从源码运行

```bash
git clone https://github.com/yukkurikasutera3/ostplayer.git
cd ostplayer
npm install
npm start
```

### 3. 打包构建

```bash
npm run pack
```
打包输出路径为 `dist/OST Player-win32-x64/`。

---

## 键盘快捷键 (Shortcuts)

| 按键 | 功能 |
| :--- | :--- |
| `Space` | 播放 / 暂停 (所有模式通用) |
| `F11` | 全屏显示切换 |
| `1` - `6` | 切换播放模式 (1: Single, 2: Dual, 3: Multi, 4: FX, 5: Sync, 6: Help) *Visual Mode 当前版本暂未启用* |
| `←` / `→` | 上一曲 / 下一曲 (Single / FX / Sync) |
| `↑` / `↓` | 调节主音量 |
| `[` / `]` | 调整 Dual 模式交叉推子 |
| `M` | 静音切换 |
| 媒体按键 | 播放 / 暂停、上一曲、下一曲 (MediaSession 联动) |

---

## 开源许可证 (License)

本项目遵循 [MIT License](LICENSE) 开源协议。
SpessaSynth、WebAudioTinySynth 等第三方依赖库遵循其各自的开源许可证。
