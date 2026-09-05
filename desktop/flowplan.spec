# -*- mode: python ; coding: utf-8 -*-
# PyInstaller 스펙 — FlowPlan.exe (onefile, windowed)
# 사용: pyinstaller desktop/flowplan.spec
import os
import sys

from PyInstaller.utils.hooks import collect_all, collect_submodules

block_cipher = None

# 저장소 루트
repo = os.path.abspath(os.path.join(SPECPATH, ".."))
sys.path.insert(0, os.path.join(repo, "backend"))

extra_datas = [
    (os.path.join(repo, "frontend", "dist"), "frontend/dist"),
    (os.path.join(SPECPATH, "assets"), "assets"),
    (os.path.join(repo, "backend", "app"), "backend/app"),
]
extra_bins = []
extra_hidden = collect_submodules("app") + collect_submodules("email")
for pkg in (
    "fastapi",
    "starlette",
    "uvicorn",
    "sqlalchemy",
    "pydantic",
    "pydantic_settings",
    "jose",
    "passlib",
    "multipart",
    "python_multipart",
    "httpx",
    "anyio",
    "httptools",
    "websockets",
):
    try:
        d, b, h = collect_all(pkg)
        extra_datas += d
        extra_bins += b
        extra_hidden += h
    except Exception:
        extra_hidden.append(pkg)

a = Analysis(
    [os.path.join(SPECPATH, "launch.py")],
    pathex=[SPECPATH, os.path.join(repo, "backend")],
    binaries=extra_bins,
    datas=extra_datas,
    hiddenimports=extra_hidden + [
        "fastapi.middleware.cors",
        "uvicorn.logging",
        "uvicorn.loops.auto",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.lifespan.on",
        "winreg",
        "PIL",
        "pystray",
        "pynput.keyboard._win32",
        "pynput.keyboard._darwin",
        "mac_hotkey",
        "settings_ui",
        "PyObjCTools.AppHelper",
        "email.mime",
        "email.mime.multipart",
        "email.mime.text",
        "email.header",
        "email.utils",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["tkinter", "pytest", "test"],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

_icon_ico = os.path.join(SPECPATH, "assets", "icon.ico")
_icon_icns = os.path.join(SPECPATH, "assets", "icon.icns")
_mac = os.path.exists(_icon_icns)

if sys.platform == "darwin":
    exe = EXE(
        pyz,
        a.scripts,
        [],
        exclude_binaries=True,
        name="FlowPlan",
        debug=False,
        bootloader_ignore_signals=False,
        strip=False,
        upx=False,
        console=False,
        disable_windowed_traceback=False,
        icon=_icon_icns if _mac else None,
    )
    coll = COLLECT(
        exe,
        a.binaries,
        a.zipfiles,
        a.datas,
        strip=False,
        upx=False,
        name="FlowPlan",
    )
    app = BUNDLE(
        coll,
        name="Flow Plan.app",
        icon=_icon_icns if _mac else None,
        bundle_identifier="dev.flowplan.desktop",
        info_plist={
            "CFBundleName": "Flow Plan",
            "CFBundleDisplayName": "Flow Plan",
            "CFBundleShortVersionString": "0.2.0",
            "CFBundleVersion": "0.2.0",
            "NSHighResolutionCapable": True,
            "LSMinimumSystemVersion": "12.0",
            "NSAppleEventsUsageDescription": "전역 단축키로 창을 앞으로 가져옵니다.",
            "NSAccessibilityUsageDescription": "다른 앱이 앞에 있을 때도 단축키로 Flow Plan을 엽니다.",
        },
    )
else:
    exe = EXE(
        pyz,
        a.scripts,
        a.binaries,
        a.zipfiles,
        a.datas,
        [],
        name="FlowPlan",
        debug=False,
        bootloader_ignore_signals=False,
        strip=False,
        upx=True,
        upx_exclude=[],
        runtime_tmpdir=None,
        console=False,
        disable_windowed_traceback=False,
        icon=_icon_ico,
    )