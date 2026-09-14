# OST Player

[ [日本語](README.md) | [English](README_EN.md) | [简体中文](README_ZH.md) | 한국어 ]

고성능 멀티 모드 데스크톱 오디오 플레이어 & DJ 믹서 (Desktop Audio Player with 3D Spatial Audio, SoundFont Synth, Spotify Integration & Visualizers)

---

## 개요 (Overview)

**OST Player**는 Electron과 Web Audio API를 기반으로 제작된 차세대 데스크톱 오디오 플레이어입니다.
로컬 오디오 및 비디오 재생, SoundFont (.sf2 / .sf3) 기반 고음질 MIDI 신시사이저, Spotify Web Playback SDK 네이티브 스트리밍, 3D 공간 음향 (8D Orbit), 5밴드 그래픽 EQ 및 리버브, 대화면 비주얼라이저, Discord Rich Presence (RPC) 연동, SSP (우카가가) SSTP 연동 기능을 하나의 세련된 글래스모피즘 인터페이스로 통합했습니다.

---

## 주요 기능 (Key Features)

### 1. 5+1 재생 & DJ 모드 (Playback & DJ Modes)
- **Single Mode (싱글 모드)**: 턴테이블 재킷 애니메이션, 자동 크로스페이드, 비디오 배경 동기화 및 Spotify 트랙 재생을 지원하는 기본 플레이어.
- **Dual Mode (듀얼 모드)**: Deck A와 Deck B 독립 데크를 활용한 실시간 DJ 믹싱, 크로스페이더, 동시 재생 (Play Both).
- **Multi Mode (멀티 모드)**: 다중 트랙을 자유롭게 추가하여 여러 곡을 동시에 중첩 재생하고 개별 볼륨을 제어하는 모드.
- **Studio FX Mode (FX 모드)**: 실시간 5밴드 EQ, 베이스 부스트 (Bass Boost), 공간 리버브, 디스토션, 딜레이, 트레몰로, 피치 락 속도 조절 (0.5x - 2.0x) 및 WAV 파일 즉시 내보내기.
- **Visual Mode (비주얼 모드)**: 오디오 주파수와 비트에 실시간 반응하는 역동적인 대화면 비주얼라이저 무대 (Quantum Orb, Neon Spectrum, Laser Wave, Radial Vortex, Starfield 3D Galaxy).
- **Help View (도움말 및 설정)**: Spotify, Discord RPC, SSP SSTP, 소프트웨어 업데이트 등 외부 서비스의 통합 관리 화면.

### 2. Spotify Web API & Web Playback SDK 네이티브 연동
- **안전한 OAuth 2.0 PKCE 인증**: 클라이언트 시크릿이 노출되지 않는 PKCE 인증 엔진으로 로컬 루프백(`http://127.0.0.1:8888/callback`)을 통한 원클릭 로그인 지원.
- **앱 내 직접 스트리밍 재생**: Spotify Web Playback SDK를 통해 앱 내에서 직접 고음질 스트리밍 재생 (Premium 전체 재생, Free 계정 30초 미리듣기 및 Spotify Connect 자동 폴백).
- **보관함 및 재생목록 원클릭 동기화**: 좋아요 표시한 곡(Liked Songs) 및 유저 재생목록을 가져와 "Spotify" 필터로 손쉽게 관리.

### 3. MIDI & SoundFont (.sf2 / .sf3) 합성 엔진
- **SpessaSynth Core & WebAudioTinySynth**: 고품질 SoundFont 렌더링과 초경량 즉시 재생 동시 지원.
- **SoundFont 핫스왑 (Hot-Swapping)**: 세션 도중 SoundFont를 변경해도 앱 재시작 없이 즉시 새 음원으로 MIDI 발음.
- **16채널 MIDI 믹서**: 각 채널별 볼륨, 음소거(Mute), 솔로(Solo), 악기 변경(Program Change) 실시간 제어 및 발음 LED 탑재.
- **즉시 음색 반영 & 프리셋 락**: 악기 변경 시 이전 보이스를 즉시 차단하고 새 음색을 즉각 반영하며, MIDI 시퀀스의 강제 변경을 방지하는 락 메커니즘 지원.
- **곡별 믹서 설정 자동 저장 및 복원**: 트랙별 16채널 밸런스를 자동으로 영구 보존.
- **초고속 피아노 롤 (Piano Roll)**: 16채널 네온 워터폴 실시간 시각화.
- **MIDI -> WAV 오프라인 고속 변환**: SoundFont 연주를 무손실 고품질 WAV 파일로 즉시 렌더링 내보내기.

### 4. 비디오 재생 & 배경 동기화 (Video Playback)
- **하드웨어 레벨 0ms 레이텐시**: Web Audio API 직결로 음성-영상 간 오차 없는 완벽한 동기화.
- **배경 비디오 모드**: 비디오 재생 시 영상이 앱 전체 배경으로 매끄럽게 투사.
- **실시간 배경 시각 효과 필터**: 블러(Blur), 어두움(Overlay), 패널 투명도(Card Opacity) 실시간 조절.

### 5. 3D Spatial Audio & 8D 입체 음향
- **HRTF 3D PannerNode**: Web Audio API 기반의 정밀한 바이노럴 3차원 입체 음향.
- **8D Auto-Orbit**: 음원이 사용자 머리 주변을 360도 자동으로 회전하는 입체 청취 모드.
- **2D Panner 패드**: 드래그 조작으로 음원의 전후좌우 위치를 자유롭게 배치.

### 6. Discord Rich Presence (RPC) & SSP (우카가가) SSTP 연동
- **Discord RPC**: Windows 네이티브 Named Pipe IPC를 통해 곡명, 아티스트, 실시간 재생 프로그레스 바를 전송.
- **SSP (우카가가) SSTP**: DirectSSTP 1.1 표준 준수, ID3 태그 우선 분석을 통해 고스트가 현재 곡을 자동으로 발화하도록 연동, SakuraScript 템플릿 커스터마이징 지원.

### 7. 트로피 룸 & 숨겨진 업적 시스템 (Achievements)
- 총 40종의 독창적인 숨겨진 업적 탑재 (재생, MIDI, 오디오 FX, DJ, 비주얼, 시크릿 등).
- 업적 달성 시 토스트 알림 및 사운드 합성 재생, 6단계 플레이어 칭호 시스템.

### 8. 앱 내 업데이트 확인 (In-App Update Checker)
- GitHub Releases API와 연동하여 최신 버전 유무를 자동으로 판별.
- 릴리스 노트 뷰어 및 최신 Windows 패키지 ZIP 원클릭 직접 다운로드 지원.

---

## 지원 포맷 (Supported Formats)

| 구분 | 지원 확장자 |
| :--- | :--- |
| **오디오** | `.mp3`, `.wav`, `.ogg`, `.flac`, `.aac`, `.m4a`, `.wma` |
| **MIDI** | `.mid`, `.midi` |
| **SoundFont** | `.sf2`, `.sf3` |
| **비디오** | `.mp4`, `.webm`, `.mov`, `.mkv`, `.m4v`, `.avi`, `.ts`, `.ogv` |
| **스트리밍** | Spotify (Web Playback SDK / Web API) |
| **재생목록** | JSON 백업 (가져오기 / 내보내기) |

---

## 동작 환경 및 요구 사양 (Requirements)

- **운영체제**: Windows 10 / 11 (64-bit)
- **Node.js**: v18.0.0 이상 (소스 코드 빌드 시)
- **Electron**: v31.x
- **Spotify 연동 시**: Spotify 계정 (전체 스트리밍을 위해 Spotify Premium 권장) 및 Spotify Developer Dashboard에서 발급받은 Client ID

---

## 설치 및 실행 방법 (Getting Started)

### 1. 배포 패키지 사용 (권장)
[GitHub Releases](https://github.com/yukkurikasutera3/ostplayer/releases)에서 최신 `OST-Player-vX.X.X-win32-x64.zip`을 다운로드한 후 원하는 폴더에 압축을 풀고 `OST Player.exe`를 실행하십시오.

### 2. 소스 코드에서 실행

```bash
# 저장소 복제
git clone https://github.com/yukkurikasutera3/ostplayer.git
cd ostplayer

# 의존성 설치
npm install

# 애플리케이션 시작
npm start
```

### 3. 패키징 빌드

```bash
# Windows 64-bit 포터블 바이너리 빌드
npm run pack
```
빌드된 패키지는 `dist/OST Player-win32-x64/`에 생성됩니다.

---

## 키보드 단축키 (Shortcuts)

| 키 | 동작 |
| :--- | :--- |
| `Space` | 재생 / 일시정지 (모든 모드 공통) |
| `F11` | 전체 화면 토글 |
| `1` - `6` | 플레이어 모드 전환 (1: Single, 2: Dual, 3: Multi, 4: FX, 5: Visual, 6: Help) |
| `←` / `→` | 이전 곡 / 다음 곡 (Single / FX / Visual) |
| `↑` / `↓` | 마스터 볼륨 조절 |
| `[` / `]` | Dual 모드 크로스페이더 이동 |
| `M` | 전체 음소거 토글 |

---

## 외부 연동 설정 가이드

### Spotify 연동 설정
1. [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)에 로그인하여 새 애플리케이션을 생성합니다.
2. 앱 설정의 Redirect URIs에 `http://127.0.0.1:8888/callback`을 추가하고 저장합니다.
3. 생성된 **Client ID**를 복사합니다.
4. OST Player의 Help 화면 -> Spotify 연동 카드에서 Client ID를 붙여넣고 "로그인 (OAuth PKCE)"을 클릭합니다.

### Discord Rich Presence 설정
- Discord가 실행 중인 상태에서 OST Player를 켜면 로컬 파이프를 통해 자동으로 연동됩니다.
- Help 화면에서 상태 표시 템플릿과 타이머 옵션을 변경할 수 있습니다.

### SSP (우카가가) SSTP 연동 설정
- SSP 등 우카가가 베이스를 실행한 상태에서 OST Player의 Help 화면에서 "SSP SSTP 연동"을 활성화합니다.
- SakuraScript 템플릿(예: `\0\s[0]현재 재생 중: {title} ({artist})\e`)을 자유롭게 편집할 수 있습니다.

---

## 라이선스 (License)

본 프로젝트는 [MIT License](LICENSE)에 따라 배포됩니다.
SpessaSynth, WebAudioTinySynth 등 서드파티 라이브러리는 각각의 오픈 소스 라이선스를 준수합니다.
