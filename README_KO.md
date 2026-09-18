# OST Player

[ [日本語](README.md) | [English](README_EN.md) | [简体中文](README_ZH.md) | 한국어 ]

고성능 멀티 모드 데스크톱 오디오 플레이어 & DJ 믹서 (Desktop Audio Player with 3D Spatial Audio, SoundFont Synth, Studio EQ & Visualizers)

---

## 개요 (Overview)

**OST Player**는 Electron과 Web Audio API를 기반으로 제작된 차세대 데스크톱 오디오 플레이어입니다.
로컬 오디오 및 비디오 재생, SoundFont (.sf2 / .sf3) 기반 고음질 MIDI 신시사이저, 10밴드 스튜디오 그래픽 EQ, 보컬 캔슬러(노래방 모드), 게임 사운드트랙 0ms 끊김 없는 무한 루프, 5도권 코드 휠, 대화면 비주얼라이저, Discord Rich Presence (RPC) 연동, SSP (우카가가) SSTP 연동 기능을 하나의 세련된 글래스모피즘 인터페이스로 통합했습니다.

---

## 주요 기능 (Key Features)

### 1. 5+1 재생 및 DJ 모드 (Playback & DJ Modes)
- **Single Mode (싱글 모드)**: 턴테이블 재킷 애니메이션, 자동 크로스페이드, 비디오 배경 동기화, 게임 OST 루프 및 5도권 코드 휠을 지원하는 기본 플레이어.
- **Dual Mode (듀얼 모드)**: Deck A / Deck B 2개의 독립 데크를 통한 실시간 DJ 믹싱, 크로스페이더, 동시 재생 (Play Both).
- **Multi Mode (멀티 모드)**: 데크를 자유롭게 추가하여 여러 곡을 동시에 중첩 재생하고 개별 볼륨을 제어하는 다중 재생 모드.
- **Studio FX Mode (스튜디오 FX 모드)**: 10밴드 스튜디오 EQ (5/10밴드 전환), 보컬 캔슬러 (노래방 반주화), 스테레오 팬 (좌우 밸런스), Swap L/R (좌우 채널 반전), Mono Mix (모노 합성), Bitcrusher, 환경음 (빗소리/LP 노이즈), 피치 고정 배속 (0.5x ~ 2.0x), WAV 즉시 내보내기.
- **Visual Mode (비주얼 모드)**: 주파수와 비트에 맞춰 역동적으로 반응하는 대화면 시네마틱 비주얼라이저 (Quantum Orb, Neon Spectrum, Laser Wave, Radial Vortex, Starfield 3D Galaxy).
- **Help View (도움말 및 설정)**: Discord RPC, SSP SSTP, 소프트웨어 업데이트 등 외부 서비스의 통합 관리 화면.

### 2. 스튜디오 사운드 및 센터 보컬 캔슬러 (Studio Audio & Vocal Cut)
- **10밴드 그래픽 이퀄라이저**: 31Hz부터 16kHz까지 10개 대역 독립 슬라이더 (5밴드 / 10밴드 원클릭 전환).
- **센터 보컬 캔슬러 (Vocal Cut)**: 스테레오 음원의 중앙 보컬 성분을 역위상 합성으로 제거하여 반주화 (0% ~ 100% 무단계 조절).
- **스테레오 제어**: 좌우 팬 슬라이더, Swap L/R (좌우 반전), Mono Mix (모노 합성).

### 3. 게임 사운드트랙 특화 0ms 무한 루프 (Game OST Loop)
- OGG, FLAC, MP3, WAV 파일 내의 `LOOPSTART`, `LOOPLENGTH`, `LOOPEND` 메타 태그를 자동 감지.
- 루프 끝 지점 도달 시 0ms 딜레이로 루프 시작점으로 즉시 이동하여 게임 원작 그대로의 무한 BGM 재생 실현.
- 4가지 루프 모드 원클릭 전환: 끄기 (Off), 전체 반복 (All), 한 곡 반복 (1), 게임 루프 (Game Loop).

### 4. 5도권 코드 휠 비주얼라이저 (Circle of Fifths Visualizer)
- MIDI 재생 중 실시간으로 발음 중인 음표와 화음을 분석.
- 5도권 원형 휠 위에 기하학적 네온 다각형과 코드 이름을 실시간 렌더링.

### 5. MIDI 및 SoundFont (.sf2 / .sf3) 신시사이저 엔진
- **SpessaSynth Core 및 WebAudioTinySynth**: 고품질 SoundFont 신시사이저와 초경량 MIDI 재생을 동시에 지원.
- **SoundFont 실시간 교체 (Hot-Swapping)**: 세션 도중 SoundFont를 교체해도 재부팅 없이 즉시 새 음색으로 발음.
- **16채널 MIDI 믹서**: 채널별 볼륨, 뮤트 (Mute), 솔로 (Solo), 악기 지정 (Program Change) 실시간 제어.
- **즉시 음색 변경 및 프리셋 잠금**: 악기 변경 시 이전 보이스를 즉시 멈추고 새 음색을 적용하며, MIDI 내부 이벤트에 의한 음색 덮어쓰기 방지.
- **곡별 믹서 설정 영구 저장**: 트랙별 16채널 밸런스를 자동 보존 및 복원.
- **고속 피아노 롤 (Piano Roll)**: 네온 컬러 워터폴 스타일의 실시간 음표 시각화.
- **MIDI -> WAV 오프라인 고속 렌더링**: SoundFont 연주를 고음질 WAV 파일로 직접 추출 저장.

### 6. 비디오 파일 재생 및 배경 동기화 (Video Playback)
- **하드웨어 0ms 지연 동기화**: Web Audio API에 비디오 오디오를 직결하여 싱크 어긋남 없는 완벽 동기 재생.
- **배경 비디오 모드**: 재생 중인 영상을 앱 배경으로 투사.
- **동적 배경 필터 연동**: 블러 (Blur), 어둡기 (Overlay), 카드 투명도 (Card Opacity) 실시간 조절.

### 7. 3D Spatial Audio 및 8D 입체 음향
- **HRTF 3D PannerNode**: Web Audio API 기반 고정밀 바이노럴 3D 입체 음향.
- **8D Auto-Orbit**: 음원이 머리 주위를 360도 자동 회전하는 8D 오디오 체험.
- **2D Panner 패드**: 드래그 조작으로 음원 위치(전후좌우)를 자유롭게 배치.

### 8. Discord Rich Presence 및 SSP (우카가가) SSTP 연동
- **Discord RPC**: Windows 네이티브 Named Pipe IPC를 통해 곡명, 아티스트, 진행 시간 프로그레스 바를 Discord 상태에 실시간 표시.
- **SSP (우카가가) SSTP 연동**: DirectSSTP 1.1 준수. ID3 태그를 파싱하여 고스트에게 재생 정보를 전송하고 발화. 커스텀 SakuraScript 템플릿 지원.

### 9. 트로피 룸 및 숨겨진 도전 과제 (Achievements)
- 40가지의 숨겨진 업적 (재생, MIDI, 오디오 FX, DJ, 비주얼, 이스터 에그).
- 달성 알림 토스트 팝업 및 6단계 플레이어 칭호 시스템.

### 10. 원클릭 인플레이스 자동 업데이트 (One-Click In-App Auto Updater)
- GitHub Releases API와 연동하여 최신 버전 유무를 자동 감지.
- 업데이트 알림 모달에서 "지금 원클릭 업데이트 (자동 재시작)"를 누르면 다운로드, 압축 해제, 파일 교체, 재시작이 한 번에 완료.

---

## 지원 포맷 (Supported Formats)

| 구분 | 지원 확장자 |
| :--- | :--- |
| **오디오** | `.mp3`, `.wav`, `.ogg`, `.flac`, `.aac`, `.m4a`, `.wma` |
| **MIDI** | `.mid`, `.midi` |
| **SoundFont** | `.sf2`, `.sf3` |
| **비디오** | `.mp4`, `.webm`, `.mov`, `.mkv`, `.m4v`, `.avi`, `.ts`, `.ogv` |
| **재생목록** | JSON 백업 (로컬 파일 완전 복원 지원) |

---

## 실행 환경 및 시스템 요구 사항 (Requirements)

- **운영체제**: Windows 10 / 11 (64-bit)
- **Node.js**: v18.0.0 이상 (소스 빌드 시)
- **Electron**: v31.x

---

## 설치 및 시작하기 (Getting Started)

### 1. 빌드 패키지 사용 (권장)
[GitHub Releases](https://github.com/yukkurikasutera3/ostplayer/releases)에서 최신 `OST-Player-vX.X.X-win32-x64.zip`을 다운로드하고 압축 해제 후 `OST Player.exe`를 실행하세요.

### 2. 소스 코드에서 실행

```bash
git clone https://github.com/yukkurikasutera3/ostplayer.git
cd ostplayer
npm install
npm start
```

### 3. 패키징 (빌드)

```bash
npm run pack
```
빌드 결과물은 `dist/OST Player-win32-x64/`에 생성됩니다.

---

## 단축키 (Shortcuts)

| 키 | 동작 |
| :--- | :--- |
| `Space` | 재생 / 일시정지 (모든 모드 공통) |
| `F11` | 전체 화면 토글 |
| `1` ~ `6` | 모드 전환 (1: Single, 2: Dual, 3: Multi, 4: FX, 5: Visual, 6: Help) |
| `←` / `→` | 이전 곡 / 다음 곡 (Single / FX / Visual) |
| `↑` / `↓` | 마스터 볼륨 조절 |
| `[` / `]` | 듀얼 모드 크로스페이더 이동 |
| `M` | 마스터 음소거 토글 |

---

## 라이선스 (License)

본 프로젝트는 [MIT License](LICENSE)에 따라 배포됩니다.
SpessaSynth, WebAudioTinySynth 등 서드파티 라이브러리는 각각의 오픈 소스 라이선스를 따릅니다.
