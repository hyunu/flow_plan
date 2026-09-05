"""macOS 전역 단축키. Carbon RegisterEventHotKey — 손쉬운 사용 불필요."""
from __future__ import annotations

import ctypes
import ctypes.util
from ctypes import CFUNCTYPE, POINTER, Structure, byref, c_int32, c_uint32, c_void_p

_cmd = 256
_shift = 512
_option = 2048
_control = 4096

_k_event_class_keyboard = 0x6B657962  # 'keyb'
_k_hotkey_pressed = 5

_VK = {
    "a": 0x00, "s": 0x01, "d": 0x02, "f": 0x03, "h": 0x04, "g": 0x05,
    "z": 0x06, "x": 0x07, "c": 0x08, "v": 0x09, "b": 0x0B, "q": 0x0C,
    "w": 0x0D, "e": 0x0E, "r": 0x0F, "y": 0x10, "t": 0x11,
    "1": 0x12, "2": 0x13, "3": 0x14, "4": 0x15, "6": 0x16, "5": 0x17,
    "9": 0x19, "7": 0x1A, "8": 0x1C, "0": 0x1D,
    "o": 0x1F, "u": 0x20, "i": 0x22, "p": 0x23,
    "l": 0x25, "j": 0x26, "k": 0x28, "n": 0x2D, "m": 0x2E,
    "space": 0x31,
}


class _EventTypeSpec(Structure):
    _fields_ = [("eventClass", c_uint32), ("eventKind", c_uint32)]


class _EventHotKeyID(Structure):
    _fields_ = [("signature", c_uint32), ("id", c_uint32)]


_Handler = CFUNCTYPE(c_int32, c_void_p, c_void_p, c_void_p)

_keep: list[object] = []
_hk_ref: c_void_p | None = None
_carbon = None
_handler_installed = False


def _parse(combo: str) -> tuple[int, int]:
    mods = 0
    key = None
    for t in combo.replace(" ", "").lower().split("+"):
        if t in ("cmd", "command", "win", "super", "meta"):
            mods |= _cmd
        elif t == "shift":
            mods |= _shift
        elif t in ("alt", "option"):
            mods |= _option
        elif t in ("ctrl", "control"):
            mods |= _control
        elif t in _VK:
            key = _VK[t]
    if key is None:
        raise ValueError(combo)
    return key, mods


def _on_main(fn) -> None:
    try:
        from PyObjCTools.AppHelper import callAfter

        callAfter(fn)
    except Exception:
        fn()


def unregister() -> None:
    global _hk_ref
    if _carbon is None or _hk_ref is None:
        return
    try:
        _carbon.UnregisterEventHotKey.argtypes = [c_void_p]
        _carbon.UnregisterEventHotKey.restype = c_int32
        _carbon.UnregisterEventHotKey(_hk_ref)
    except Exception:
        pass
    _hk_ref = None


def register(combo: str, on_hotkey) -> bool:
    global _hk_ref, _carbon, _handler_installed
    lib = ctypes.util.find_library("Carbon")
    if not lib:
        return False
    carbon = ctypes.cdll.LoadLibrary(lib)
    _carbon = carbon
    unregister()

    keycode, mods = _parse(combo)

    carbon.GetEventDispatcherTarget.restype = c_void_p
    target = carbon.GetEventDispatcherTarget()
    if not target:
        return False

    if not _handler_installed:
        def handler(_next, _event, _user):
            cb = _keep[0] if _keep else None
            if callable(cb):
                _on_main(cb)
            return 0

        c_handler = _Handler(handler)
        spec = _EventTypeSpec(_k_event_class_keyboard, _k_hotkey_pressed)
        handler_ref = c_void_p()
        carbon.InstallEventHandler.argtypes = [
            c_void_p, _Handler, c_uint32, POINTER(_EventTypeSpec), c_void_p, POINTER(c_void_p)
        ]
        carbon.InstallEventHandler.restype = c_int32
        err = carbon.InstallEventHandler(target, c_handler, 1, byref(spec), None, byref(handler_ref))
        if err != 0:
            return False
        _keep.append(None)
        _keep.extend([c_handler, handler_ref])
        _handler_installed = True

    _keep[0] = on_hotkey

    hk_id = _EventHotKeyID(0x46504C4E, 1)  # 'FPLN'
    hk_ref = c_void_p()
    carbon.RegisterEventHotKey.argtypes = [
        c_uint32, c_uint32, _EventHotKeyID, c_void_p, c_uint32, POINTER(c_void_p)
    ]
    carbon.RegisterEventHotKey.restype = c_int32
    err = carbon.RegisterEventHotKey(keycode, mods, hk_id, target, 0, byref(hk_ref))
    if err != 0:
        return False

    _hk_ref = hk_ref
    return True
