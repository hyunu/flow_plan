from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import api_router
from app.core.audit_context import get_pending_ids, get_request_meta, reset
from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
from app import models  # noqa: F401  (모델 등록)

Base.metadata.create_all(bind=engine)

# 첫 실행 시 DB가 비어 있으면 시드 데이터 자동 생성 (멱등)
if settings.seed_on_startup:
    from app.core.database import SessionLocal as _SL
    from app.seed import seed as _seed

    _seed(_SL())

app = FastAPI(
    title=settings.app_name,
    version="0.2.0",
    description="AI 기반 프로젝트 일정·진척 관리 시스템 API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def audit_context_middleware(request, call_next):
    """요청 메타데이터(IP/UA/Method/Path/User)를 Audit 컨텍스트에 기록.

    응답 완료 후 Audit Log의 result(HTTP 상태)를 일괄 반영한다.
    """
    reset()
    meta = {
        "method": request.method,
        "path": request.url.path,
        "ip": request.client.host if request.client else "unknown",
        "user_agent": (request.headers.get("user-agent") or "")[:250],
    }
    get_request_meta().update(meta)
    request.state.user_id = None

    # Bearer 토큰에서 user_id 추출(Rate Limit key용, 검증은 각 엔드포인트가 수행)
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        try:
            from jose import jwt as _jwt

            payload = _jwt.decode(auth[7:], settings.secret_key, algorithms=[settings.algorithm])
            if payload.get("type") == "access":
                request.state.user_id = int(payload.get("sub", 0))
        except Exception:
            pass

    try:
        response = await call_next(request)
    except Exception as exc:  # 500으로 응답되는 경우에도 result 기록
        response = None
        raise exc
    finally:
        pending = get_pending_ids()
        if pending:
            db = SessionLocal()
            try:
                for log_id in pending:
                    log = db.get(models.AuditLog, log_id)
                    if log and log.result is None:
                        log.result = response.status_code if response is not None else 500
                db.commit()
            except Exception:
                db.rollback()
            finally:
                db.close()
    return response


app.include_router(api_router)


@app.get("/health")
def health():
    return {"status": "ok", "app": settings.app_name}