from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_membership
from app.models.fabric import Fabric
from app.models.fabric_roll import FabricRoll
from app.schemas.fabric import FabricCreate, FabricListItem, RollListItem

from app.models.tenant import Tenant
from app.services.cloudinary_service import upload_image

router = APIRouter(prefix="/fabrics", tags=["fabrics"])

@router.get("", response_model=list[FabricListItem])
def list_fabrics(
    db: Session = Depends(get_db),
    membership=Depends(get_current_membership),
):
    tenant_id = membership.tenant_id

    rows = db.execute(
        select(
            Fabric.id,
            Fabric.name,
            Fabric.color,
            Fabric.photo_url,
            func.coalesce(func.sum(FabricRoll.current_length), 0).label("total_stock_meters"),
            func.count(FabricRoll.id).label("total_rolls"),
            func.coalesce(func.max(FabricRoll.current_length), 0).label("largest_roll_length"),
        )
        .outerjoin(
            FabricRoll,
            (FabricRoll.fabric_id == Fabric.id) & (FabricRoll.deleted_at.is_(None))
        )
        .where(
            Fabric.tenant_id == tenant_id,
            Fabric.deleted_at.is_(None),
        )
        .group_by(
            Fabric.id,
            Fabric.name,
            Fabric.color,
        )
        .order_by(Fabric.name.asc())
    ).all()

    return [
        FabricListItem(
            id=row.id,
            name=row.name,
            color=row.color,
            photo_url=row.photo_url,
            total_stock_meters=float(row.total_stock_meters or 0),
            total_rolls=int(row.total_rolls or 0),
            largest_roll_length=float(row.largest_roll_length or 0),
        )
        for row in rows
    ]

@router.get("/{fabric_id}/rolls", response_model=list[RollListItem])
def list_rolls_by_fabric(
    fabric_id: str,
    db: Session = Depends(get_db),
    membership=Depends(get_current_membership),
):
    tenant_id = membership.tenant_id

    rolls = db.execute(
        select(FabricRoll)
        .where(
            FabricRoll.tenant_id == tenant_id,
            FabricRoll.fabric_id == fabric_id,
            FabricRoll.deleted_at.is_(None),
        )
        .order_by(FabricRoll.roll_code.asc())
    ).scalars().all()

    return [
        RollListItem(
            id=r.id,
            code=r.roll_code,
            initial_length=float(r.initial_length or 0),
            current_length=float(r.current_length or 0),
            status=r.status,
        )
        for r in rolls
    ]

@router.post("", status_code=status.HTTP_201_CREATED)
def create_fabric(
    name: str = Form(...),
    fabric_type: str | None = Form(default=None),
    color: str | None = Form(default=None),
    supplier_id: str | None = Form(default=None),
    notes: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),

    db: Session = Depends(get_db),
    membership=Depends(get_current_membership),
):
    tenant_id = membership.tenant_id

    name = name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Fabric name is required")

    photo_url = None
    photo_public_id = None

    if file:
        tenant = db.execute(
            select(Tenant).where(Tenant.id == tenant_id)
        ).scalar_one()

        asset_key = name.replace(" ", "_")

        result = upload_image(
            file_obj=file.file,
            tenant_slug=tenant.slug,
            entity="fabrics",
            asset_key=asset_key,
            overwrite=True,
        )

        photo_url = result["url"]
        photo_public_id = result["public_id"]

    fabric = Fabric(
        tenant_id=tenant_id,
        name=name,
        fabric_type=fabric_type.strip() if fabric_type else None,
        color=color.strip() if color else None,
        supplier_id=supplier_id,
        notes=notes.strip() if notes else None,
        photo_url=photo_url,
        photo_public_id=photo_public_id,
    )

    db.add(fabric)
    db.commit()
    db.refresh(fabric)

    return {
        "id": str(fabric.id),
        "name": fabric.name,
        "fabric_type": fabric.fabric_type,
        "color": fabric.color,
        "photo_url": fabric.photo_url,
    }

from app.services.cloudinary_service import delete_image

@router.patch("/{fabric_id}")
def update_fabric(
    fabric_id: str,
    name: str | None = Form(default=None),
    fabric_type: str | None = Form(default=None),
    color: str | None = Form(default=None),
    notes: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),

    db: Session = Depends(get_db),
    membership=Depends(get_current_membership),
):
    tenant_id = membership.tenant_id

    fabric = db.execute(
        select(Fabric).where(
            Fabric.id == fabric_id,
            Fabric.tenant_id == tenant_id,
            Fabric.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not fabric:
        raise HTTPException(status_code=404, detail="Fabric not found")

    if name is not None:
        fabric.name = name.strip()

    if fabric_type is not None:
        fabric.fabric_type = fabric_type.strip() or None

    if color is not None:
        fabric.color = color.strip() or None

    if notes is not None:
        fabric.notes = notes.strip() or None

    if file:
        tenant = db.execute(
            select(Tenant).where(Tenant.id == tenant_id)
        ).scalar_one()

        old_public_id = getattr(fabric, "photo_public_id", None)

        asset_key = fabric.name.replace(" ", "_")

        result = upload_image(
            file_obj=file.file,
            tenant_slug=tenant.slug,
            entity="fabrics",
            asset_key=asset_key,
            overwrite=True,
        )

        fabric.photo_url = result["url"]
        fabric.photo_public_id = result["public_id"]

        if old_public_id:
            delete_image(old_public_id)

    db.add(fabric)
    db.commit()
    db.refresh(fabric)

    return fabric
