import threading

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.permissions import get_project_or_403
from app.core.security import get_current_user
from app.models.entities import (
    AIAnalysis,
    Milestone,
    ScheduleChange,
    Task,
    User,
)
from app.services.ai_service import build_project_facts
from app.services.schedule_service import compute_project_schedule

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

_generating: set[int] = set()


def _generate_risk_async(project_id: int) -> None:
    """대시보드 응답을 막지 않도록 백그라운드에서 AI 위험 분석을 생성한다.
    동일 프로젝트의 중복 생성은 방지한다."""
    from app.core.database import SessionLocal
    from app.models.entities import Project
    from app.services.ai_service import analyze_project_risk

    if project_id in _generating:
        return
    _generating.add(project_id)
    db = SessionLocal()
    try:
        project = db.get(Project, project_id)
        if project:
            analyze_project_risk(db, project)
    except Exception:
        pass
    finally:
        db.close()
        _generating.discard(project_id)


@router.get("/projects/{project_id}")
def project_dashboard(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = get_project_or_403(db, project_id, user)
    result = compute_project_schedule(db, project)

    milestones = db.query(Milestone).filter_by(project_id=project.id).order_by(Milestone.sort_order).all()
    delayed = [t for t in result.tasks if t.delay_days > 0]
    critical = [t for t in result.tasks if t.is_critical]
    issues = db.query(Task).filter_by(project_id=project.id, is_issue=True, is_deleted=False).all()

    # 사용자별 작업량
    user_load: dict[int, dict] = {}
    for t in db.query(Task).filter_by(project_id=project.id, is_deleted=False).all():
        for a in t.assignments:
            entry = user_load.setdefault(a.user_id, {"user_id": a.user_id, "name": a.user.name if a.user else "", "workload_hours": 0.0, "delayed_tasks": 0, "critical_tasks": 0, "issue_tasks": 0})
            entry["workload_hours"] += a.workload_hours
    for tr in result.tasks:
        task = db.get(Task, tr.task_id)
        if not task:
            continue
        for a in task.assignments:
            entry = user_load.get(a.user_id)
            if entry:
                if tr.delay_days > 0:
                    entry["delayed_tasks"] += 1
                if tr.is_critical:
                    entry["critical_tasks"] += 1
                if task.is_issue:
                    entry["issue_tasks"] += 1

    recent_changes = db.query(ScheduleChange).join(Task, ScheduleChange.task_id == Task.id).filter(
        Task.project_id == project.id
    ).order_by(ScheduleChange.changed_at.desc()).limit(10).all()

    latest_analysis = db.query(AIAnalysis).filter_by(project_id=project.id, analysis_type="risk").order_by(AIAnalysis.created_at.desc()).first()
    if not latest_analysis:
        # 응답 지연 방지: 백그라운드에서 생성 (다음 조회 시 반영)
        threading.Thread(target=_generate_risk_async, args=(project.id,), daemon=True).start()

    return {
        "project_name": project.name,
        "overall_progress": result.actual_progress,
        "plan_progress": result.plan_progress,
        "progress_gap": result.progress_gap,
        "planned_finish": result.project_planned_finish,
        "forecast_finish": result.project_forecast_finish,
        "expected_delay_days": result.expected_delay_days,
        "risk_level": "WARNING" if result.expected_delay_days > 0 else "NORMAL",
        "plan_curve": [{"date": d.isoformat(), "pct": pct} for d, pct in result.plan_curve],
        "milestones": [
            {"id": m.id, "name": m.name, "progress": m.progress, "status": m.status,
             "start_date": m.start_date, "end_date": m.end_date}
            for m in milestones
        ],
        "critical_path": [
            {"task_id": t.task_id, "title": t.title, "delay_days": t.delay_days, "total_float": t.total_float}
            for t in critical
        ],
        "delayed_tasks": [
            {"task_id": t.task_id, "title": t.title, "delay_days": t.delay_days, "forecast_finish": t.forecast_finish}
            for t in delayed
        ],
        "issues": [
            {"id": i.id, "title": i.title, "status": i.status, "resolve_plan_date": i.issue_resolve_plan_date,
             "cause": i.issue_cause, "solution": i.issue_solution}
            for i in issues
        ],
        "user_workload": list(user_load.values()),
        "recent_changes": [
            {"task_id": c.task_id, "changed_at": c.changed_at, "reason": c.reason,
             "before_end": c.before_end, "after_end": c.after_end}
            for c in recent_changes
        ],
        "ai_summary": latest_analysis.content if latest_analysis else None,
    }