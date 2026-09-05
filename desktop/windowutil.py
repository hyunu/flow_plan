"""창을 앞으로 가져오거나 숨긴다. JS 브리지·트레이에서 같이 쓴다."""
from __future__ import annotations

import sys


def _on_ui(fn) -> None:
    if sys.platform == "darwin":
        try:
            from PyObjCTools.AppHelper import callAfter

            callAfter(fn)
            return
        except Exception:
            pass
    fn()


def hide_window(window) -> None:
    def _go() -> None:
        try:
            window.hide()
        except Exception:
            pass
        if sys.platform == "darwin":
            try:
                native = getattr(window, "native", None)
                if native is not None:
                    native.orderOut_(None)
            except Exception:
                pass

    _on_ui(_go)


def raise_window(window) -> None:
    def _go() -> None:
        try:
            window.show()
        except Exception:
            pass
        try:
            window.restore()
        except Exception:
            pass
        if sys.platform == "darwin":
            try:
                from AppKit import NSApplication, NSApplicationActivateIgnoringOtherApps

                app = NSApplication.sharedApplication()
                app.unhide_(None)
                app.activateIgnoringOtherApps_(True)
                for w in app.windows():
                    try:
                        if w.isMiniaturized():
                            w.deminiaturize_(None)
                        w.makeKeyAndOrderFront_(None)
                    except Exception:
                        pass
            except Exception:
                try:
                    from AppKit import NSRunningApplication, NSApplicationActivateIgnoringOtherApps

                    NSRunningApplication.currentApplication().activateWithOptions_(
                        NSApplicationActivateIgnoringOtherApps
                    )
                except Exception:
                    pass

    _on_ui(_go)
