"""Schedule Service: DB 모델 ↔ Deterministic Engine 연결."""
from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from app.engine.calendar import (
    ProjectCalendarSpec,
    UserCalendarSpec,
    WorkingCalendar,
    work_days_from_str,
)
from app.engine.schedule import (
    EngineTaskInput,
    ScheduleResult,
    run_schedule_engine,
)
from app.models.entities import (
    Project,
    ProjectCalendar,
    ProjectCalendarEntry,
    Task,
    TaskDependency,
    User,
    UserCalendar,
    UserCalendarEntry,
)


def _project_calendar_spec(project: Project) -> ProjectCalendarSpec:
    cal: ProjectCalendar | None = project.calendar
    exceptions: dict[date, float] = {}
    if cal:
        for entry in cal.entries:
            if not entry.is_workday:
                exceptions[entry.date] = 0.0
            elif entry.hours is not None:
                exceptions[entry.date] = entry.hours
        work_days = work_days_from_str(cal.work_days)
        daily = cal.daily_work_hours
    else:
        work_days = {0, 1, 2, 3, 4}
        daily = 8.0
    return ProjectCalendarSpec(work_days=work_days, daily_work_hours=daily, exceptions=exceptions)


def _user_calendar_spec(db: Session, user_id: int) -> UserCalendarSpec | None:
    cal = db.query(UserCalendar).filter_by(user_id=user_id).first()
    if not cal:
        return None
    exceptions: dict[date, float] = {}
    for entry in cal.entries:
        if not entry.is_available:
            exceptions[entry.date] = 0.0
        elif entry.available_hours is not None:
            exceptions[entry.date] = entry.available_hours
    return UserCalendarSpec(daily_work_hours=cal.daily_work_hours, exceptions=exceptions)


def _aggregate_parents(tasks: list[Task]) -> None:
    """Child Task를 기반으로 Parent Task의 진척률/일정/작업량을 계산한다.
    사용자가 parent를 직접 보정(effective_progress 수동 설정)한 경우는 유지한다."""
    by_parent: dict[int, list[Task]] = {}
    for t in tasks:
        if t.parent_id:
            by_parent.setdefault(t.parent_id, []).append(t)

    for parent in tasks:
        children = by_parent.get(parent.id)
        if not children:
            continue
        # 작업량 가중 평균 진척률
        total_w = sum(max(c.workload, 1.0) for c in children)
        agg_progress = sum(c.effective_progress * max(c.workload, 1.0) for c in children) / total_w if total_w else 0
        if parent.user_adjustment == 0:
            parent.effective_progress = round(min(100.0, max(0.0, agg_progress)), 1)
        plan_starts = [c.plan_start for c in children if c.plan_start]
        plan_ends = [c.plan_end for c in children if c.plan_end]
        if plan_starts:
            parent.plan_start = min(plan_starts)
        if plan_ends:
            parent.plan_end = max(plan_ends)
        parent.workload = sum(c.workload for c in children)


def compute_project_schedule(db: Session, project: Project, today: date | None = None) -> ScheduleResult:
    tasks = db.query(Task).filter_by(project_id=project.id, is_deleted=False).all()
    deps = db.query(TaskDependency).join(Task, TaskDependency.successor_id == Task.id).filter(
        Task.project_id == project.id
    ).all()

    _aggregate_parents(tasks)

    project_cal = WorkingCalendar(_project_calendar_spec(project))

    # 사용자 캘린더 결합: 엔진은 작업량 기반 forecast 시 프로젝트 캘린더를 주로 사용.
    user_cals: dict[int, UserCalendarSpec] = {}
    assigned_ids = {a.user_id for t in tasks for a in t.assignments}
    for uid in assigned_ids:
        spec = _user_calendar_spec(db, uid)
        if spec:
            user_cals[uid] = spec

    inputs = [
        EngineTaskInput(
            id=t.id,
            title=t.title,
            plan_start=t.plan_start,
            plan_end=t.plan_end,
            workload=t.workload,
            effective_progress=t.effective_progress,
            status=t.status,
            assignments=[(a.user_id, a.workload_hours) for a in t.assignments],
            parent_id=t.parent_id,
        )
        for t in tasks
    ]

    dep_tuples = [(d.predecessor_id, d.successor_id, d.dependency_type, d.lag_days) for d in deps]

    return run_schedule_engine(inputs, dep_tuples, project_cal, user_cals, today=today)


def apply_engine_progress(db: Session, project: Project, today: date | None = None) -> ScheduleResult:
    """엔진 계산 결과를 Task의 자동 진척률(schedule_progress)에 반영하고 커밋한다."""
    result = compute_project_schedule(db, project, today)
    by_id = {t.id: t for t in db.query(Task).filter_by(project_id=project.id, is_deleted=False).all()}
    for tr in result.tasks:
        task = by_id.get(tr.task_id)
        if task:
            task.schedule_progress = tr.schedule_progress
            # 유저 보정이 없으면 effective = 자동 진척률
            if task.user_adjustment == 0:
                task.effective_progress = min(100.0, max(0.0, tr.schedule_progress + task.user_adjustment))
    db.commit()
    return result