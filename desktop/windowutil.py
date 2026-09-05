"""창을 앞으로 가져온다. 단축키·트레이·두 번째 실행에서 같이 쓴다."""
from __future__ import annotations

import sys


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
    if sys.platform == "darwin":
        try:
            from PyObjCTools.AppHelper import callAfter

            callAfter(_go)
            return
        except Exception:
            pass
    _go()
