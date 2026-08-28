from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.permissions import get_project_or_403, require_perm
from app.core.ratelimit import rate_limit
from app.core.security import get_current_user
from app.models.entities import DailyReport, User, WeeklyReport
from app.services.ai_service import generate_daily_report, generate_weekly_report
from app.services.email_service import send_daily_reports, send_weekly_report

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/daily")
def my_daily_reports(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(DailyReport).filter_by(user_id=user.id).order_by(DailyReport.report_date.desc()).limit(30).all()


@router.post("/daily/generate", dependencies=[Depends(rate_limit(10, 300, "report"))])
def make_daily_report(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    report = generate_daily_report(db, user)
    return report


@router.get("/weekly/{project_id}")
def project_weekly_reports(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = get_project_or_403(db, project_id, user)
    return db.query(WeeklyReport).filter_by(project_id=project.id).order_by(WeeklyReport.week_start.desc()).limit(20).all()


@router.post("/weekly/generate/{project_id}", dependencies=[Depends(rate_limit(10, 300, "report"))])
def make_weekly_report(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = get_project_or_403(db, project_id, user)
    require_perm(db, user, "report.send", project)
    report = generate_weekly_report(db, project)
    return report


@router.post("/daily/send", dependencies=[Depends(rate_limit(5, 300, "report"))])
def send_daily_email(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """개발자(수신 권한 사용자)에게 오늘 데일리 리포트를 이메일로 발송."""
    require_perm(db, user, "report.send")
    try:
        sent = send_daily_reports(db)
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"sent": len(sent), "recipients": sent}


@router.post("/weekly/send/{project_id}", dependencies=[Depends(rate_limit(5, 300, "report"))])
def send_weekly_email(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """관리자에게 해당 프로젝트 위클리 리포트를 이메일로 발송."""
    project = get_project_or_403(db, project_id, user)
    require_perm(db, user, "report.send", project)
    try:
        sent = send_weekly_report(db, project)
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"sent": len(sent), "recipients": sent}