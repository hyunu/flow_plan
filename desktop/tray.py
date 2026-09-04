"""트레이 아이콘 — 표시/숨김, 자동 시작, 종료.

pywebview 창과 연결되어:
  - 창 X(닫기) → 숨김 (프로세스·메모리 유지, 트레이 상주)
  - 트레이 더블클릭 → 즉시 표시
"""
from __future__ import annotations

import sys
import threading
from pathlib import Path

import pystray
from PIL import Image, ImageDraw

AUTOSTART_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"
AUTOSTART_NAME = "FlowPlan"


class TrayIcon:
    def __init__(self, window, icon_path: Path | None = None):
        self.window = window
        self.icon = pystray.Icon(
            "flowplan",
            self._load_icon(icon_path),
            "Flow Plan",
            self._menu(),
        )

    def _load_icon(self, icon_path: Path | None) -> Image.Image:
        if icon_path is not None and icon_path.exists():
            try:
                return Image.open(icon_path)
            except Exception:
                pass
        # 폴백 아이콘: 파란 정사각형 + 'F'
        img = Image.new("RGBA", (64, 64), (51, 65, 85, 255))
        d = ImageDraw.Draw(img)
        d.text((20, 12), "F", fill=(255, 255, 255, 255))
        return img

    # ---- 트레이 동작 ----
    def _show(self) -> None:
        try:
            self.window.show()
            self.window.restore()
        except Exception:
            pass

    def _toggle(self) -> None:
        self._show()

    def _quit(self) -> None:
        import os

        os._exit(0)  # 트레이 종료 = 전체 앱 종료

    # ---- 자동 시작 (레지스트리) ----
    def _is_autostart(self) -> bool:
        if sys.platform != "win32":
            return False
        try:
            import winreg

            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, AUTOSTART_KEY) as key:
                winreg.QueryValueEx(key, AUTOSTART_NAME)
            return True
        except OSError:
            return False

    def _set_autostart(self, enable: bool) -> None:
        if sys.platform != "win32":
            return
        import winreg

        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, AUTOSTART_KEY, 0, winreg.KEY_SET_VALUE) as key:
            if enable:
                exe = sys.executable
                args = ""
                # PyInstaller 번들(onefile)이면 exe 경로만, 아니면 "pythonw app.py"
                if getattr(sys, "frozen", False):
                    cmd = f'"{exe}"'
                else:
                    script = Path(__file__).resolve().parent / "app.py"
                    cmd = f'"{exe}" "{script}"'
                winreg.SetValueEx(key, AUTOSTART_NAME, 0, winreg.REG_SZ, cmd)
            else:
                try:
                    winreg.DeleteValue(key, AUTOSTART_NAME)
                except OSError:
                    pass

    def _toggle_autostart(self) -> None:
        self._set_autostart(not self._is_autostart())

    def _menu(self):
        return pystray.Menu(
            pystray.MenuItem("열기 / 숨기기", lambda icon, item: self._toggle(), default=True),
            pystray.MenuItem(
                "자동 시작",
                lambda icon, item: self._toggle_autostart(),
                checked=lambda item: self._is_autostart(),
            ),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("종료", lambda icon, item: self._quit()),
        )

    def start_thread(self) -> None:
        threading.Thread(target=self.icon.run, daemon=True).start()