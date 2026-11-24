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
