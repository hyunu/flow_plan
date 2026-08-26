from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.entities import RefreshToken, Role, User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": str(user_id), "type": "access", "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def create_refresh_token(db: Session, user_id: int, ip_address: str | None = None) -> str:
    """Refresh Token 발급(회전/폐기 가능). DB에 해시로 저장한다."""
    raw = secrets.token_urlsafe(48)
    # SQLite는 tz 미지원 -> naive UTC로 저장해 비교 일관성 유지
    expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=settings.refresh_token_expire_days)
    db.add(
        RefreshToken(
            user_id=user_id,
            token_hash=_hash_token(raw),
            expires_at=expires_at,
            ip_address=ip_address,
        )
    )
    db.commit()
    return raw


def rotate_refresh_token(db: Session, raw_refresh: str, ip_address: str | None = None) -> tuple[str, str] | None:
    """기존 Refresh Token 검증 후 새 Access/Refresh Token 쌍을 발급(회전).

    유효하지 않으면 None 반환.
    """
    token = db.query(RefreshToken).filter_by(token_hash=_hash_token(raw_refresh)).first()
    if not token or token.revoked:
        return None
    if token.expires_at < datetime.now(timezone.utc).replace(tzinfo=None):
        token.revoked = True
        db.commit()
        return None
    user = db.get(User, token.user_id)
    if user is None or not user.is_active:
        return None
    # 회전: 기존 토큰 폐기, 새 토큰 발급
    token.revoked = True
    new_raw = create_refresh_token(db, user.id, ip_address)
    return create_access_token(user.id), new_raw


def revoke_user_refresh_tokens(db: Session, user_id: int) -> None:
    tokens = db.query(RefreshToken).filter_by(user_id=user_id, revoked=False).all()
    for t in tokens:
        t.revoked = True
    db.commit()


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="자격 증명이 유효하지 않습니다.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        if payload.get("type") != "access":
            raise credentials_error
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_error
    except JWTError:
        raise credentials_error
    user = db.get(User, int(user_id))
    if user is None or not user.is_active:
        raise credentials_error
    return user


def require_role(*roles: str):
    def checker(user: User = Depends(get_current_user)) -> User:
        role: Role | None = user.role
        if role is None or role.name not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="권한이 없습니다.")
        return user

    return checker


SYSTEM_ADMIN = "System Administrator"
PROJECT_MANAGER = "Project Manager"
PROJECT_MEMBER = "Project Member"