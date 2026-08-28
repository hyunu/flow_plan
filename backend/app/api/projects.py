from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.permissions import (
    SYSTEM_ADMIN,
    audit,
    get_project_or_403,
    require_perm,
)
from app.core.security import get_current_user
from app.models.entities import (
    Group,
    Project,
    ProjectCalendar,
    ProjectMember,
    User,
)
from app.schemas import (
    ProjectCreate,
    ProjectDetail,
    ProjectMemberCreate,
    ProjectMemberRead,
    ProjectRead,
    ProjectUpdate,
)

router = APIRouter(prefix="/projects", tags=["projects"])


def _project_read(p: Project, user: User, db: Session) -> ProjectRead:
    return ProjectRead.model_validate(p)


@router.get("", response_model=list[ProjectRead])
def list_projects(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    query = db.query(Project).filter(Project.is_deleted.is_(False))
    role_name = user.role.name if user.role else ""
    if role_name != SYSTEM_ADMIN:
        # 일반 사용자/PM: 자신이 참여한 프로젝트만
        member_ids = db.query(ProjectMember.project_id).filter(ProjectMember.user_id == user.id)
        query = query.filter((Project.id.in_(member_ids)) | (Project.manager_id == user.id))
    projects = query.order_by(Project.id).all()
    return [_project_read(p, user, db) for p in projects]


@router.post("", response_model=ProjectRead)
def create_project(
    body: ProjectCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_perm(db, user, "project.create")
    project = Project(name=body.name, description=body.description, manager_id=body.manager_id or user.id)
    db.add(project)
    db.flush()
    db.add(ProjectCalendar(project_id=project.id, daily_work_hours=8.0, work_days="0,1,2,3,4"))
    audit(db, user.id, "create", "Project", project.id, reason="프로젝트 생성")
    db.commit()
    db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectDetail)
def get_project(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = get_project_or_403(db, project_id, user)
    detail = ProjectDetail.model_validate(project)
    detail.members = [
        ProjectMemberRead(
            id=m.id,
            project_id=m.project_id,
            user_id=m.user_id,
            role_in_project=m.role_in_project,
            user_name=m.user.name if m.user else None,
        )
        for m in db.query(ProjectMember).filter_by(project_id=project.id).options(joinedload(ProjectMember.user)).all()
    ]
    return detail


@router.put("/{project_id}", response_model=ProjectRead)
def update_project(
    project_id: int,
    body: ProjectUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = get_project_or_403(db, project_id, user)
    require_perm(db, user, "project.edit", project)
    before = project.name
    if body.name is not None:
        project.name = body.name
    if body.description is not None:
        project.description = body.description
    if body.manager_id is not None:
        project.manager_id = body.manager_id
    if body.status is not None:
        project.status = body.status
    audit(db, user.id, "update", "Project", project.id, before=before, after=project.name)
    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = get_project_or_403(db, project_id, user)
    require_perm(db, user, "project.delete", project)
    project.is_deleted = True  # Soft delete
    audit(db, user.id, "delete", "Project", project.id, reason="프로젝트 삭제(soft)")
    db.commit()
    return {"message": "deleted"}


# ---------- Members ----------
@router.get("/{project_id}/members", response_model=list[ProjectMemberRead])
def list_members(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = get_project_or_403(db, project_id, user)
    return [
        ProjectMemberRead(
            id=m.id, project_id=m.project_id, user_id=m.user_id, role_in_project=m.role_in_project,
            user_name=m.user.name if m.user else None,
        )
        for m in db.query(ProjectMember).filter_by(project_id=project.id).options(joinedload(ProjectMember.user)).all()
    ]


@router.post("/{project_id}/members", response_model=ProjectMemberRead)
def add_member(
    project_id: int,
    body: ProjectMemberCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = get_project_or_403(db, project_id, user)
    require_perm(db, user, "project.manage_members", project)
    member = db.query(ProjectMember).filter_by(project_id=project.id, user_id=body.user_id).first()
    if member:
        member.role_in_project = body.role_in_project
    else:
        member = ProjectMember(project_id=project.id, user_id=body.user_id, role_in_project=body.role_in_project)
        db.add(member)
    audit(db, user.id, "add_member", "ProjectMember", member.id, after=f"user={body.user_id}")
    db.commit()
    db.refresh(member)
    return ProjectMemberRead(
        id=member.id, project_id=member.project_id, user_id=member.user_id,
        role_in_project=member.role_in_project,
        user_name=db.get(User, member.user_id).name if db.get(User, member.user_id) else None,
    )


@router.delete("/{project_id}/members/{user_id}")
def remove_member(project_id: int, user_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = get_project_or_403(db, project_id, user)
    require_perm(db, user, "project.manage_members", project)
    member = db.query(ProjectMember).filter_by(project_id=project.id, user_id=user_id).first()
    if member:
        audit(db, user.id, "remove_member", "ProjectMember", member.id, reason=f"remove user={user_id}")
        db.delete(member)
        db.commit()
    return {"message": "removed"}