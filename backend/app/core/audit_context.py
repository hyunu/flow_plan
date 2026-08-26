"""요청 컨텍스트(Audit용).

미들웨어가 요청 메타데이터(method/endpoint/IP/User-Agent)를 contextvar에 기록하면
permissions.audit()이 별도 파라미터 없이 이를 AuditLog에 채운다.
응답 완료 시 result(HTTP 상태)가 일괄 반영된다.
"""
from __future__ import annotations

from contextvars import ContextVar

request_meta: ContextVar[dict] = ContextVar("request_meta", default={})
pending_audit_ids: ContextVar[list[int]] = ContextVar("pending_audit_ids", default=[])


def get_request_meta() -> dict:
    return request_meta.get()


def get_pending_ids() -> list[int]:
    return pending_audit_ids.get()


def reset() -> None:
    request_meta.set({})
    pending_audit_ids.set([])