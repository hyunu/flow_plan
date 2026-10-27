"""편집 중(presence) API.

같은 프로젝트를 보고 있거나 편집 중인 사용자를 공유한다. 실시간 소켓 대신
짧은 TTL을 가진 하트비트(15초 주기)와 폴링(5초)으로 가볍게 구현한다.
"""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.permissions import get_project_or_403
from app.core.security import get_current_user
from app.models.entities import EditPresence, Task, User
from app.schemas import PresenceRead, PresenceUpdate

router = APIRouter(prefix="/projects/{project_id}/presence", tags=["presence"])

#: 하트비트 유효 시간(초). 프론트는 15초마다 보내고, 60초 무신호면 편집 중이 아닌 것으로 본다.
PRESENCE_TTL_SECONDS = 60


def _utcnow() -> datetime:
    """SQLite CURRENT_TIMESTAMP와 같은 naive UTC."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _cutoff() -> datetime:
    return _utcnow() - timedelta(seconds=PRESENCE_TTL_SECONDS)


def _purge_expired(db: Session, project_id: int) -> None:
    db.query(EditPresence).filter(
        EditPresence.project_id == project_id,
        EditPresence.updated_at < _cutoff(),
    ).delete(synchronize_session=False)


def _active(db: Session, project_id: int, viewer_id: int) -> list[PresenceRead]:
    rows = (
        db.query(EditPresence)
        .options(joinedload(EditPresence.user))
        .filter(EditPresence.project_id == project_id, EditPresence.updated_at >= _cutoff())
        .order_by(EditPresence.updated_at.desc())
        .all()
    )
    return [
        PresenceRead(
            user_id=r.user_id,
            user_name=r.user.name if r.user else None,
            task_id=r.task_id,
            updated_at=r.updated_at,
            is_self=(r.user_id == viewer_id),
        )
        for r in rows
    ]


@router.get("", response_model=list[PresenceRead])
def list_presence(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = get_project_or_403(db, project_id, user)
    _purge_expired(db, project.id)
    db.commit()
    return _active(db, project.id, user.id)


@router.post("", response_model=list[PresenceRead])
def heartbeat(
    project_id: int,
    body: PresenceUpdate | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = get_project_or_403(db, project_id, user)
    task_id = body.task_id if body else None
    if task_id is not None:
        task = db.get(Task, task_id)
        if task is None or task.is_deleted or task.project_id != project.id:
            raise HTTPException(status_code=404, detail="프로젝트에 없는 태스크입니다")

    _purge_expired(db, project.id)
    row = db.query(EditPresence).filter_by(project_id=project.id, user_id=user.id).first()
    if row is None:
        row = EditPresence(project_id=project.id, user_id=user.id, task_id=task_id)
        db.add(row)
    else:
        row.task_id = task_id
        row.updated_at = _utcnow()
    db.commit()
    return _active(db, project.id, user.id)


@router.delete("")
def leave(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = get_project_or_403(db, project_id, user)
    db.query(EditPresence).filter_by(project_id=project.id, user_id=user.id).delete(synchronize_session=False)
    db.commit()
    return {"removed": True}
