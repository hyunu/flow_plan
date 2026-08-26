"""Rate Limit 모듈(§43.9).

사용자/IP/API 종류 기준으로 확장 가능한 구조.
기본 구현은 인메모리 슬라이딩 윈도우(단일 프로세스 용).
운영/멀티프로세스 환경에서는 Redis 등 공유 저장소 구현으로 교체 가능하도록
Backend 인터페이스로 분리한다.
"""
from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status


class RateLimitBackend:
    def hit(self, key: str, window_seconds: int, limit: int) -> tuple[bool, int, int]:
        """현재 호출을 기록하고 (허용 여부, 현재 호출 수, 남은 시간) 반환."""
        raise NotImplementedError


class InMemoryRateLimitBackend(RateLimitBackend):
    """슬라이딩 윈도우(초 단위) 인메모리 구현."""

    def __init__(self):
        self._locks: dict[str, threading.Lock] = defaultdict(threading.Lock)
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def reset(self) -> None:
        self._hits.clear()

    def hit(self, key: str, window_seconds: int, limit: int) -> tuple[bool, int, int]:
        with self._locks[key]:
            now = time.monotonic()
            q = self._hits[key]
            while q and q[0] < now - window_seconds:
                q.popleft()
            if len(q) >= limit:
                oldest = q[0] if q else now
                retry_after = int(window_seconds - (now - oldest)) + 1
                return False, len(q), retry_after
            q.append(now)
            return True, len(q) + 1, 0


_backend: RateLimitBackend = InMemoryRateLimitBackend()


def set_rate_limit_backend(backend: RateLimitBackend) -> None:
    global _backend
    _backend = backend


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit(limit: int, window_seconds: int, scope: str = "general"):
    """FastAPI dependency: scope(예: login, ai, report)별로 제한을 적용한다.

    key = f"{scope}:{ip}[:{user_id}]"
    """

    def dependency(request: Request) -> None:
        user_id = request.headers.get("x-user-id") or getattr(request.state, "user_id", None)
        ip = _client_ip(request)
        key = f"{scope}:{ip}" + (f":{user_id}" if user_id else "")
        allowed, current, retry_after = _backend.hit(key, window_seconds, limit)
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
                headers={"Retry-After": str(retry_after)},
            )

    return dependency