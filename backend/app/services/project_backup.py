"""프로젝트 단위 JSON 백업·복원. 사용자는 아이디로만 연결하고 계정은 만들지 않는다."""
from __future__ import annotations

from datetime import date, datetime
from typing import Any

from sqlalchemy.orm import Session, joinedload

from app.models.entities import (
    Baseline,
    Challenge,
    ChallengeResponse,
    Forecast,
    Group,
    Milestone,
    ProgressSnapshot,
    ProgressUpdate,
    Project,
    ProjectCalendar,
    ProjectCalendarEntry,
    ProjectMember,
    ScheduleChange,
    Task,
    TaskAssignment,
    TaskDependency,
    User,
    WeeklyReport,
)

FORMAT = 1


def _d(v: date | datetime | None) -> str | None:
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.isoformat()
    return v.isoformat()


def _user_name(db: Session, user_id: int | None) -> str | None:
    if not user_id:
        return None
    u = db.get(User, user_id)
    return u.username if u else None


def export_project(db: Session, project: Project) -> dict[str, Any]:
    cal = (
        db.query(ProjectCalendar)
        .options(joinedload(ProjectCalendar.entries))
        .filter_by(project_id=project.id)
        .first()
    )
    groups = db.query(Group).filter_by(project_id=project.id).order_by(Group.sort_order, Group.id).all()
    tasks = (
        db.query(Task)
        .filter_by(project_id=project.id, is_deleted=False)
        .order_by(Task.id)
        .options(joinedload(Task.assignments), joinedload(Task.progress_updates), joinedload(Task.schedule_changes))
        .all()
    )
    task_ids = [t.id for t in tasks]
    deps = []
    if task_ids:
        deps = (
            db.query(TaskDependency)
            .filter(TaskDependency.predecessor_id.in_(task_ids), TaskDependency.successor_id.in_(task_ids))
            .all()
        )
    members = db.query(ProjectMember).filter_by(project_id=project.id).all()
    snaps = db.query(ProgressSnapshot).filter_by(project_id=project.id).order_by(ProgressSnapshot.snapshot_date).all()
    miles = db.query(Milestone).filter_by(project_id=project.id).order_by(Milestone.sort_order, Milestone.id).all()
    bases = db.query(Baseline).filter_by(project_id=project.id).all()
    forecasts = db.query(Forecast).filter_by(project_id=project.id).all()
    weeks = db.query(WeeklyReport).filter_by(project_id=project.id).all()
    challenges = db.query(Challenge).filter_by(project_id=project.id).options(joinedload(Challenge.responses)).all()

    return {
        "format": FORMAT,
        "kind": "flowplan.project",
        "exported_at": datetime.now().isoformat(timespec="seconds"),
        "project": {
            "name": project.name,
            "description": project.description,
            "status": project.status,
            "manager": _user_name(db, project.manager_id),
        },
        "members": [{"username": _user_name(db, m.user_id), "role_in_project": m.role_in_project} for m in members],
        "calendar": None
        if cal is None
        else {
            "daily_work_hours": cal.daily_work_hours,
            "work_days": cal.work_days,
            "entries": [
                {
                    "date": _d(e.date),
                    "is_workday": e.is_workday,
                    "kind": e.kind,
                    "hours": e.hours,
                    "note": e.note,
                }
                for e in cal.entries
            ],
        },
        "groups": [{"id": g.id, "name": g.name, "description": g.description, "sort_order": g.sort_order} for g in groups],
        "tasks": [
            {
                "id": t.id,
                "group_id": t.group_id,
                "parent_id": t.parent_id,
                "title": t.title,
                "description": t.description,
                "baseline_start": _d(t.baseline_start),
                "baseline_end": _d(t.baseline_end),
                "baseline_workload": t.baseline_workload,
                "plan_start": _d(t.plan_start),
                "plan_end": _d(t.plan_end),
                "workload": t.workload,
                "actual_start": _d(t.actual_start),
                "actual_end": _d(t.actual_end),
                "status": t.status,
                "task_type": t.task_type,
                "schedule_progress": t.schedule_progress,
                "work_progress": t.work_progress,
                "user_adjustment": t.user_adjustment,
                "effective_progress": t.effective_progress,
                "is_issue": t.is_issue,
                "issue_symptom": t.issue_symptom,
                "issue_cause": t.issue_cause,
                "issue_impact": t.issue_impact,
                "issue_solution": t.issue_solution,
                "issue_resolve_plan_date": _d(t.issue_resolve_plan_date),
                "issue_resolve_actual_date": _d(t.issue_resolve_actual_date),
                "issue_resolve_result": t.issue_resolve_result,
                "created_by": _user_name(db, t.created_by),
                "assignments": [
                    {
                        "username": _user_name(db, a.user_id),
                        "workload_hours": a.workload_hours,
                        "assigned_by": _user_name(db, a.assigned_by),
                    }
                    for a in t.assignments
                ],
                "progress_updates": [
                    {
                        "author": _user_name(db, u.author_id),
                        "current_status": u.current_status,
                        "work_done": u.work_done,
                        "problems": u.problems,
                        "delay_cause": u.delay_cause,
                        "delay_cause_category": u.delay_cause_category,
                        "response_plan": u.response_plan,
                        "next_plan": u.next_plan,
                        "extra_opinion": u.extra_opinion,
                        "expected_delay_days": u.expected_delay_days,
                        "recovery_plan": u.recovery_plan,
                        "recovery_expected_date": _d(u.recovery_expected_date),
                        "created_at": _d(u.created_at),
                    }
                    for u in t.progress_updates
                ],
                "schedule_changes": [
                    {
                        "before_start": _d(c.before_start),
                        "before_end": _d(c.before_end),
                        "after_start": _d(c.after_start),
                        "after_end": _d(c.after_end),
                        "before_workload": c.before_workload,
                        "after_workload": c.after_workload,
                        "changed_by": _user_name(db, c.changed_by),
                        "reason": c.reason,
                        "user_opinion": c.user_opinion,
                        "project_impact": c.project_impact,
                    }
                    for c in t.schedule_changes
                ],
            }
            for t in tasks
        ],
        "dependencies": [
            {
                "predecessor_id": d.predecessor_id,
                "successor_id": d.successor_id,
                "dependency_type": d.dependency_type,
                "lag_days": d.lag_days,
            }
            for d in deps
        ],
        "milestones": [
            {
                "name": m.name,
                "description": m.description,
                "sort_order": m.sort_order,
                "start_date": _d(m.start_date),
                "end_date": _d(m.end_date),
                "progress": m.progress,
                "status": m.status,
                "owner": _user_name(db, m.owner_id),
            }
            for m in miles
        ],
        "snapshots": [
            {"snapshot_date": _d(s.snapshot_date), "actual_progress": s.actual_progress, "plan_progress": s.plan_progress}
            for s in snaps
        ],
        "baselines": [{"name": b.name, "snapshot": b.snapshot, "created_by": _user_name(db, b.created_by)} for b in bases],
        "forecasts": [
            {
                "forecast_finish": _d(f.forecast_finish),
                "expected_delay_days": f.expected_delay_days,
                "basis": f.basis,
                "data_used": f.data_used,
                "actual_finish": _d(f.actual_finish),
            }
            for f in forecasts
        ],
        "weekly_reports": [{"week_start": _d(w.week_start), "content": w.content} for w in weeks],
        "challenges": [
            {
                "username": _user_name(db, c.user_id),
                "task_id": c.task_id,
                "priority": c.priority,
                "category": c.category,
                "message": c.message,
                "status": c.status,
                "created_by": c.created_by,
                "responses": [{"username": _user_name(db, r.user_id), "response": r.response} for r in c.responses],
            }
            for c in challenges
        ],
    }


def _parse_date(v: str | None) -> date | None:
    if not v:
        return None
    return date.fromisoformat(v[:10])


def _uid(db: Session, username: str | None, fallback: int) -> int:
    if not username:
        return fallback
    u = db.query(User).filter_by(username=username).first()
    return u.id if u else fallback


def import_project(db: Session, payload: dict[str, Any], actor: User) -> Project:
    if not isinstance(payload, dict) or payload.get("kind") != "flowplan.project":
        raise ValueError("Flow Plan 프로젝트 백업 파일이 아닙니다.")
    meta = payload.get("project") or {}
    name = (meta.get("name") or "복원된 프로젝트").strip()
    project = Project(
        name=name,
        description=meta.get("description"),
        status=meta.get("status") or "active",
        manager_id=_uid(db, meta.get("manager"), actor.id),
    )
    db.add(project)
    db.flush()

    seen_members: set[int] = set()
    for m in payload.get("members") or []:
        uid = _uid(db, m.get("username"), 0)
        if not uid or uid in seen_members:
            continue
        db.add(ProjectMember(project_id=project.id, user_id=uid, role_in_project=m.get("role_in_project") or "member"))
        seen_members.add(uid)
    if project.manager_id and project.manager_id not in seen_members:
        db.add(ProjectMember(project_id=project.id, user_id=project.manager_id, role_in_project="manager"))
        seen_members.add(project.manager_id)
    if actor.id not in seen_members:
        db.add(ProjectMember(project_id=project.id, user_id=actor.id, role_in_project="manager"))

    cal_in = payload.get("calendar")
    cal = ProjectCalendar(
        project_id=project.id,
        daily_work_hours=(cal_in or {}).get("daily_work_hours") or 8.0,
        work_days=(cal_in or {}).get("work_days") or "0,1,2,3,4",
    )
    db.add(cal)
    db.flush()
    for e in (cal_in or {}).get("entries") or []:
        if not e.get("date"):
            continue
        db.add(
            ProjectCalendarEntry(
                calendar_id=cal.id,
                date=_parse_date(e["date"]),
                is_workday=bool(e.get("is_workday", True)),
                kind=e.get("kind") or "normal",
                hours=e.get("hours"),
                note=e.get("note"),
            )
        )

    group_map: dict[int, int] = {}
    for g in payload.get("groups") or []:
        ng = Group(
            project_id=project.id,
            name=g.get("name") or "그룹",
            description=g.get("description"),
            sort_order=int(g.get("sort_order") or 0),
        )
        db.add(ng)
        db.flush()
        if g.get("id") is not None:
            group_map[int(g["id"])] = ng.id

    raw_tasks = list(payload.get("tasks") or [])
    task_map: dict[int, int] = {}
    pending = raw_tasks[:]
    guard = 0
    while pending and guard < 20:
        guard += 1
        nxt = []
        for t in pending:
            old_parent = t.get("parent_id")
            if old_parent and old_parent not in task_map:
                nxt.append(t)
                continue
            nt = Task(
                project_id=project.id,
                group_id=group_map.get(t["group_id"]) if t.get("group_id") else None,
                parent_id=task_map.get(old_parent) if old_parent else None,
                title=t.get("title") or "태스크",
                description=t.get("description"),
                baseline_start=_parse_date(t.get("baseline_start")),
                baseline_end=_parse_date(t.get("baseline_end")),
                baseline_workload=t.get("baseline_workload"),
                plan_start=_parse_date(t.get("plan_start")),
                plan_end=_parse_date(t.get("plan_end")),
                workload=float(t.get("workload") or 0),
                actual_start=_parse_date(t.get("actual_start")),
                actual_end=_parse_date(t.get("actual_end")),
                status=t.get("status") or "not_started",
                task_type=t.get("task_type") or "normal",
                schedule_progress=float(t.get("schedule_progress") or 0),
                work_progress=float(t.get("work_progress") or 0),
                user_adjustment=float(t.get("user_adjustment") or 0),
                effective_progress=float(t.get("effective_progress") or 0),
                is_issue=bool(t.get("is_issue")),
                issue_symptom=t.get("issue_symptom"),
                issue_cause=t.get("issue_cause"),
                issue_impact=t.get("issue_impact"),
                issue_solution=t.get("issue_solution"),
                issue_resolve_plan_date=_parse_date(t.get("issue_resolve_plan_date")),
                issue_resolve_actual_date=_parse_date(t.get("issue_resolve_actual_date")),
                issue_resolve_result=t.get("issue_resolve_result"),
                created_by=_uid(db, t.get("created_by"), actor.id),
            )
            db.add(nt)
            db.flush()
            if t.get("id") is not None:
                task_map[int(t["id"])] = nt.id
            for a in t.get("assignments") or []:
                uid = _uid(db, a.get("username"), 0)
                if not uid:
                    continue
                db.add(
                    TaskAssignment(
                        task_id=nt.id,
                        user_id=uid,
                        workload_hours=float(a.get("workload_hours") or 0),
                        assigned_by=_uid(db, a.get("assigned_by"), actor.id),
                    )
                )
            for u in t.get("progress_updates") or []:
                db.add(
                    ProgressUpdate(
                        task_id=nt.id,
                        author_id=_uid(db, u.get("author"), actor.id),
                        current_status=u.get("current_status"),
                        work_done=u.get("work_done"),
                        problems=u.get("problems"),
                        delay_cause=u.get("delay_cause"),
                        delay_cause_category=u.get("delay_cause_category"),
                        response_plan=u.get("response_plan"),
                        next_plan=u.get("next_plan"),
                        extra_opinion=u.get("extra_opinion"),
                        expected_delay_days=u.get("expected_delay_days"),
                        recovery_plan=u.get("recovery_plan"),
                        recovery_expected_date=_parse_date(u.get("recovery_expected_date")),
                    )
                )
            for c in t.get("schedule_changes") or []:
                db.add(
                    ScheduleChange(
                        task_id=nt.id,
                        before_start=_parse_date(c.get("before_start")),
                        before_end=_parse_date(c.get("before_end")),
                        after_start=_parse_date(c.get("after_start")),
                        after_end=_parse_date(c.get("after_end")),
                        before_workload=c.get("before_workload"),
                        after_workload=c.get("after_workload"),
                        changed_by=_uid(db, c.get("changed_by"), actor.id),
                        reason=c.get("reason"),
                        user_opinion=c.get("user_opinion"),
                        project_impact=c.get("project_impact"),
                    )
                )
        pending = nxt

    for d in payload.get("dependencies") or []:
        pre, suc = task_map.get(d.get("predecessor_id")), task_map.get(d.get("successor_id"))
        if not pre or not suc:
            continue
        db.add(
            TaskDependency(
                predecessor_id=pre,
                successor_id=suc,
                dependency_type=d.get("dependency_type") or "FS",
                lag_days=int(d.get("lag_days") or 0),
                created_by=actor.id,
            )
        )

    for m in payload.get("milestones") or []:
        db.add(
            Milestone(
                project_id=project.id,
                name=m.get("name") or "마일스톤",
                description=m.get("description"),
                sort_order=int(m.get("sort_order") or 0),
                start_date=_parse_date(m.get("start_date")),
                end_date=_parse_date(m.get("end_date")),
                progress=float(m.get("progress") or 0),
                status=m.get("status") or "pending",
                owner_id=_uid(db, m.get("owner"), 0) or None,
            )
        )

    for s in payload.get("snapshots") or []:
        if not s.get("snapshot_date"):
            continue
        db.add(
            ProgressSnapshot(
                project_id=project.id,
                snapshot_date=_parse_date(s["snapshot_date"]),
                actual_progress=float(s.get("actual_progress") or 0),
                plan_progress=float(s.get("plan_progress") or 0),
            )
        )

    for b in payload.get("baselines") or []:
        db.add(
            Baseline(
                project_id=project.id,
                name=b.get("name") or "최초 계획",
                snapshot=b.get("snapshot") or "[]",
                created_by=_uid(db, b.get("created_by"), actor.id),
            )
        )
    for f in payload.get("forecasts") or []:
        db.add(
            Forecast(
                project_id=project.id,
                forecast_finish=_parse_date(f.get("forecast_finish")),
                expected_delay_days=f.get("expected_delay_days"),
                basis=f.get("basis"),
                data_used=f.get("data_used"),
                actual_finish=_parse_date(f.get("actual_finish")),
            )
        )
    for w in payload.get("weekly_reports") or []:
        if not w.get("week_start"):
            continue
        db.add(WeeklyReport(project_id=project.id, week_start=_parse_date(w["week_start"]), content=w.get("content") or "{}"))

    for c in payload.get("challenges") or []:
        uid = _uid(db, c.get("username"), 0)
        if not uid:
            continue
        ch = Challenge(
            user_id=uid,
            project_id=project.id,
            task_id=task_map.get(c["task_id"]) if c.get("task_id") else None,
            priority=c.get("priority") or "NORMAL",
            category=c.get("category") or "일반",
            message=c.get("message") or "",
            status=c.get("status") or "open",
            created_by=c.get("created_by") or "system",
        )
        db.add(ch)
        db.flush()
        for r in c.get("responses") or []:
            rid = _uid(db, r.get("username"), 0)
            if not rid:
                continue
            db.add(ChallengeResponse(challenge_id=ch.id, user_id=rid, response=r.get("response") or ""))

    db.flush()
    return project
