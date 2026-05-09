from datetime import datetime, timedelta, timezone
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import (
    RequestContext,
    get_current_membership,
    get_current_user,
    get_request_context,
    get_token_payload,
)
from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token, verify_password, get_password_hash
from app.models.impersonation_audit import ImpersonationAudit
from app.models.tenant import Tenant
from app.models.tenant_feature import TenantFeature
from app.models.user import User, UserTenant

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    tenant_slug: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    impersonated: bool = False


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


def get_token_expire_minutes() -> int:
    return int(getattr(settings, "ACCESS_TOKEN_EXPIRE_MINUTES", 480))


@router.get("/ping")
def ping():
    return {"message": "auth ok"}


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.execute(
        select(User).where(User.email == payload.email)
    ).scalar_one_or_none()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    if not user.is_active or user.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
        )

    membership = None
    tenant_slug = (payload.tenant_slug or "").strip().lower()

    if tenant_slug:
        tenant = db.execute(
            select(Tenant).where(Tenant.slug == tenant_slug)
        ).scalar_one_or_none()

        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tenant not found",
            )

        membership = db.execute(
            select(UserTenant).where(
                UserTenant.user_id == user.id,
                UserTenant.tenant_id == tenant.id,
            )
        ).scalar_one_or_none()

        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User has no membership for this tenant",
            )
    else:
        membership = db.execute(
            select(UserTenant)
            .where(UserTenant.user_id == user.id)
            .order_by(UserTenant.is_default.desc(), UserTenant.created_at.asc())
        ).scalars().first()

        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User has no tenant membership",
            )

    token_data = {
        "sub": str(user.id),
        "tenant_id": str(membership.tenant_id),
        "membership_id": str(membership.id),
        "role": membership.role,
        "impersonated": False,
    }

    access_token = create_access_token(
        token_data,
        expires_delta=timedelta(minutes=get_token_expire_minutes()),
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        impersonated=False,
    )


@router.get("/me")
def me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_membership: UserTenant = Depends(get_current_membership),
    token_payload: dict = Depends(get_token_payload),
):
    tenant = db.execute(
        select(Tenant).where(Tenant.id == current_membership.tenant_id)
    ).scalar_one_or_none()

    features = db.execute(
        select(TenantFeature.feature_key).where(
            TenantFeature.tenant_id == current_membership.tenant_id,
            TenantFeature.enabled.is_(True),
        )
    ).scalars().all()

    tenant_default_language = getattr(tenant, "default_language", None) or "es"
    preferred_language = getattr(current_user, "preferred_language", None)
    effective_language = preferred_language or tenant_default_language or "es"

    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "full_name": f"{current_user.first_name} {current_user.last_name}".strip(),
        "is_active": current_user.is_active,
        "is_superuser": current_user.is_superuser,
        "must_change_password": getattr(current_user, "must_change_password", False),

        "tenant_id": str(current_membership.tenant_id),
        "tenant_name": tenant.name if tenant else None,
        "tenant_logo_url": tenant.logo_url if tenant else None,
        "tenant_primary_color": tenant.primary_color if tenant else None,
        
        "tenant_plan": (
            tenant.plan_code
            if tenant and tenant.plan_code
            else "PRO"
        ),

        "tenant_plan_label": {
            "BASIC": "DressFlow Basic",
            "PRO": "DressFlow Pro",
            "PREMIUM": "DressFlow Premium",
        }.get(
            tenant.plan_code if tenant else "PRO",
            "DressFlow Pro",
        ),

        "tenant_default_language": tenant_default_language,
        "preferred_language": preferred_language,
        "effective_language": effective_language,

        "membership_id": str(current_membership.id),
        "role": current_membership.role,
        "features": list(features),

        "impersonated": bool(token_payload.get("impersonated", False)),
        "impersonated_by": token_payload.get("impersonated_by"),
        "original_sub": token_payload.get("original_sub"),
        "original_sub": token_payload.get("original_sub"),
        "impersonation_audit_id": token_payload.get("impersonation_audit_id"),
    }


@router.post("/impersonate/{membership_id}", response_model=TokenResponse)
def impersonate(
    membership_id: str,
    db: Session = Depends(get_db),
    ctx: RequestContext = Depends(get_request_context),
):
    allowed_roles = {"owner", "admin", "superadmin"}

    if (
        not ctx.is_superuser
        and (ctx.role or "").lower() not in allowed_roles
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to impersonate",
        )

    try:
        membership_uuid = uuid.UUID(str(membership_id))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid membership id",
        )

    target_membership = db.execute(
        select(UserTenant).where(UserTenant.id == membership_uuid)
    ).scalar_one_or_none()

    if not target_membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target membership not found",
        )

    target_user = db.execute(
        select(User).where(User.id == target_membership.user_id)
    ).scalar_one_or_none()

    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target user not found",
        )

    if not target_user.is_active or target_user.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Target user is inactive",
        )

    if target_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot impersonate a superuser",
        )

    if (
        str(target_user.id) == str(ctx.user.id)
        and str(target_membership.id) == str(ctx.membership.id)
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot impersonate your own current session",
        )

    if not ctx.is_superuser:
        if str(target_membership.tenant_id) != str(ctx.membership.tenant_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cross-tenant impersonation is not allowed",
            )

    audit = ImpersonationAudit(
        actor_user_id=ctx.user.id,
        actor_membership_id=ctx.membership.id,
        target_user_id=target_user.id,
        target_membership_id=target_membership.id,
        target_tenant_id=target_membership.tenant_id,
        started_at=datetime.now(timezone.utc),
        ended_at=None,
        is_active=True,
        reason=None,
    )
    db.add(audit)
    db.flush()

    original_sub = ctx.original_sub or str(ctx.user.id)
    impersonated_by = ctx.impersonated_by or str(ctx.user.id)

    token_data = {
        "sub": str(target_user.id),
        "tenant_id": str(target_membership.tenant_id),
        "membership_id": str(target_membership.id),
        "role": target_membership.role,
        "impersonated": True,
        "impersonated_by": str(impersonated_by),
        "original_sub": str(original_sub),
        "original_membership_id": str(ctx.membership.id),
        "original_tenant_id": str(ctx.membership.tenant_id),
        "impersonation_audit_id": str(audit.id),
    }

    access_token = create_access_token(
        token_data,
        expires_delta=timedelta(minutes=get_token_expire_minutes()),
    )

    db.commit()

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        impersonated=True,
    )


@router.post("/exit-impersonation", response_model=TokenResponse)
def exit_impersonation(
    db: Session = Depends(get_db),
    token_payload: dict = Depends(get_token_payload),
):
    if not token_payload.get("impersonated"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session is not impersonated",
        )

    original_sub = token_payload.get("original_sub")
    original_membership_id = token_payload.get("original_membership_id")
    impersonation_audit_id = token_payload.get("impersonation_audit_id")

    if not original_sub or not original_membership_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Original session data not found in token",
        )

    try:
        original_user_uuid = uuid.UUID(str(original_sub))
        original_membership_uuid = uuid.UUID(str(original_membership_id))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid original session data",
        )

    original_user = db.execute(
        select(User).where(User.id == original_user_uuid)
    ).scalar_one_or_none()

    if not original_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Original user not found",
        )

    if not original_user.is_active or original_user.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Original user is inactive",
        )

    original_membership = db.execute(
        select(UserTenant).where(UserTenant.id == original_membership_uuid)
    ).scalar_one_or_none()

    if not original_membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Original membership not found",
        )

    if impersonation_audit_id:
        try:
            audit_uuid = uuid.UUID(str(impersonation_audit_id))
            audit = db.execute(
                select(ImpersonationAudit).where(ImpersonationAudit.id == audit_uuid)
            ).scalar_one_or_none()

            if audit and audit.is_active:
                audit.is_active = False
                audit.ended_at = datetime.now(timezone.utc)
        except ValueError:
            pass

    token_data = {
        "sub": str(original_user.id),
        "tenant_id": str(original_membership.tenant_id),
        "membership_id": str(original_membership.id),
        "role": original_membership.role,
        "impersonated": False,
    }

    access_token = create_access_token(
        token_data,
        expires_delta=timedelta(minutes=get_token_expire_minutes()),
    )

    db.commit()

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        impersonated=False,
    )


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Invalid current password")

    current_user.password_hash = get_password_hash(payload.new_password)
    current_user.must_change_password = False

    db.commit()

    return {"message": "Password updated"}
