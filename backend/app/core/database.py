import os
from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings

connect_args = {}
if settings.database_url.startswith("sqlite"):
    connect_args["check_same_thread"] = False
    # SQLite 파일의 상위 폴더가 없으면 자동 생성 (예: data/)
    db_path = settings.database_url.replace("sqlite:///", "", 1)
    if db_path and db_path != ":memory:":
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(settings.database_url, connect_args=connect_args, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def ensure_schema():
    """기존 DB(모델 변경분)에 누락 컬럼을 안전하게 추가한다. 신규 DB는 create_all이 처리."""
    insp = inspect(engine)
    if "roles" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("roles")}
    if "permissions" not in cols:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE roles ADD COLUMN permissions TEXT"))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()