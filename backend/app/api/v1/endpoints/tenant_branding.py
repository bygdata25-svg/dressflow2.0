from fastapi import UploadFile, File, APIRouter, Depends
import shutil
import os
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import get_current_membership
from app.models.tenant import Tenant

UPLOAD_DIR = "static/tenant_logos"
os.makedirs(UPLOAD_DIR, exist_ok=True)

router = APIRouter(prefix="/tenant-branding", tags=["tenant-branding"])


@router.put("")
def update_branding(
    payload: dict,
    db: Session = Depends(get_db),
    membership=Depends(get_current_membership),
):
    tenant = db.get(Tenant, membership.tenant_id)

    if "primary_color" in payload:
        tenant.primary_color = payload["primary_color"]

    db.commit()

    return {"ok": True}


@router.post("/upload-logo")
def upload_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    membership=Depends(get_current_membership),
):
    filename = f"{membership.tenant_id}.png"
    filepath = os.path.join(UPLOAD_DIR, filename)

    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    logo_url = f"/static/tenant_logos/{filename}"

    tenant = db.get(Tenant, membership.tenant_id)
    tenant.logo_url = logo_url

    db.commit()

    return {"logo_url": logo_url}
