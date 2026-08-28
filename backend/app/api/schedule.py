from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.permissions import get_project_or_403, require_perm
from app.core.ratelimit import rate_limit
from app.core.security import get_current_user
from app.models.entities import Project, User
from app.schemas import (
    CriticalPathItem,
    ForecastCreate,
    ForecastRead,
    ScheduleAnalysis,
)
from app.services.ai_service import analyze_project_risk, create_forecast
from app.services.schedule_service import compute_project_schedule

router = APIRouter(prefix="/projects/{project_id}", tags=["schedule"])


def _compute_or_conflict(db: Session, project_id: int):
    from fastapi import HTTPException

    try:
        return compute_project_schedule(db, db.get(Project, project_id))
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=f"일정 계산 충돌: {exc}") from exc


@router.get("/schedule-analysis", response_model=ScheduleAnalysis)
def schedule_analysis(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = get_project_or_403(db, project_id, user)
    result = _compute_or_conflict(db, project_id)
    return ScheduleAnalysis(
        plan_progress=result.plan_progress,
        actual_progress=result.actual_progress,
        progress_gap=result.progress_gap,
        planned_finish=result.project_planned_finish,
        forecast_finish=result.project_forecast_finish,
        schedule_delay_days=result.expected_delay_days,
        critical_path=[
            CriticalPathItem(
                task_id=t.task_id, title=t.title, total_float=t.total_float, free_float=t.free_float,
                early_start=t.early_start, early_finish=t.early_finish,
                late_start=t.late_start, late_finish=t.late_finish, is_critical=t.is_critical,
            )
            for t in result.tasks
        ],
    )


@router.get("/critical-path", response_model=list[CriticalPathItem])
def critical_path(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = get_project_or_403(db, project_id, user)
    result = _compute_or_conflict(db, project_id)
    return [
        CriticalPathItem(
            task_id=t.task_id, title=t.title, total_float=t.total_float, free_float=t.free_float,
            early_start=t.early_start, early_finish=t.early_finish,
            late_start=t.late_start, late_finish=t.late_finish, is_critical=t.is_critical,
        )
        for t in result.tasks
        if t.is_critical
    ]


@router.get("/forecast", response_model=list[ForecastRead])
def list_forecasts(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = get_project_or_403(db, project_id, user)
    from app.models.entities import Forecast

    return db.query(Forecast).filter_by(project_id=project.id).order_by(Forecast.created_at).all()


@router.post("/forecast", response_model=ForecastRead)
def make_forecast(project_id: int, body: ForecastCreate | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = get_project_or_403(db, project_id, user)
    require_perm(db, user, "forecast.manage", project)
    forecast = create_forecast(db, project)
    if body:
        if body.forecast_finish:
            forecast.forecast_finish = body.forecast_finish
        if body.expected_delay_days is not None:
            forecast.expected_delay_days = body.expected_delay_days
        if body.basis:
            forecast.basis = body.basis
        db.commit()
        db.refresh(forecast)
    return forecast


@router.post("/ai-risk-analysis", dependencies=[Depends(rate_limit(5, 300, "ai"))])
def risk_analysis(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = get_project_or_403(db, project_id, user)
    _compute_or_conflict(db, project_id)  # 충돌 시 409
    analysis = analyze_project_risk(db, project)
    return {"id": analysis.id, "type": analysis.analysis_type, "content": analysis.content}