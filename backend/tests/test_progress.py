"""진척률 보정(수동) 적용 유닛 테스트.

- progress_is_manual=False(자동): effective = schedule + user_adjustment 가 항상 재계산된다.
- progress_is_manual=True(사용자 수동 지정): effective를 자동 계산으로 덮어쓰지 않는다.
"""
from __future__ import annotations

from datetime import date

from app.core.database import Base, engine, SessionLocal
from app.models.entities import Project, Task
from app.services.schedule_service import apply_engine_progress


def _seed_task() -> tuple[SessionLocal, Project, Task]:
    Base.metadata.create_all(engine)
    db = SessionLocal()
    p = Project(name="진척 테스트", description="")
    db.add(p)
    db.commit()
    task = Task(
        project_id=p.id,
        title="작업 A",
        plan_start=date(2026, 9, 1),
        plan_end=date(2026, 9, 10),
        workload=80,
        status="in_progress",
        created_by=0,
    )
    db.add(task)
    db.commit()
    try:
        apply_engine_progress(db, p, today=date(2026, 9, 3))
    finally:
        db.commit()
    db.refresh(task)
    return db, p, task


def _destroy(db, p, task):
    db.delete(task)
    db.delete(p)
    db.commit()
    db.close()


def test_auto_progress_follows_schedule():
    db, p, task = _seed_task()
    try:
        assert task.progress_is_manual is False
        assert task.effective_progress == task.schedule_progress
    finally:
        _destroy(db, p, task)


def test_manual_effective_is_preserved():
    db, p, task = _seed_task()
    try:
        task.effective_progress = 60.0
        task.progress_is_manual = True
        db.commit()
        apply_engine_progress(db, p, today=date(2026, 9, 3))
        db.refresh(task)
        assert task.effective_progress == 60.0  # 자동값으로 덮어쓰지 않는다
    finally:
        _destroy(db, p, task)


def test_adjustment_adds_to_schedule_when_auto():
    db, p, task = _seed_task()
    try:
        task.user_adjustment = 20.0
        db.commit()
        apply_engine_progress(db, p, today=date(2026, 9, 3))
        db.refresh(task)
        assert abs(task.effective_progress - (task.schedule_progress + 20.0)) < 0.01
    finally:
        _destroy(db, p, task)