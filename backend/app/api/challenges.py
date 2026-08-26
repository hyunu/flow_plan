from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.ratelimit import rate_limit
from app.core.security import get_current_user
from app.models.entities import Challenge, ChallengeResponse, User
from app.schemas import ChallengeRead, ChallengeResponseCreate, ChallengeResponseRead
from app.services.ai_service import generate_user_challenges

router = APIRouter(prefix="/challenges", tags=["challenges"])


@router.get("", response_model=list[ChallengeRead])
def list_my_challenges(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Challenge).filter_by(user_id=user.id).order_by(Challenge.created_at.desc()).all()


@router.post("/generate", response_model=list[ChallengeRead], dependencies=[Depends(rate_limit(10, 300, "ai"))])
def generate_challenges(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    challenges = generate_user_challenges(db, user)
    return challenges


@router.get("/{challenge_id}", response_model=ChallengeRead)
def get_challenge(challenge_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ch = db.get(Challenge, challenge_id)
    if not ch or ch.user_id != user.id:
        raise HTTPException(status_code=404, detail="Challenge를 찾을 수 없습니다.")
    return ch


@router.post("/{challenge_id}/response", response_model=ChallengeResponseRead)
def respond(challenge_id: int, body: ChallengeResponseCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ch = db.get(Challenge, challenge_id)
    if not ch or ch.user_id != user.id:
        raise HTTPException(status_code=404, detail="Challenge를 찾을 수 없습니다.")
    resp = ChallengeResponse(challenge_id=ch.id, user_id=user.id, response=body.response)
    db.add(resp)
    ch.status = "answered"
    db.commit()
    db.refresh(resp)
    return ChallengeResponseRead(id=resp.id, challenge_id=resp.challenge_id, user_id=resp.user_id, response=resp.response, created_at=resp.created_at)