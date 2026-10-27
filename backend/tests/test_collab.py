"""동시 편집 대응 계약 테스트.

- 편집 중 표시(presence): 두 사용자의 하트비트가 공유되고, 만료되면 사라지며, DELETE로 해제된다.
- 덮어쓰기 방지(낙관적 잠금): expected_revision이 서버 값과 다르면 409,
  최신 revision으로는 성공하고, 값을 보내지 않는 기존 클라이언트는 그대로 동작한다.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.core.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models.entities import EditPresence  # noqa: E402
from app.seed import seed  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    seed(db)
    db.close()


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def client():
    return TestClient(app)


@pytest.fixture()
def admin(client):
    r = client.post("/auth/login", data={"username": "admin", "password": "admin123"})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture()
def pm(client):
    r = client.post("/auth/login", data={"username": "pm_a", "password": "pm123"})
    assert r.status_code == 200, r.text
    return r.json()


def _setup_project(client, headers) -> tuple[int, int]:
    r = client.post("/projects", headers=headers, json={"name": "동시 편집 테스트"})
    assert r.status_code == 200, r.text
    pid = r.json()["id"]
    r = client.post("/tasks", headers=headers, json={
        "project_id": pid, "title": "A",
        "plan_start": "2026-11-02", "plan_end": "2026-11-06", "workload": 40,
    })
    assert r.status_code == 200, r.text
    return pid, r.json()["id"]


def _add_pm_member(client, headers, pid: int) -> int:
    users = client.get("/users", headers=headers).json()
    uid = next(u["id"] for u in users if u["username"] == "pm_a")
    r = client.post(f"/projects/{pid}/members", headers=headers,
                    json={"user_id": uid, "role_in_project": "member"})
    assert r.status_code == 200, r.text
    return uid


# ---------- A. 편집 중 표시 ----------
def test_presence_shared_between_users(client, admin, pm):
    a = _auth(admin["access_token"])
    p = _auth(pm["access_token"])
    pid, tid = _setup_project(client, a)
    pm_uid = _add_pm_member(client, a, pid)

    # admin이 태스크를 편집 중이라고 알린다.
    r = client.post(f"/projects/{pid}/presence", headers=a, json={"task_id": tid})
    assert r.status_code == 200, r.text

    # pm이 보면 admin이 해당 태스크를 편집 중으로 보인다.
    r = client.get(f"/projects/{pid}/presence", headers=p)
    assert r.status_code == 200, r.text
    items = r.json()
    assert len(items) == 1
    assert items[0]["user_name"]
    assert items[0]["task_id"] == tid

    # pm은 프로젝트 단위로 합류(태스크 없음) → 두 사람이 보인다.
    r = client.post(f"/projects/{pid}/presence", headers=p, json={})
    assert r.status_code == 200, r.text
    r = client.get(f"/projects/{pid}/presence", headers=a)
    rows = r.json()
    assert len(rows) == 2
    assert {row["task_id"] for row in rows} == {tid, None}

    # admin이 나가면 자기 행만 지워진다.
    r = client.delete(f"/projects/{pid}/presence", headers=a)
    assert r.status_code == 200, r.text
    rows = client.get(f"/projects/{pid}/presence", headers=p).json()
    assert len(rows) == 1
    assert rows[0]["user_id"] == pm_uid


def test_presence_expires(client, admin, pm):
    a = _auth(admin["access_token"])
    p = _auth(pm["access_token"])
    pid, tid = _setup_project(client, a)
    _add_pm_member(client, a, pid)

    client.post(f"/projects/{pid}/presence", headers=a, json={"task_id": tid})

    # 하트비트를 10분 전으로 되돌리면 목록에서 빠진다(만료 60초).
    db = SessionLocal()
    try:
        row = db.query(EditPresence).filter_by(project_id=pid).one()
        row.updated_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=10)
        db.commit()
    finally:
        db.close()

    r = client.get(f"/projects/{pid}/presence", headers=p)
    assert r.status_code == 200, r.text
    assert r.json() == []


def test_presence_requires_project_access(client, admin):
    """프로젝트 멤버가 아니면 presence를 볼 수 없다(IDOR 방지)."""
    a = _auth(admin["access_token"])
    pid, tid = _setup_project(client, a)

    # pm_a는 이 프로젝트 멤버가 아니다.
    r = client.post("/auth/login", data={"username": "pm_a", "password": "pm123"})
    p = _auth(r.json()["access_token"])
    r = client.get(f"/projects/{pid}/presence", headers=p)
    assert r.status_code in (403, 404)


# ---------- D. 덮어쓰기 방지 ----------
def test_stale_revision_conflict(client, admin, pm):
    a = _auth(admin["access_token"])
    p = _auth(pm["access_token"])
    pid, tid = _setup_project(client, a)
    _add_pm_member(client, a, pid)

    r = client.get(f"/tasks/{tid}", headers=a)
    rev = r.json()["revision"]
    assert isinstance(rev, int) and rev >= 1

    # admin이 먼저 저장 → revision 증가
    r = client.put(f"/tasks/{tid}", headers=a, json={
        "plan_end": "2026-11-05", "expected_revision": rev,
    })
    assert r.status_code == 200, r.text
    assert r.json()["revision"] == rev + 1

    # pm이 같은(이미 지난) revision으로 저장 시도 → 409
    r = client.put(f"/tasks/{tid}", headers=p, json={
        "plan_end": "2026-11-04", "expected_revision": rev,
    })
    assert r.status_code == 409, r.text
    assert "다른 사용자" in r.json()["detail"]

    # 최신 revision으로 다시 저장하면 성공하고, 마지막 값이 반영된다.
    latest = client.get(f"/tasks/{tid}", headers=p).json()["revision"]
    r = client.put(f"/tasks/{tid}", headers=p, json={
        "plan_end": "2026-11-04", "expected_revision": latest,
    })
    assert r.status_code == 200, r.text
    assert r.json()["plan_end"] == "2026-11-04"


def test_revision_optional_for_old_clients(client, admin):
    a = _auth(admin["access_token"])
    _pid, tid = _setup_project(client, a)

    r = client.put(f"/tasks/{tid}", headers=a, json={"status": "in_progress"})
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "in_progress"


def test_revision_not_bumped_by_engine_progress(client, admin):
    """엔진 진척 반영(apply_engine_progress)은 revision을 올리지 않는다."""
    a = _auth(admin["access_token"])
    pid, tid = _setup_project(client, a)

    before = client.get(f"/tasks/{tid}", headers=a).json()["revision"]
    # 진척률 보정은 엔진 계산을 다시 돌리지만 사용자 '일정 편집'은 아니다.
    r = client.put(f"/tasks/{tid}", headers=a, json={"effective_progress": 30.0})
    assert r.status_code == 200, r.text
    mid = r.json()["revision"]
    assert mid == before + 1  # 이 경로도 사용자 저장이므로 1 증가

    # 대시보드 조회(엔진 계산·스냅샷)는 revision을 바꾸지 않는다.
    client.get(f"/dashboard/projects/{pid}", headers=a)
    after = client.get(f"/tasks/{tid}", headers=a).json()["revision"]
    assert after == mid
