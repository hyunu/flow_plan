from fastapi import APIRouter, Depends
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.entities import Notification, User
from app.schemas import NotificationRead
from app.services.ai_service import notice_title_from_body, sync_challenge_notifications

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationRead])
def list_notifications(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    try:
        sync_challenge_notifications(db, user)
    except Exception:
        pass
    rows = (
        db.query(Notification)
        .filter(
            Notification.user_id == user.id,
            or_(Notification.is_hidden.is_(False), Notification.is_hidden.is_(None)),
        )
        .order_by(Notification.created_at.desc())
        .limit(100)
        .all()
    )
    dirty = False
    for n in rows:
        if n.type == "challenge" and ("Daily Challenge" in (n.title or "") or n.title.startswith("[")):
            n.title = notice_title_from_body(n.body)
            dirty = True
        if n.type == "daily_report" and n.title in ("일일 보고서 이메일 발송",):
            n.title = "일일 리포트를 메일로 보냈습니다"
            dirty = True
        if n.type == "weekly_report" and n.title in ("주간 보고서 이메일 발송",):
            n.title = "주간 리포트를 메일로 보냈습니다"
            dirty = True
    if dirty:
        db.commit()
    return rows


@router.post("/read-all")
def mark_all_read(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db.query(Notification).filter_by(user_id=user.id, is_read=False).update({"is_read": True})
    db.commit()
    return {"message": "ok"}


@router.post("/hide-read")
def hide_read(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db.query(Notification).filter_by(user_id=user.id, is_read=True, is_hidden=False).update({"is_hidden": True})
    db.commit()
    return {"message": "ok"}


@router.post("/{notification_id}/read")
def mark_read(notification_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    n = db.get(Notification, notification_id)
    if n and n.user_id == user.id:
        n.is_read = True
        db.commit()
    return {"message": "ok"}


@router.post("/{notification_id}/hide")
def hide_one(notification_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    n = db.get(Notification, notification_id)
    if n and n.user_id == user.id:
        n.is_hidden = True
        n.is_read = True
        db.commit()
    return {"message": "ok"}