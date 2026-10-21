import json
import threading
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.permissions import get_project_or_403
from app.core.security import get_current_user
from app.models.entities import (
    AIAnalysis,
    Forecast,
    Milestone,
    ProgressSnapshot,
    ScheduleChange,
    Task,
    User,
)
from app.services.ai_service import personalize_risk_summary
from app.services.schedule_service import (
    compute_project_schedule,
    display_finishes,
    upsert_progress_snapshot,
)

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
    upsert_progress_snapshot(db, project, result)
    db.commit()
    snapshots = (
        db.query(ProgressSnapshot)
        .filter_by(project_id=project.id)
        .order_by(ProgressSnapshot.snapshot_date)
        .all()
    )

    milestones = db.query(Milestone).filter_by(project_id=project.id).order_by(Milestone.sort_order).all()
    # 완료일은 "마지막 마일스톤(오픈)" 기준으로 통일 — 예상 완료일 = 오픈 + 예상 지연일.
    display_planned_finish, display_forecast_finish = display_finishes(db, project, result)
    delayed = [t for t in result.tasks if t.delay_days > 0]
    critical = sorted(
        [t for t in result.tasks if t.is_critical],
        key=lambda t: (t.early_start or date.max, t.early_finish or date.max, t.task_id),
    )
    issues = db.query(Task).filter_by(project_id=project.id, is_issue=True, is_deleted=False).all()

    # 사용자별 작업량 — 배정 시간(workload_hours)과 진척률 기반 실제 투입 시간(done_hours) 산정.
    # 투입 시간 = Σ 배정 시간 × 태스크 최종 진척률(%). 태스크가 여러 명 담당이면 배정 비율대로 배분한다.
    user_load: dict[int, dict] = {}
    eff = {tr.task_id: tr.effective_progress for tr in result.tasks}
    for t in db.query(Task).filter_by(project_id=project.id, is_deleted=False).all():
        pct = eff.get(t.id, t.effective_progress or 0.0)
        for a in t.assignments:
            entry = user_load.setdefault(a.user_id, {"user_id": a.user_id, "name": a.user.name if a.user else "", "workload_hours": 0.0, "done_hours": 0.0, "delayed_tasks": 0, "critical_tasks": 0, "issue_tasks": 0})
            entry["workload_hours"] += a.workload_hours
            entry["done_hours"] += a.workload_hours * (pct / 100.0)
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

    # 이전 예측 스냅샷(마지막 일정 변경 직전의 예측) — S-Curve "이전 예측 vs 지금 예측" 오버레이용.
    # 곡선(forecast_curve)을 담은 행만 쓴다: 기존 수동 스냅샷(POST /forecast)은 곡선이 없다.
    latest_forecast = (
        db.query(Forecast)
        .filter_by(project_id=project.id)
        .order_by(Forecast.created_at.desc(), Forecast.id.desc())
        .first()
    )
    prev_forecast_finish = None
    prev_forecast_at = None
    prev_forecast_curve = None
    if latest_forecast and latest_forecast.data_used:
        try:
            prev_forecast_curve = json.loads(latest_forecast.data_used).get("forecast_curve")
        except (ValueError, AttributeError, TypeError):
            prev_forecast_curve = None
        if prev_forecast_curve:
            prev_forecast_finish = latest_forecast.forecast_finish
            prev_forecast_at = latest_forecast.created_at

    latest_analysis = db.query(AIAnalysis).filter_by(project_id=project.id, analysis_type="risk").order_by(AIAnalysis.created_at.desc()).first()
    needs_ai = latest_analysis is None
    if latest_analysis:
        try:
            parsed = json.loads(latest_analysis.content)
            needs_ai = not isinstance(parsed, dict) or not (parsed.get("headline") or parsed.get("situation"))
        except Exception:
            needs_ai = True
    if needs_ai:
        # 응답 지연 방지: 백그라운드에서 생성 (다음 조회 시 반영)
        threading.Thread(target=_generate_risk_async, args=(project.id,), daemon=True).start()

    my_task_ids = {
        t.id
        for t in db.query(Task).filter_by(project_id=project.id, is_deleted=False).all()
        if any(a.user_id == user.id for a in t.assignments)
    }
    ai_summary = personalize_risk_summary(
        latest_analysis.content if latest_analysis else None,
        user=user,
        result=result,
        my_task_ids=my_task_ids,
        role_name=user.role.name if user.role else "",
        delayed=delayed,
        critical=critical,
        issues=issues,
        user_load=list(user_load.values()),
    )

    return {
        "project_name": project.name,
        "overall_progress": result.actual_progress,
        "plan_progress": result.plan_progress,
        "progress_gap": result.progress_gap,
        "planned_finish": display_planned_finish,
        "forecast_finish": display_forecast_finish,
        "expected_delay_days": result.expected_delay_days,
        "risk_level": "WARNING" if result.expected_delay_days > 0 else "NORMAL",
        "plan_curve": [{"date": d.isoformat(), "pct": pct} for d, pct in result.plan_curve],
        "forecast_curve": [{"date": d.isoformat(), "pct": pct} for d, pct in result.forecast_curve],
        "progress_snapshots": [
            {"date": s.snapshot_date.isoformat(), "actual": s.actual_progress, "plan": s.plan_progress}
            for s in snapshots
        ],
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
             "before_start": c.before_start, "after_start": c.after_start,
             "before_end": c.before_end, "after_end": c.after_end}
            for c in recent_changes
        ],
        "prev_forecast_finish": prev_forecast_finish,
        "prev_forecast_at": prev_forecast_at,
        "prev_forecast_curve": prev_forecast_curve,
        "ai_summary": ai_summary,
    }