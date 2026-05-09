from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps_superadmin import require_superuser
from app.core.database import get_db
from app.models.tenant import Tenant
from app.models.tenant_currency import TenantCurrency
from app.models.tenant_currency_rule import TenantCurrencyRule
from app.schemas.tenant_currency_rule import (
    TenantCurrencyRuleCreate,
    TenantCurrencyRuleRead,
    TenantCurrencyRuleUpdate,
)

router = APIRouter(
    prefix="/superadmin/tenants",
    tags=["superadmin-tenant-currency-rules"],
)


def ensure_tenant_exists(db: Session, tenant_id: UUID) -> Tenant:
    tenant = db.execute(
        select(Tenant).where(
            Tenant.id == tenant_id,
            Tenant.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found.",
        )

    return tenant


def ensure_currency_enabled(db: Session, tenant_id: UUID, currency_code: str) -> None:
    currency = db.execute(
        select(TenantCurrency).where(
            TenantCurrency.tenant_id == tenant_id,
            TenantCurrency.currency_code == currency_code.upper(),
            TenantCurrency.is_enabled.is_(True),
        )
    ).scalar_one_or_none()

    if not currency:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Currency is not enabled for this tenant.",
        )


@router.get("/{tenant_id}/currency-rules", response_model=list[TenantCurrencyRuleRead])
def list_tenant_currency_rules(
    tenant_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(require_superuser),
):
    ensure_tenant_exists(db, tenant_id)

    rows = db.execute(
        select(TenantCurrencyRule)
        .where(TenantCurrencyRule.tenant_id == tenant_id)
        .order_by(
            TenantCurrencyRule.module,
            TenantCurrencyRule.price_type,
        )
    ).scalars().all()

    return rows


@router.post("/{tenant_id}/currency-rules", response_model=TenantCurrencyRuleRead)
def create_tenant_currency_rule(
    tenant_id: UUID,
    payload: TenantCurrencyRuleCreate,
    db: Session = Depends(get_db),
    user=Depends(require_superuser),
):
    ensure_tenant_exists(db, tenant_id)

    currency_code = payload.default_currency.upper()
    ensure_currency_enabled(db, tenant_id, currency_code)

    existing = db.execute(
        select(TenantCurrencyRule).where(
            TenantCurrencyRule.tenant_id == tenant_id,
            TenantCurrencyRule.module == payload.module,
            TenantCurrencyRule.price_type == payload.price_type,
        )
    ).scalar_one_or_none()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Currency rule already exists for this module and price type.",
        )

    rule = TenantCurrencyRule(
        tenant_id=tenant_id,
        module=payload.module,
        price_type=payload.price_type,
        default_currency=currency_code,
        allow_override=payload.allow_override,
    )

    db.add(rule)
    db.commit()
    db.refresh(rule)

    return rule


@router.put("/{tenant_id}/currency-rules/{rule_id}", response_model=TenantCurrencyRuleRead)
def update_tenant_currency_rule(
    tenant_id: UUID,
    rule_id: UUID,
    payload: TenantCurrencyRuleUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_superuser),
):
    ensure_tenant_exists(db, tenant_id)

    rule = db.execute(
        select(TenantCurrencyRule).where(
            TenantCurrencyRule.id == rule_id,
            TenantCurrencyRule.tenant_id == tenant_id,
        )
    ).scalar_one_or_none()

    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Currency rule not found.",
        )

    data = payload.model_dump(exclude_unset=True)

    if "default_currency" in data and data["default_currency"]:
        data["default_currency"] = data["default_currency"].upper()
        ensure_currency_enabled(db, tenant_id, data["default_currency"])

    for key, value in data.items():
        setattr(rule, key, value)

    db.commit()
    db.refresh(rule)

    return rule


@router.delete("/{tenant_id}/currency-rules/{rule_id}")
def delete_tenant_currency_rule(
    tenant_id: UUID,
    rule_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(require_superuser),
):
    ensure_tenant_exists(db, tenant_id)

    rule = db.execute(
        select(TenantCurrencyRule).where(
            TenantCurrencyRule.id == rule_id,
            TenantCurrencyRule.tenant_id == tenant_id,
        )
    ).scalar_one_or_none()

    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Currency rule not found.",
        )

    db.delete(rule)
    db.commit()

    return {"ok": True}
