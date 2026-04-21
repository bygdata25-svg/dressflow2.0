from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_membership
from app.models.fabric import Fabric
from app.models.fabric_roll import FabricRoll
from app.schemas.fabric import FabricCreate, FabricListItem, RollListItem

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
    payload: FabricCreate,
    db: Session = Depends(get_db),
    membership=Depends(get_current_membership),
):
    tenant_id = membership.tenant_id

    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Fabric name is required")

    fabric = Fabric(
        tenant_id=tenant_id,
        name=name,
        fabric_type=payload.fabric_type.strip() if payload.fabric_type else None,
        color=payload.color.strip() if payload.color else None,
        supplier_id=payload.supplier_id,
        notes=payload.notes.strip() if payload.notes else None,
        photo_url=payload.photo_url,
    )

    db.add(fabric)
    db.commit()
    db.refresh(fabric)

    return {
        "id": str(fabric.id),
        "name": fabric.name,
        "fabric_type": fabric.fabric_type,
        "color": fabric.color,
        "supplier_id": str(fabric.supplier_id) if fabric.supplier_id else None,
        "notes": fabric.notes,
    }
