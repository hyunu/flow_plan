from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Flow Plan"
    debug: bool = False
    # 로컬 SQLite DB는 backend/data/ 폴더에서 관리 (test는 DATABASE_URL 오버라이드)
    database_url: str = "sqlite:///./data/flow_plan.db"
    # 개발: 빈 DB면 데모 계정·프로젝트 자동 생성. 설치본은 SEED_ON_STARTUP=false.
    seed_on_startup: bool = True

    # JWT
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30  # 짧은 만료 시간(§43.1)
    refresh_token_expire_days: int = 7

    # AI Provider
    ai_provider: str = "openai"  # openai | anthropic | clova | gemini | mock
    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-3-5-haiku-latest"
    clova_api_key: str | None = None
    clova_gateway_url: str | None = None
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-3.6-flash"
    ai_timeout_seconds: int = 60

    # 오늘의 챌린지: 백엔드가 전 사용자 대상으로 다시 만드는 주기(분). 최소 5분.
    challenge_sync_minutes: int = 60


settings = Settings()