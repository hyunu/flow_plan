"""일정 엔진(결정적) 유닛 테스트.

- WorkingCalendar(Project + User) 작업일/가용시간 계산
- CPM: forward/backward pass, Float, Critical Path
- Dependency(Lag) 전파
- 사이클 감지
"""
from __future__ import annotations

from datetime import date

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
def _task(id, start, end, workload, progress, status="in_progress", assignee=(1, 0)):
    return EngineTaskInput(id=id, plan_start=start, plan_end=end, workload=workload,
                           effective_progress=progress, status=status, assignments=[assignee])


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
    assert r1.forecast_curve[0][1] == 0.0  # 계획 곡선 시작점(0%)을 지연일만큼 평행이동
    assert r1.forecast_curve[-1][1] == 100.0
    assert r1.forecast_curve[-1][0] == r1.project_forecast_finish


def test_schedule_engine_no_dependencies_independent():
    cal = _cal()
    tasks = [
        _task(1, date(2026, 9, 1), date(2026, 9, 3), 24, 100, status="completed"),
        _task(2, date(2026, 9, 1), date(2026, 9, 3), 24, 0),
    ]
    r = run_schedule_engine(tasks, [], cal, today=date(2026, 9, 2))
    # 완료 Task는 지연 0, 미착수 Task는 계획 유지
    assert {t.delay_days for t in r.tasks} == {0}