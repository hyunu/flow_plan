"""Flow Plan 데스크톱 래퍼 설정.

백엔드(backend)를 그대로 재사용하되, 데이터는 %APPDATA%에 두어
설치 위치·실행 위치와 무관하게 쓰기 가능하도록 환경변수를 주입한다.
이 모듈은 반드시 backend/app.main 을 import 하기 전에 ensure_env()를 호출해야 한다.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

APP_NAME = "FlowPlan"
DEFAULT_PORT = 8765


def data_dir() -> Path:
    if sys.platform == "darwin":
        d = Path.home() / "Library" / "Application Support" / APP_NAME
    elif sys.platform == "win32":
        base = os.environ.get("APPDATA") or str(Path.home() / "AppData" / "Roaming")
        d = Path(base) / APP_NAME
    else:
        d = Path.home() / ".local" / "share" / APP_NAME
    d.mkdir(parents=True, exist_ok=True)
    return d


def ensure_env() -> None:
    """백엔드 import 전에 호출 — DB·AI 설정을 환경변수로 주입한다.

    pydantic-settings는 환경변수를 .env 보다 우선하므로, 기존 backend 코드는
    수정 없이 그대로 적용된다. AI 프로바이더는 기본 'mock'(규칙 기반, 외부 호출 없음)으로
    두어 쿼터 초과·네트워크 지연으로 생성이 멈추지 않게 한다. 실제 AI 사용 시
    .env/환경변수로 openai/gemini 등을 지정하면 된다.
    """
    d = data_dir()
    os.environ.setdefault("DATABASE_URL", f"sqlite:///{d / 'flow_plan.db'}")
    os.environ.setdefault("FLOWPLAN_DATA_DIR", str(d))
    os.environ.setdefault("AI_PROVIDER", "mock")
    # 백엔드가 backend/.env 를 다시 읽지 않도록 cwd 기준 .env 경로 고정은 두지 않는다
    # (환경변수가 우선이므로 충분).


def port() -> int:
    return int(os.environ.get("FLOWPLAN_PORT", str(DEFAULT_PORT)))


def app_root() -> Path:
    """번들(PyInstaller _MEIPASS) 또는 저장소 루트."""
    if getattr(sys, "_MEIPASS", None):
        return Path(sys._MEIPASS)
    return Path(__file__).resolve().parent.parent


def repo_dir() -> Path:
    """개발용 저장소 루트(backend/ frontend/ 상위)."""
    return Path(__file__).resolve().parent.parent


def frontend_dist() -> Path:
    return app_root() / "frontend" / "dist"


def backend_pkg() -> Path:
    return app_root() / "backend"


def prefs_path() -> Path:
    return data_dir() / "desktop.json"


def load_prefs() -> dict:
    p = prefs_path()
    if not p.exists():
        return {}
    try:
        raw = json.loads(p.read_text(encoding="utf-8"))
        return raw if isinstance(raw, dict) else {}
    except Exception:
        return {}


def update_prefs(**kwargs) -> dict:
    data = load_prefs()
    for key, val in kwargs.items():
        if val is None:
            data.pop(key, None)
        else:
            data[key] = val
    prefs_path().write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return data


def normalize_api_base(url: str) -> str:
    u = (url or "").strip()
    if not u or u in ("/api", "local", "내장"):
        return ""
    u = u.rstrip("/")
    if not u.startswith(("http://", "https://")):
        u = "http://" + u
    return u


def api_base() -> str:
    env = (os.environ.get("FLOWPLAN_API_BASE") or "").strip()
    if env:
        return normalize_api_base(env)
    return normalize_api_base(str(load_prefs().get("api_base") or ""))


def icon_path() -> Path:
    if getattr(sys, "_MEIPASS", None):
        p = Path(sys._MEIPASS) / "assets" / "icon.ico"
    else:
        p = Path(__file__).resolve().parent / "assets" / "icon.ico"
    return p