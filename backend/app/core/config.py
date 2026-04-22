from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
from pydantic import field_validator
import json


class Settings(BaseSettings):
    database_url: str
    secret_key: str
    environment: str = "development"
    access_token_expire_minutes: int = 1440

    cors_origins: List[str] = ["http://localhost:5173"]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            v = v.strip()

            if not v:
                return []

            # caso JSON: ["url1","url2"]
            if v.startswith("["):
                return json.loads(v)

            # caso simple: url1,url2
            return [item.strip() for item in v.split(",") if item.strip()]

        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )


settings = Settings()
