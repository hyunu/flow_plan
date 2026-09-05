"""트레이 — 열기, 자동 시작, 종료. 창을 닫아도 프로세스는 남는다."""
from __future__ import annotations

import subprocess
import sys
import threading
from pathlib import Path

import pystray
from PIL import Image, ImageDraw

from windowutil import raise_window

AUTOSTART_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"
AUTOSTART_NAME = "FlowPlan"
MAC_PLIST = Path.home() / "Library" / "LaunchAgents" / "com.flowplan.desktop.plist"


class TrayIcon:
    def __init__(self, window, icon_path: Path | None = None, hotkey_label: str = "", on_settings=None):
        self.window = window
        self.hotkey_label = hotkey_label
        self.on_settings = on_settings
        self.icon = pystray.Icon(
            "flowplan",
            self._load_icon(icon_path),
            "Flow Plan",
            self._menu(),
        )

    def _load_icon(self, icon_path: Path | None) -> Image.Image:
        del icon_path
        return self._menu_glyph()

    def _menu_glyph(self) -> Image.Image:
        size = 64
        img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        # macOS 템플릿: 검정 글리프 → 메뉴바가 흰색/검정으로 칠함
        fill = (0, 0, 0, 255) if sys.platform == "darwin" else (255, 255, 255, 255)
        stem = 11
        x0, y0, y1 = 16, 10, 54
        draw.rounded_rectangle((x0, y0, x0 + stem, y1), radius=2, fill=fill)
        draw.rounded_rectangle((x0, y0, 50, y0 + stem), radius=2, fill=fill)
        draw.rounded_rectangle((x0, 29, 42, 29 + stem - 1), radius=2, fill=fill)
        return img

    def _apply_mac_template(self) -> None:
        try:
            img = getattr(self.icon, "_icon_image", None)
            if img is None:
                return
            img.setTemplate_(True)
            self.icon._status_item.button().setImage_(img)
        except Exception:
            pass

    def show(self) -> None:
        raise_window(self.window)

    def hide(self) -> None:
        try:
            self.window.hide()
        except Exception:
            pass

    def _toggle(self) -> None:
        try:
            hidden = getattr(self.window, "hidden", None)
            if hidden is True:
                self.show()
            else:
                self.show()
        except Exception:
            self.show()

    def _quit(self) -> None:
        import os

        os._exit(0)

    def _launch_cmd(self) -> list[str]:
        if getattr(sys, "frozen", False):
            return [sys.executable]
        script = Path(__file__).resolve().parent / "launch.py"
        return [sys.executable, str(script)]

    def _is_autostart(self) -> bool:
        if sys.platform == "win32":
            try:
                import winreg

                with winreg.OpenKey(winreg.HKEY_CURRENT_USER, AUTOSTART_KEY) as key:
                    winreg.QueryValueEx(key, AUTOSTART_NAME)
                return True
            except OSError:
                return False
        if sys.platform == "darwin":
            return MAC_PLIST.exists()
        return False

    def _set_autostart(self, enable: bool) -> None:
        if sys.platform == "win32":
            import winreg

            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, AUTOSTART_KEY, 0, winreg.KEY_SET_VALUE) as key:
                if enable:
                    parts = self._launch_cmd()
                    cmd = " ".join(f'"{p}"' for p in parts)
                    winreg.SetValueEx(key, AUTOSTART_NAME, 0, winreg.REG_SZ, cmd)
                else:
                    try:
                        winreg.DeleteValue(key, AUTOSTART_NAME)
                    except OSError:
                        pass
            return
        if sys.platform == "darwin":
            if enable:
                args = "".join(f"    <string>{p}</string>\n" for p in self._launch_cmd())
                MAC_PLIST.parent.mkdir(parents=True, exist_ok=True)
                MAC_PLIST.write_text(
                    '<?xml version="1.0" encoding="UTF-8"?>\n'
                    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" '
                    '"http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n'
                    '<plist version="1.0"><dict>\n'
                    "  <key>Label</key><string>com.flowplan.desktop</string>\n"
                    "  <key>RunAtLoad</key><true/>\n"
                    "  <key>KeepAlive</key><false/>\n"
                    "  <key>ProgramArguments</key><array>\n"
                    f"{args}"
                    "  </array>\n"
                    "</dict></plist>\n",
                    encoding="utf-8",
                )
                subprocess.run(["launchctl", "load", "-w", str(MAC_PLIST)], check=False, capture_output=True)
            else:
                subprocess.run(["launchctl", "unload", "-w", str(MAC_PLIST)], check=False, capture_output=True)
                try:
                    MAC_PLIST.unlink()
                except OSError:
                    pass

    def _toggle_autostart(self) -> None:
        self._set_autostart(not self._is_autostart())

    def _open_settings(self) -> None:
        if self.on_settings:
            self.on_settings()

    def set_hotkey_label(self, label: str) -> None:
        self.hotkey_label = label
        try:
            self.icon.menu = self._menu()
            self.icon.update_menu()
        except Exception:
            pass

    def _menu(self):
        items = [
            pystray.MenuItem("열기", lambda icon, item: self.show(), default=True),
            pystray.MenuItem("숨기기", lambda icon, item: self.hide()),
            pystray.MenuItem(
                "로그인 시 자동 시작",
                lambda icon, item: self._toggle_autostart(),
                checked=lambda item: self._is_autostart(),
            ),
            pystray.MenuItem(
                f"설정…{f'  ({self.hotkey_label})' if self.hotkey_label else ''}",
                lambda icon, item: self._open_settings(),
            ),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("종료", lambda icon, item: self._quit()),
        ]
        return pystray.Menu(*items)

    def start(self) -> None:
        # macOS 26+: NSApplication.run()을 백그라운드에서 부르면 SIGTRAP
        if sys.platform == "darwin":
            orig = self.icon._assert_image

            def wrapped():
                orig()
                self._apply_mac_template()

            self.icon._assert_image = wrapped
            try:
                self.icon.run_detached()
                return
            except Exception:
                pass
        threading.Thread(target=self.icon.run, daemon=True).start()
