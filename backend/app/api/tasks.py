from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.permissions import audit, get_project_or_403, has_perm, require_perm
from app.core.security import get_current_user
from app.models.entities import (
    Group,
    ScheduleChange,
    Task,
    TaskAssignment,
    User,
)
from app.schemas import (
    AssignmentCreate,
    AssignmentRead,
    ProgressUpdateCreate,
    ProgressUpdateRead,
    ScheduleChangeRead,
    TaskCreate,
    TaskDetail,
    TaskRead,
    TaskUpdate,
)
from app.services.schedule_service import apply_engine_progress, compute_project_schedule

router = APIRouter(prefix="/tasks", tags=["tasks"])


def _to_read(t: Task, db: Session, crit_ids: set[int] | None = None, delays: dict[int, int] | None = None) -> TaskRead:
    read = TaskRead.model_validate(t)
    read.assignments = [
        AssignmentRead(id=a.id, task_id=a.task_id, user_id=a.user_id, workload_hours=a.workload_hours,
                       user_name=a.user.name if a.user else None)
        for a in t.assignments
    ]
    read.group_name = t.group.name if t.group else None
    if crit_ids is not None:
        read.is_critical = t.id in crit_ids
    if delays is not None:
        read.delay_days = delays.get(t.id)
    return read


def _load_task(db: Session, task_id: int, user: User, perm: str | None = None) -> Task:
    task = db.query(Task).options(
        joinedload(Task.project), joinedload(Task.assignments), joinedload(Task.group),
    ).filter(Task.id == task_id, Task.is_deleted.is_(False)).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task를 찾을 수 없습니다.")
    get_project_or_403(db, task.project_id, user)
    if perm:
        require_perm(db, user, perm, task.project)
    return task


@router.get("", response_model=list[TaskRead])
def list_tasks(
    project_id: int | None = Query(None),
    group_id: int | None = Query(None),
    parent_id: int | None = Query(None),
    include_children: bool = Query(False, description="Gantt/테이블용: 하위 Task 포함 전체 조회"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.core.permissions import SYSTEM_ADMIN
    from app.models.entities import Project, ProjectMember

    q = db.query(Task).filter(Task.is_deleted.is_(False)).options(joinedload(Task.assignments))

    if project_id is not None:
        project = get_project_or_403(db, project_id, user)
        q = q.filter(Task.project_id == project.id)
    else:
        # project_id 없이 조회하는 경우(IDOR 차단): 접근 가능한 프로젝트로 한정
        role_name = user.role.name if user.role else ""
        if role_name == SYSTEM_ADMIN:
            pass
        else:
            from sqlalchemy import select

            member_ids = select(ProjectMember.project_id).where(ProjectMember.user_id == user.id)
            managed_ids = select(Project.id).where(
                Project.is_deleted.is_(False), Project.manager_id == user.id
            )
            q = q.filter(Task.project_id.in_(member_ids.union(managed_ids)))
    if group_id is not None:
        group = db.get(Group, group_id)
        if group:
            get_project_or_403(db, group.project_id, user)
        q = q.filter(Task.group_id == group_id)
    if parent_id is not None:
        q = q.filter(Task.parent_id == parent_id)
    elif project_id is not None and not include_children:
        q = q.filter(Task.parent_id.is_(None))
    tasks = q.order_by(Task.id).all()
    crit_ids: set[int] | None = None
    delays: dict[int, int] | None = None
    if project_id is not None:
        from app.models.entities import Project

        project = db.get(Project, project_id)
        try:
            result = compute_project_schedule(db, project)
            crit_ids = {tr.task_id for tr in result.tasks if tr.is_critical}
            delays = {tr.task_id: tr.delay_days for tr in result.tasks}
        except Exception:
            crit_ids = set()
            delays = {}
    return [_to_read(t, db, crit_ids, delays) for t in tasks]


@router.post("", response_model=TaskRead)
def create_task(body: TaskCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = get_project_or_403(db, body.project_id, user)
    require_perm(db, user, "task.create", project)
    if body.parent_id:
        parent = db.get(Task, body.parent_id)
        if not parent or parent.project_id != project.id:
            raise HTTPException(status_code=400, detail="Parent Task가 프로젝트에 속하지 않습니다.")

    task = Task(
        project_id=project.id,
        group_id=body.group_id,
        parent_id=body.parent_id,
        title=body.title,
        description=body.description,
        plan_start=body.plan_start,
        plan_end=body.plan_end,
        workload=body.workload,
        task_type=body.task_type,
        is_issue=body.is_issue,
        issue_symptom=body.issue_symptom,
        issue_cause=body.issue_cause,
        issue_impact=body.issue_impact,
        issue_solution=body.issue_solution,
        issue_resolve_plan_date=body.issue_resolve_plan_date,
        created_by=user.id,
    )
    # 최초 계획 → Baseline으로 보존
    task.baseline_start = body.plan_start
    task.baseline_end = body.plan_end
    task.baseline_workload = body.workload
    db.add(task)
    audit(db, user.id, "create", "Task", task.id, reason="Task 생성")
    db.commit()
    db.refresh(task)
    apply_engine_progress(db, project)
    return _to_read(task, db)


@router.get("/{task_id}", response_model=TaskDetail)
def get_task(task_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    task = _load_task(db, task_id, user)
    detail = TaskDetail.model_validate(task)
    detail.group_name = task.group.name if task.group else None
    detail.assignments = [
        AssignmentRead(id=a.id, task_id=a.task_id, user_id=a.user_id, workload_hours=a.workload_hours,
                       user_name=a.user.name if a.user else None)
        for a in task.assignments
    ]
    # 일정 분석 결과 반영
    result = compute_project_schedule(db, task.project)
    for tr in result.tasks:
        if tr.task_id == task.id:
            detail.delay_days = tr.delay_days
            detail.is_critical = tr.is_critical
            detail.plan_start = tr.early_start or task.plan_start
            detail.plan_end = tr.early_finish or task.plan_end
            break
    return detail


@router.put("/{task_id}", response_model=TaskRead)
def update_task(task_id: int, body: TaskUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    task = _load_task(db, task_id, user)

    # 변경하려는 항목 분류에 따른 세분 권한 검사
    schedule_fields = ("plan_start", "plan_end", "workload")
    progress_fields = ("actual_start", "actual_end", "user_adjustment", "effective_progress")
    basic_fields = (
        "title", "description", "group_id", "parent_id", "status", "task_type",
        "is_issue", "issue_symptom", "issue_cause", "issue_impact", "issue_solution",
        "issue_resolve_plan_date", "issue_resolve_actual_date", "issue_resolve_result",
    )
    needed: set[str] = set()
    if any(getattr(body, f) is not None for f in schedule_fields):
        needed.add("task.edit_schedule")
    if any(getattr(body, f) is not None for f in progress_fields):
        needed.add("task.update_progress")
    if any(getattr(body, f) is not None for f in basic_fields):
        needed.add("task.edit_basic")
    for p in needed:
        require_perm(db, user, p, task.project)

    # 일정 변경 이력 기록
    schedule_changed = (
        body.plan_start is not None and body.plan_start != task.plan_start
    ) or (body.plan_end is not None and body.plan_end != task.plan_end) or (
        body.workload is not None and body.workload != task.workload
    )
    if schedule_changed:
        db.add(
            ScheduleChange(
                task_id=task.id,
                before_start=task.plan_start,
                before_end=task.plan_end,
                after_start=body.plan_start if body.plan_start is not None else task.plan_start,
                after_end=body.plan_end if body.plan_end is not None else task.plan_end,
                before_workload=task.workload,
                after_workload=body.workload if body.workload is not None else task.workload,
                changed_by=user.id,
                reason=body.change_reason,
                user_opinion=body.user_opinion,
            )
        )

    for field_name in [
        "title", "description", "group_id", "parent_id", "plan_start", "plan_end", "workload",
        "status", "task_type", "actual_start", "actual_end", "user_adjustment", "effective_progress",
        "is_issue", "issue_symptom", "issue_cause", "issue_impact", "issue_solution",
        "issue_resolve_plan_date", "issue_resolve_actual_date", "issue_resolve_result",
    ]:
        val = getattr(body, field_name)
        if val is not None:
            setattr(task, field_name, val)

    audit(db, user.id, "update", "Task", task.id, reason=body.change_reason, after=task.plan_end)
    db.commit()
    apply_engine_progress(db, task.project)
    return _to_read(task, db)


@router.delete("/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    task = _load_task(db, task_id, user, perm="task.delete")
    task.is_deleted = True  # Soft delete
    audit(db, user.id, "delete", "Task", task.id)
    db.commit()
    return {"message": "deleted"}


# ---------- Children & Issues ----------
@router.post("/{task_id}/children", response_model=TaskRead)
def create_child(task_id: int, body: TaskCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    task = _load_task(db, task_id, user, perm="task.create")
    child = Task(
        project_id=task.project_id, group_id=task.group_id, parent_id=task.id, title=body.title,
        description=body.description, plan_start=body.plan_start, plan_end=body.plan_end,
        workload=body.workload, task_type=body.task_type, created_by=user.id,
    )
    child.baseline_start = body.plan_start
    child.baseline_end = body.plan_end
    child.baseline_workload = body.workload
    db.add(child)
    audit(db, user.id, "create", "Task", child.id, reason=f"child of {task.id}")
    db.commit()
    db.refresh(child)
    return _to_read(child, db)


@router.post("/{task_id}/issues", response_model=TaskRead)
def create_issue(task_id: int, body: TaskCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    task = _load_task(db, task_id, user, perm="task.manage_issues")
    issue = Task(
        project_id=task.project_id, group_id=task.group_id, parent_id=task.id, title=body.title,
        description=body.description, plan_start=body.plan_start, plan_end=body.plan_end,
        workload=body.workload, task_type="issue", is_issue=True,
        issue_symptom=body.issue_symptom, issue_cause=body.issue_cause,
        issue_impact=body.issue_impact, issue_solution=body.issue_solution,
        issue_resolve_plan_date=body.issue_resolve_plan_date, created_by=user.id,
    )
    issue.baseline_start = body.plan_start
    issue.baseline_end = body.plan_end
    issue.baseline_workload = body.workload
    db.add(issue)
    audit(db, user.id, "create", "Task", issue.id, reason=f"issue on {task.id}")
    db.commit()
    db.refresh(issue)
    apply_engine_progress(db, task.project)
    return _to_read(issue, db)


# ---------- Assignments ----------
@router.post("/{task_id}/assignments", response_model=AssignmentRead)
def add_assignment(task_id: int, body: AssignmentCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    task = _load_task(db, task_id, user, perm="task.assign")
    existing = db.query(TaskAssignment).filter_by(task_id=task.id, user_id=body.user_id).first()
    if existing:
        existing.workload_hours = body.workload_hours
        assignment = existing
    else:
        assignment = TaskAssignment(task_id=task.id, user_id=body.user_id, workload_hours=body.workload_hours, assigned_by=user.id)
        db.add(assignment)
    audit(db, user.id, "assign", "TaskAssignment", assignment.id, after=f"user={body.user_id} hours={body.workload_hours}")
    db.commit()
    db.refresh(assignment)
    return AssignmentRead(id=assignment.id, task_id=task.id, user_id=body.user_id,
                          workload_hours=body.workload_hours, user_name=db.get(User, body.user_id).name if db.get(User, body.user_id) else None)


@router.delete("/{task_id}/assignments/{user_id}")
def remove_assignment(task_id: int, user_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    task = _load_task(db, task_id, user, perm="task.assign")
    db.query(TaskAssignment).filter_by(task_id=task.id, user_id=user_id).delete()
    audit(db, user.id, "unassign", "TaskAssignment", task.id, reason=f"remove user={user_id}")
    db.commit()
    return {"message": "removed"}


# ---------- Progress Update ----------
@router.post("/{task_id}/progress", response_model=ProgressUpdateRead)
def add_progress(task_id: int, body: ProgressUpdateCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    task = _load_task(db, task_id, user)
    # 담당자, 또는 '진척률 기록' 권한이 있는 사용자만 작성 가능
    is_assignee = any(a.user_id == user.id for a in task.assignments)
    if not is_assignee and not has_perm(db, user, "task.update_progress", task.project):
        raise HTTPException(status_code=403, detail="담당자이거나 진척률 기록 권한이 있어야 진행상황을 입력할 수 있습니다.")
    pu = ProgressUpdate(
        task_id=task.id, author_id=user.id,
        current_status=body.current_status, work_done=body.work_done, problems=body.problems,
        delay_cause=body.delay_cause, delay_cause_category=body.delay_cause_category,
        response_plan=body.response_plan, next_plan=body.next_plan, extra_opinion=body.extra_opinion,
        expected_delay_days=body.expected_delay_days, recovery_plan=body.recovery_plan,
        recovery_expected_date=body.recovery_expected_date,
    )
    db.add(pu)
    audit(db, user.id, "progress", "Task", task.id, reason="진행상황 입력")
    db.commit()
    db.refresh(pu)
    return ProgressUpdateRead(
        id=pu.id, task_id=task.id, author_id=user.id, author_name=user.name,
        current_status=pu.current_status, work_done=pu.work_done, problems=pu.problems,
        delay_cause=pu.delay_cause, delay_cause_category=pu.delay_cause_category,
        response_plan=pu.response_plan, next_plan=pu.next_plan, extra_opinion=pu.extra_opinion,
        expected_delay_days=pu.expected_delay_days, recovery_plan=pu.recovery_plan,
        recovery_expected_date=pu.recovery_expected_date, created_at=pu.created_at,
    )


@router.get("/{task_id}/progress", response_model=list[ProgressUpdateRead])
def list_progress(task_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    task = _load_task(db, task_id, user)
    rows = task.progress_updates
    return [
        ProgressUpdateRead(
            id=p.id, task_id=p.task_id, author_id=p.author_id,
            author_name=p.author.name if p.author else None,
            current_status=p.current_status, work_done=p.work_done, problems=p.problems,
            delay_cause=p.delay_cause, delay_cause_category=p.delay_cause_category,
            response_plan=p.response_plan, next_plan=p.next_plan, extra_opinion=p.extra_opinion,
            expected_delay_days=p.expected_delay_days, recovery_plan=p.recovery_plan,
            recovery_expected_date=p.recovery_expected_date, created_at=p.created_at,
        )
        for p in rows
    ]


@router.get("/{task_id}/history", response_model=list[ScheduleChangeRead])
def task_history(task_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    task = _load_task(db, task_id, user)
    return [
        ScheduleChangeRead(
            id=c.id, task_id=c.task_id, before_start=c.before_start, before_end=c.before_end,
            after_start=c.after_start, after_end=c.after_end, before_workload=c.before_workload,
            after_workload=c.after_workload, changed_by=c.changed_by,
            changed_by_name=c.changer.name if c.changer else None, changed_at=c.changed_at,
            reason=c.reason, user_opinion=c.user_opinion, project_impact=c.project_impact,
        )
        for c in task.schedule_changes
    ]