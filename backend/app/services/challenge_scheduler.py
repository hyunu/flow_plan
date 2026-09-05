"""오늘의 챌린지를 백엔드 주기로 맞춘다."""
from __future__ import annotations

import asyncio
import logging

from app.core.config import settings
from app.core.database import SessionLocal
from app.services.ai_service import generate_all_user_challenges

log = logging.getLogger(__name__)


def run_challenge_sync() -> None:
    db = SessionLocal()
    try:
        generate_all_user_challenges(db)
        log.info("챌린지 주기 생성 완료")
    except Exception:
        log.exception("챌린지 주기 생성 실패")
        db.rollback()
    finally:
        db.close()


async def challenge_sync_loop(stop: asyncio.Event) -> None:
    minutes = max(5, int(settings.challenge_sync_minutes or 60))
    interval = minutes * 60
    while not stop.is_set():
        await asyncio.to_thread(run_challenge_sync)
        try:
            await asyncio.wait_for(stop.wait(), timeout=interval)
        except TimeoutError:
            continue
