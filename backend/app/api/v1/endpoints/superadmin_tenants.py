from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from uuid import UUID

from pydantic import BaseModel

from app.api.deps_superadmin import require_superuser
from app.core.database import get_db
from app.core.exceptions import AppException
from app.core.security import hash_password

from app.models.tenant import Tenant
from app.models.user import User, UserTenant
from app.models.tenant_feature import TenantFeature
from app.models.tenant_currency import TenantCurrency

from app.schemas.superadmin import (
    SuperadminCreateTenantRequest,
    SuperadminTenantListItemResponse,
    SuperadminTenantResponse,
    SuperadminTenantWithAdminResponse,
)

from app.services.tenant_currency_setup import (
    create_default_currency_rules,
)

router = APIRouter(
    prefix="/superadmin/tenants",
    tags=["superadmin-tenants"],
)


@router.get("")
def list_tenants(
    db: Session = Depends(get_db),
    current_user=Depends(require_superuser),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    base_query = select(Tenant).where(
        Tenant.deleted_at.is_(None)
    )

    total = db.execute(
        select(func.count()).select_from(base_query.subquery())
    ).scalar_one()

    tenants = db.execute(
        base_query.order_by(Tenant.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).scalars().all()

    tenant_ids = [tenant.id for tenant in tenants]

    active_counts = {}

    if tenant_ids:
        active_counts_rows = db.execute(
            select(
                UserTenant.tenant_id,
                func.count(UserTenant.user_id),
            )
            .where(UserTenant.tenant_id.in_(tenant_ids))
            .group_by(UserTenant.tenant_id)
        ).all()

        active_counts = {
            tenant_id: count
            for tenant_id, count in active_counts_rows
        }

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

        active_users = active_counts.get(tenant.id, 0)

        tenant_data = (
            SuperadminTenantResponse
            .model_validate(tenant)
            .model_dump(mode="json")
        )

        tenant_data["max_users"] = tenant.max_users
        tenant_data["active_users"] = active_users
        tenant_data["available_users"] = max(
            tenant.max_users - active_users,
            0,
        )

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

    base_currency = payload.tenant.currency.upper()

    base_symbol = {
        "USD": "U$S",
        "ARS": "$",
        "EUR": "€",
    }.get(base_currency, base_currency)

    tenant_currency = TenantCurrency(
        tenant_id=tenant.id,
        currency_code=base_currency,
        symbol=base_symbol,
        is_base=True,
        is_enabled=True,
        display_order=0,
    )

    db.add(tenant_currency)

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

    default_features = [
        "dashboard",
        "dresses",
        "accessories",
        "accessory_movements",
        "capsules",
        "loans",
        "sales",
        "production_orders",
        "fabrics",
        "fabric_rolls",
        "trims",
        "fabric_movements",
        "reports",
        "reports_stock_valuation",
        "reports_dress_stock",
        "reports_fabric_movements",
        "reports_loans",
        "reports_production_costs",
        "reports_sales",
        "financial_dashboard",
        "branding",
        "users",
        "suppliers",
        "customers",
        "imports",
        "production_process_types",
    ]

    for feature_key in default_features:
        db.add(
            TenantFeature(
                tenant_id=tenant.id,
                feature_key=feature_key,
                enabled=True,
            )
        )

    db.flush()

    create_default_currency_rules(
        db=db,
        tenant_id=tenant.id,
        base_currency=base_currency,
    )

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


class TenantPlanUpdate(BaseModel):
    plan_code: str


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


PLAN_FEATURES = {
    "BASIC": [
        "dashboard",
        "dresses",
        "customers",
        "loans",
        "sales",
    ],

    "PRO": [
        "dashboard",
        "dresses",
        "accessories",
        "accessory_movements",
        "capsules",
        "customers",
        "loans",
        "sales",
        "production_orders",
        "fabrics",
        "fabric_rolls",
        "trims",
        "fabric_movements",
        "reports",
        "reports_stock_valuation",
        "reports_dress_stock",
        "reports_fabric_movements",
        "reports_loans",
        "reports_production_costs",
        "reports_sales",
    ],

    "PREMIUM": [
        "dashboard",
        "dresses",
        "accessories",
        "accessory_movements",
        "capsules",
        "customers",
        "loans",
        "sales",
        "production_orders",
        "fabrics",
        "fabric_rolls",
        "trims",
        "fabric_movements",
        "reports",
        "reports_stock_valuation",
        "reports_dress_stock",
        "reports_fabric_movements",
        "reports_loans",
        "reports_production_costs",
        "reports_sales",
        "financial_dashboard",
        "branding",
        "users",
        "suppliers",
        "imports",
        "production_process_types",
    ],
}


@router.put("/{tenant_id}/plan")
def update_tenant_plan(
    tenant_id: UUID,
    payload: TenantPlanUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_superuser),
):
    tenant = db.execute(
        select(Tenant).where(
            Tenant.id == tenant_id,
            Tenant.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if tenant is None:
        raise AppException(
            status_code=404,
            message="Tenant not found",
            code="TENANT_NOT_FOUND",
        )

    plan_code = payload.plan_code.upper().strip()

    if plan_code not in PLAN_FEATURES:
        raise AppException(
            status_code=400,
            message="Invalid plan",
            code="INVALID_PLAN",
        )

    tenant.plan_code = plan_code

    allowed_features = set(PLAN_FEATURES[plan_code])

    existing_features = db.execute(
        select(TenantFeature).where(
            TenantFeature.tenant_id == tenant.id
        )
    ).scalars().all()

    existing_map = {
        feature.feature_key: feature
        for feature in existing_features
    }

    all_feature_keys = set()

    for features in PLAN_FEATURES.values():
        all_feature_keys.update(features)

    for feature_key in all_feature_keys:
        enabled = feature_key in allowed_features
        existing = existing_map.get(feature_key)

        if existing:
            existing.enabled = enabled
        else:
            db.add(
                TenantFeature(
                    tenant_id=tenant.id,
                    feature_key=feature_key,
                    enabled=enabled,
                )
            )

    db.commit()
    db.refresh(tenant)

    return {
        "tenant_id": str(tenant.id),
        "plan_code": tenant.plan_code,
    }


@router.get("/{tenant_id}/features")
def get_tenant_features(
    tenant_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(require_superuser),
):
    features = db.execute(
        select(TenantFeature).where(
            TenantFeature.tenant_id == tenant_id
        )
    ).scalars().all()

    return [
        {
            "tenant_id": str(feature.tenant_id),
            "feature_key": feature.feature_key,
            "enabled": feature.enabled,
        }
        for feature in features
    ]
