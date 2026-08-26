from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import SYSTEM_ADMIN, get_current_user, require_role
from app.models.entities import AuditLog, User
from app.schemas import AuditLogRead

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("", response_model=list[AuditLogRead])
def list_audit_logs(
    entity: str | None = Query(None),
    limit: int = Query(200, le=1000),
    db: Session = Depends(get_db),
    _: User = Depends(require_role(SYSTEM_ADMIN)),
):
    q = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit)
    if entity:
        q = q.filter(AuditLog.entity == entity)
    logs = q.all()
    return [
        AuditLogRead(
            id=l.id, actor_id=l.actor_id, action=l.action, entity=l.entity, entity_id=l.entity_id,
            http_method=l.http_method, endpoint=l.endpoint, ip_address=l.ip_address,
            user_agent=l.user_agent, result=l.result,
            before=l.before, after=l.after, timestamp=l.timestamp, reason=l.reason,
        )
        for l in logs
    ]