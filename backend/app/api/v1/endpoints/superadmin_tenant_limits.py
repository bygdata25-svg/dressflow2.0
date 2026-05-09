from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.api.deps import require_superuser
from app.core.database import get_db
from app.models.tenant import Tenant

router = APIRouter(
    prefix="/superadmin/tenant-limits",
    tags=["superadmin-tenant-limits"],
)


class TenantLimitUpdate(BaseModel):
    max_users: int = Field(ge=1, le=1000)


@router.put("/{tenant_id}")
def update_tenant_limits(
    tenant_id: UUID,
    payload: TenantLimitUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_superuser),
):
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

    tenant.max_users = payload.max_users

    db.commit()
    db.refresh(tenant)

    return {
        "id": str(tenant.id),
        "name": tenant.name,
        "max_users": tenant.max_users,
    }
