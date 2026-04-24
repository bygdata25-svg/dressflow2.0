import uuid
from collections.abc import Callable
from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User, UserTenant

security = HTTPBearer()


@dataclass
class RequestContext:
    user: User
    membership: UserTenant
    tenant_id: str
    membership_id: str
    role: str
    is_superuser: bool
    impersonated: bool
    impersonated_by: str | None
    original_sub: str | None


def get_token_payload(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    token = credentials.credentials
    try:
        payload = decode_access_token(token)
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


def get_current_user(
    db: Session = Depends(get_db),
    token_payload: dict = Depends(get_token_payload),
):
    user_id = token_payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject",
        )

    try:
        user_uuid = uuid.UUID(str(user_id))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user id in token",
        )

    user = db.execute(
        select(User).where(User.id == user_uuid)
    ).scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    if not user.is_active or user.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inactive user",
        )

    return user


def get_current_membership(
    db: Session = Depends(get_db),
    token_payload: dict = Depends(get_token_payload),
):
    membership_id = token_payload.get("membership_id")
    tenant_id = token_payload.get("tenant_id")

    if not membership_id or not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing membership context",
        )

    try:
        membership_uuid = uuid.UUID(str(membership_id))
        tenant_uuid = uuid.UUID(str(tenant_id))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid membership context in token",
        )

    membership = db.execute(
        select(UserTenant).where(
            UserTenant.id == membership_uuid,
            UserTenant.tenant_id == tenant_uuid,
        )
    ).scalar_one_or_none()

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Membership not found",
        )

    return membership


def get_request_context(
    current_user: User = Depends(get_current_user),
    current_membership: UserTenant = Depends(get_current_membership),
    token_payload: dict = Depends(get_token_payload),
) -> RequestContext:
    return RequestContext(
        user=current_user,
        membership=current_membership,
        tenant_id=str(current_membership.tenant_id),
        membership_id=str(current_membership.id),
        role=current_membership.role or "",
        is_superuser=bool(current_user.is_superuser),
        impersonated=bool(token_payload.get("impersonated", False)),
        impersonated_by=token_payload.get("impersonated_by"),
        original_sub=token_payload.get("original_sub"),
    )


def require_roles(*allowed_roles: str) -> Callable:
    normalized_roles = {role.lower() for role in allowed_roles}

    def dependency(
        current_user: User = Depends(get_current_user),
        current_membership: UserTenant = Depends(get_current_membership),
    ) -> UserTenant:
        if current_user.is_superuser:
            return current_membership

        current_role = (current_membership.role or "").lower()

        if current_role not in normalized_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions",
            )

        return current_membership

    return dependency

def require_superuser(user: User = Depends(get_current_user)) -> User:
    if not user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized")
    return user
