"""오늘의 챌린지를 백엔드 주기로 맞춘다."""
from __future__ import annotations

import asyncio
import logging

from app.core.config import settings
from app.core.database import SessionLocal
from datetime import datetime, timedelta

from app.services.ai_service import generate_all_daily_reports, generate_all_user_challenges

log = logging.getLogger(__name__)


def run_challenge_sync() -> None:
    db = SessionLocal()
    try:
        generate_all_user_challenges(db)
        # 일일 리포트도 같은 주기로 자동 생성한다(사용자가 버튼을 누르지 않아도 오늘 리포트가 있게).
        # KST 07시 이전에는 전날 마감 정리가 끝난 상태라 굳이 다시 만들지 않는다.
        kst_hour = (datetime.utcnow() + timedelta(hours=9)).hour
        if kst_hour >= 7:
            n = generate_all_daily_reports(db)
            log.info("일일 리포트 자동 생성 %s건", n)
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
