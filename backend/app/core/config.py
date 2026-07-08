import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "GeoColleges Douala IV API"
    DATABASE_URL: str = os.environ.get(
        "DATABASE_URL",
        "postgresql://geocolleges:geocolleges@localhost:5432/geocolleges",
    )
    SECRET_KEY: str = os.environ.get("SECRET_KEY", "change-me-in-production-please")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8
    ANTHROPIC_API_KEY: str | None = os.environ.get("ANTHROPIC_API_KEY")
    DEEPSEEK_API_KEY: str | None = os.environ.get("DEEPSEEK_API_KEY")
    DEEPSEEK_BASE_URL: str = os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
    DEEPSEEK_MODEL: str = os.environ.get("DEEPSEEK_MODEL", "deepseek-chat")
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000", "http://frontend:80"]
    CORS_EXTRA_ORIGINS: str = ""  # URLs supplémentaires séparées par des virgules (ex: Vercel)

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
