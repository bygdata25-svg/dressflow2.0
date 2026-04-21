from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
ALGORITHM = "HS256"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def hash_password(password: str) -> str:
    return get_password_hash(password)


def get_jwt_secret() -> str:
    candidates = [
        getattr(settings, "SECRET_KEY", None),
        getattr(settings, "secret_key", None),
        getattr(settings, "JWT_SECRET", None),
        getattr(settings, "jwt_secret", None),
        getattr(settings, "AUTH_SECRET", None),
        getattr(settings, "auth_secret", None),
    ]

    for value in candidates:
        if value:
            return str(value)

    # fallback solo para desarrollo local
    return "dressflow-dev-secret-change-me"


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(hours=8))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, get_jwt_secret(), algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, get_jwt_secret(), algorithms=[ALGORITHM])
