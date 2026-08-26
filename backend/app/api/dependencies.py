from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.permissions import audit, get_project_or_403
from app.core.security import get_current_user
from app.models.entities import Task, TaskDependency, User
from app.schemas import DependencyCreate, DependencyRead
from app.services.schedule_service import apply_engine_progress

router = APIRouter(prefix="/dependencies", tags=["dependencies"])


@router.get("/project/{project_id}", response_model=list[DependencyRead])
def list_dependencies(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = get_project_or_403(db, project_id, user)
    dep_ids = db.query(Task.id).filter_by(project_id=project.id, is_deleted=False)
    return db.query(TaskDependency).filter(
        TaskDependency.predecessor_id.in_(dep_ids), TaskDependency.successor_id.in_(dep_ids)
    ).all()


@router.post("", response_model=DependencyRead)
def create_dependency(body: DependencyCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    pred = db.get(Task, body.predecessor_id)
    succ = db.get(Task, body.successor_id)
    if not pred or not succ:
        raise HTTPException(status_code=404, detail="Task를 찾을 수 없습니다.")
    if pred.project_id != succ.project_id:
        raise HTTPException(status_code=400, detail="같은 프로젝트의 Task만 연결할 수 있습니다.")
    project = get_project_or_403(db, pred.project_id, user, require_manage=True)
    if pred.id == succ.id:
        raise HTTPException(status_code=400, detail="자기 자신에 의존할 수 없습니다.")
    existing = db.query(TaskDependency).filter_by(predecessor_id=pred.id, successor_id=succ.id).first()
    if existing:
        raise HTTPException(status_code=409, detail="이미 존재하는 의존성입니다.")
    dep = TaskDependency(
        predecessor_id=pred.id, successor_id=succ.id,
        dependency_type=body.dependency_type, lag_days=body.lag_days, created_by=user.id,
    )
    db.add(dep)
    db.flush()
    # 사이클 감지: 실패 시 409
    try:
        apply_engine_progress(db, project)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail=f"의존성 사이클이 발생합니다: {exc}") from exc
    audit(db, user.id, "create", "TaskDependency", dep.id, reason=f"{pred.id}->{succ.id}")
    db.commit()
    db.refresh(dep)
    return dep


@router.delete("/{dep_id}")
def delete_dependency(dep_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    dep = db.get(TaskDependency, dep_id)
    if not dep:
        raise HTTPException(status_code=404, detail="의존성을 찾을 수 없습니다.")
    pred = db.get(Task, dep.predecessor_id)
    if pred is None:
        raise HTTPException(status_code=404, detail="선행 Task를 찾을 수 없습니다.")
    project = get_project_or_403(db, pred.project_id, user, require_manage=True)
    audit(db, user.id, "delete", "TaskDependency", dep.id)
    db.delete(dep)
    db.commit()
    apply_engine_progress(db, pred.project)
    return {"message": "deleted"}