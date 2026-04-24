from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.api.deps_superadmin import require_superuser
from app.core.database import get_db
from app.core.exceptions import AppException
from app.core.security import hash_password
from app.models.tenant import Tenant
from app.models.user import User, UserTenant
from app.schemas.superadmin import (
    SuperadminCreateTenantRequest,
    SuperadminTenantListItemResponse,
    SuperadminTenantResponse,
    SuperadminTenantWithAdminResponse,
)

from pydantic import BaseModel
from sqlalchemy import select
from app.models.tenant_feature import TenantFeature

router = APIRouter(prefix="/superadmin/tenants", tags=["superadmin-tenants"])


@router.get("")
def list_tenants(
    db: Session = Depends(get_db),
    current_user=Depends(require_superuser),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    base_query = select(Tenant).where(Tenant.deleted_at.is_(None))

    total = db.execute(
        select(func.count()).select_from(base_query.subquery())
    ).scalar_one()

    tenants = db.execute(
        base_query.order_by(Tenant.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).scalars().all()

    items = []

    for tenant in tenants:
        admin_link = db.execute(
            select(UserTenant, User)
            .join(User, User.id == UserTenant.user_id)
            .where(
                UserTenant.tenant_id == tenant.id,
                User.deleted_at.is_(None),
                User.is_active.is_(True),
            )
            .order_by(
                UserTenant.is_default.desc(),
                UserTenant.created_at.asc(),
            )
        ).first()

        admin_membership_id = None
        admin_user_name = None
        admin_user_email = None

        if admin_link:
            link, user = admin_link
            admin_membership_id = link.id
            admin_user_name = f"{user.first_name} {user.last_name}".strip()
            admin_user_email = user.email

        tenant_data = SuperadminTenantResponse.model_validate(tenant).model_dump(mode="json")

        items.append(
            SuperadminTenantListItemResponse(
                **tenant_data,
                admin_membership_id=admin_membership_id,
                admin_user_name=admin_user_name,
                admin_user_email=admin_user_email,
            ).model_dump(mode="json")
        )

    return {
        "items": items,
        "page": page,
        "page_size": page_size,
        "total": total,
    }


@router.post("", response_model=SuperadminTenantWithAdminResponse)
def create_tenant_with_admin(
    payload: SuperadminCreateTenantRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_superuser),
):
    existing_slug = db.execute(
        select(Tenant).where(
            Tenant.slug == payload.tenant.slug,
            Tenant.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if existing_slug:
        raise AppException(
            status_code=400,
            message="Tenant slug already exists",
            code="TENANT_SLUG_DUPLICATE",
        )

    existing_user = db.execute(
        select(User).where(
            User.email == payload.admin_user.email,
            User.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if existing_user:
        raise AppException(
            status_code=400,
            message="Admin email already exists",
            code="ADMIN_EMAIL_DUPLICATE",
        )

    tenant = Tenant(
        name=payload.tenant.name,
        slug=payload.tenant.slug,
        status="ACTIVE",
        email=payload.tenant.email,
        phone=payload.tenant.phone,
        currency=payload.tenant.currency,
        timezone=payload.tenant.timezone,
    )
    db.add(tenant)
    db.flush()

    admin_user = User(
        email=payload.admin_user.email,
        password_hash=hash_password(payload.admin_user.password),
        first_name=payload.admin_user.first_name,
        last_name=payload.admin_user.last_name,
        is_active=True,
        is_superuser=False,
    )
    db.add(admin_user)
    db.flush()

    link = UserTenant(
        user_id=admin_user.id,
        tenant_id=tenant.id,
        role="admin",
        is_default=True,
    )
    db.add(link)

    db.commit()
    db.refresh(tenant)
    db.refresh(admin_user)
    db.refresh(link)

    return SuperadminTenantWithAdminResponse(
        tenant=SuperadminTenantResponse.model_validate(tenant),
        admin_user_id=admin_user.id,
        admin_user_email=admin_user.email,
    )

class TenantFeatureUpdate(BaseModel):
    enabled: bool


@router.put("/{tenant_id}/features/{feature_key}")
def update_tenant_feature(
    tenant_id: UUID,
    feature_key: str,
    payload: TenantFeatureUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_superuser),
):
    feature = db.execute(
        select(TenantFeature).where(
            TenantFeature.tenant_id == tenant_id,
            TenantFeature.feature_key == feature_key,
        )
    ).scalar_one_or_none()

    if feature is None:
        feature = TenantFeature(
            tenant_id=tenant_id,
            feature_key=feature_key,
            enabled=payload.enabled,
        )
        db.add(feature)
    else:
        feature.enabled = payload.enabled

    db.commit()
    db.refresh(feature)

    return {
        "tenant_id": str(feature.tenant_id),
        "feature_key": feature.feature_key,
        "enabled": feature.enabled,
    }
