"""일정 변경 영향(impact) 수용 테스트.

우선순위 ①②③④ 구현의 백엔드 계약:

- 일정 변경 응답(`PUT /tasks/{id}`)에 `impact`가 반환된다
  (예측 완료 before→after, delta 일수, 영향/신규 지연 태스크 집합)
- 변경 적용 **전** 예측 스냅샷이 `Forecast`에 남는다 (`data_used`에 `forecast_curve`)
- 변경 이력(`GET /tasks/{id}/history`)의 `project_impact`에 영향 JSON이 저장된다
- 대시보드 `recent_changes`에 시작일 before/after가 노출된다
- 일정이 아닌 수정(상태 등)에는 impact/스냅샷이 생기지 않는다
"""
from __future__ import annotations

import json
from datetime import date, timedelta

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


# 날짜는 '오늘' 기준 상대값 — 고정 날짜를 쓰면 시간이 지나며 테스트가 깨진다.
A_START = date.today() + timedelta(days=7)
A_END = A_START + timedelta(days=10)
B_START = A_END + timedelta(days=3)
B_END = B_START + timedelta(days=6)
A_START_MOVED = A_START + timedelta(days=7)
A_END_PULLED = A_START + timedelta(days=2)


def _setup_project(client, headers, a_start=None, a_end=None) -> tuple[int, int, int]:
    """의존성(A → B)이 있는 2태스크 프로젝트를 만들고 (project_id, a_id, b_id)를 반환한다.

    a_start/a_end 로 A의 계획 구간을 바꿀 수 있다(작업량 대비 빠듯한 구간 → 지연 발생).
    """
    a_start = a_start or A_START
    a_end = a_end or A_END
    b_start = a_end + timedelta(days=3)
    b_end = b_start + timedelta(days=6)
    r = client.post("/projects", headers=headers, json={"name": "영향 테스트"})
    assert r.status_code == 200, r.text
    pid = r.json()["id"]

    r = client.post("/tasks", headers=headers, json={
        "project_id": pid, "title": "A",
        "plan_start": a_start.isoformat(), "plan_end": a_end.isoformat(), "workload": 40,
    })
    assert r.status_code == 200, r.text
    a_id = r.json()["id"]

    r = client.post("/tasks", headers=headers, json={
        "project_id": pid, "title": "B",
        "plan_start": b_start.isoformat(), "plan_end": b_end.isoformat(), "workload": 24,
    })
    assert r.status_code == 200, r.text
    b_id = r.json()["id"]

    r = client.post("/dependencies", headers=headers, json={
        "predecessor_id": a_id, "successor_id": b_id, "dependency_type": "FS",
    })
    assert r.status_code == 200, r.text
    return pid, a_id, b_id


# ---------- 우선순위 ①④: 응답 impact + 시작일 노출 ----------
def test_start_change_moves_forecast(client, admin):
    h = _auth(admin["access_token"])
    pid, a_id, b_id = _setup_project(
        client, h, a_start=A_START, a_end=A_START + timedelta(days=3)
    )

    # A 시작일을 1주 연기하면 예측 완료도 달력일 7일 뒤로 밀린다(오늘 > 계획 시작이므로 엔진이 plan_start를 따른다).
    r = client.put(f"/tasks/{a_id}", headers=h, json={"plan_start": A_START_MOVED.isoformat()})
    assert r.status_code == 200, r.text
    impact = r.json().get("impact")
    assert impact, "일정 변경 응답에 impact가 없다"
    assert impact["changed_task_id"] == a_id
    assert impact["task_before"]["plan_start"] == A_START.isoformat()
    assert impact["task_after"]["plan_start"] == A_START_MOVED.isoformat()
    assert impact["forecast_before"] < impact["forecast_after"]
    assert impact["forecast_delta_days"] == 7
    # 의존 태스크 B까지 영향받았는가
    assert a_id in impact["affected_task_ids"]
    assert b_id in impact["affected_task_ids"]

    # 우선순위 ④: 대시보드 최근 변경에 시작일 before/after
    r = client.get(f"/dashboard/projects/{pid}", headers=h)
    assert r.status_code == 200, r.text
    recent = r.json()["recent_changes"][0]
    assert recent["task_id"] == a_id
    assert recent["before_start"] == A_START.isoformat()
    assert recent["after_start"] == A_START_MOVED.isoformat()


# ---------- 우선순위 ①: 종료일 당김 → 지연 발생 ----------
def test_pull_end_creates_delay(client, admin):
    h = _auth(admin["access_token"])
    pid, a_id, _b_id = _setup_project(client, h)

    # A 종료일을 앞당기면 계획은 당겨지지만 남은 작업량 기반 예측은 그대로 → 지연 발생.
    r = client.put(f"/tasks/{a_id}", headers=h, json={"plan_end": A_END_PULLED.isoformat()})
    assert r.status_code == 200, r.text
    impact = r.json()["impact"]
    assert impact["delay_days_before"] == 0
    assert impact["delay_days_after"] > 0
    assert a_id in impact["newly_delayed_task_ids"]
    assert a_id in impact["affected_task_ids"]
    # 예측 완료는 남은 작업량 기준이라 계획 종료일을 당겨도 늦어지지 않는다(같거나 앞당겨짐)
    assert impact["forecast_delta_days"] <= 0


# ---------- 이력 저장(우선순위 ①의 기록) ----------
def test_impact_stored_in_history(client, admin):
    h = _auth(admin["access_token"])
    pid, a_id, _b_id = _setup_project(client, h)

    r = client.put(f"/tasks/{a_id}", headers=h, json={
        "plan_end": A_END_PULLED.isoformat(), "change_reason": "범위 축소",
    })
    assert r.status_code == 200, r.text
    impact = r.json()["impact"]

    r = client.get(f"/tasks/{a_id}/history", headers=h)
    assert r.status_code == 200, r.text
    hist = r.json()
    assert hist, "변경 이력이 비어 있다"
    latest = hist[0]
    assert latest["reason"] == "범위 축소"
    assert latest["project_impact"], "ScheduleChange.project_impact가 저장되지 않았다"
    stored = json.loads(latest["project_impact"])
    assert stored["changed_task_id"] == a_id
    assert stored["forecast_after"] == impact["forecast_after"]
    assert stored["affected_task_ids"] == impact["affected_task_ids"]


# ---------- 우선순위 ③: 변경 전 예측 스냅샷 ----------
def test_forecast_snapshot_taken(client, admin):
    h = _auth(admin["access_token"])
    pid, a_id, _b_id = _setup_project(client, h)

    r = client.get(f"/projects/{pid}/forecast", headers=h)
    assert r.status_code == 200, r.text
    before = r.json()
    assert before == [], "준비 단계에서 스냅샷이 있으면 안 된다"

    r = client.put(f"/tasks/{a_id}", headers=h, json={"plan_end": A_END_PULLED.isoformat()})
    assert r.status_code == 200, r.text

    r = client.get(f"/projects/{pid}/forecast", headers=h)
    rows = r.json()
    assert len(rows) == len(before) + 1, "일정 변경 시 예측 스냅샷 1건이 생겨야 한다"
    latest = rows[-1]
    assert latest["forecast_finish"]
    data = json.loads(latest["data_used"] or "{}")
    assert data.get("forecast_curve"), "스냅샷 data_used에 forecast_curve가 없다"


# ---------- 스냅샷/impact는 일정 변경에만 ----------
def test_non_schedule_change_has_no_impact(client, admin):
    h = _auth(admin["access_token"])
    pid, a_id, _b_id = _setup_project(client, h)

    r = client.put(f"/tasks/{a_id}", headers=h, json={"status": "in_progress"})
    assert r.status_code == 200, r.text
    assert r.json().get("impact") is None

    r = client.get(f"/projects/{pid}/forecast", headers=h)
    assert r.json() == [], "일정이 아닌 수정에서 스냅샷이 생기면 안 된다"
