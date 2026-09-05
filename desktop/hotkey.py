"""전역 단축키. 기본은 macOS ⌘⌥F, Windows Ctrl+Shift+F.

환경변수 FLOWPLAN_HOTKEY 또는 data_dir/desktop.json 의 hotkey 로 바꿉니다.
예: cmd+shift+space, ctrl+alt+p
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

_MOD = {
    "ctrl": "<ctrl>",
    "control": "<ctrl>",
    "alt": "<alt>",
    "option": "<alt>",
    "shift": "<shift>",
    "cmd": "<cmd>",
    "command": "<cmd>",
    "win": "<cmd>",
    "super": "<cmd>",
    "meta": "<cmd>",
}


def default_combo() -> str:
    return "cmd+alt+f" if sys.platform == "darwin" else "ctrl+shift+f"


def load_combo(data_dir: Path) -> str:
    env = (os.environ.get("FLOWPLAN_HOTKEY") or "").strip()
    if env:
        return env.lower()
    p = data_dir / "desktop.json"
    if p.exists():
        try:
            v = json.loads(p.read_text(encoding="utf-8")).get("hotkey")
            if isinstance(v, str) and v.strip():
                return v.strip().lower()
        except Exception:
            pass
    return default_combo()


def combo_label(combo: str) -> str:
    parts = []
    for t in combo.replace(" ", "").split("+"):
        if t in ("cmd", "command"):
            parts.append("⌘" if sys.platform == "darwin" else "Win")
        elif t in ("ctrl", "control"):
            parts.append("Ctrl")
        elif t in ("alt", "option"):
            parts.append("⌥" if sys.platform == "darwin" else "Alt")
        elif t == "shift":
            parts.append("⇧" if sys.platform == "darwin" else "Shift")
        elif t == "space":
            parts.append("Space")
        else:
            parts.append(t.upper())
    return "+".join(parts)


def to_pynput(combo: str) -> str:
    out: list[str] = []
    for t in combo.replace(" ", "").lower().split("+"):
        if t in _MOD:
            out.append(_MOD[t])
        elif t == "space":
            out.append("<space>")
        elif len(t) == 1:
            out.append(t)
        else:
            out.append(f"<{t}>")
    return "+".join(out)


def _on_main(fn) -> None:
    if sys.platform == "darwin":
        try:
            from PyObjCTools.AppHelper import callAfter

            callAfter(fn)
            return
        except Exception:
            pass
    fn()


def save_combo(data_dir: Path, combo: str) -> None:
    del data_dir
    from config import update_prefs

    update_prefs(hotkey=combo.strip().lower())


def normalize_combo(combo: str) -> str:
    raw = [t for t in combo.replace(" ", "").lower().split("+") if t]
    mods: list[str] = []
    key = ""
    for t in raw:
        if t in ("cmd", "command", "win", "super", "meta"):
            if "cmd" not in mods:
                mods.append("cmd")
        elif t in ("ctrl", "control"):
            if "ctrl" not in mods:
                mods.append("ctrl")
        elif t in ("alt", "option"):
            if "alt" not in mods:
                mods.append("alt")
        elif t == "shift":
            if "shift" not in mods:
                mods.append("shift")
        elif t == "space" or (len(t) == 1 and t.isalnum()):
            key = t
    if not mods or not key:
        raise ValueError("modifier+key")
    return "+".join(mods + [key])


class HotkeyBind:
    def __init__(self) -> None:
        self.combo = ""
        self._cb = None
        self._pynput = None
        self._carbon = False

    def start(self, combo: str, on_hotkey) -> None:
        self._cb = on_hotkey
        self._bind(combo)

    def set_combo(self, combo: str, data_dir: Path) -> str:
        combo = normalize_combo(combo)
        save_combo(data_dir, combo)
        self.combo = combo

        def later() -> None:
            self._bind(combo)

        if sys.platform == "darwin":
            try:
                from PyObjCTools.AppHelper import callAfter

                callAfter(later)
                return combo
            except Exception:
                pass
        later()
        return combo

    def _bind(self, combo: str) -> None:
        self.stop()
        self.combo = combo
        if not self._cb:
            return
        if sys.platform == "darwin":
            try:
                from mac_hotkey import register

                if register(combo, self._cb):
                    self._carbon = True
                    return
            except Exception:
                pass
        try:
            from pynput import keyboard
        except Exception:
            return
        mapping = {to_pynput(combo): lambda: _on_main(self._cb)}
        listener = keyboard.GlobalHotKeys(mapping)
        listener.daemon = True
        listener.start()
        self._pynput = listener

    def stop(self) -> None:
        if self._carbon:
            try:
                from mac_hotkey import unregister

                unregister()
            except Exception:
                pass
            self._carbon = False
        if self._pynput is not None:
            try:
                self._pynput.stop()
            except Exception:
                pass
            self._pynput = None


def start_listener(combo: str, on_hotkey) -> HotkeyBind:
    bind = HotkeyBind()
    bind.start(combo, on_hotkey)
    return bind
