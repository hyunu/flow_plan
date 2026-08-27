from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.permissions import audit
from app.core.security import SYSTEM_ADMIN, require_role
from app.models.entities import User, UserReportSetting
from app.services.email_service import get_email_config, should_deliver

router = APIRouter(prefix="/settings", tags=["settings"])


class EmailConfigBody(BaseModel):
    smtp_host: str | None = None
    smtp_port: int | None = None
    smtp_user: str | None = None
    smtp_password: str | None = None
    from_email: str | None = None
    from_name: str | None = None
    use_tls: bool | None = None
    enabled: bool | None = None


class UserSettingBody(BaseModel):
    deliver_daily: bool | None = None
    deliver_weekly: bool | None = None


@router.get("/email")
def get_email_settings(db: Session = Depends(get_db), _: User = Depends(require_role(SYSTEM_ADMIN))):
    cfg = get_email_config(db)
    return {
        "id": cfg.id,
        "smtp_host": cfg.smtp_host,
        "smtp_port": cfg.smtp_port,
        "smtp_user": cfg.smtp_user,
        "has_smtp_password": bool(cfg.smtp_password),
        "from_email": cfg.from_email,
        "from_name": cfg.from_name,
        "use_tls": cfg.use_tls,
        "enabled": cfg.enabled,
    }


@router.put("/email")
def update_email_settings(
    body: EmailConfigBody,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role(SYSTEM_ADMIN)),
):
    cfg = get_email_config(db)
    before = cfg.smtp_host
    if body.smtp_host is not None:
        cfg.smtp_host = body.smtp_host
    if body.smtp_port is not None:
        cfg.smtp_port = body.smtp_port
    if body.smtp_user is not None:
        cfg.smtp_user = body.smtp_user
    if body.smtp_password:  # 빈 값이면 기존 유지
        cfg.smtp_password = body.smtp_password
    if body.from_email is not None:
        cfg.from_email = body.from_email
    if body.from_name is not None:
        cfg.from_name = body.from_name
    if body.use_tls is not None:
        cfg.use_tls = body.use_tls
    if body.enabled is not None:
        cfg.enabled = body.enabled
    audit(db, admin.id, "update", "EmailConfig", cfg.id, before=before, after=cfg.smtp_host)
    db.commit()
    db.refresh(cfg)
    return get_email_settings(db, admin)


@router.get("/users")
def list_user_settings(db: Session = Depends(get_db), _: User = Depends(require_role(SYSTEM_ADMIN))):
    users = db.query(User).order_by(User.id).all()
    out = []
    for u in users:
        setting = db.query(UserReportSetting).filter_by(user_id=u.id).first()
        out.append({
            "user_id": u.id,
            "username": u.username,
            "name": u.name,
            "email": u.email,
            "role": u.role.name if u.role else "",
            "is_active": u.is_active,
            "deliver_daily": setting.deliver_daily if setting else should_deliver(db, u, "daily"),
            "deliver_weekly": setting.deliver_weekly if setting else should_deliver(db, u, "weekly"),
        })
    return out


@router.put("/users/{user_id}")
def update_user_setting(
    user_id: int,
    body: UserSettingBody,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role(SYSTEM_ADMIN)),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    setting = db.query(UserReportSetting).filter_by(user_id=user.id).first()
    if not setting:
        setting = UserReportSetting(user_id=user.id)
        db.add(setting)
    if body.deliver_daily is not None:
        setting.deliver_daily = body.deliver_daily
    if body.deliver_weekly is not None:
        setting.deliver_weekly = body.deliver_weekly
    audit(db, admin.id, "update", "UserReportSetting", setting.id, after=f"user={user.id}")
    db.commit()
    return {
        "user_id": user.id,
        "deliver_daily": setting.deliver_daily,
        "deliver_weekly": setting.deliver_weekly,
    }