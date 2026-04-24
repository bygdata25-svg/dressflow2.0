import shutil
import uuid
from pathlib import Path

from pydantic import BaseModel
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_membership, get_current_user
from app.core.database import get_db
from app.models.tenant import Tenant
from app.models.user import User, UserTenant
from app.schemas.tenant import TenantBrandingResponse, TenantBrandingUpdateRequest
from app.schemas.tenant import TenantBrandingRead, TenantBrandingUpdate
from app.services.tenant_branding import build_tenant_branding
from app.models.tenant_feature import TenantFeature

router = APIRouter(prefix="/tenants", tags=["tenants"])

BASE_DIR = Path(__file__).resolve().parents[3]
UPLOADS_DIR = BASE_DIR / "uploads" / "tenant-logos"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_IMAGE_TYPES = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
}


@router.get("/me", response_model=TenantBrandingResponse)
def get_my_tenant(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_membership: UserTenant = Depends(get_current_membership),
):
    tenant = db.execute(
        select(Tenant).where(
            Tenant.id == current_membership.tenant_id,
            Tenant.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found",
        )

    return TenantBrandingResponse(
        id=str(tenant.id),
        name=tenant.name,
        slug=tenant.slug,
        email=tenant.email,
        phone=tenant.phone,
        currency=tenant.currency,
        timezone=tenant.timezone,
        logo_url=tenant.logo_url,
        primary_color=tenant.primary_color,
    )


@router.put("/me", response_model=TenantBrandingResponse)
def update_my_tenant(
    payload: TenantBrandingUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_membership: UserTenant = Depends(get_current_membership),
):
    allowed_roles = {"owner", "admin"}

    if not current_user.is_superuser and (current_membership.role or "").lower() not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to update tenant branding",
        )

    tenant = db.execute(
        select(Tenant).where(
            Tenant.id == current_membership.tenant_id,
            Tenant.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found",
        )

    tenant.name = payload.name
    tenant.email = payload.email
    tenant.phone = payload.phone
    tenant.currency = payload.currency
    tenant.timezone = payload.timezone
    tenant.primary_color = payload.primary_color

    db.commit()
    db.refresh(tenant)

    return TenantBrandingResponse(
        id=str(tenant.id),
        name=tenant.name,
        slug=tenant.slug,
        email=tenant.email,
        phone=tenant.phone,
        currency=tenant.currency,
        timezone=tenant.timezone,
        logo_url=tenant.logo_url,
        primary_color=tenant.primary_color,
    )


@router.post("/me/logo", response_model=TenantBrandingResponse)
def upload_my_tenant_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_membership: UserTenant = Depends(get_current_membership),
):
    allowed_roles = {"owner", "admin"}

    if not current_user.is_superuser and (current_membership.role or "").lower() not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to update tenant logo",
        )

    tenant = db.execute(
        select(Tenant).where(
            Tenant.id == current_membership.tenant_id,
            Tenant.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found",
        )

    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image type. Use PNG, JPG, WEBP or SVG.",
        )

    extension = ALLOWED_IMAGE_TYPES[file.content_type]
    safe_slug = tenant.slug or str(tenant.id)
    filename = f"{safe_slug}_{uuid.uuid4().hex}{extension}"
    destination = UPLOADS_DIR / filename

    with destination.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    tenant.logo_url = f"/uploads/tenant-logos/{filename}"

    db.commit()
    db.refresh(tenant)

    return TenantBrandingResponse(
        id=str(tenant.id),
        name=tenant.name,
        slug=tenant.slug,
        email=tenant.email,
        phone=tenant.phone,
        currency=tenant.currency,
        timezone=tenant.timezone,
        logo_url=tenant.logo_url,
        primary_color=tenant.primary_color,
    )

@router.patch("/me/branding", response_model=TenantBrandingRead)
def patch_my_tenant_branding(
    payload: TenantBrandingUpdate,
    db: Session = Depends(get_db),
    membership = Depends(get_current_membership),
):
    if getattr(membership, "role", None) not in {"OWNER", "ADMIN"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to update branding",
        )

    tenant = membership.tenant
    data = payload.model_dump(exclude_unset=True)

    field_map = {
        "logo_url": "branding_logo_url",
        "primary_color": "branding_primary_color",
        "secondary_color": "branding_secondary_color",
        "accent_color": "branding_accent_color",
        "surface_color": "branding_surface_color",
        "sidebar_color": "branding_sidebar_color",
    }

    for payload_field, tenant_field in field_map.items():
        if payload_field in data:
            setattr(tenant, tenant_field, data[payload_field])

    db.add(tenant)
    db.commit()
    db.refresh(tenant)

    return build_tenant_branding(tenant)

class TenantFeatureUpdate(BaseModel):
    enabled: bool


@router.put("/tenants/{tenant_id}/features/{feature_key}")
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
