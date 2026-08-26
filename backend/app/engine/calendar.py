"""결정적(Deterministic) Working Calendar 계산 모듈.

UI/AI와 분리된 순수 계산 계층.
Project Calendar(공용)와 User Calendar(개인)를 모두 고려하여
실제 작업 가능일/가능시간을 계산한다.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta


@dataclass
class ProjectCalendarSpec:
    work_days: set[int] = field(default_factory=lambda: {0, 1, 2, 3, 4})  # 0=Mon
    daily_work_hours: float = 8.0
    exceptions: dict[date, float] = field(default_factory=dict)  # date -> available hours (0 = 휴일/특이일)


@dataclass
class UserCalendarSpec:
    daily_work_hours: float = 8.0
    exceptions: dict[date, float] = field(default_factory=dict)  # date -> available hours (0 = 부재)


WEEKDAY_INDEX = {"Mon": 0, "Tue": 1, "Wed": 2, "Thu": 3, "Fri": 4, "Sat": 5, "Sun": 6}


def work_days_from_str(s: str) -> set[int]:
    """'0,1,2,3,4' 형태(0=Mon)를 set으로 변환. 'Mon,Tue'도 지원."""
    parts = [p.strip() for p in s.split(",") if p.strip()]
    out: set[int] = set()
    for p in parts:
        if p.isdigit():
            out.add(int(p))
        elif p in WEEKDAY_INDEX:
            out.add(WEEKDAY_INDEX[p])
    return out


class WorkingCalendar:
    """Project Calendar와 User Calendar를 합성한 실제 작업 가능 시간 계산기."""

    def __init__(self, project: ProjectCalendarSpec, user: UserCalendarSpec | None = None):
        self.project = project
        self.user = user

    def is_workday(self, d: date) -> bool:
        if d in self.project.exceptions:
            return self.project.exceptions[d] > 0
        return d.weekday() in self.project.work_days

    def available_hours(self, d: date) -> float:
        """특정 날짜의 작업 가능 시간(hour)."""
        if not self.is_workday(d):
            return 0.0
        hours = self.project.daily_work_hours
        if d in self.project.exceptions:
            hours = self.project.exceptions[d]
        if self.user is not None:
            if d in self.user.exceptions:
                hours = min(hours, self.user.exceptions[d])
            else:
                hours = min(hours, self.user.daily_work_hours)
        return max(0.0, hours)

    def add_workdays(self, start: date, n: int) -> date:
        """start에서 n개의 작업일 뒤의 날짜(n=0이면 start 자기 자신)."""
        d = start
        if n == 0:
            return d if self.is_workday(d) else self.next_workday(d)
        step = 1 if n > 0 else -1
        remaining = abs(n)
        while remaining > 0:
            d = d + timedelta(days=step)
            if self.is_workday(d):
                remaining -= 1
        return d

    def next_workday(self, d: date) -> date:
        return self.add_workdays(d, 1)

    def workdays_between(self, start: date, end: date) -> list[date]:
        """start~end(포함) 구간의 작업일 목록."""
        out: list[date] = []
        d = start
        while d <= end:
            if self.is_workday(d):
                out.append(d)
            d += timedelta(days=1)
        return out

    def count_workdays(self, start: date, end: date) -> int:
        return len(self.workdays_between(start, end))

    def available_hours_between(self, start: date, end: date) -> float:
        return sum(self.available_hours(d) for d in self.workdays_between(start, end))

    def forecast_end(self, start: date, remaining_hours: float) -> date:
        """start 이후 remaining_hours를 소화하기 위해 필요한 마지막 작업일을 계산."""
        if remaining_hours <= 0:
            return start
        d = start
        if not self.is_workday(d):
            d = self.next_workday(d)
        acc = 0.0
        guard = 0
        while acc < remaining_hours and guard < 4000:
            acc += self.available_hours(d)
            if acc < remaining_hours:
                d = self.next_workday(d)
            guard += 1
        return d