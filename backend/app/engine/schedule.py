"""Deterministic Schedule Engine - 최상위 오케스트레이터.

Task/의존성/작업량/캘린더/실제 진척/Issue를 입력받아
현재 일정, 예측 일정, Critical Path, Float, 예상 종료일, Gap을 계산한다.

주의: AI가 이 엔진을 대체하지 않는다. 모든 일정 계산은 여기서 결정적으로 수행된다.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta

from app.engine.calendar import UserCalendarSpec, WorkingCalendar
from app.engine.cpm import Edge, TaskNode, build_network


@dataclass
class EngineTaskInput:
    id: int
    title: str = ""
    plan_start: date | None = None
    plan_end: date | None = None
    workload: float = 0.0
    effective_progress: float = 0.0
    status: str = "not_started"
    assignments: list[tuple[int, float]] = field(default_factory=list)  # (user_id, hours)
    parent_id: int | None = None


@dataclass
class TaskResult:
    task_id: int
    title: str
    schedule_progress: float
    work_progress: float
    effective_progress: float
    early_start: date | None = None
    early_finish: date | None = None
    late_start: date | None = None
    late_finish: date | None = None
    total_float: float = 0.0
    free_float: float = 0.0
    is_critical: bool = False
    forecast_finish: date | None = None
    delay_days: int = 0
    status: str = "not_started"


@dataclass
class ScheduleResult:
    project_planned_finish: date
    project_forecast_finish: date
    expected_delay_days: int
    plan_progress: float
    actual_progress: float
    progress_gap: float
    tasks: list[TaskResult] = field(default_factory=list)
    critical_path_ids: list[int] = field(default_factory=list)
    plan_curve: list[tuple[date, float]] = field(default_factory=list)  # (date, 계획 진척률%)
    forecast_curve: list[tuple[date, float]] = field(default_factory=list)  # 오늘 이후 예측 진척률%


def _schedule_progress(t: EngineTaskInput, cal: WorkingCalendar, today: date, count_done: bool = True) -> float:
    """태스크의 계획 진척률(%) — 계획 구간 안에서 작업일 경과 비율.
    count_done=True(기본)면 완료 상태 태스크는 즉시 100으로 계상하고,
    False(순수 일정 페이싱)면 실제 상태와 무관하게 계획 구간만으로 계산한다."""
    if count_done and t.status == "completed":
        return 100.0
    if not t.plan_start or not t.plan_end:
        return 0.0
    if today < t.plan_start:
        return 0.0
    if today >= t.plan_end:
        return 100.0
    total = cal.count_workdays(t.plan_start, t.plan_end)
    elapsed = cal.count_workdays(t.plan_start, today)
    if total <= 0:
        return 100.0
    return round(min(100.0, max(0.0, elapsed / total * 100)), 1)


def _plan_curve_at(tasks: list[EngineTaskInput], cal: WorkingCalendar, child_ids: set[int], d: date) -> float:
    """특정 날짜 d에서의 계획 진척률(%) — plan_progress와 완전히 동일한 정의.
    잎(leaf)만 집계, 순수 일정 페이싱(_schedule_progress[count_done=False])을 전개한다."""
    acc = 0.0
    wsum = 0.0
    for t in tasks:
        if t.id in child_ids:
            continue
        w = max(t.workload, 1.0)
        acc += _schedule_progress(t, cal, d, count_done=False) * w
        wsum += w
    return round(acc / wsum, 1) if wsum else 0.0


def _build_plan_curve(
    tasks: list[EngineTaskInput],
    cal: WorkingCalendar,
    child_ids: set[int],
    today: date,
    planned_finish: date | None = None,
) -> list[tuple[date, float]]:
    """계획 S-Curve 전개: 최초 계획 시작일 하루 전 ~ max(최종 계획 종료일, 계획 완료일, 오늘)까지 일별 값.
    모든 태스크 계획이 시작되기 전이므로 첫 지점은 정확히 0%이고,
    마지막 계획 종료일에 100%에 수렴하며, 오늘 시점 값은 plan_progress와 정확히 일치한다."""
    leaves = [t for t in tasks if t.id not in child_ids]
    starts = [t.plan_start for t in leaves if t.plan_start]
    ends = [t.plan_end for t in leaves if t.plan_end]
    if not starts or not ends:
        return []
    lo = min(starts) - timedelta(days=1)
    hi = max(max(ends), planned_finish or today, today)
    out: list[tuple[date, float]] = []
    d = lo
    guard = 0
    while d <= hi and guard < 4000:
        out.append((d, _plan_curve_at(tasks, cal, child_ids, d)))
        d += timedelta(days=1)
        guard += 1
    return out


def _build_forecast_curve(
    plan_curve: list[tuple[date, float]],
    today: date,
    delay_days: int,
    forecast_finish: date | None,
) -> list[tuple[date, float]]:
    """예측선 = 계획 곡선을 지연일만큼 오른쪽으로 평행이동한 곡선.
    지연이 없으면 계획 곡선과 동일하고, 예측 완료일까지는 100%를 유지한다."""
    if not plan_curve:
        return []
    if delay_days <= 0 or not forecast_finish:
        return list(plan_curve)
    out: list[tuple[date, float]] = []
    for d, pct in plan_curve:
        fd = d + timedelta(days=delay_days)
        if fd < today:
            continue
        out.append((fd, pct))
    if out and out[-1][0] < forecast_finish:
        out.append((forecast_finish, 100.0))
    return out


def _forecast_finish_for_task(
    t: EngineTaskInput,
    cal: WorkingCalendar,
    today: date,
    progress: float,
) -> date | None:
    if not t.plan_start or not t.plan_end:
        return None
    if t.status == "completed":
        return t.plan_end
    remaining = t.workload * (1 - progress / 100.0)
    if remaining <= 0:
        return t.plan_end
    user_specs: dict[int, UserCalendarSpec] = {}
    # 개인별 가용시간 반영을 위해 user 단위 캘린더 결합이 필요하지만,
    # 엔진 입력 수준에서는 작업량을 담당자 수로 나눠 평균 가용시간을 적용한다.
    start = max(t.plan_start, today)
    return cal.forecast_end(start, remaining)


def run_schedule_engine(
    tasks: list[EngineTaskInput],
    dependencies: list[tuple[int, int, str, int]],  # (pred, succ, type, lag)
    project_cal: WorkingCalendar,
    user_cals: dict[int, UserCalendarSpec] | None = None,
    today: date | None = None,
) -> ScheduleResult:
    today = today or date.today()
    user_cals = user_cals or {}

    # 1) schedule_progress 계산
    progress_map: dict[int, float] = {}
    child_ids = {t.parent_id for t in tasks if t.parent_id}
    for t in tasks:
        sp = _schedule_progress(t, project_cal, today)
        progress_map[t.id] = sp
        # work_progress: 완료 상태면 100, 아니면 진척률 보정 반영(작업량 기준은 시간 데이터 필요 시 확장)
        # 단, 부모(집계) 태스크는 자식 진척을 대표하므로 100% 강제하지 않는다.
        if t.status == "completed" and t.id not in child_ids:
            t.effective_progress = 100.0

    # 2) Current Schedule CPM (계획 기준)
    nodes: dict[int, TaskNode] = {}
    for t in tasks:
        if not t.plan_start or not t.plan_end:
            continue
        duration = max(1, project_cal.count_workdays(t.plan_start, t.plan_end))
        nodes[t.id] = TaskNode(id=t.id, title=t.title, duration=duration, plan_start=t.plan_start)

    edges = [Edge(p, s, lag, d) for (p, s, d, lag) in dependencies if p in nodes and s in nodes]
    network = build_network(list(nodes.values()), edges, project_cal)
    planned_finish = network.compute()

    # 3) Forecast CPM (진척 기반 종료일 반영)
    forecast_nodes: dict[int, TaskNode] = {}
    forecast_finish_map: dict[int, date] = {}
    for t in tasks:
        if t.id not in nodes:
            continue
        progress = progress_map.get(t.id, 0.0)
        ff = _forecast_finish_for_task(t, project_cal, today, progress)
        if ff and ff > t.plan_end:
            duration = max(1, project_cal.count_workdays(t.plan_start, ff))
            forecast_nodes[t.id] = TaskNode(id=t.id, title=t.title, duration=duration, plan_start=t.plan_start)
            forecast_finish_map[t.id] = ff
        else:
            forecast_nodes[t.id] = TaskNode(id=t.id, title=t.title, duration=nodes[t.id].duration, plan_start=t.plan_start)

    f_network = build_network(list(forecast_nodes.values()), edges, project_cal)
    forecast_finish = f_network.compute()

    # 4) 결과 조립
    results: list[TaskResult] = []
    weight_sum = 0.0
    plan_progress_acc = 0.0
    actual_progress_acc = 0.0
    # 프로젝트 진척률은 잎(leaf) Task만 집계한다.
    # 부모는 자식 작업량을 합산한 집계치이므로 포함하면 이중 계상된다.
    for t in tasks:
        node = nodes.get(t.id)
        fnode = forecast_nodes.get(t.id)
        sp = progress_map.get(t.id, 0.0)
        effective = t.effective_progress
        if t.status == "completed" and t.id not in child_ids:
            effective = 100.0
        delay_days = 0
        if node and fnode and fnode.earliest_finish and node.earliest_finish:
            delay_days = max(0, project_cal.count_workdays(node.earliest_finish, fnode.earliest_finish) - 1)
        total_float = node.total_float if node else 0.0
        is_critical = bool(node and node.is_critical)
        results.append(
            TaskResult(
                task_id=t.id,
                title=t.title,
                schedule_progress=sp,
                work_progress=effective,
                effective_progress=effective,
                early_start=node.earliest_start if node else t.plan_start,
                early_finish=node.earliest_finish if node else t.plan_end,
                late_start=node.latest_start if node else None,
                late_finish=node.latest_finish if node else None,
                total_float=round(total_float, 1),
                free_float=round(node.free_float, 1) if node else 0.0,
                is_critical=is_critical,
                forecast_finish=fnode.earliest_finish if fnode else t.plan_end,
                delay_days=delay_days,
                status=t.status,
            )
        )
        w = max(t.workload, 1.0)
        if t.id in child_ids:
            continue
        weight_sum += w
        # 계획 진척률은 순수 일정 페이싱(실제 상태 미반영)으로 집계 — 곡선 및 카드와 동일 정의
        plan_sp = _schedule_progress(t, project_cal, today, count_done=False)
        plan_progress_acc += plan_sp * w
        actual_progress_acc += effective * w

    plan_progress = round(plan_progress_acc / weight_sum, 1) if weight_sum else 0.0
    actual_progress = round(actual_progress_acc / weight_sum, 1) if weight_sum else 0.0

    # 달력 일수(계획 완료일 → 예측 완료일). 차트 축·날짜 라벨과 같은 단위.
    expected_delay = 0
    if planned_finish and forecast_finish:
        expected_delay = max(0, (forecast_finish - planned_finish).days)

    plan_curve = _build_plan_curve(tasks, project_cal, child_ids, today, planned_finish)
    forecast_curve = _build_forecast_curve(plan_curve, today, expected_delay, forecast_finish)

    return ScheduleResult(
        project_planned_finish=planned_finish,
        project_forecast_finish=forecast_finish,
        expected_delay_days=expected_delay,
        plan_progress=plan_progress,
        actual_progress=actual_progress,
        progress_gap=round(plan_progress - actual_progress, 1),
        tasks=results,
        critical_path_ids=[
            tr.task_id
            for tr in sorted(
                (t for t in results if t.is_critical),
                key=lambda t: (t.early_start or date.max, t.early_finish or date.max, t.task_id),
            )
        ],
        plan_curve=plan_curve,
        forecast_curve=forecast_curve,
    )