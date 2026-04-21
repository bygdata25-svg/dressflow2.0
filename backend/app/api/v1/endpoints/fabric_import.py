from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_current_membership
from app.core.database import get_db
from app.services.fabric_importer import import_fabrics_file

router = APIRouter(prefix="/fabric-import", tags=["fabric-import"])


@router.post("/preview")
async def preview_fabric_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    membership=Depends(get_current_membership),
):
    import_batch = datetime.utcnow().strftime("preview-%Y%m%d%H%M%S")
    return await import_fabrics_file(
        db=db,
        tenant_id=membership.tenant_id,
        file=file,
        dry_run=True,
        import_batch=import_batch,
    )


@router.post("/execute")
async def execute_fabric_import(
    file: UploadFile = File(...),
    confirm: bool = Form(default=False),
    db: Session = Depends(get_db),
    membership=Depends(get_current_membership),
):
    if not confirm:
        return {
            "ok": False,
            "message": "Para ejecutar la importación enviá confirm=true.",
        }

    import_batch = datetime.utcnow().strftime("import-%Y%m%d%H%M%S")
    result = await import_fabrics_file(
        db=db,
        tenant_id=membership.tenant_id,
        file=file,
        dry_run=False,
        import_batch=import_batch,
    )
    return {
        "ok": True,
        **result,
    }
