"""챌린지·리포트 품질 회귀 테스트.

- 챌린지 우선순위는 '예측 임계경로'(실제 지연 반영) 기준이어야 한다.
- 더 이상 해당되지 않는 열린 챌린지는 만료(expired) 처리한다.
- 일일 리포트는 자동 생성되고, 어제 대비·오늘 마감·예측 임계경로 섹션을 포함한다.
"""
from __future__ import annotations

import tempfile
from datetime import date

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.entities import Base, Challenge, DailyReport, Project, Task, TaskAssignment, User
from app.seed import seed
from app.services.ai_service import (
    generate_all_daily_reports,
    generate_daily_report,
    generate_user_challenges,
)


@pytest.fixture()
def db():
    path = tempfile.mktemp(suffix=".db")
    engine = create_engine(f"sqlite:///{path}")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    session = Session()
    seed(session)
    yield session
    session.close()


def _owner_of(db, task_id: int) -> User | None:
    a = db.query(TaskAssignment).filter_by(task_id=task_id).first()
    return db.get(User, a.user_id) if a else None


def test_challenge_priority_uses_forecast_critical(db):
    """계획상 비임계여도 실제로 크게 지연된 태스크는 CRITICAL 챌린지가 된다."""
    task = db.get(Task, 21)  # 시드: 105일 지연, 계획 기준 비임계
    user = _owner_of(db, 21)
    assert user is not None

    generate_user_challenges(db, user, today=date.today())
    ch = (
        db.query(Challenge)
        .filter_by(user_id=user.id, task_id=21, status="open")
        .first()
    )
    assert ch is not None
    assert ch.priority == "CRITICAL"
    assert ch.category == "critical_delay"
    assert "예측 임계경로" in ch.message


def test_stale_challenge_expires(db):
    """완료된 태스크의 열린 챌린지는 다음 생성 주기에 만료된다."""
    user = _owner_of(db, 21)
    generate_user_challenges(db, user, today=date.today())
    before = db.query(Challenge).filter_by(user_id=user.id, task_id=21, status="open").count()
    assert before >= 1

    task = db.get(Task, 21)
    task.status = "completed"
    task.actual_end = date.today()
    task.effective_progress = 100.0
    db.flush()

    generate_user_challenges(db, user, today=date.today())
    left = db.query(Challenge).filter_by(user_id=user.id, task_id=21, status="open").count()
    expired = db.query(Challenge).filter_by(user_id=user.id, task_id=21, status="expired").count()
    assert left == 0
    assert expired >= 1


def test_daily_report_has_new_sections_and_auto_generates(db):
    user = db.query(User).filter_by(username="pm_a").one()
    report = generate_daily_report(db, user)
    for section in ("### 어제 대비", "### 오늘 마감", "### 예측 임계경로"):
        assert section in report.content

    # 스케줄러가 부르는 일괄 생성도 동작하고, 같은 날짜는 덮어쓴다.
    n = generate_all_daily_reports(db)
    assert n >= 1
    rows = db.query(DailyReport).filter_by(user_id=user.id, report_date=date.today()).count()
    assert rows == 1


# ---------- AI: mock 가드·숫자 검증 ----------
def test_numbers_preserved_rejects_invented():
    from app.services.ai_service import _numbers_preserved

    facts = "예상 완료 2027-04-16 / 지연 58일 / 진척 36%"
    assert _numbers_preserved(facts, "예상 완료 2027-04-16, 계획보다 58일 지연")
    assert not _numbers_preserved(facts, "예상 완료 2027-05-30, 계획보다 99일 지연")


def test_risk_analysis_mock_never_stores_mock_text(db):
    """mock 프로바이더에서는 [Mock...] 텍스트를 저장하지 않고 결정적 JSON을 만든다."""
    from app.models.entities import AIAnalysis
    from app.services.ai_service import analyze_project_risk

    project = db.get(Project, 1)
    analysis = analyze_project_risk(db, project)
    assert analysis.content.startswith("{")
    assert "[Mock" not in analysis.content
    data = __import__("json").loads(analysis.content)
    assert data["basis"] == "deterministic"
    assert data["headline"] and data["situation"]
    assert data["risks"] or data["recommendations"]
    # 근거에 실제 수치가 들어있다
    assert "2027-02-17" in analysis.content or "2027-04" in analysis.content


def test_risk_analysis_falls_back_when_ai_invents_numbers(db, monkeypatch):
    """AI가 근거에 없는 숫자를 만들면 결정적 브리핑으로 폴백한다."""
    import app.services.ai_service as svc

    class _BadProvider:
        name = "fake"

        def generate(self, prompt, system=None, max_tokens=1500):
            return '{"headline":"예상 완료 2099-12-31, 999일 지연","situation":"없는 숫자"}'

    monkeypatch.setattr(svc, "get_ai_provider", lambda: _BadProvider())
    analysis = svc.analyze_project_risk(db, db.get(Project, 1))
    data = __import__("json").loads(analysis.content)
    assert data["basis"] == "deterministic"
    assert "2099-12-31" not in analysis.content


def test_personalize_exposes_ai_brief(db):
    """검증된 AI 브리핑이 있으면 요약 payload에 ai_brief/ai_watch로 노출된다."""
    import json as _json
    from app.services.ai_service import personalize_risk_summary
    from app.services.schedule_service import compute_project_schedule

    project = db.get(Project, 1)
    result = compute_project_schedule(db, project)
    user = db.query(User).filter_by(username="pm_a").one()
    content = _json.dumps(
        {
            "basis": "ai",
            "headline": "테스트 헤드라인 2027-04-16",
            "situation": "상황",
            "watch_next": "다음 주 확인",
        },
        ensure_ascii=False,
    )
    payload = _json.loads(
        personalize_risk_summary(
            content,
            user=user,
            result=result,
            my_task_ids=set(),
            role_name="Project Manager",
            delayed=[t for t in result.tasks if t.delay_days > 0],
            critical=[t for t in result.tasks if t.forecast_is_critical],
            issues=[],
            user_load=[],
        )
    )
    assert payload["ai_brief"].startswith("테스트 헤드라인")
    assert payload["ai_watch"] == "다음 주 확인"
