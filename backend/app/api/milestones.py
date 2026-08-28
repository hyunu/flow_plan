from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.permissions import audit, get_project_or_403, require_perm
from app.core.security import get_current_user
from app.models.entities import Milestone, User
from app.schemas import MilestoneCreate, MilestoneRead, MilestoneUpdate

router = APIRouter(prefix="/milestones", tags=["milestones"])


@router.get("/project/{project_id}", response_model=list[MilestoneRead])
def list_milestones(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = get_project_or_403(db, project_id, user)
    return db.query(Milestone).filter_by(project_id=project.id).order_by(Milestone.sort_order, Milestone.id).all()


@router.post("", response_model=MilestoneRead)
def create_milestone(body: MilestoneCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = get_project_or_403(db, body.project_id, user)
    require_perm(db, user, "milestone.manage", project)
    ms = Milestone(
        project_id=project.id, name=body.name, description=body.description, sort_order=body.sort_order,
        start_date=body.start_date, end_date=body.end_date, owner_id=body.owner_id,
    )
    db.add(ms)
    audit(db, user.id, "create", "Milestone", ms.id)
    db.commit()
    db.refresh(ms)
    return ms


@router.put("/{milestone_id}", response_model=MilestoneRead)
def update_milestone(milestone_id: int, body: MilestoneUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ms = db.get(Milestone, milestone_id)
    if not ms:
        raise HTTPException(status_code=404, detail="Milestone을 찾을 수 없습니다.")
    project = get_project_or_403(db, ms.project_id, user)
    require_perm(db, user, "milestone.manage", project)
    for field_name in ["name", "description", "sort_order", "start_date", "end_date", "progress", "status", "owner_id"]:
        val = getattr(body, field_name)
        if val is not None:
            setattr(ms, field_name, val)
    audit(db, user.id, "update", "Milestone", ms.id)
    db.commit()
    db.refresh(ms)
    return ms


@router.delete("/{milestone_id}")
def delete_milestone(milestone_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ms = db.get(Milestone, milestone_id)
    if not ms:
        raise HTTPException(status_code=404, detail="Milestone을 찾을 수 없습니다.")
    project = get_project_or_403(db, ms.project_id, user)
    require_perm(db, user, "milestone.manage", project)
    audit(db, user.id, "delete", "Milestone", ms.id)
    db.delete(ms)
    db.commit()
    return {"message": "deleted"}