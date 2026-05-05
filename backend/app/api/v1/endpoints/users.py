from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Literal
from app.api.deps import get_current_user

from app.api.deps import require_roles, get_current_membership
from app.core.database import get_db
from app.core.exceptions import AppException
from app.core.security import get_password_hash
from app.models.user import User, UserTenant
from app.schemas.user import UserCreate, UserResponse, UserUpdate
from app.services.audit_service import create_audit_log

router = APIRouter(prefix="/users", tags=["users"])

class UserPreferencesUpdate(BaseModel):
    preferred_language: Literal["es", "en"] | None = None

@router.get("", response_model=list[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    membership=Depends(get_current_membership),
):
    rows = db.execute(
        select(User, UserTenant.role)
        .join(UserTenant, UserTenant.user_id == User.id)
        .where(UserTenant.tenant_id == membership.tenant_id)
    ).all()

    return [
        UserResponse(
            id=user.id,
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            role=role,
            is_active=user.is_active,
        )
        for user, role in rows
    ]


@router.post("", response_model=UserResponse)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    membership=Depends(get_current_membership),
):
    user = User(
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        first_name=payload.first_name,
        last_name=payload.last_name,
    )

    db.add(user)
    db.flush()

    user_tenant = UserTenant(
        user_id=user.id,
        tenant_id=membership.tenant_id,
        role=payload.role,
        is_default=True,
    )

    db.add(user_tenant)
    db.commit()

    return UserResponse(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        role=payload.role,
        is_active=user.is_active,
    )


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: UUID,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    membership=Depends(get_current_membership),
):
    user = db.get(User, user_id)

    if not user or user.deleted_at is not None:
        raise AppException(
            status_code=404,
            message="User not found",
            code="USER_NOT_FOUND",
        )

    user.first_name = payload.first_name
    user.last_name = payload.last_name
    user.is_active = payload.is_active

    ut = db.execute(
        select(UserTenant).where(
            UserTenant.user_id == user_id,
            UserTenant.tenant_id == membership.tenant_id,
        )
    ).scalar_one_or_none()

    if not ut:
        raise AppException(
            status_code=404,
            message="User membership not found",
            code="USER_MEMBERSHIP_NOT_FOUND",
        )

    ut.role = payload.role

    db.commit()

    return UserResponse(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        role=payload.role,
        is_active=user.is_active,
    )


@router.post("/{user_id}/reset-password")
def reset_user_password(
    user_id: UUID,
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager")),
):
    user = db.execute(
        select(User)
        .join(UserTenant, UserTenant.user_id == User.id)
        .where(
            User.id == user_id,
            UserTenant.tenant_id == membership.tenant_id,
            User.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not user:
        raise AppException(
            status_code=404,
            message="User not found",
            code="USER_NOT_FOUND",
        )

    temporary_password = "123456"

    user.password_hash = get_password_hash(temporary_password)
    user.must_change_password = True

    create_audit_log(
        db=db,
        tenant_id=membership.tenant_id,
        user_id=membership.user_id,
        entity_type="user",
        entity_id=user.id,
        action="reset_password",
        payload={
            "email": user.email,
        },
    )

    db.commit()

    return {
        "message": "Password reset",
        "temporary_password": temporary_password,
    }

@router.patch("/me/preferences")
def update_my_preferences(
    payload: UserPreferencesUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.preferred_language = payload.preferred_language

    db.commit()
    db.refresh(current_user)

    return {
        "ok": True,
        "preferred_language": current_user.preferred_language,
    }
