"""프레이임 없는 창에서 닫기·이동·크기 조절."""
from __future__ import annotations

from hotkey import combo_label, default_combo


class DesktopApi:
    def __init__(self) -> None:
        self.window = None
        self.hotkey_bind = None
        self.data_dir = None
        self.on_hotkey_change = None

    def get_hotkey(self) -> dict:
        combo = getattr(self.hotkey_bind, "combo", "") or default_combo()
        return {"combo": combo, "label": combo_label(combo), "default": default_combo()}

    def set_hotkey(self, combo: str) -> dict:
        import threading

        bind = self.hotkey_bind
        if bind is None or self.data_dir is None:
            raise RuntimeError("단축키를 바꿀 수 없습니다.")
        applied = bind.set_combo(combo, self.data_dir)
        cb = self.on_hotkey_change
        if cb:
            threading.Thread(target=lambda: cb(combo_label(applied)), daemon=True).start()
        return self.get_hotkey()

    def reset_hotkey(self) -> dict:
        return self.set_hotkey(default_combo())

    def get_desktop_prefs(self) -> dict:
        import config

        hk = self.get_hotkey()
        base = config.api_base()
        return {
            **hk,
            "api_base": base,
            "api_base_display": base or "/api (이 앱)",
        }

    def set_api_base(self, url: str) -> dict:
        import config

        config.update_prefs(api_base=config.normalize_api_base(url))
        return self.get_desktop_prefs()

    def save_text(self, suggested: str, content: str) -> dict:
        """저장 경로를 고르게 한 뒤 텍스트 파일을 쓴다."""
        import threading
        from pathlib import Path

        import webview

        w = self.window
        if w is None:
            return {"ok": False, "error": "창이 없습니다."}
        name = (suggested or "backup.json").replace("/", "-").replace("\\", "-")
        if not name.endswith(".json"):
            name += ".json"
        box: dict = {}
        done = threading.Event()

        def _go() -> None:
            try:
                kind = getattr(getattr(webview, "FileDialog", None), "SAVE", None)
                if kind is None:
                    kind = getattr(webview, "SAVE_DIALOG", 10)
                home = str(Path.home() / "Downloads")
                if not Path(home).is_dir():
                    home = str(Path.home())
                res = w.create_file_dialog(
                    kind,
                    directory=home,
                    save_filename=name,
                    file_types=("JSON (*.json)",),
                )
                path = None
                if res:
                    path = res[0] if isinstance(res, (list, tuple)) else str(res)
                if not path:
                    box["cancelled"] = True
                else:
                    p = Path(str(path))
                    if p.suffix.lower() != ".json":
                        p = p.with_suffix(".json")
                    p.write_text(content, encoding="utf-8")
                    box["path"] = str(p)
            except Exception as exc:
                box["error"] = str(exc)
            finally:
                done.set()

        import sys

        if sys.platform == "darwin" and threading.current_thread() is not threading.main_thread():
            try:
                from PyObjCTools.AppHelper import callAfter

                callAfter(_go)
                if not done.wait(180):
                    return {"ok": False, "error": "저장 대화상자가 응답하지 않습니다."}
            except Exception:
                _go()
        else:
            _go()
        if box.get("error"):
            return {"ok": False, "error": box["error"]}
        if box.get("cancelled"):
            return {"ok": False, "cancelled": True}
        return {"ok": True, "path": box.get("path") or ""}

    def hide(self) -> None:
        from windowutil import hide_window

        w = self.window
        if w is None:
            return
        hide_window(w)

    def geometry(self) -> dict:
        w = self.window
        if w is None:
            return {"x": 0, "y": 0, "width": 1400, "height": 900}
        return {
            "x": int(getattr(w, "x", 0) or 0),
            "y": int(getattr(w, "y", 0) or 0),
            "width": int(getattr(w, "width", 1400) or 1400),
            "height": int(getattr(w, "height", 900) or 900),
        }

    def move_to(self, x: int, y: int) -> None:
        w = self.window
        if w is None:
            return
        try:
            w.move(int(x), int(y))
        except Exception:
            pass

    def resize_to(self, width: int, height: int) -> None:
        w = self.window
        if w is None:
            return
        width = max(1000, int(width))
        height = max(680, int(height))
        try:
            w.resize(width, height)
        except Exception:
            pass
