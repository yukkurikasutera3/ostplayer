# OST Player

[![GitHub release](https://img.shields.io/github/v/release/yukkurikasutera3/ostplayer)](https://github.com/yukkurikasutera3/ostplayer/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Web%20%7C%20Android-green.svg)](https://github.com/yukkurikasutera3/ostplayer)

> [!NOTE]
> **多言語ドキュメント (Multilingual Documentation)**:
> - [English README](README_EN.md)
> - [한국어 README](README_KO.md)
> - [中文 README](README_ZH.md)

**OST Player** は、ゲームサントラやローカル音楽ファイルを最高の音質とビジュアルで楽しむために設計された、次世代のハイパフォーマンス・クロスプラットフォーム音楽プレイヤーです。
通常オーディオ（MP3 / WAV / FLAC / OGG / AAC 等）の高音質再生はもちろん、SoundFont 合成エンジン（SpessaSynth）による本格 MIDI 再生、動画ファイル再生、3D 立体音響、10バンド EQ、五度圏コードホイール、そして WebRTC P2P による「同期リスニング (DJ Room)」「スマホ・ワイヤレスリモコン」「Wi-Fi プレイリスト一括転送」を搭載しています。

---

## 主な機能 (Key Features)

### 1. 多彩なマルチプレイヤーモード
- **Single Mode**: 直感的なターンテーブル UI による単曲・プレイリスト再生。
- **Dual Mode**: 2 つの独立デッキ（Deck A / B）によるクロスフェード・DJ プレイ。
- **Multi Mode**: 最大 4 トラックの同時再生・ミキシング・音量バランス制御。
- **FX Mode**: リバーブ、ディレイ、ディストーション、フィルター等を組み合わせる音響空間エディタ。
- **Sync Mode (DJ Room & Remote)**: 6桁コードで即座に繋がる P2P 同期リスニング & ワイヤレスリモコン & Wi-Fi プレイリスト転送。

### 2. 厳選された7大マルチ UI レイアウトシステム (Layout Switcher)
設定モーダルからワンクリックで 7 つの洗練された UI レイアウトへシームレスに切り替え可能（※Album / Now playing は Library / Split へ集約・最適化済み）:
1. **Split**: 従来の直感的な左右 2 ペイン分割プレイヤー。
2. **Library**: 左サイドバーにプレイリスト、右上にトラック一覧、下部に横長フル幅プレイヤーバーを配した 3 ペイン本格ライブラリ構成。
3. **Cover wall**: アルバムジャケットを高密度に並べたレスポンシブ・グリッドビュー（サイズ調整対応）。
4. **Shelf**: レコード棚や CD ラックの背表紙を模したシェルフストリップ。
5. **Stage**: 背景ビジュアライザーを主役に据えたシネマティック・ステージビュー。
6. **Terminal**: CLI ターミナル UI（Vim キーバインド操作対応）。
7. **Retro LCD**: 20バンドグリーン LCD スペクトラム＆情報表示パネル。

### 3. 高精度スタジオ音響 & 五度圏コードホイール
- **本格 10バンド・グラフィックイコライザー**: 31Hz 〜 16kHz の 10 帯域独立スライダー（5-Band / 10-Band ワンタップ切替）。
- **センターボーカルキャンセラー**: ステレオ音源の中央成分を逆位相合成で消音し、瞬時にカラオケ化。
- **ステレオ定位制御**: 左右定位パン、Swap L/R（左右反転）、Mono Mix（モノラル合成）。
- **五度圏コードホイール (Circle of Fifths)**: リアルタイム和音ネオンビジュアライザー（Ch 10 ドラム除外による高精度判定）。
- **ゲームサントラ特化 0ms 無限ループ**: ループポイント自動検出によるシームレス永久ループ再生。

### 4. リアルタイム・オーディオビジュアライザー
- **多様なビジュアルモード**: Bars (スペクトラムバー), Wave (オシロスコープ波形), Circle (円形スペクトラム), Particles (粒子), Mirror Bars (左右対称), Quantum Orb (3Dプラズマコア球体)。
- **FPS・感度・解像度調整**: 描画 FPS（30 / 60 / 120 FPS）、FFT サイズ、周波数平滑化の無段階調整。

### 5. SoundFont 対応 高音質 MIDI 再生エンジン
- **SpessaSynth Core & WebAudioTinySynth**: 高音質 SoundFont シンセシスと軽量 MIDI 再生を両立。
- **SoundFont 即時切り替え (Hot-Swapping)**: アプリ再起動なしで選択した SoundFont (.sf2 / .sf3) へ瞬時に切り替え。
- **16チャンネル MIDI ミキサー**: 各チャンネルの音量、ミュート、ソロ、カスタム音色 (Program Change) をリアルタイム制御。
- **即時音色反映 & プリセットロック**: 楽器変更時に旧音色ボイスを即座に消音し、新音色を即座に反映。
- **楽曲別ミキサー設定の自動保存・復元**: トラックごとの 16ch バランスを IndexedDB に永続化。
- **高速ピアノロール (Piano Roll)**: ウォーターフォールによる演奏可視化。

### 6. 動画ファイル再生 & 背景同期 (Video Playback)
- **ハードウェア同期 (0ms レイテンシ)**: Web Audio API に動画音声を直結し、音ズレのない完全同期再生。
- **背景動画モード**: 動画再生時に背景全面へ映像をシームレス投影。ぼかし (Blur)、暗さ (Overlay)、パネル透明度のリアルタイム調整。

### 7. 3D Spatial Audio & 8D 立体音響
- **HRTF 3D PannerNode**: Web Audio API による高精度 3D 立体音響。
- **8D Auto-Orbit**: 音源が頭の周囲を 360 度自動旋回する 8D オーディオ体験。
- **2D Panner パッド**: ドラッグ操作で音源位置（前後左右）を自由自在に配置。

### 8. Discord Rich Presence (RPC) & SSP (伺か) SSTP 連携
- **Discord RPC**: Windows ネイティブ Named Pipe IPC による超軽量通信。楽曲名、アーティスト名、経過時間/総再生時間のリアルタイムプログレスバーを表示。
- **SSP (伺か) SSTP 連携**: DirectSSTP 1.1 準拠。再生中の楽曲情報をゴーストへ自動送信・発話。SakuraScript テンプレートのカスタマイズ対応。

### 9. トロフィールーム & 隠し実績システム (Achievements)
- 全 40 種類の隠し実績を搭載（再生・リスニング系、MIDI系、音響FX系、DJ系、ビジュアル系、シークレット系）。
- 実績解除時のトースト通知、解禁数に応じた 6 段階のプレイヤー称号システム。

### 10. P2P 同期リスニング & DJ Room (Sync Mode)
WebRTC (PeerJS) 技術を採用した、完全サーバーレスのリアルタイム共同リスニング機能。
- **6桁ルームコード接続**: ホストが発行した 6 桁コードを入力するだけで暗号化 P2P 直結。サーバー契約やポート開放は不要。
- **高精度ミリ秒再生同期**: ネットワーク往復遅延時間 (RTT) を自動測定・補正し、再生開始・停止・シーク位置を一致。
- **リアルタイム・リクエストキュー & Upvote 投票**: ルーム内の参加者がライブラリから楽曲をリクエスト可能。
- **DJ アナウンス & チャット機能**: ホストからのテロップ送信、参加者全員によるリアルタイムテキストチャット。
- **DJ 権限委譲 (Pass the AUX)**: ホストから信頼できる参加者へワンタップで操作権限を譲渡可能。

### 11. スマホ・ワイヤレスリモコンモード (Wireless Remote Control) [NEW]
- **双方向リアルタイム同期**: 6桁コードで接続したスマートフォンから、PC 版 OST Player の再生/一時停止、トラック移動、ループ切替、音量、シーク、プレイヤーモード切替 (Single/Dual/Multi/FX/Sync) をミリ秒単位で遠隔操作。
- **スマホ専用タッチ最適化 UI**: 片手で扱いやすい大型ボタン群とシークバー、音量スライダー。
- **楽曲クイック選曲リスト**: PC ホスト上のプレイリスト楽曲をスマホから一覧ブラウズし、タップで即時再生。
- **ハプティック連携**: タッチ操作時の振動フィードバック (`MobileBridge.hapticFeedback`)。

### 12. Wi-Fi プレイリスト一括転送 (Batch Playlist Transfer) [NEW]
- **大容量高速ストリーミング**: 同一 Wi-Fi 内の PC からスマホへ、指定プレイリスト（または全楽曲）のオーディオ / MIDI ファイルおよびメタデータを一括転送。
- **16KB チャンク分割 & ACK 受信確認制御**: データチャネルの溢れやメモリ圧迫を防止し、確実に順次転送。
- **完全オフライン保存**: 受信した楽曲はスマホ端末側の IndexedDB およびローカルプレイリストへ順次自動保存。次回以降、完全オフライン環境でも通信なしで即座に再生可能。

### 13. ミニプレイヤーモード (Mini Player Mode)
- **省スペース常時最前面表示**: 画面端にコンパクトに配置可能な専用プレイヤー。作業中やゲーム中の BGM 再生に最適。

### 14. MediaSession & OS メディアコントロール連携
- **OS 標準メディアキー完全対応**: キーボードの再生/一時停止、前の曲、次の曲キーによる操作。
- **Bluetooth オーディオ機器連携**: ヘッドセットやワイヤレスイヤホンのハードウェアボタンからの再生・スキップ制御。
- **OS 通知・フライアウト連動**: 音量オーバーレイやロック画面での曲名・アーティスト名表示およびコントロール。

### 15. ワンクリック・インプレイス自動アップデート (One-Click In-App Auto Updater)
- GitHub Releases API と連携し、最新リリースの有無を自動判定。
- 更新通知モーダルで「今すぐワンクリック更新 (自動再起動)」を押すだけで、自動ダウンロード、アーカイブ展開、ファイルの自動置換、アプリ自動再起動が 1 クリックで完結。

---

## 対応フォーマット (Supported Formats)

| 種別 | 対応拡張子 |
| :--- | :--- |
| **通常音声ファイル** | `.mp3`, `.wav`, `.ogg`, `.flac`, `.aac`, `.m4a`, `.wma`, `.opus` |
| **MIDIファイル** | `.mid`, `.midi` |
| **SoundFont** | `.sf2`, `.sf3` |
| **動画・背景ファイル** | `.mp4`, `.webm`, `.mov`, `.mkv`, `.m4v`, `.avi`, `.ts`, `.ogv` |
| **プレイリスト** | JSON バックアップ (実ファイル完全復元対応) |

---

## 動作環境 & 必要要件 (System Requirements)

### 1. デスクトップ環境 (Windows Electron アプリ)
- **対応 OS**: Windows 10 (64-bit) / Windows 11 (64-bit) (Version 1903 / Build 18362 以降)
- **CPU**: Intel Core i3 相当以上 / AMD Ryzen 3 相当以上 (x86_64 アーキテクチャ)
- **メモリ (RAM)**:
  - 最小: 4 GB 以上
  - 推奨: 8 GB 以上（大容量 SoundFont .sf2 / .sf3 の複数ロード時、3D オーディオ・多重ビジュアライザー処理時）
- **ストレージ**:
  - アプリ本体: 350 MB 以上の空き容量
  - データ保存用: SoundFont 音色ファイルおよび楽曲ライブラリに応じた空き容量
- **オーディオ出力**: DirectSound / WASAPI 対応のオーディオデバイスまたはサウンドカード
- **デスクトップ外部連携 (任意)**:
  - Discord Rich Presence: Discord デスクトップ版クライアント（IPC 通信有効）
  - SSP (伺か) 連携: DirectSSTP 1.1 対応のゴースト起動環境
- **開発ビルド環境 (ソースからビルドする場合)**:
  - Node.js: v18.0.0 以上
  - Electron: v31.x

### 2. モバイル / スマートフォン環境 (Android & モバイルブラウザ)
- **対応 OS**: Android 8.0 (Oreo / API Level 26) 以上（Android 10 以上推奨）
- **動作形態**: Capacitor 8.x ネイティブ APK または モダンモバイルブラウザ
- **推奨ブラウザ**: Google Chrome Mobile (v90+), Samsung Internet (v15+), Firefox Mobile (最新版)
- **ハードウェア機能**:
  - 静電容量式マルチタッチスクリーン（スワイプ・ダブルタップジェスチャー対応）
  - ハプティックバイブレーション（操作フィードバック用、端末対応時）
- **バックグラウンド & メディア制御**:
  - MediaSession API（通知領域・ロック画面からの再生/停止/曲送り/シーク制御）
  - Screen WakeLock API（ビジュアライザー・再生中の画面点灯維持）

### 3. Web / ブラウザ環境 (クロスプラットフォーム)
- **対応ブラウザ**:
  - Google Chrome (v90 以降)
  - Microsoft Edge (v90 以降)
  - Mozilla Firefox (v88 以降)
  - Apple Safari (v15 以降)
- **必須ブラウザ API**:
  - Web Audio API & AudioWorklet（低遅延オーディオグラフ & SpessaSynth 高音質 MIDI 合成エンジン）
  - WebRTC & RTCDataChannel（P2P 同期リスニング、ワイヤレスリモコン、Wi-Fi プレイリスト転送）
  - IndexedDB & Web Storage（楽曲バイナリ・プレイリスト・設定の完全ローカル永続化）

### 4. ネットワーク要件 (P2P Sync / リモコン / Wi-Fi 転送)
- **接続方式**: 6桁コードによる端末間ダイレクト暗号化通信 (WebRTC PeerJS)
- **Wi-Fi プレイリスト転送 / LAN 同期**: 同一 LAN / Wi-Fi ネットワーク接続時、高速直接通信（ルーター内の端末間通信が許可されていること）
- **インターネット P2P 同期**: STUN サーバー経由の NAT 越え接続（一般的な家庭用ブロードバンド・モバイル回線に対応）
- **通信帯域**:
  - ワイヤレスリモコン操作: 極小（数 KB/s 程度）
  - 音声ストリーミング / プレイリスト一括転送: 10 Mbps 以上のローカル Wi-Fi 環境推奨

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
| `1` 〜 `6` | プレイヤーモード切替 (1: Single, 2: Dual, 3: Multi, 4: FX, 5: Sync, 6: Help) |
| `←` / `→` | 前の曲 / 次の曲 (Single / FX / Sync) |
| `↑` / `↓` | マスター音量の調整 |
| `[` / `]` | Dual モードのクロスフェーダー移動 |
| `M` | 全体ミュートの切り替え |
| メディアキー | 再生 / 一時停止、前の曲、次の曲 (MediaSession 連動) |

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
