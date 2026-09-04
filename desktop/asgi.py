"""데스크톱용 ASGI 앱.

- 기존 백엔드(backend/app.main:app)를 그대로 /api 아래에 마운트한다.
- frontend/dist 를 루트에 정적 서빙한다.
따라서 기존 프론트 빌드(기본 VITE_API_BASE='/api')가 수정 없이 동작한다.
"""
from __future__ import annotations

import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

import config

# backend 패키지를 import 가능하게 (개발: 저장소, 번들: _MEIPASS)
for _p in (config.backend_pkg(), config.repo_dir() / "backend"):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

# ⚠️ config.ensure_env()가 먼저 호출된 상태여야 한다 (app.py 에서 처리)
from app.main import app as backend_app  # noqa: E402

app = FastAPI(title="Flow Plan Desktop")

# 백엔드 전체를 /api 로 마운트 → 프론트의 '/api/...' 호출이 그대로 매핑됨
app.mount("/api", backend_app)

_dist = config.frontend_dist()
if _dist.exists():
    app.mount("/", StaticFiles(directory=str(_dist), html=True), name="frontend")