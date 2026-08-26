from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.permissions import audit
from app.core.security import SYSTEM_ADMIN, hash_password, require_role
from app.models.entities import Role, User, UserCalendar
from app.schemas import UserCreate, UserRead, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


def _to_read(user: User) -> UserRead:
    data = UserRead.model_validate(user)
    data.role_name = user.role.name if user.role else None
    return data


@router.get("", response_model=list[UserRead])
def list_users(db: Session = Depends(get_db), _: User = Depends(require_role(SYSTEM_ADMIN))):
    users = db.query(User).options(joinedload(User.role)).order_by(User.id).all()
    return [_to_read(u) for u in users]


@router.post("", response_model=UserRead)
def create_user(body: UserCreate, db: Session = Depends(get_db), admin: User = Depends(require_role(SYSTEM_ADMIN))):
    if db.query(User).filter((User.username == body.username) | (User.email == body.email)).first():
        raise HTTPException(status_code=400, detail="이미 존재하는 아이디 또는 이메일입니다.")
    user = User(
        username=body.username,
        email=body.email,
        name=body.name,
        hashed_password=hash_password(body.password),
        role_id=body.role_id,
    )
    db.add(user)
    db.flush()
    db.add(UserCalendar(user_id=user.id, daily_work_hours=8.0))
    audit(db, admin.id, "create", "User", user.id, reason="사용자 생성")
    db.commit()
    db.refresh(user)
    return _to_read(user)


@router.get("/{user_id}", response_model=UserRead)
def get_user(user_id: int, db: Session = Depends(get_db), _: User = Depends(require_role(SYSTEM_ADMIN))):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    return _to_read(user)


@router.put("/{user_id}", response_model=UserRead)
def update_user(
    user_id: int,
    body: UserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role(SYSTEM_ADMIN)),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    before = user.username
    if body.email is not None:
        user.email = body.email
    if body.name is not None:
        user.name = body.name
    if body.password:
        user.hashed_password = hash_password(body.password)
    if body.role_id is not None:
        user.role_id = body.role_id
    if body.is_active is not None:
        user.is_active = body.is_active
    if body.profile is not None:
        user.profile = body.profile
    audit(db, admin.id, "update", "User", user.id, before=before, after=user.username, reason="사용자 수정")
    db.commit()
    db.refresh(user)
    return _to_read(user)


@router.get("/roles", response_model=list)
def list_roles(db: Session = Depends(get_db), _: User = Depends(require_role(SYSTEM_ADMIN))):
    return [{"id": r.id, "name": r.name, "description": r.description} for r in db.query(Role).all()]