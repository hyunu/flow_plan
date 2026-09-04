# -*- mode: python ; coding: utf-8 -*-
# PyInstaller 스펙 — FlowPlan.exe (onefile, windowed)
# 사용: pyinstaller desktop/flowplan.spec
import os

block_cipher = None

# 저장소 루트
repo = os.path.abspath(os.path.join(SPECPATH, ".."))

a = Analysis(
    [os.path.join(SPECPATH, "app.py")],
    pathex=[SPECPATH, os.path.join(repo, "backend")],
    binaries=[],
    datas=[
        (os.path.join(repo, "frontend", "dist"), "frontend/dist"),
        (os.path.join(SPECPATH, "assets"), "assets"),
    ],
    hiddenimports=[
        "uvicorn.logging",
        "uvicorn.loops",
        "uvicorn.loops.auto",
        "uvicorn.protocols",
        "uvicorn.protocols.http",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.websockets",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.lifespan",
        "uvicorn.lifespan.on",
        "uvicorn.lifespan.off",
        "app.api",
        "app.models",
        "app.seed",
        "pydantic",
        "pydantic_settings",
        "sqlalchemy",
        "winreg",
        "PIL",
        "pystray",
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
    console=False,  # 창 없는 GUI 앱 (windowed)
    disable_windowed_traceback=False,
    icon=os.path.join(SPECPATH, "assets", "icon.ico"),
)