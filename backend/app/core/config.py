import os
import json
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def resolve_env_file() -> str:
    """
    Orden de prioridad:

    1. ENV_FILE explícito:
       ENV_FILE=.env.staging.backend uvicorn app.main:app --reload

    2. ENVIRONMENT:
       ENVIRONMENT=staging uvicorn app.main:app --reload

    3. Default:
       .env
    """

    explicit_env_file = os.getenv("ENV_FILE")
    if explicit_env_file:
        return explicit_env_file

    environment = os.getenv("ENVIRONMENT", "development").lower().strip()

    env_file_map = {
        "development": ".env",
        "dev": ".env",
        "local": ".env",
        "staging": ".env.staging.backend",
        "test": ".env.test",
        "production": ".env",
        "prod": ".env",
    }

    return env_file_map.get(environment, ".env")


class Settings(BaseSettings):
    database_url: str
    secret_key: str
    environment: str = "development"
    access_token_expire_minutes: int = 1440

    cors_origins: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value):
        if isinstance(value, str):
            value = value.strip()

            if not value:
                return []

            if value.startswith("["):
                return json.loads(value)

            return [item.strip() for item in value.split(",") if item.strip()]

        return value

    model_config = SettingsConfigDict(
        env_file=resolve_env_file(),
        extra="ignore",
    )


settings = Settings()
