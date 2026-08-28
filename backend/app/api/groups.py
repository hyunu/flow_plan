from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.permissions import audit, get_project_or_403, require_perm
from app.core.security import get_current_user
from app.models.entities import Group, User
from app.schemas import GroupCreate, GroupRead, GroupUpdate

router = APIRouter(prefix="/groups", tags=["groups"])


@router.get("/project/{project_id}", response_model=list[GroupRead])
def list_groups(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = get_project_or_403(db, project_id, user)
    return db.query(Group).filter_by(project_id=project.id).order_by(Group.sort_order, Group.id).all()


@router.post("", response_model=GroupRead)
def create_group(body: GroupCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = get_project_or_403(db, body.project_id, user)
    require_perm(db, user, "group.manage", project)
    group = Group(project_id=project.id, name=body.name, description=body.description, sort_order=body.sort_order)
    db.add(group)
    audit(db, user.id, "create", "Group", group.id, reason="Group 생성")
    db.commit()
    db.refresh(group)
    return group


@router.put("/{group_id}", response_model=GroupRead)
def update_group(group_id: int, body: GroupUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    group = db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group을 찾을 수 없습니다.")
    project = get_project_or_403(db, group.project_id, user)
    require_perm(db, user, "group.manage", project)
    if body.name is not None:
        group.name = body.name
    if body.description is not None:
        group.description = body.description
    if body.sort_order is not None:
        group.sort_order = body.sort_order
    audit(db, user.id, "update", "Group", group.id)
    db.commit()
    db.refresh(group)
    return group


@router.delete("/{group_id}")
def delete_group(group_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    group = db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group을 찾을 수 없습니다.")
    project = get_project_or_403(db, group.project_id, user)
    require_perm(db, user, "group.manage", project)
    audit(db, user.id, "delete", "Group", group.id)
    db.delete(group)
    db.commit()
    return {"message": "deleted"}