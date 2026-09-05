# Flow Plan 데스크톱 (macOS · Windows)

백엔드·프론트를 그대로 쓰고, **트레이에 상주**한 뒤 **전역 단축키로 바로 창을 띄웁니다.**
창을 닫아도 프로세스는 남아서, 다시 열 때 서버를 처음부터 켜지 않습니다.

## 동작
```
실행 → DB 경로 주입 → FastAPI(uvicorn) 백그라운드
     → 창(pywebview) + 트레이
     → 전역 단축키
창 닫기(X)     → 숨김 (종료 아님)
단축키 / 트레이 열기 / 앱을 다시 실행 → 이미 떠 있는 창을 앞으로
트레이 종료     → 프로세스 종료
```

| 플랫폼 | 기본 단축키 | 데이터 |
|---|---|---|
| macOS | **⌘⌥F** (Command+Option+F) | `~/Library/Application Support/FlowPlan` |
| Windows | **Ctrl+Shift+F** | `%APPDATA%\FlowPlan` |

macOS에서 단축키가 안 먹으면 **시스템 설정 → 개인정보 보호 및 보안 → 손쉬운 사용**에 Flow Plan(또는 Python)을 허용하세요.

단축키와 백엔드 주소는 메뉴막대 → **설정…**에서 바꿀 수 있습니다. `desktop.json`의 `hotkey`, `api_base` 또는 환경변수 `FLOWPLAN_HOTKEY`, `FLOWPLAN_API_BASE`로도 지정됩니다.

```json
{ "hotkey": "cmd+shift+space" }
```

Windows 예: `"ctrl+alt+p"`.

## 설치본 (권장)

**macOS** — 이 맥에서 설치 이미지(.app + DMG)를 만듭니다.

```bash
cd desktop
chmod +x build.sh
./build.sh --install
```

- `desktop/dist/Flow Plan.app` — 앱
- `desktop/dist/FlowPlan.dmg` — 다른 맥에 줄 설치 이미지 (Applications로 드래그)
- `--install` 이면 `/Applications/Flow Plan.app`에 넣고 실행합니다

이후에는 Launchpad·Spotlight·Dock에서 **Flow Plan**을 엽니다. 창을 닫아도 메뉴막대에 남고, **⌘⌥F**로 다시 뜹니다.

**Windows** — Windows PC에서:

```powershell
cd desktop
.\build.ps1
```

`desktop\dist\FlowPlanSetup.exe`를 실행해 설치합니다. 시작 메뉴·바탕화면 바로가기, 선택 시 자동 시작이 들어갑니다.

## 개발 실행 (설치 없이)
```bash
cd desktop
../backend/.venv/bin/python launch.py
```

## Windows 빌드
```powershell
cd desktop
.\build.ps1
```

- `desktop/dist/FlowPlan.exe`
- `desktop/dist/FlowPlanSetup.exe`

PyInstaller는 **그 OS에서** 빌드해야 합니다. Windows exe는 Windows에서, Mac 앱은 Mac에서 만듭니다.

## 트레이
- **열기** / **숨기기**
- **로그인 시 자동 시작** (Windows 레지스트리, macOS LaunchAgent)
- **단축키 …** (현재 조합 표시)
- **종료**
