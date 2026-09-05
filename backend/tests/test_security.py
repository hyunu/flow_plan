"""API 보안 Acceptance Criteria 테스트 (§48).

- 인증 없이 보호 API 호출 불가
- 만료된 Access Token으로 호출 불가
- 권한 없는 사용자의 Project ID 직접 입력 차단(IDOR/BOLA)
- 권한 없는 사용자가 타인 Task 수정 불가
- Project Member가 System Admin API 호출 불가
- Refresh Token 회전/폐기
- Rate Limit 적용
- Audit Log 기록
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.core.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.seed import seed  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    seed(db)
    db.close()


@pytest.fixture(autouse=True)
def _reset_rate_limit():
    from app.core.ratelimit import _backend

    if hasattr(_backend, "reset"):
        _backend.reset()
    yield


@pytest.fixture()
def client():
    return TestClient(app)


def _login(client, username: str, password: str) -> dict:
    r = client.post("/auth/login", data={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture()
def admin(client):
    return _login(client, "admin", "admin123")


@pytest.fixture()
def pm(client):
    return _login(client, "pm_a", "pm123")


@pytest.fixture()
def member(client):
    return _login(client, "dev_back", "member123")


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ---------- §48-1: 인증 없이 보호 API 호출 불가 ----------
@pytest.mark.parametrize(
    "method,path",
    [
        ("GET", "/projects"),
        ("POST", "/projects"),
        ("GET", "/tasks"),
        ("POST", "/tasks"),
        ("GET", "/challenges"),
        ("GET", "/audit"),
        ("GET", "/users"),
        ("POST", "/reports/daily/generate"),
    ],
)
def test_unauthenticated_blocked(client, method, path):
    r = client.request(method, path, json={} if method == "POST" else None)
    assert r.status_code in (401, 422), f"{method} {path} -> {r.status_code}"


# ---------- §48-2: 만료된 Access Token 차단 ----------
def test_expired_access_token_blocked(client):
    from jose import jwt as pyjwt
    from datetime import datetime, timezone

    from app.core.config import settings

    # 명시적으로 만료된 access token
    expired_payload = {
        "sub": "1", "type": "access",
        "exp": datetime.now(timezone.utc).timestamp() - 60,
    }
    expired = pyjwt.encode(expired_payload, settings.secret_key, algorithm=settings.algorithm)
    r = client.get("/projects", headers=_auth(expired))
    assert r.status_code == 401

    # refresh token은 access token으로 사용 불가해야 함
    from app.core.security import create_refresh_token

    refresh = create_refresh_token(SessionLocal(), 1)
    r = client.get("/projects", headers=_auth(refresh))
    assert r.status_code == 401


# ---------- §48-3: IDOR/BOLA - 다른 프로젝트 ID 직접 입력 차단 ----------
def test_idor_project_access_blocked(client, member, admin):
    # 멤버(dev_back)은 Project A(1)만 참여. 프로젝트 9999 존재하지 않음 -> 404
    r = client.get("/projects/9999", headers=_auth(member["access_token"]))
    assert r.status_code == 404

    # outsider 사용자 생성(SysAdmin 전용 API)
    r = client.post("/users", headers=_auth(admin["access_token"]), json={
        "username": "outsider", "email": "out@x.com", "name": "외부인", "password": "pass123", "role_id": 3,
    })
    assert r.status_code == 200, r.text
    r = client.post("/auth/login", data={"username": "outsider", "password": "pass123"})
    assert r.status_code == 200, r.text
    outsider = r.json()
    # outsider(member 아님)가 project 1 접근 -> 403
    r = client.get("/projects/1", headers=_auth(outsider["access_token"]))
    assert r.status_code == 403
    # outsider가 SysAdmin API 호출 -> 403
    r = client.post("/users", headers=_auth(outsider["access_token"]), json={
        "username": "u2", "email": "u2@x.com", "name": "u2", "password": "x", "role_id": 3,
    })
    assert r.status_code == 403


def test_idor_task_direct_id(client, member):
    # 멤버(dev_back)은 Project A 소속 -> task 1 조회 가능
    r = client.get("/tasks/1", headers=_auth(member["access_token"]))
    assert r.status_code in (200, 403)
    # 존재하지 않는 task -> 404
    r = client.get("/tasks/99999", headers=_auth(member["access_token"]))
    assert r.status_code == 404


# ---------- §48-4: 권한 없는 사용자가 타인 Task 수정 불가 ----------
def test_member_cannot_edit_task(client, member):
    # 멤버(dev_back)은 멤버(manage 불가). Task 수정(PUT)은 manage 권한 필요
    r = client.put("/tasks/1", headers=_auth(member["access_token"]), json={"title": "hacked"})
    assert r.status_code == 403


# ---------- §48-5: Member가 System Admin API 호출 불가 ----------
def test_member_cannot_call_admin_api(client, member):
    r = client.get("/users", headers=_auth(member["access_token"]))
    assert r.status_code == 403
    r = client.get("/audit", headers=_auth(member["access_token"]))
    assert r.status_code == 403


# ---------- Refresh Token 회전/폐기 ----------
def test_refresh_token_rotation_and_revocation(client, member):
    refresh = member["refresh_token"]
    # 정상 refresh
    r = client.post("/auth/refresh", json={"refresh_token": refresh})
    assert r.status_code == 200
    new_pair = r.json()
    assert new_pair["access_token"] and new_pair["refresh_token"] != refresh
    # 재사용(이전 refresh) -> 401 (회전으로 폐기됨)
    r = client.post("/auth/refresh", json={"refresh_token": refresh})
    assert r.status_code == 401

    # logout 시 모든 refresh token 폐기
    r = client.post("/auth/logout", headers=_auth(new_pair["access_token"]))
    assert r.status_code == 200
    r = client.post("/auth/refresh", json={"refresh_token": new_pair["refresh_token"]})
    assert r.status_code == 401


def test_refresh_with_wrong_token(client):
    r = client.post("/auth/refresh", json={"refresh_token": "invalid-token"})
    assert r.status_code == 401


# ---------- Rate Limit ----------
def test_login_rate_limit(client):
    # login limit: 20회/5분
    r = None
    for _ in range(21):
        r = client.post("/auth/login", data={"username": "dev_back", "password": "wrong"})
    assert r.status_code == 429


# ---------- Audit Log ----------
def test_audit_log_created(client, admin):
    r = client.get("/audit", headers=_auth(admin["access_token"]))
    assert r.status_code == 200
    logs = r.json()
    assert len(logs) > 0
    # 로그인 성공/실패 기록 확인
    actions = {l["action"] for l in logs}
    assert "login" in actions
    assert any(l["entity"] == "Auth" for l in logs)  # 실패 기록 포함


def test_audit_log_not_exposed_to_member(client, member):
    r = client.get("/audit", headers=_auth(member["access_token"]))
    assert r.status_code == 403


def test_setup_blocked_when_users_exist(client):
    r = client.get("/auth/setup-status")
    assert r.status_code == 200
    assert r.json()["needs_setup"] is False
    r = client.post("/auth/setup", json={"username": "hacker", "password": "password1", "name": "x"})
    assert r.status_code == 409