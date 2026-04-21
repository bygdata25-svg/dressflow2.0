from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.tenant import Tenant
from app.schemas.tenant import PublicTenantBrandingResponse

router = APIRouter(prefix="/public/tenant-branding", tags=["public-tenant-branding"])


@router.get("/{slug}", response_model=PublicTenantBrandingResponse)
def get_tenant_branding(
    slug: str,
    db: Session = Depends(get_db),
):
    tenant = db.execute(
        select(Tenant).where(
            Tenant.slug == slug,
            Tenant.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found",
        )

    return PublicTenantBrandingResponse(
        name=tenant.name,
        slug=tenant.slug,
        logo_url=tenant.logo_url,
        primary_color=tenant.primary_color,
    )
