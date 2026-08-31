from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(255))
    permissions: Mapped[str] = mapped_column(Text, default="[]")  # JSON 배열

    users: Mapped[list["User"]] = relationship(back_populates="role")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    profile: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    role: Mapped[Role] = relationship(back_populates="users")
    memberships: Mapped[list["ProjectMember"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    assignments: Mapped[list["TaskAssignment"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", foreign_keys="TaskAssignment.user_id"
    )
    user_calendar: Mapped["UserCalendar"] = relationship(back_populates="user", cascade="all, delete-orphan")


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    manager_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(30), default="active")  # active | archived
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    members: Mapped[list["ProjectMember"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    groups: Mapped[list["Group"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    tasks: Mapped[list["Task"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    milestones: Mapped[list["Milestone"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    calendar: Mapped["ProjectCalendar"] = relationship(back_populates="project", cascade="all, delete-orphan", uselist=False)
    baselines: Mapped[list["Baseline"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    progress_snapshots: Mapped[list["ProgressSnapshot"]] = relationship(back_populates="project", cascade="all, delete-orphan")


class ProjectMember(Base):
    __tablename__ = "project_members"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    role_in_project: Mapped[str] = mapped_column(String(50), default="member")  # manager | member
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    project: Mapped[Project] = relationship(back_populates="members")
    user: Mapped[User] = relationship(back_populates="memberships")


class Group(Base):
    __tablename__ = "groups"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    project: Mapped[Project] = relationship(back_populates="groups")
    tasks: Mapped[list["Task"]] = relationship(back_populates="group")


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    group_id: Mapped[int | None] = mapped_column(ForeignKey("groups.id"))
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("tasks.id"), index=True)

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    # Baseline
    baseline_start: Mapped[date | None] = mapped_column(Date)
    baseline_end: Mapped[date | None] = mapped_column(Date)
    baseline_workload: Mapped[float | None] = mapped_column(Float)

    # Current Plan
    plan_start: Mapped[date | None] = mapped_column(Date, index=True)
    plan_end: Mapped[date | None] = mapped_column(Date, index=True)
    workload: Mapped[float] = mapped_column(Float, default=0)  # hours

    # Actual
    actual_start: Mapped[date | None] = mapped_column(Date)
    actual_end: Mapped[date | None] = mapped_column(Date)

    status: Mapped[str] = mapped_column(String(30), default="not_started")  # not_started | in_progress | completed | delayed | blocked
    task_type: Mapped[str] = mapped_column(String(30), default="normal")  # normal | issue | milestone

    # Progress (자동 계산 + 사용자 보정 분리)
    schedule_progress: Mapped[float] = mapped_column(Float, default=0)  # 시스템 자동(일정 기준)
    work_progress: Mapped[float] = mapped_column(Float, default=0)  # 시스템 자동(작업량 기준)
    user_adjustment: Mapped[float] = mapped_column(Float, default=0)  # 사용자 보정 (-100~100)
    effective_progress: Mapped[float] = mapped_column(Float, default=0)  # 최종

    # Issue 정보
    is_issue: Mapped[bool] = mapped_column(Boolean, default=False)
    issue_symptom: Mapped[str | None] = mapped_column(Text)
    issue_cause: Mapped[str | None] = mapped_column(Text)
    issue_impact: Mapped[str | None] = mapped_column(Text)
    issue_solution: Mapped[str | None] = mapped_column(Text)
    issue_resolve_plan_date: Mapped[date | None] = mapped_column(Date)
    issue_resolve_actual_date: Mapped[date | None] = mapped_column(Date)
    issue_resolve_result: Mapped[str | None] = mapped_column(Text)

    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)

    project: Mapped[Project] = relationship(back_populates="tasks")
    group: Mapped[Group | None] = relationship(back_populates="tasks")
    parent: Mapped["Task | None"] = relationship(remote_side=[id], back_populates="children")
    children: Mapped[list["Task"]] = relationship(back_populates="parent", cascade="all, delete-orphan")
    assignments: Mapped[list["TaskAssignment"]] = relationship(back_populates="task", cascade="all, delete-orphan")
    dependencies_out: Mapped[list["TaskDependency"]] = relationship(
        back_populates="predecessor", cascade="all, delete-orphan", foreign_keys="TaskDependency.predecessor_id"
    )
    dependencies_in: Mapped[list["TaskDependency"]] = relationship(
        back_populates="successor", cascade="all, delete-orphan", foreign_keys="TaskDependency.successor_id"
    )
    progress_updates: Mapped[list["ProgressUpdate"]] = relationship(back_populates="task", cascade="all, delete-orphan")
    schedule_changes: Mapped[list["ScheduleChange"]] = relationship(
        back_populates="task", cascade="all, delete-orphan", foreign_keys="ScheduleChange.task_id"
    )


class TaskAssignment(Base):
    __tablename__ = "task_assignments"

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    workload_hours: Mapped[float] = mapped_column(Float, default=0)
    assigned_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    task: Mapped[Task] = relationship(back_populates="assignments")
    user: Mapped[User] = relationship(back_populates="assignments", foreign_keys=[user_id])


class TaskDependency(Base):
    __tablename__ = "task_dependencies"

    id: Mapped[int] = mapped_column(primary_key=True)
    predecessor_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"), nullable=False, index=True)
    successor_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"), nullable=False, index=True)
    dependency_type: Mapped[str] = mapped_column(String(20), default="FS")  # FS | SS | FF
    lag_days: Mapped[int] = mapped_column(Integer, default=0)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    predecessor: Mapped[Task] = relationship(back_populates="dependencies_out", foreign_keys=[predecessor_id])
    successor: Mapped[Task] = relationship(back_populates="dependencies_in", foreign_keys=[successor_id])


class Milestone(Base):
    __tablename__ = "milestones"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    progress: Mapped[float] = mapped_column(Float, default=0)
    status: Mapped[str] = mapped_column(String(30), default="pending")
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    project: Mapped[Project] = relationship(back_populates="milestones")


class ProjectCalendar(Base):
    __tablename__ = "project_calendars"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    daily_work_hours: Mapped[float] = mapped_column(Float, default=8.0)
    work_days: Mapped[str] = mapped_column(String(20), default="1,2,3,4,5")  # 0=Mon..6=Sun
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    project: Mapped[Project] = relationship(back_populates="calendar")
    entries: Mapped[list["ProjectCalendarEntry"]] = relationship(back_populates="calendar", cascade="all, delete-orphan")


class ProjectCalendarEntry(Base):
    __tablename__ = "project_calendar_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    calendar_id: Mapped[int] = mapped_column(ForeignKey("project_calendars.id"), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    is_workday: Mapped[bool] = mapped_column(Boolean, default=True)
    kind: Mapped[str] = mapped_column(String(30), default="normal")  # holiday | special | weekend | work
    hours: Mapped[float | None] = mapped_column(Float)
    note: Mapped[str | None] = mapped_column(Text)

    calendar: Mapped[ProjectCalendar] = relationship(back_populates="entries")


class UserCalendar(Base):
    __tablename__ = "user_calendars"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, unique=True, index=True)
    daily_work_hours: Mapped[float] = mapped_column(Float, default=8.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user: Mapped[User] = relationship(back_populates="user_calendar")
    entries: Mapped[list["UserCalendarEntry"]] = relationship(back_populates="calendar", cascade="all, delete-orphan")


class UserCalendarEntry(Base):
    __tablename__ = "user_calendar_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    calendar_id: Mapped[int] = mapped_column(ForeignKey("user_calendars.id"), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    kind: Mapped[str] = mapped_column(String(30), default="normal")  # vacation | half | business_trip | education | absence | other
    available_hours: Mapped[float | None] = mapped_column(Float)
    note: Mapped[str | None] = mapped_column(Text)

    calendar: Mapped[UserCalendar] = relationship(back_populates="entries")


class ProgressSnapshot(Base):
    """프로젝트 진척 일별 스냅샷. S-Curve 실적선은 이 시계열로 그린다."""
    __tablename__ = "progress_snapshots"
    __table_args__ = (UniqueConstraint("project_id", "snapshot_date", name="uq_progress_snap_day"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    snapshot_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    actual_progress: Mapped[float] = mapped_column(Float, default=0)
    plan_progress: Mapped[float] = mapped_column(Float, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    project: Mapped[Project] = relationship(back_populates="progress_snapshots")


class ProgressUpdate(Base):
    __tablename__ = "progress_updates"

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"), nullable=False, index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    current_status: Mapped[str | None] = mapped_column(Text)
    work_done: Mapped[str | None] = mapped_column(Text)
    problems: Mapped[str | None] = mapped_column(Text)
    delay_cause: Mapped[str | None] = mapped_column(Text)
    delay_cause_category: Mapped[str | None] = mapped_column(String(50))
    response_plan: Mapped[str | None] = mapped_column(Text)
    next_plan: Mapped[str | None] = mapped_column(Text)
    extra_opinion: Mapped[str | None] = mapped_column(Text)
    expected_delay_days: Mapped[int | None] = mapped_column(Integer)
    recovery_plan: Mapped[str | None] = mapped_column(Text)
    recovery_expected_date: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    task: Mapped[Task] = relationship(back_populates="progress_updates")
    author: Mapped[User] = relationship()


class ScheduleChange(Base):
    __tablename__ = "schedule_changes"

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"), nullable=False, index=True)
    before_start: Mapped[date | None] = mapped_column(Date)
    before_end: Mapped[date | None] = mapped_column(Date)
    after_start: Mapped[date | None] = mapped_column(Date)
    after_end: Mapped[date | None] = mapped_column(Date)
    before_workload: Mapped[float | None] = mapped_column(Float)
    after_workload: Mapped[float | None] = mapped_column(Float)
    changed_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    changed_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    reason: Mapped[str | None] = mapped_column(Text)
    related_issue_id: Mapped[int | None] = mapped_column(ForeignKey("tasks.id"))
    user_opinion: Mapped[str | None] = mapped_column(Text)
    project_impact: Mapped[str | None] = mapped_column(Text)

    task: Mapped[Task] = relationship(back_populates="schedule_changes", foreign_keys=[task_id])
    changer: Mapped[User] = relationship(foreign_keys=[changed_by])


class Baseline(Base):
    __tablename__ = "baselines"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), default="최초 계획")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    snapshot: Mapped[str] = mapped_column(Text)  # JSON snapshot of task schedules

    project: Mapped[Project] = relationship(back_populates="baselines")


class Forecast(Base):
    __tablename__ = "forecasts"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    forecast_finish: Mapped[date | None] = mapped_column(Date)
    expected_delay_days: Mapped[int | None] = mapped_column(Integer)
    basis: Mapped[str | None] = mapped_column(Text)
    data_used: Mapped[str | None] = mapped_column(Text)
    actual_finish: Mapped[date | None] = mapped_column(Date)

    project: Mapped[Project] = relationship()


class Challenge(Base):
    __tablename__ = "challenges"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    task_id: Mapped[int | None] = mapped_column(ForeignKey("tasks.id"))
    priority: Mapped[str] = mapped_column(String(20), default="NORMAL")  # CRITICAL | WARNING | ATTENTION | NORMAL
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="open")  # open | answered | done | dismissed
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    created_by: Mapped[str] = mapped_column(String(20), default="system")  # system | ai | user

    user: Mapped[User] = relationship()
    task: Mapped[Task | None] = relationship()
    responses: Mapped[list["ChallengeResponse"]] = relationship(back_populates="challenge", cascade="all, delete-orphan")


class ChallengeResponse(Base):
    __tablename__ = "challenge_responses"

    id: Mapped[int] = mapped_column(primary_key=True)
    challenge_id: Mapped[int] = mapped_column(ForeignKey("challenges.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    response: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    challenge: Mapped[Challenge] = relationship(back_populates="responses")
    user: Mapped[User] = relationship()


class DailyReport(Base):
    __tablename__ = "daily_reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    report_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)  # JSON
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user: Mapped[User] = relationship()


class WeeklyReport(Base):
    __tablename__ = "weekly_reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    week_start: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)  # JSON
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    project: Mapped[Project] = relationship()


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    channel: Mapped[str] = mapped_column(String(20), default="web")  # web | push | email
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    link: Mapped[str | None] = mapped_column(String(500))
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user: Mapped[User] = relationship()


class AIAnalysis(Base):
    __tablename__ = "ai_analyses"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    analysis_type: Mapped[str] = mapped_column(String(50), nullable=False)  # risk | forecast | summary | recommendation
    content: Mapped[str] = mapped_column(Text, nullable=False)
    sources: Mapped[str | None] = mapped_column(Text)  # JSON list of evidence ids
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    project: Mapped[Project] = relationship()


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    entity: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[int | None] = mapped_column(Integer)
    http_method: Mapped[str | None] = mapped_column(String(10))
    endpoint: Mapped[str | None] = mapped_column(String(255))
    ip_address: Mapped[str | None] = mapped_column(String(64))
    user_agent: Mapped[str | None] = mapped_column(String(255))
    result: Mapped[int | None] = mapped_column(Integer)  # HTTP status
    before: Mapped[str | None] = mapped_column(Text)
    after: Mapped[str | None] = mapped_column(Text)
    timestamp: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    reason: Mapped[str | None] = mapped_column(Text)

    actor: Mapped[User | None] = relationship()


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    ip_address: Mapped[str | None] = mapped_column(String(64))

    user: Mapped[User] = relationship()


class EmailConfig(Base):
    """이메일(SMTP) 발송 설정 — 관리자 페이지에서 관리한다."""

    __tablename__ = "email_config"

    id: Mapped[int] = mapped_column(primary_key=True)
    smtp_host: Mapped[str] = mapped_column(String(255), default="")
    smtp_port: Mapped[int] = mapped_column(Integer, default=587)
    smtp_user: Mapped[str | None] = mapped_column(String(255))
    smtp_password: Mapped[str | None] = mapped_column(String(255))
    from_email: Mapped[str] = mapped_column(String(255), default="no-reply@flowplan.dev")
    from_name: Mapped[str] = mapped_column(String(100), default="Flow Plan")
    use_tls: Mapped[bool] = mapped_column(Boolean, default=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class UserReportSetting(Base):
    """사용자별 리포트 이메일 발송 권한 — 관리자 페이지에서 관리한다."""

    __tablename__ = "user_report_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, nullable=False, index=True)
    deliver_daily: Mapped[bool] = mapped_column(Boolean, default=False)
    deliver_weekly: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    user: Mapped[User] = relationship()