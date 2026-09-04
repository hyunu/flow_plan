"""Flow Plan 데스크톱 엔트리 — Windows 트레이 상주 앱.

동작:
  1. 환경변수(DB 경로 등) 주입
  2. 기존 FastAPI 백엔드를 /api 로 마운트한 ASGI 앱을 uvicorn(데몬 스레드)으로 기동
  3. pywebview(WebView2) 창으로 프론트 표시
  4. pystray 트레이 상주 — 창 닫기=숨김, 더블클릭=즉시 표시, 자동 시작/종료

실행:
  cd desktop && python app.py
"""
from __future__ import annotations

import sys
import threading
from pathlib import Path

# 1) backend import 전에 환경 주입 (반드시 최상단)
import config  # noqa: E402

config.ensure_env()

# 저장소의 backend 디렉터리를 sys.path 에 추가 (번들 시에도 동작)
_REPO = Path(__file__).resolve().parent.parent
if str(_REPO / "backend") not in sys.path:
    sys.path.insert(0, str(_REPO / "backend"))

import webview  # noqa: E402

from asgi import app as desktop_app  # noqa: E402
from tray import TrayIcon  # noqa: E402

PORT = config.port()


def _serve() -> None:
    import uvicorn

    uvicorn.run(desktop_app, host="127.0.0.1", port=PORT, log_level="warning")


def main() -> None:
    # 2) 백엔드 서버 스레드
    threading.Thread(target=_serve, daemon=True).start()

    # 3) 창 생성
    window = webview.create_window(
        "Flow Plan",
        f"http://127.0.0.1:{PORT}",
        width=1400,
        height=900,
        min_size=(1000, 680),
    )

    # 4) 창 X(닫기) → 숨김 (종료 아님)
    def _on_closing(event):
        event.cancelled = True
        try:
            window.hide()
        except Exception:
            pass

    window.events.closing += _on_closing

    # 5) 트레이 상주
    tray = TrayIcon(window, config.icon_path())
    tray.start_thread()

    # 6) GUI 메인 루프 (숨겨져 있어도 유지 → 메모리 상주)
    webview.start()


if __name__ == "__main__":
    main()