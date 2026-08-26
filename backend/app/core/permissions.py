from __future__ import annotations

import json
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.audit_context import get_pending_ids, get_request_meta
from app.core.database import get_db
from app.core.security import PROJECT_MANAGER, SYSTEM_ADMIN, get_current_user
from app.models.entities import AuditLog, Project, ProjectMember, User


def audit(
    db: Session,
    actor_id: int | None,
    action: str,
    entity: str,
    entity_id: int | None = None,
    before: object | None = None,
    after: object | None = None,
    reason: str | None = None,
) -> AuditLog:
    def _ser(v):
        if v is None:
            return None
        if isinstance(v, (dict, list)):
            return json.dumps(v, default=str)
        return str(v)

    meta = get_request_meta()
    log = AuditLog(
        actor_id=actor_id,
        action=action,
        entity=entity,
        entity_id=entity_id,
        http_method=meta.get("method"),
        endpoint=meta.get("path"),
        ip_address=meta.get("ip"),
        user_agent=meta.get("user_agent"),
        before=_ser(before),
        after=_ser(after),
        reason=reason,
    )
    db.add(log)
    db.flush()
    get_pending_ids().append(log.id)
    return log


def check_project_access(
    db: Session, project: Project, user: User, require_manage: bool = False
) -> None:
    """일반 사용자는 자신이 참여한 프로젝트만 볼 수 있다. 관리자는 전체를 본다."""
    role_name = user.role.name if user.role else ""

    if require_manage:
        if role_name == SYSTEM_ADMIN:
            return
        if role_name != PROJECT_MANAGER:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="관리자 권한이 필요합니다.")
        if project.manager_id != user.id:
            member = db.query(ProjectMember).filter_by(project_id=project.id, user_id=user.id).first()
            if not member or member.role_in_project != "manager":
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="프로젝트 관리 권한이 없습니다.")
        return

    if role_name in (SYSTEM_ADMIN, PROJECT_MANAGER):
        if role_name == PROJECT_MANAGER and project.manager_id == user.id:
            return
        if role_name == PROJECT_MANAGER:
            member = db.query(ProjectMember).filter_by(project_id=project.id, user_id=user.id).first()
            if not member:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="프로젝트에 접근할 수 없습니다.")
        return

    # Project Member: 반드시 참여해야 함
    member = db.query(ProjectMember).filter_by(project_id=project.id, user_id=user.id).first()
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="프로젝트에 접근할 수 없습니다.")


def get_project_or_403(db: Session, project_id: int, user: User, require_manage: bool = False) -> Project:
    project = db.get(Project, project_id)
    if project is None or project.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="프로젝트를 찾을 수 없습니다.")
    check_project_access(db, project, user, require_manage)
    return project


def can_manage_project(db: Session, project: Project, user: User) -> bool:
    role_name = user.role.name if user.role else ""
    if role_name == SYSTEM_ADMIN:
        return True
    if role_name != PROJECT_MANAGER:
        return False
    if project.manager_id == user.id:
        return True
    member = db.query(ProjectMember).filter_by(project_id=project.id, user_id=user.id).first()
    return bool(member and member.role_in_project == "manager")