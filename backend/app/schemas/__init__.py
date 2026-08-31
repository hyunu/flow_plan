from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- Auth / User ----------
class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserBase(BaseModel):
    username: str
    email: str
    name: str


class UserCreate(UserBase):
    password: str
    role_id: int


class UserUpdate(BaseModel):
    email: str | None = None
    name: str | None = None
    password: str | None = None
    role_id: int | None = None
    is_active: bool | None = None
    profile: str | None = None


class UserRead(UserBase, ORMModel):
    id: int
    role_id: int
    is_active: bool
    role_name: str | None = None
    permissions: list[str] = []
    profile: str | None = None
    created_at: datetime


class RoleRead(ORMModel):
    id: int
    name: str
    description: str | None = None
    permissions: list[str] = []


class RoleUpdate(BaseModel):
    description: str | None = None
    permissions: list[str] | None = None


# ---------- Project ----------
class ProjectCreate(BaseModel):
    name: str
    description: str | None = None
    manager_id: int | None = None


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    manager_id: int | None = None
    status: str | None = None


class ProjectMemberCreate(BaseModel):
    user_id: int
    role_in_project: str = "member"


class ProjectMemberRead(ORMModel):
    id: int
    project_id: int
    user_id: int
    role_in_project: str
    user_name: str | None = None


class ProjectRead(ORMModel):
    id: int
    name: str
    description: str | None = None
    manager_id: int | None = None
    status: str
    created_at: datetime


class ProjectDetail(ProjectRead):
    members: list[ProjectMemberRead] = []


# ---------- Group ----------
class GroupCreate(BaseModel):
    project_id: int
    name: str
    description: str | None = None
    sort_order: int = 0


class GroupUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    sort_order: int | None = None


class GroupRead(ORMModel):
    id: int
    project_id: int
    name: str
    description: str | None = None
    sort_order: int


# ---------- Task ----------
class TaskCreate(BaseModel):
    project_id: int
    group_id: int | None = None
    parent_id: int | None = None
    title: str
    description: str | None = None
    plan_start: date | None = None
    plan_end: date | None = None
    workload: float = 0
    task_type: str = "normal"
    is_issue: bool = False
    issue_symptom: str | None = None
    issue_cause: str | None = None
    issue_impact: str | None = None
    issue_solution: str | None = None
    issue_resolve_plan_date: date | None = None


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    group_id: int | None = None
    parent_id: int | None = None
    plan_start: date | None = None
    plan_end: date | None = None
    workload: float | None = None
    status: str | None = None
    task_type: str | None = None
    actual_start: date | None = None
    actual_end: date | None = None
    user_adjustment: float | None = None
    effective_progress: float | None = None
    is_issue: bool | None = None
    issue_symptom: str | None = None
    issue_cause: str | None = None
    issue_impact: str | None = None
    issue_solution: str | None = None
    issue_resolve_plan_date: date | None = None
    issue_resolve_actual_date: date | None = None
    issue_resolve_result: str | None = None
    change_reason: str | None = None
    user_opinion: str | None = None


class AssignmentCreate(BaseModel):
    user_id: int
    workload_hours: float = 0


class AssignmentRead(ORMModel):
    id: int
    task_id: int
    user_id: int
    workload_hours: float
    user_name: str | None = None


class TaskRead(ORMModel):
    id: int
    project_id: int
    group_id: int | None = None
    parent_id: int | None = None
    title: str
    description: str | None = None
    baseline_start: date | None = None
    baseline_end: date | None = None
    baseline_workload: float | None = None
    plan_start: date | None = None
    plan_end: date | None = None
    workload: float
    actual_start: date | None = None
    actual_end: date | None = None
    status: str
    task_type: str
    schedule_progress: float
    work_progress: float
    user_adjustment: float
    effective_progress: float
    is_issue: bool
    created_at: datetime
    updated_at: datetime
    assignments: list[AssignmentRead] = []
    children: list["TaskRead"] = []
    group_name: str | None = None
    is_critical: bool = False
    delay_days: int | None = None
    early_start: date | None = None
    early_finish: date | None = None
    forecast_finish: date | None = None
    total_float: float | None = None


class TaskDetail(TaskRead):
    group_name: str | None = None
    dependencies: list["DependencyRead"] = []
    delay_days: int | None = None
    is_critical: bool = False


# ---------- Dependency ----------
class DependencyCreate(BaseModel):
    predecessor_id: int
    successor_id: int
    dependency_type: str = "FS"
    lag_days: int = 0


class DependencyRead(ORMModel):
    id: int
    predecessor_id: int
    successor_id: int
    dependency_type: str
    lag_days: int


# ---------- Milestone ----------
class MilestoneCreate(BaseModel):
    project_id: int
    name: str
    description: str | None = None
    sort_order: int = 0
    start_date: date | None = None
    end_date: date | None = None
    owner_id: int | None = None


class MilestoneUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    sort_order: int | None = None
    start_date: date | None = None
    end_date: date | None = None
    progress: float | None = None
    status: str | None = None
    owner_id: int | None = None


class MilestoneRead(ORMModel):
    id: int
    project_id: int
    name: str
    description: str | None = None
    sort_order: int
    start_date: date | None = None
    end_date: date | None = None
    progress: float
    status: str
    owner_id: int | None = None


# ---------- Calendar ----------
class ProjectCalendarEntryCreate(BaseModel):
    date: date
    is_workday: bool = True
    kind: str = "normal"
    hours: float | None = None
    note: str | None = None


class ProjectCalendarUpdate(BaseModel):
    daily_work_hours: float | None = None
    work_days: str | None = None


class ProjectCalendarEntryRead(ORMModel):
    id: int
    date: date
    is_workday: bool
    kind: str
    hours: float | None = None
    note: str | None = None


class UserCalendarEntryCreate(BaseModel):
    date: date
    is_available: bool = True
    kind: str = "normal"
    available_hours: float | None = None
    note: str | None = None


class UserCalendarEntryRead(ORMModel):
    id: int
    date: date
    is_available: bool
    kind: str
    available_hours: float | None = None
    note: str | None = None


# ---------- Progress ----------
class ProgressUpdateCreate(BaseModel):
    current_status: str | None = None
    work_done: str | None = None
    problems: str | None = None
    delay_cause: str | None = None
    delay_cause_category: str | None = None
    response_plan: str | None = None
    next_plan: str | None = None
    extra_opinion: str | None = None
    expected_delay_days: int | None = None
    recovery_plan: str | None = None
    recovery_expected_date: date | None = None


class ProgressUpdateRead(ORMModel):
    id: int
    task_id: int
    author_id: int
    author_name: str | None = None
    current_status: str | None = None
    work_done: str | None = None
    problems: str | None = None
    delay_cause: str | None = None
    delay_cause_category: str | None = None
    response_plan: str | None = None
    next_plan: str | None = None
    extra_opinion: str | None = None
    expected_delay_days: int | None = None
    recovery_plan: str | None = None
    recovery_expected_date: date | None = None
    created_at: datetime


class ScheduleChangeRead(ORMModel):
    id: int
    task_id: int
    before_start: date | None = None
    before_end: date | None = None
    after_start: date | None = None
    after_end: date | None = None
    before_workload: float | None = None
    after_workload: float | None = None
    changed_by: int
    changed_by_name: str | None = None
    changed_at: datetime
    reason: str | None = None
    user_opinion: str | None = None
    project_impact: str | None = None


# ---------- Schedule / Analysis ----------
class CriticalPathItem(BaseModel):
    task_id: int
    title: str
    total_float: float
    free_float: float
    early_start: date | None = None
    early_finish: date | None = None
    late_start: date | None = None
    late_finish: date | None = None
    is_critical: bool = False


class ScheduleAnalysis(BaseModel):
    plan_progress: float
    actual_progress: float
    progress_gap: float
    planned_finish: date | None = None
    forecast_finish: date | None = None
    schedule_delay_days: int | None = None
    critical_path: list[CriticalPathItem] = []


class ChallengeRead(ORMModel):
    id: int
    user_id: int
    project_id: int
    task_id: int | None = None
    priority: str
    category: str
    message: str
    status: str
    created_at: datetime


class ChallengeResponseCreate(BaseModel):
    response: str


class ChallengeResponseRead(ORMModel):
    id: int
    challenge_id: int
    user_id: int
    response: str
    created_at: datetime


class ForecastCreate(BaseModel):
    forecast_finish: date | None = None
    expected_delay_days: int | None = None
    basis: str | None = None
    data_used: str | None = None


class ForecastRead(ORMModel):
    id: int
    project_id: int
    forecast_finish: date | None = None
    expected_delay_days: int | None = None
    basis: str | None = None
    data_used: str | None = None
    actual_finish: date | None = None
    created_at: datetime


class NotificationRead(ORMModel):
    id: int
    user_id: int
    channel: str
    type: str
    title: str
    body: str
    link: str | None = None
    is_read: bool
    created_at: datetime


class AuditLogRead(ORMModel):
    id: int
    actor_id: int | None = None
    action: str
    entity: str
    entity_id: int | None = None
    http_method: str | None = None
    endpoint: str | None = None
    ip_address: str | None = None
    user_agent: str | None = None
    result: int | None = None
    before: str | None = None
    after: str | None = None
    timestamp: datetime
    reason: str | None = None


TaskDetail.model_rebuild()
TaskRead.model_rebuild()