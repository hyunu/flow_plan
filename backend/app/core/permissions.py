from __future__ import annotations

import json
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.audit_context import get_pending_ids, get_request_meta
from app.core.security import PROJECT_MANAGER, SYSTEM_ADMIN
from app.models.entities import AuditLog, Project, ProjectMember, Role, User

# ================================================================
# 세분화 권한 카탈로그
#   key → { group, label, desc }  (label/desc 는 관리 UI 표시용)
# ================================================================
PERMISSIONS: dict[str, dict[str, str]] = {
    # ------------------------------------------------- 프로젝트
    "project.create": {"group": "project", "label": "프로젝트 생성", "desc": "새 프로젝트를 만들 수 있습니다."},
    "project.edit": {"group": "project", "label": "프로젝트 정보 수정", "desc": "프로젝트 이름/설명/상태를 수정할 수 있습니다."},
    "project.delete": {"group": "project", "label": "프로젝트 삭제", "desc": "프로젝트를 삭제할 수 있습니다."},
    "project.manage_members": {"group": "project", "label": "멤버·담당 PM 관리", "desc": "프로젝트 멤버를 추가/제거하고 담당 PM을 지정할 수 있습니다."},
    # ---------------------------------------------------- 태스크
    "task.create": {"group": "task", "label": "태스크 생성", "desc": "태스크/하위 태스크를 추가할 수 있습니다."},
    "task.delete": {"group": "task", "label": "태스크 삭제", "desc": "태스크를 삭제할 수 있습니다."},
    "task.edit_basic": {"group": "task", "label": "태스크 기본정보 수정", "desc": "제목·설명·그룹·상태 등을 수정할 수 있습니다."},
    "task.edit_schedule": {"group": "task", "label": "계획 일정 수정", "desc": "계획 시작/종료, 작업량, 기준선 일정을 수정할 수 있습니다."},
    "task.assign": {"group": "task", "label": "담당자 배정", "desc": "태스크에 담당자를 배정/해제할 수 있습니다."},
    "task.update_progress": {"group": "task", "label": "진척률 기록·보정", "desc": "태스크 진척률을 기록하거나 보정할 수 있습니다."},
    "task.manage_issues": {"group": "task", "label": "이슈 관리", "desc": "이슈를 등록/해결 처리할 수 있습니다."},
    # ---------------------------------------------------- 일정 인프라
    "dependency.manage": {"group": "schedule", "label": "의존성(CP) 관리", "desc": "선행/후행 의존성을 추가·삭제할 수 있습니다."},
    "milestone.manage": {"group": "schedule", "label": "마일스톤 관리", "desc": "마일스톤을 생성/수정/삭제할 수 있습니다."},
    "group.manage": {"group": "schedule", "label": "작업그룹 관리", "desc": "작업 그룹을 생성/수정/삭제할 수 있습니다."},
    "calendar.project_manage": {"group": "schedule", "label": "프로젝트 캘린더 관리", "desc": "프로젝트 휴일/공휴일 일정을 관리할 수 있습니다."},
    "forecast.manage": {"group": "schedule", "label": "예측일정 저장", "desc": "진척 기반 예측 일정을 저장/수정할 수 있습니다."},
    # ------------------------------------------------------- 리포트
    "report.send": {"group": "report", "label": "리포트 이메일 발송", "desc": "일간/주간 리포트를 이메일로 발송할 수 있습니다."},
    # ---------------------------------------------------- 시스템(관리자)
    "user.manage": {"group": "admin", "label": "사용자·역할 관리", "desc": "사용자 생성/수정 및 역할 권한을 설정할 수 있습니다."},
    "settings.manage": {"group": "admin", "label": "시스템 설정 관리", "desc": "SMTP·이메일 전송 등 시스템 설정을 변경할 수 있습니다."},
    "audit.view": {"group": "admin", "label": "감사로그 조회", "desc": "감사 로그를 열람할 수 있습니다."},
}

GROUP_LABELS: dict[str, str] = {
    "project": "프로젝트",
    "task": "태스크",
    "schedule": "일정 인프라",
    "report": "리포트",
    "admin": "시스템",
}

ALL_PERMISSIONS = frozenset(PERMISSIONS)

# 역할별 기본 권한 (신규/초기화 시 적용, 관리자가 설정 UI에서 변경 가능)
DEFAULT_PERMISSIONS: dict[str, set[str]] = {
    SYSTEM_ADMIN: set(ALL_PERMISSIONS),
    PROJECT_MANAGER: set(ALL_PERMISSIONS) - {"user.manage", "settings.manage", "audit.view"},
    "Project Member": {"task.update_progress", "task.manage_issues"},
}


def role_permissions(role: Role | None) -> set[str]:
    if role is None or not role.permissions:
        return set(
            DEFAULT_PERMISSIONS.get(role.name if role else "", set())
        )
    try:
        data = json.loads(role.permissions)
    except (ValueError, TypeError):
        data = []
    return {p for p in data if p in PERMISSIONS}


def perms_serialize(perms: set[str] | list[str]) -> str:
    return json.dumps(sorted(perms))


def effective_permissions(db: Session, user: User, project: Project | None = None) -> set[str]:
    """프로젝트 컨텍스트에서는 해당 프로젝트의 관리자(담당 PM)면 PM 수준 권한이 더해진다."""
    if user.role is None:
        return set()
    if user.role.name == SYSTEM_ADMIN:
        return set(ALL_PERMISSIONS)
    perms = role_permissions(user.role)
    if project is not None and can_manage_project(db, project, user):
        pms = db.query(Role).filter_by(name=PROJECT_MANAGER).first()
        perms = perms | role_permissions(pms)
    return perms


def has_perm(db: Session, user: User, perm: str, project: Project | None = None) -> bool:
    return perm in effective_permissions(db, user, project)


def require_perm(db: Session, user: User, perm: str, project: Project | None = None) -> None:
    if not has_perm(db, user, perm, project):
        label = PERMISSIONS.get(perm, {}).get("label", perm)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"권한이 없습니다. '{label}' 권한이 필요합니다.",
        )


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