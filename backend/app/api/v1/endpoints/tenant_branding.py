from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_membership
from app.core.database import get_db
from app.models.tenant import Tenant
from app.services.cloudinary_service import delete_image, upload_image

router = APIRouter(prefix="/tenant-branding", tags=["tenant-branding"])


class TenantBrandingUpdate(BaseModel):
    primary_color: str | None = None
    default_language: str | None = None


@router.get("")
def get_tenant_branding(
    db: Session = Depends(get_db),
    membership=Depends(get_current_membership),
):
    tenant = db.get(Tenant, membership.tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado.")

    return {
        "logo_url": tenant.logo_url,
        "logo_public_id": getattr(tenant, "logo_public_id", None),
        "primary_color": tenant.primary_color,
        "default_language": getattr(tenant, "default_language", "es"),
    }


@router.put("")
def update_tenant_branding(
    payload: TenantBrandingUpdate,
    db: Session = Depends(get_db),
    membership=Depends(get_current_membership),
):
    tenant = db.get(Tenant, membership.tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado.")

    if payload.primary_color is not None:
        tenant.primary_color = payload.primary_color

    if payload.default_language is not None:
        if payload.default_language not in {"es", "en"}:
            raise HTTPException(
                status_code=400,
                detail="Idioma no válido. Valores permitidos: es, en.",
            )

        tenant.default_language = payload.default_language

    db.commit()
    db.refresh(tenant)

    return {
        "ok": True,
        "logo_url": tenant.logo_url,
        "logo_public_id": getattr(tenant, "logo_public_id", None),
        "primary_color": tenant.primary_color,
        "default_language": getattr(tenant, "default_language", "es"),
    }


@router.post("/upload-logo")
def upload_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    membership=Depends(get_current_membership),
):
    tenant = db.get(Tenant, membership.tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado.")

    if not tenant.slug:
        raise HTTPException(
            status_code=400,
            detail="El tenant no tiene slug configurado.",
        )

    old_public_id = getattr(tenant, "logo_public_id", None)

    result = upload_image(
        file_obj=file.file,
        tenant_slug=tenant.slug,
        entity="branding",
        asset_key="logo",
        overwrite=True,
    )

    tenant.logo_url = result["url"]

    if hasattr(tenant, "logo_public_id"):
        tenant.logo_public_id = result["public_id"]

    db.commit()
    db.refresh(tenant)

    if old_public_id and old_public_id != result["public_id"]:
        try:
            delete_image(old_public_id)
        except Exception:
            pass

    return {
        "logo_url": tenant.logo_url,
        "logo_public_id": getattr(tenant, "logo_public_id", None),
        "primary_color": tenant.primary_color,
        "default_language": getattr(tenant, "default_language", "es"),
    }

