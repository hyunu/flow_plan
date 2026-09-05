"""Flow Plan 데스크톱 — macOS·Windows 트레이 상주.

  - 프로세스는 메모리에 남고, 창만 숨긴다
  - 전역 단축키로 즉시 앞으로 (mac ⌘⌥F, Windows Ctrl+Shift+F)
  - 두 번째 실행은 새 프로세스를 안 만들고 기존 창만 연다
"""
from __future__ import annotations

import socket
import sys
import threading
import time
from pathlib import Path

import config

config.ensure_env()

_REPO = Path(__file__).resolve().parent.parent
if str(_REPO / "backend") not in sys.path:
    sys.path.insert(0, str(_REPO / "backend"))

import webview

from asgi import app as desktop_app
from hotkey import combo_label, load_combo, start_listener
from ipc import notify_existing, serve as serve_ipc
from bridge import DesktopApi
from tray import TrayIcon
from windowutil import raise_window

PORT = config.port()
IPC_PORT = PORT + 1


def _serve() -> None:
    import uvicorn

    uvicorn.run(desktop_app, host="127.0.0.1", port=PORT, log_level="warning")


def _wait_http(port: int, seconds: float = 8.0) -> None:
    deadline = time.time() + seconds
    while time.time() < deadline:
        try:
            s = socket.create_connection(("127.0.0.1", port), timeout=0.2)
            s.close()
            return
        except OSError:
            time.sleep(0.08)


def main() -> None:
    if notify_existing(IPC_PORT):
        if sys.platform == "darwin":
            import subprocess

            subprocess.run(
                ["osascript", "-e", 'tell application "Flow Plan" to activate'],
                check=False,
                capture_output=True,
            )
        return

    threading.Thread(target=_serve, daemon=True).start()
    _wait_http(PORT)

    combo = load_combo(config.data_dir())
    label = combo_label(combo)

    api = DesktopApi()
    window = webview.create_window(
        "Flow Plan",
        f"http://127.0.0.1:{PORT}",
        width=1400,
        height=900,
        min_size=(1000, 680),
        frameless=True,
        easy_drag=False,
        resizable=True,
        js_api=api,
    )
    api.window = window

    def _on_closing(event):
        event.cancelled = True
        try:
            window.hide()
        except Exception:
            pass

    window.events.closing += _on_closing

    def _show() -> None:
        raise_window(window)

    serve_ipc(IPC_PORT, _show)
    bind = start_listener(combo, _show)

    def _settings() -> None:
        def show_main() -> None:
            try:
                window.show()
            except Exception:
                pass
            try:
                window.restore()
            except Exception:
                pass

        def fire_js() -> None:
            time.sleep(0.2)
            try:
                window.evaluate_js(
                    "window.dispatchEvent(new CustomEvent('flowplan-open-desk-settings'))"
                )
            except Exception:
                pass

        if sys.platform == "darwin":
            try:
                from PyObjCTools.AppHelper import callAfter

                callAfter(show_main)
            except Exception:
                show_main()
        else:
            show_main()
        threading.Thread(target=fire_js, daemon=True).start()

    tray = TrayIcon(window, config.icon_path(), hotkey_label=label, on_settings=_settings)
    api.hotkey_bind = bind
    api.data_dir = config.data_dir()
    api.on_hotkey_change = tray.set_hotkey_label
    tray.start()

    webview.start()


if __name__ == "__main__":
    main()
