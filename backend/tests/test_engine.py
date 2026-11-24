"""일정 엔진(결정적) 유닛 테스트.

- WorkingCalendar(Project + User) 작업일/가용시간 계산
- CPM: forward/backward pass, Float, Critical Path
- Dependency(Lag) 전파
- 사이클 감지
"""
from __future__ import annotations

from datetime import date, timedelta

from app.engine.calendar import ProjectCalendarSpec, UserCalendarSpec, WorkingCalendar
from app.engine.cpm import Edge, TaskNode, build_network
from app.engine.schedule import EngineTaskInput, run_schedule_engine


def _cal(work_days=None, exceptions=None, daily=8.0):
    return WorkingCalendar(
        ProjectCalendarSpec(work_days=set(work_days or {0, 1, 2, 3, 4}), daily_work_hours=daily, exceptions=exceptions or {})
    )


# ---------- Calendar ----------
def test_weekend_and_holiday():
    cal = _cal(exceptions={date(2026, 9, 3): 0.0})  # 목요일 공휴일
    # 2026-09-01은 화요일, 09-05/06 주말
    assert cal.is_workday(date(2026, 9, 1)) is True
    assert cal.is_workday(date(2026, 9, 3)) is False  # 공휴일
    assert cal.is_workday(date(2026, 9, 5)) is False  # 토요일
    assert cal.count_workdays(date(2026, 9, 1), date(2026, 9, 6)) == 3  # 1,2,4


def test_add_workdays_skips_holiday():
    cal = _cal(exceptions={date(2026, 9, 3): 0.0})
    # 9/1(화)에서 1 작업일 뒤 = 9/2(수), 2일 뒤는 공휴일 9/3 스킵 -> 9/4(금)
    assert cal.add_workdays(date(2026, 9, 1), 1) == date(2026, 9, 2)
    assert cal.add_workdays(date(2026, 9, 1), 2) == date(2026, 9, 4)


def test_user_calendar_reduces_availability():
    project = ProjectCalendarSpec(work_days={0, 1, 2, 3, 4}, daily_work_hours=8.0)
    user = UserCalendarSpec(daily_work_hours=8.0, exceptions={date(2026, 9, 2): 0.0})  # 수요일 휴가
    cal = WorkingCalendar(project, user)
    assert cal.available_hours(date(2026, 9, 1)) == 8.0
    assert cal.available_hours(date(2026, 9, 2)) == 0.0  # 휴가
    assert cal.available_hours_between(date(2026, 9, 1), date(2026, 9, 4)) == 24.0  # 1,3,4


# ---------- CPM ----------
def test_critical_path_single_chain():
    cal = _cal()
    a = TaskNode(id=1, duration=2, plan_start=date(2026, 9, 1))
    b = TaskNode(id=2, duration=3, plan_start=date(2026, 9, 1))
    net = build_network([a, b], [Edge(1, 2, 0, "FS")], cal)
    ef = net.compute()
    assert ef == date(2026, 9, 7)  # a: 9/1,9/2 | b: 9/3,9/4,9/7(월)
    assert a.total_float == 0 and a.is_critical
    assert b.total_float == 0 and b.is_critical


def test_parallel_tasks_float():
    cal = _cal()
    a = TaskNode(id=1, duration=2, plan_start=date(2026, 9, 1))
    b = TaskNode(id=2, duration=1, plan_start=date(2026, 9, 1))
    c = TaskNode(id=3, duration=2, plan_start=date(2026, 9, 1))
    # a -> c, b -> c
    net = build_network([a, b, c], [Edge(1, 3, 0, "FS"), Edge(2, 3, 0, "FS")], cal)
    net.compute()
    assert a.total_float == 0 and a.is_critical
    # b는 2일짜리 선행(a)에 맞춰 여유 -> float = 1
    assert b.total_float == 1 and not b.is_critical


def test_dependency_lag():
    cal = _cal()
    a = TaskNode(id=1, duration=1, plan_start=date(2026, 9, 1))
    b = TaskNode(id=2, duration=1, plan_start=date(2026, 9, 1))
    # FS + lag 2
    net = build_network([a, b], [Edge(1, 2, lag=2, dep_type="FS")], cal)
    net.compute()
    assert a.earliest_finish == date(2026, 9, 1)
    assert b.earliest_start == date(2026, 9, 4)  # a 종료 후 lag 2 작업일


def test_cycle_detection():
    cal = _cal()
    a = TaskNode(id=1, duration=1, plan_start=date(2026, 9, 1))
    b = TaskNode(id=2, duration=1, plan_start=date(2026, 9, 1))
    net = build_network([a, b], [Edge(1, 2, 0, "FS"), Edge(2, 1, 0, "FS")], cal)
    try:
        net.compute()
        raise AssertionError("사이클이 감지되어야 함")
    except ValueError:
        pass


# ---------- Schedule Engine ----------
def _task(id, start, end, workload, progress, status="in_progress", assignee=(1, 0), actual_end=None):
    return EngineTaskInput(id=id, plan_start=start, plan_end=end, workload=workload,
                           effective_progress=progress, status=status, assignments=[assignee],
                           actual_end=actual_end)


def test_schedule_engine_deterministic():
    cal = _cal()
    tasks = [
        _task(1, date(2026, 9, 1), date(2026, 9, 3), 24, 50),
        _task(2, date(2026, 9, 1), date(2026, 9, 5), 40, 50),
    ]
    deps = [(1, 2, "FS", 0)]
    r1 = run_schedule_engine(tasks, deps, cal, today=date(2026, 9, 2))
    r2 = run_schedule_engine(tasks, deps, cal, today=date(2026, 9, 2))
    assert r1.project_forecast_finish == r2.project_forecast_finish  # 재현 가능
    assert r1.expected_delay_days == r2.expected_delay_days
    # task1(50%, 12h 남음)은 9/3 계획 종료, 실제론 9/4까지
    t1 = next(t for t in r1.tasks if t.task_id == 1)
    assert t1.delay_days >= 0
    assert r1.forecast_curve
    # 예측 곡선은 계획곡선 평행이동이 아니라 '오늘 실적'에서 시작해 예측 완료일 100%로 수렴
    assert r1.forecast_curve[0][0] == date(2026, 9, 2)
    assert r1.forecast_curve[0][1] == r1.actual_progress
    assert r1.forecast_curve[-1][1] == 100.0
    assert r1.forecast_curve[-1][0] == r1.project_forecast_finish


def test_schedule_engine_no_dependencies_independent():
    cal = _cal()
    tasks = [
        _task(1, date(2026, 9, 1), date(2026, 9, 3), 24, 100, status="completed"),
        _task(2, date(2026, 9, 1), date(2026, 9, 3), 24, 0),
    ]
    r = run_schedule_engine(tasks, [], cal, today=date(2026, 9, 2))
    t1 = next(t for t in r.tasks if t.task_id == 1)
    assert t1.delay_days == 0
    t2 = next(t for t in r.tasks if t.task_id == 2)
    assert t2.delay_days >= 0


def test_completed_task_keeps_dependency():
    """완료 태스크는 '실제 종료일 고정 노드'로 예측망에 남아 후속 의존성을 유지한다.
    (예전에는 예측망에서 제외되어 후속이 선행보다 먼저 시작할 수 있었다)"""
    cal = _cal()
    tasks = [
        _task(1, date(2026, 9, 1), date(2026, 9, 2), 48, 50, status="in_progress"),
        _task(2, date(2026, 9, 8), date(2026, 9, 10), 24, 100, status="completed"),
        _task(3, date(2026, 9, 15), date(2026, 9, 17), 24, 0, status="in_progress"),
    ]
    deps = [(1, 2, "FS", 0), (2, 3, "FS", 0)]
    r = run_schedule_engine(tasks, deps, cal, today=date(2026, 9, 2))
    t2 = next(t for t in r.tasks if t.task_id == 2)
    assert t2.forecast_finish == date(2026, 9, 10)  # 실제/계획 종료일에 고정
    assert t2.delay_days == 0
    t3 = next(t for t in r.tasks if t.task_id == 3)
    # 후속은 완료 태스크(09-10) 다음 작업일(09-11) 이후에만 시작할 수 있다
    assert t3.forecast_finish is not None and t3.forecast_finish >= date(2026, 9, 11)


def test_early_completion_pulls_successor_earlier():
    """조기 완료(actual_end < plan_end)가 후속/프로젝트 예측을 앞당긴다."""
    cal = _cal()
    tasks = [
        _task(1, date(2026, 9, 1), date(2026, 9, 10), 24, 100, status="completed"),
        _task(2, date(2026, 9, 11), date(2026, 9, 15), 24, 0),
    ]
    deps = [(1, 2, "FS", 0)]

    on_time = run_schedule_engine(tasks, deps, cal, today=date(2026, 9, 1))
    early_tasks = [
        _task(1, date(2026, 9, 1), date(2026, 9, 10), 24, 100, status="completed",
              actual_end=date(2026, 9, 3)),
        _task(2, date(2026, 9, 11), date(2026, 9, 15), 24, 0),
    ]
    early = run_schedule_engine(early_tasks, deps, cal, today=date(2026, 9, 1))

    t2_on = next(t for t in on_time.tasks if t.task_id == 2)
    t2_early = next(t for t in early.tasks if t.task_id == 2)
    assert t2_early.forecast_finish < t2_on.forecast_finish
    assert early.project_forecast_finish < on_time.project_forecast_finish


def test_user_leave_extends_forecast():
    """담당자 휴가(개인 캘린더)가 예측 종료일을 늦춘다."""
    cal = _cal()
    tasks = [_task(1, date(2026, 9, 1), date(2026, 9, 3), 24, 0, assignee=(1, 24))]
    no_leave = run_schedule_engine(tasks, [], cal, today=date(2026, 9, 1))
    leave = UserCalendarSpec(
        daily_work_hours=8.0,
        exceptions={date(2026, 9, 2) + timedelta(days=i): 0.0 for i in range(10)},
    )
    with_leave = run_schedule_engine(tasks, [], cal, {1: leave}, today=date(2026, 9, 1))
    t_no = next(t for t in no_leave.tasks if t.task_id == 1)
    t_leave = next(t for t in with_leave.tasks if t.task_id == 1)
    assert t_leave.forecast_finish > t_no.forecast_finish


def test_multiple_assignees_shorten_forecast():
    """담당자 2명이면 같은 작업량을 더 빨리 끝낸다(동시성 반영)."""
    cal = _cal()
    one = [_task(1, date(2026, 9, 1), date(2026, 9, 7), 48, 0, assignee=(1, 48))]
    two = [_task(1, date(2026, 9, 1), date(2026, 9, 7), 48, 0, assignee=(1, 24))]
    r1 = run_schedule_engine(one, [], cal, today=date(2026, 9, 1))
    # 같은 태스크에 담당자 두 명
    t = two[0]
    t.assignments = [(1, 24), (2, 24)]
    r2 = run_schedule_engine(two, [], cal, today=date(2026, 9, 1))
    f1 = next(x for x in r1.tasks if x.task_id == 1).forecast_finish
    f2 = next(x for x in r2.tasks if x.task_id == 1).forecast_finish
    assert f2 < f1


def test_forecast_critical_differs_from_plan():
    """계획에서는 여유가 있던 태스크도 지연되면 예측 임계경로에 들어온다."""
    cal = _cal()
    tasks = [
        _task(1, date(2026, 9, 1), date(2026, 9, 3), 24, 0),
        _task(2, date(2026, 9, 1), date(2026, 9, 2), 24, 0),
    ]
    # task2 작업량을 크게 늘려 지연시킨다(계획상으로는 여유 태스크)
    tasks[1] = _task(2, date(2026, 9, 1), date(2026, 9, 2), 240, 0)
    r = run_schedule_engine(tasks, [], cal, today=date(2026, 9, 1))
    t2 = next(t for t in r.tasks if t.task_id == 2)
    assert t2.is_critical is False          # 계획 기준으로는 임계 아님
    assert t2.forecast_is_critical is True   # 실제 지연 반영 시 임계
    assert 2 in r.forecast_critical_path_ids
    assert t2.delay_days > 0


def test_parent_aggregates_does_not_mutate_entities():
    """부모 집계는 계산만 하고 엔티티를 변이하지 않는다(조회 중 저장 방지)."""
    from types import SimpleNamespace
    from app.services.schedule_service import parent_aggregates

    parent = SimpleNamespace(
        id=10, parent_id=None, workload=100, effective_progress=10,
        progress_is_manual=False, plan_start=date(2026, 9, 1), plan_end=date(2026, 9, 30),
    )
    child_a = SimpleNamespace(
        id=11, parent_id=10, workload=24, effective_progress=100,
        progress_is_manual=False, plan_start=date(2026, 9, 2), plan_end=date(2026, 9, 5),
    )
    child_b = SimpleNamespace(
        id=12, parent_id=10, workload=24, effective_progress=0,
        progress_is_manual=False, plan_start=date(2026, 9, 8), plan_end=date(2026, 9, 12),
    )
    tasks = [parent, child_a, child_b]
    aggs = parent_aggregates(tasks)

    assert aggs[10][0] == 50.0                      # 작업량 가중 평균 진척률
    assert aggs[10][1] == date(2026, 9, 2)          # min(자식 시작)
    assert aggs[10][2] == date(2026, 9, 12)         # max(자식 종료)
    # 원본은 그대로
    assert parent.effective_progress == 10
    assert parent.plan_start == date(2026, 9, 1)
    assert parent.plan_end == date(2026, 9, 30)
