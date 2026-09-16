from datetime import datetime, timedelta, timezone
from typing import Optional
import uuid

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
    # Settings exige SECRET_KEY/secret_key. No usamos un secreto fallback conocido:
    # si la configuración falta, es preferible que la aplicación no pueda firmar JWT.
    secret = str(settings.secret_key or "").strip()
    if not secret:
        raise RuntimeError("SECRET_KEY is required for JWT signing")
    return secret


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(hours=8))
    to_encode.update(
        {
            "exp": expire,
            "iat": now,
            "jti": str(uuid.uuid4()),
        }
    )
    return jwt.encode(to_encode, get_jwt_secret(), algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, get_jwt_secret(), algorithms=[ALGORITHM])
