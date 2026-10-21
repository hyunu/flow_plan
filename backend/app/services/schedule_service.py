"""Schedule Service: DB 모델 ↔ Deterministic Engine 연결."""
from __future__ import annotations

import json
from datetime import date, timedelta

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
    Forecast,
    Milestone,
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
        if not parent.progress_is_manual:
            parent.effective_progress = round(min(100.0, max(0.0, agg_progress)), 1)
        plan_starts = [c.plan_start for c in children if c.plan_start]
        plan_ends = [c.plan_end for c in children if c.plan_end]
        if plan_starts:
            parent.plan_start = min(plan_starts)
        if plan_ends:
            parent.plan_end = max(plan_ends)
        # 부모 workload는 시드의 원래 값을 유지한다. 자식 합(병렬 모듈을 순차로 취급)으로 덮어쓰면
        # 예측 일정(forecast)이 비현실적으로 늘어난다.


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


def display_finishes(db: Session, project: Project, result: ScheduleResult) -> tuple[date | None, date | None]:
    """표시용 (계획 완료일, 예측 완료일)을 돌려준다.

    완료일은 "마지막 마일스톤(end_date 있음) + 예상 지연일" 기준으로 통일하고,
    마일스톤이 없으면 엔진 값을 그대로 쓴다. 대시보드와 일정 변경 영향(impact) 배너가
    같은 날짜를 보이도록 하는 단일 출처."""
    milestones = db.query(Milestone).filter_by(project_id=project.id).order_by(Milestone.sort_order).all()
    open_ms = next((m for m in reversed(milestones) if m.end_date), None)
    if open_ms:
        return open_ms.end_date, open_ms.end_date + timedelta(days=result.expected_delay_days)
    return result.project_planned_finish, result.project_forecast_finish


#: 프로젝트당 유지하는 예측 스냅샷 개수 (대시보드 "이전 예측" 오버레이가 참조하는 최신 1건 포함)
FORECAST_SNAPSHOT_KEEP = 10


def snapshot_forecast(
    db: Session,
    project: Project,
    result: ScheduleResult,
    basis: str = "일정 변경 전 스냅샷",
) -> Forecast:
    """현재 엔진 결과를 예측 스냅샷(Forecast)으로 남긴다.

    `data_used` JSON에 forecast_curve를 함께 저장해 대시보드가
    "이전 예측 vs 지금 예측" 오버레이를 그릴 수 있게 한다. 프로젝트당 최신 N건만 유지한다."""
    curve = [{"date": d.isoformat(), "pct": pct} for d, pct in result.forecast_curve]
    row = Forecast(
        project_id=project.id,
        forecast_finish=result.project_forecast_finish,
        expected_delay_days=result.expected_delay_days,
        basis=basis,
        data_used=json.dumps(
            {
                "planned_finish": str(result.project_planned_finish),
                "forecast_finish": str(result.project_forecast_finish),
                "forecast_curve": curve,
            },
            ensure_ascii=False,
        ),
    )
    db.add(row)
    db.commit()
    # 유지 개수 초과분 정리 (delete()에 offset()을 못 걸므로 대상 id를 먼저 조회)
    stale_ids = [
        r[0]
        for r in db.query(Forecast.id)
        .filter_by(project_id=project.id)
        .order_by(Forecast.created_at.desc(), Forecast.id.desc())
        .offset(FORECAST_SNAPSHOT_KEEP)
        .all()
    ]
    if stale_ids:
        db.query(Forecast).filter(Forecast.id.in_(stale_ids)).delete(synchronize_session=False)
        db.commit()
    return row


def build_change_impact(
    before: ScheduleResult,
    after: ScheduleResult,
    before_finishes: tuple[date | None, date | None],
    after_finishes: tuple[date | None, date | None],
    changed_task_id: int,
    task_before: dict,
    task_after: dict,
) -> dict:
    """변경 전/후 엔진 결과를 비교해 영향 딕셔너리를 만든다(CP-03 계약).

    - affected: 예측 완료(forecast_finish) 또는 지연일(delay_days)이 달라진 태스크
    - newly_delayed: 그중 지연이 새로 발생(0 → 양수)한 태스크
    """
    b_by = {t.task_id: t for t in before.tasks}
    affected: list[int] = []
    newly_delayed: list[int] = []
    for a in sorted(after.tasks, key=lambda t: t.task_id):
        b = b_by.get(a.task_id)
        if b is None:
            continue
        if a.forecast_finish != b.forecast_finish or a.delay_days != b.delay_days:
            affected.append(a.task_id)
            if b.delay_days <= 0 < a.delay_days:
                newly_delayed.append(a.task_id)

    planned_before, forecast_before = before_finishes
    planned_after, forecast_after = after_finishes
    delta = (
        (forecast_after - forecast_before).days
        if forecast_before is not None and forecast_after is not None
        else 0
    )
    return {
        "changed_task_id": changed_task_id,
        "task_before": task_before,
        "task_after": task_after,
        "planned_before": planned_before,
        "planned_after": planned_after,
        "forecast_before": forecast_before,
        "forecast_after": forecast_after,
        "forecast_delta_days": delta,
        "delay_days_before": before.expected_delay_days,
        "delay_days_after": after.expected_delay_days,
        "affected_task_ids": affected,
        "newly_delayed_task_ids": newly_delayed,
    }


def upsert_progress_snapshot(db: Session, project: Project, result: ScheduleResult, today: date | None = None) -> None:
    """오늘 날짜의 계획/실적 진척을 한 줄로 남긴다. 같은 날은 덮어쓴다."""
    from app.models.entities import ProgressSnapshot

    day = today or date.today()
    row = db.query(ProgressSnapshot).filter_by(project_id=project.id, snapshot_date=day).first()
    if row:
        row.actual_progress = result.actual_progress
        row.plan_progress = result.plan_progress
    else:
        db.add(ProgressSnapshot(
            project_id=project.id,
            snapshot_date=day,
            actual_progress=result.actual_progress,
            plan_progress=result.plan_progress,
        ))


def apply_engine_progress(db: Session, project: Project, today: date | None = None) -> ScheduleResult:
    """엔진 계산 결과를 Task의 자동 진척률(schedule_progress)에 반영하고 커밋한다."""
    result = compute_project_schedule(db, project, today)
    by_id = {t.id: t for t in db.query(Task).filter_by(project_id=project.id, is_deleted=False).all()}
    for tr in result.tasks:
        task = by_id.get(tr.task_id)
        if task:
            task.schedule_progress = tr.schedule_progress
            # 엔진의 작업량 기준 진척(완료=100)을 저장. 그 안에 사용자 보정이 포함되어 있어도
            # 별도 저장되는 user_adjustment와 충돌하지 않는다.
            task.work_progress = tr.work_progress
            # 수동 보정(progress_is_manual)이 아니면 effective = 자동 진척률 + 사용자 보정
            if not task.progress_is_manual:
                task.effective_progress = min(100.0, max(0.0, tr.schedule_progress + task.user_adjustment))
    db.commit()
    upsert_progress_snapshot(db, project, result, today)
    db.commit()
    return result