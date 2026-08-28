from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.permissions import audit, role_permissions
from app.core.ratelimit import rate_limit
from app.core.security import (
    create_access_token,
    create_refresh_token,
    get_current_user,
    revoke_user_refresh_tokens,
    rotate_refresh_token,
    verify_password,
)
from app.models.entities import User
from app.schemas import TokenResponse, UserRead

router = APIRouter(prefix="/auth", tags=["auth"])


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshRequest(BaseModel):
    refresh_token: str


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


@router.post("/login", response_model=TokenPair, dependencies=[Depends(rate_limit(20, 300, "login"))])
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    request: Request = None,
    db: Session = Depends(get_db),
):
    ip = _client_ip(request)
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        # 로그인 실패도 Audit Log에 기록(§43.10)
        audit(db, user.id if user else None, "login_failed", "Auth", reason=f"login failed: {form_data.username}", after=None)
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="아이디 또는 비밀번호가 올바르지 않습니다.")
    if not user.is_active:
        audit(db, user.id, "login_blocked", "Auth", reason="비활성 계정 로그인 시도")
        db.commit()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="비활성화된 계정입니다.")
    access = create_access_token(user.id)
    refresh = create_refresh_token(db, user.id, ip)
    audit(db, user.id, "login", "User", user.id, reason="로그인")
    db.commit()
    return TokenPair(access_token=access, refresh_token=refresh, expires_in=settings_expires_in_seconds())


def settings_expires_in_seconds() -> int:
    from app.core.config import settings

    return settings.access_token_expire_minutes * 60


@router.post("/refresh", response_model=TokenPair, dependencies=[Depends(rate_limit(30, 300, "token"))])
def refresh(body: RefreshRequest, request: Request = None, db: Session = Depends(get_db)):
    result = rotate_refresh_token(db, body.refresh_token, _client_ip(request))
    if result is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh Token이 유효하지 않거나 만료되었습니다.")
    access, new_refresh = result
    audit(db, None, "token_refresh", "Auth", reason="refresh token rotation")
    db.commit()
    return TokenPair(access_token=access, refresh_token=new_refresh, expires_in=settings_expires_in_seconds())


@router.get("/me", response_model=UserRead)
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    data = UserRead.model_validate(user)
    data.role_name = user.role.name if user.role else None
    data.permissions = sorted(role_permissions(user.role))
    return data


@router.post("/logout")
def logout(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    revoke_user_refresh_tokens(db, user.id)
    audit(db, user.id, "logout", "User", user.id, reason="로그아웃")
    db.commit()
    return {"message": "ok"}