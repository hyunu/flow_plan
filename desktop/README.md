# Flow Plan 데스크톱 (Windows 트레이 상주 래퍼)

기존 **backend(FastAPI)** 와 **frontend(React/Vite)** 를 수정 없이 그대로 사용하고,
이 폴더는 Windows에서 **시스템 트레이에 상주 + 메모리 로드 + 빠른 표시/숨김**을 제공하는 얇은 래퍼입니다.

## 구성
| 파일 | 역할 |
|---|---|
| `app.py` | 엔트리 — uvicorn 스레드 + pywebview 창 + pystray 트레이 |
| `asgi.py` | 기존 백엔드를 `/api`로 마운트 + `frontend/dist` 정적 서빙 |
| `tray.py` | 트레이 아이콘(열기/숨기기·자동 시작·종료) |
| `config.py` | DB 경로(`%APPDATA%\FlowPlan`), 포트, AI 기본값(mock) 주입 |
| `flowplan.spec` | PyInstaller 단일 exe 스펙 |
| `installer.iss` | Inno Setup 설치 파일 스크립트 |
| `build.ps1` | 프론트 빌드 → exe → 설치파일 전체 자동화 |
| `assets/icon.ico` | 트레이/창/설치 아이콘 |

## 동작 방식
```
실행 → 환경변수(DB 경로 등) 주입
     → 기존 FastAPI 백엔드를 /api 로 마운트한 ASGI를 uvicorn(데몬 스레드)으로 기동
     → pywebview(WebView2) 창으로 frontend/dist 표시
     → pystray 트레이 상주
        - 창 X(닫기)  → 종료가 아닌 숨김 (프로세스·메모리 유지)
        - 트레이 더블클릭 → 즉시 표시
        - 메뉴: 열기/숨기기 · 자동 시작 · 종료
```

- **DB**: `%APPDATA%\FlowPlan\flow_plan.db` (설치/실행 위치와 무관)
- **AI**: 기본 `mock`(규칙 기반, 외부 호출 없음) — 쿼터 초과로 멈추지 않음. 실제 AI 사용 시 환경변수로 지정.

## 개발 실행 (macOS에서 서버만 검증)
```bash
cd desktop
DATABASE_URL="sqlite:////tmp/test.db" python app.py   # pywebview 창은 Windows 전용
# 서버만 테스트: uvicorn asgi:app --port 8765  → http://127.0.0.1:8765
```

## Windows 빌드
```powershell
cd desktop
.\build.ps1                 # 프론트 빌드 + FlowPlan.exe + FlowPlanSetup.exe
.\build.ps1 -SkipInstaller  # exe만
```
산출물:
- `desktop/dist/FlowPlan.exe` — 단일 실행 바이너리 (Python+백엔드+프론트 번들)
- `desktop/dist/FlowPlanSetup.exe` — 설치 파일 (시작 메뉴/바탕화면 바로가기, 자동 시작 옵션, 제거)

> PyInstaller는 크로스 컴파일 불가 → **Windows에서 빌드**해야 합니다.
> `v*` 태그 푸시 시 GitHub Actions(`.github/workflows/build-windows.yml`)가 자동 빌드해 exe/설치파일을 산출물로 올립니다.