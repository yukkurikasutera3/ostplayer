# OST Player

[ 日本語 | [English](README_EN.md) | [简体中文](README_ZH.md) | [한국어](README_KO.md) ]

高機能マルチモード・オーディオプレイヤー & DJミキサー (Desktop Audio Player with 3D Spatial Audio, SoundFont Synth, Studio EQ & Visualizers)

---

## 概要 (Overview)

**OST Player** は、Electron / Web Audio API を基盤としたデスクトップ向け次世代オーディオプレイヤーです。
ローカル音声・動画ファイルの再生、SoundFont (.sf2 / .sf3) による高品質MIDIシンセシス、本格10バンドスタジオEQ・空間リバーブ、ボーカルキャンセラー、ゲームサントラ特化0msシームレスループ、五度圏コードホイール、大画面ビジュアライザー、Discord Rich Presence (RPC) 連携、SSP (伺か) SSTP 連動などを1つの美麗なガラスモーフィズムUIに統合しています。

---

## 主な機能 (Key Features)

### 1. 5+1 プレイヤーモード (Playback & DJ Modes)
- **Single Mode**: アルバムアート連動ターンテーブル、オートクロスフェード、動画背景同期、ゲームサントラループ、五度圏コードホイール表示に対応した標準プレイヤー。
- **Dual Mode**: 2つの独立デッキ (Deck A / Deck B) によるリアルタイムDJミックス、クロスフェーダー、同時再生 (Play Both)。
- **Multi Mode**: デッキを自由に追加し、複数曲を重ねて一括再生・個別音量調整が可能な多重再生モード。
- **Studio FX Mode**: 10バンドスタジオEQ (5/10バンド切替)、ボーカルキャンセラー (カラオケ化)、ステレオパン (L/R 定位)、Swap L/R、Mono Mix、Bitcrusher、テープディレイ、環境音 (雨音・レコードノイズ)、ピッチロック付き速度変更 (0.5x〜2.0x)、WAVエクスポート。
- **Visual Mode**: 楽曲の周波数・音圧にダイナミック連動する大画面シネマティックビジュアライザー (Quantum Orb, Neon Spectrum, Laser Wave, Radial Vortex, Starfield 3D Galaxy)。
- **Help View**: 各種連携設定 (Discord RPC, SSP SSTP, Software Update)、更新履歴、操作マニュアル。

### 2. スタジオ音響 & センターボーカルキャンセラー (Studio Audio & Vocal Cut)
- **10バンド・グラフィックイコライザー**: 31Hz 〜 16kHz の 10 帯域独立スライダー（5-Band / 10-Band ワンタップ切替）。
- **センターボーカルキャンセラー**: ステレオ音源の中央成分を逆位相合成で消音し、即座にインスト化（0%〜100%カット強度調整）。
- **ステレオパン & チャンネル制御**: 左右定位スライダー、左右チャンネル反転 (Swap L/R)、モノラル合成 (Mono Mix)。

### 3. ゲームサントラ特化 0ms シームレスループ (Game OST Loop)
- OGG / FLAC / MP3 / WAV に埋め込まれた `LOOPSTART`, `LOOPLENGTH`, `LOOPEND` タグを自動検出。
- ループ終端到達時に 0ms ハードウェアシークでループ開始点へ瞬時にジャンプし、ゲーム本編そのままの永遠のBGM再生を実現。
- ループボタンで「Off」「All」「1」「Game (サントラループ)」の4モードをワンタップ切り替え。

### 4. 五度圏コードホイール (Circle of Fifths Visualizer)
- MIDI 再生中にリアルタイムで発音中の音符・構成音を解析。
- 五度圏ホイール上に幾何学ネオンポリゴンとコード名を描画。

### 5. MIDI & SoundFont (.sf2 / .sf3) 合成エンジン
- **SpessaSynth Core & WebAudioTinySynth**: 高音質SoundFontシンセシスと軽量MIDI再生を両立。
- **SoundFont 即時切り替え (Hot-Swapping)**: セッション中にカスタムSoundFontを変更しても、アプリ再起動なしで即座にMIDIが発音。
- **16チャンネル MIDI ミキサー**: 各チャンネルの音量、ミュート、ソロ、カスタム音色 (Program Change) をリアルタイム制御。
- **即時音色反映 & プリセットロック**: 楽器変更時に旧音色ボイスを即座に消音し、新音色を即座に反映。MIDI内部イベントによる上書きを防止。
- **楽曲別ミキサー設定の自動保存・復元**: トラックごとの16chバランスを永続化。
- **高速ピアノロール (Piano Roll)**: ネオンカラーのウォーターフォールによる演奏可視化。
- **MIDI -> WAV 高速オフライン書き出し**: SoundFontの演奏を直接高音質WAVへエクスポート。

### 6. 動画ファイル再生 & 背景同期 (Video Playback)
- **ハードウェア同期 (0ms レイテンシ)**: Web Audio API に動画音声を直結し、音ズレのない完全同期再生。
- **背景動画モード**: 動画再生時に背景全面へ映像をシームレス投影。
- **背景エフェクト連動**: ぼかし (Blur)、暗さ (Overlay)、パネル透明度 (Card Opacity) のリアルタイム調整。

### 7. 3D Spatial Audio & 8D 立体音響
- **HRTF 3D PannerNode**: Web Audio API による高精度3D立体音響。
- **8D Auto-Orbit**: 音源が頭の周囲を360度自動旋回する8Dオーディオ体験。
- **2D Panner パッド**: ドラッグ操作で音源位置（前後左右）を自由自在に配置。

### 8. Discord Rich Presence (RPC) & SSP (伺か) SSTP 連携
- **Discord RPC**: Windows ネイティブ Named Pipe IPC による超軽量通信。楽曲名、アーティスト名、経過時間/総再生時間のリアルタイムプログレスバーを表示。
- **SSP (伺か) SSTP 連携**: DirectSSTP 1.1 準拠。ID3タグを優先解析し、再生中の楽曲情報をゴーストへ自動送信・発話。SakuraScriptテンプレートのカスタマイズ対応。

### 9. トロフィールーム & 隠し実績システム (Achievements)
- 全40種類の隠し実績を搭載（再生・リスニング系、MIDI系、音響FX系、DJ系、ビジュアル系、シークレット系）。
- 実績解除時のトースト通知、解禁数に応じた6段階のプレイヤー称号システム。

### 10. ワンクリック・インプレイス自動アップデート (One-Click In-App Auto Updater)
- GitHub Releases API と連携し、最新リリースの有無を自動判定。
- 更新通知モーダルで「今すぐワンクリック更新 (自動再起動)」を押すだけで、自動ダウンロード、アーカイブ展開、ファイルの自動置換、アプリ自動再起動が 1 クリックで完結。

---

## 対応フォーマット (Supported Formats)

| 種別 | 対応拡張子 |
| :--- | :--- |
| **音声ファイル** | `.mp3`, `.wav`, `.ogg`, `.flac`, `.aac`, `.m4a`, `.wma` |
| **MIDIファイル** | `.mid`, `.midi` |
| **SoundFont** | `.sf2`, `.sf3` |
| **動画ファイル** | `.mp4`, `.webm`, `.mov`, `.mkv`, `.m4v`, `.avi`, `.ts`, `.ogv` |
| **プレイリスト** | JSON バックアップ (実ファイル完全復元対応) |

---

## 動作環境 & 必要要件 (Requirements)

- **OS**: Windows 10 / 11 (64-bit)
- **Node.js**: v18.0.0 以上 (ソースからビルドする場合)
- **Electron**: v31.x

---

## インストール & 起動方法 (Getting Started)

### 1. リリース版の利用 (推奨)
[GitHub Releases](https://github.com/yukkurikasutera3/ostplayer/releases) より最新版の `OST-Player-vX.X.X-win32-x64.zip` をダウンロードし、任意のフォルダに解凍後、`OST Player.exe` を実行してください。

### 2. ソースコードから実行

```bash
# リポジトリのクローン
git clone https://github.com/yukkurikasutera3/ostplayer.git
cd ostplayer

# 依存パッケージのインストール
npm install

# アプリの起動
npm start
```

### 3. パッケージング (ビルド)

```bash
# Windows 64-bit 向けポータブルパッケージのビルド
npm run pack
```
ビルドされたバイナリは `dist/OST Player-win32-x64/` に出力されます。

---

## キーボードショートカット (Shortcuts)

| キー | 動作 |
| :--- | :--- |
| `Space` | 再生 / 一時停止 (全モード共通) |
| `F11` | フルスクリーン表示の切り替え |
| `1` 〜 `6` | プレイヤーモード切替 (1: Single, 2: Dual, 3: Multi, 4: FX, 5: Visual, 6: Help) |
| `←` / `→` | 前の曲 / 次の曲 (Single / FX / Visual) |
| `↑` / `↓` | マスター音量の調整 |
| `[` / `]` | Dual モードのクロスフェーダー移動 |
| `M` | 全体ミュートの切り替え |

---

## 設定 & 外部連携ガイド (Configuration Guide)

### Discord Rich Presence の設定
- OST Player を起動するだけで、バックグラウンドの Discord と自動接続（Named Pipe IPC）します。
- 必要に応じて「Help」画面の Discord 設定カードから表示テンプレートやタイマー表示をカスタマイズできます。

### SSP (伺か) SSTP 連携の設定
- SSP などのゴースト基盤ソフトウェアを起動した状態で、OST Player の「Help」画面 ->「SSP SSTP 連携」を ON にしてください。
- SakuraScript テンプレート（`\0\s[0]『{title}』({artist})を再生中だよ！\e` 等）を自由に編集できます。

---

## ライセンス (License)

本プロジェクトは [MIT License](LICENSE) のもとで公開されています。
SpessaSynth, WebAudioTinySynth などのサードパーティライブラリはそれぞれのオープンソースライセンスに準拠します。
