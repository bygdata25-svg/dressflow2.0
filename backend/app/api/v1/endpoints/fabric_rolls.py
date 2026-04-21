from fastapi import APIRouter, Depends, Query, status, HTTPException
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session

from app.api.deps import get_current_membership
from app.core.database import get_db
from app.models.fabric import Fabric
from app.models.fabric_roll import FabricRoll
from app.models.supplier import Supplier
from app.schemas.fabric_roll import (
    FabricRollCreate,
    FabricRollUpdate,
    FabricRollResponse,
)

router = APIRouter(prefix="/fabric-rolls", tags=["fabric-rolls"])


def build_roll_response(
    roll: FabricRoll,
    fabric_name: str | None = None,
    fabric_color: str | None = None,
    fabric_code: str | None = None,
    supplier_name: str | None = None,
) -> FabricRollResponse:
    return FabricRollResponse(
        id=roll.id,
        tenant_id=roll.tenant_id,
        fabric_id=roll.fabric_id,
        supplier_id=roll.supplier_id,
        roll_code=roll.roll_code,
        piece_type=roll.piece_type,
        legacy_slot=roll.legacy_slot,
        initial_length=roll.initial_length,
        current_length=roll.current_length,
        reserved_length=roll.reserved_length,
        unit=roll.unit,
        status=roll.status,
        price_per_meter=roll.price_per_meter,
        currency=roll.currency,
        purchase_date=roll.purchase_date,
        location=roll.location,
        is_scrap=roll.is_scrap,
        notes=roll.notes,
        fabric_name=fabric_name,
        fabric_color=fabric_color,
        fabric_code=fabric_code,
        supplier_name=supplier_name,
    )


@router.get("")
def list_fabric_rolls(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    search: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    membership=Depends(get_current_membership),
):
    tenant_id = membership.tenant_id

    filters = [
      FabricRoll.tenant_id == tenant_id,
      FabricRoll.deleted_at.is_(None),
    ]

    if status_filter:
        filters.append(FabricRoll.status == status_filter)

    if search:
        search_term = f"%{search.strip()}%"
        filters.append(
            or_(
                FabricRoll.roll_code.ilike(search_term),
                Fabric.name.ilike(search_term),
                Fabric.color.ilike(search_term),
                Fabric.code.ilike(search_term),
                FabricRoll.notes.ilike(search_term),
            )
        )

    total = db.execute(
        select(func.count())
        .select_from(FabricRoll)
        .join(Fabric, Fabric.id == FabricRoll.fabric_id)
        .where(*filters)
    ).scalar_one()

    rows = db.execute(
        select(
            FabricRoll,
            Fabric.name.label("fabric_name"),
            Fabric.color.label("fabric_color"),
            Fabric.code.label("fabric_code"),
            Supplier.name.label("supplier_name"),
        )
        .join(Fabric, Fabric.id == FabricRoll.fabric_id)
        .outerjoin(Supplier, Supplier.id == FabricRoll.supplier_id)
        .where(*filters)
        .order_by(FabricRoll.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    items = [
        build_roll_response(
            roll=roll,
            fabric_name=fabric_name,
            fabric_color=fabric_color,
            fabric_code=fabric_code,
            supplier_name=supplier_name,
        )
        for roll, fabric_name, fabric_color, fabric_code, supplier_name in rows
    ]

    return {
        "items": items,
        "page": page,
        "page_size": page_size,
        "total": total,
    }


@router.post("", response_model=FabricRollResponse, status_code=status.HTTP_201_CREATED)
def create_fabric_roll(
    payload: FabricRollCreate,
    db: Session = Depends(get_db),
    membership=Depends(get_current_membership),
):
    tenant_id = membership.tenant_id

    fabric = db.execute(
        select(Fabric).where(
            Fabric.id == payload.fabric_id,
            Fabric.tenant_id == tenant_id,
            Fabric.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not fabric:
        raise HTTPException(status_code=404, detail="Fabric not found")

    supplier = None
    if payload.supplier_id:
        supplier = db.execute(
            select(Supplier).where(
                Supplier.id == payload.supplier_id,
                Supplier.tenant_id == tenant_id,
                Supplier.deleted_at.is_(None),
            )
        ).scalar_one_or_none()

        if not supplier:
            raise HTTPException(status_code=404, detail="Supplier not found")

    existing_roll = db.execute(
        select(FabricRoll).where(
            FabricRoll.tenant_id == tenant_id,
            FabricRoll.roll_code == payload.roll_code.strip(),
            FabricRoll.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if existing_roll:
        raise HTTPException(status_code=400, detail="Roll code already exists")

    roll = FabricRoll(
        tenant_id=tenant_id,
        fabric_id=payload.fabric_id,
        supplier_id=payload.supplier_id,
        roll_code=payload.roll_code.strip(),
        piece_type=payload.piece_type,
        legacy_slot=payload.legacy_slot,
        initial_length=payload.initial_length,
        current_length=payload.initial_length,
        reserved_length=0,
        unit=payload.unit,
        status="AVAILABLE",
        price_per_meter=payload.price_per_meter,
        currency=payload.currency,
        purchase_date=payload.purchase_date,
        location=payload.location,
        is_scrap=payload.is_scrap,
        notes=payload.notes.strip() if payload.notes else None,
    )

    db.add(roll)
    db.commit()
    db.refresh(roll)

    return build_roll_response(
        roll=roll,
        fabric_name=fabric.name,
        fabric_color=getattr(fabric, "color", None),
        fabric_code=getattr(fabric, "code", None),
        supplier_name=supplier.name if supplier else None,
    )


@router.patch("/{roll_id}", response_model=FabricRollResponse)
def update_fabric_roll(
    roll_id: str,
    payload: FabricRollUpdate,
    db: Session = Depends(get_db),
    membership=Depends(get_current_membership),
):
    tenant_id = membership.tenant_id

    roll = db.execute(
        select(FabricRoll).where(
            FabricRoll.id == roll_id,
            FabricRoll.tenant_id == tenant_id,
            FabricRoll.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not roll:
        raise HTTPException(status_code=404, detail="Fabric roll not found")

    fabric = db.execute(
        select(Fabric).where(
            Fabric.id == payload.fabric_id,
            Fabric.tenant_id == tenant_id,
            Fabric.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not fabric:
        raise HTTPException(status_code=404, detail="Fabric not found")

    supplier = None
    if payload.supplier_id:
        supplier = db.execute(
            select(Supplier).where(
                Supplier.id == payload.supplier_id,
                Supplier.tenant_id == tenant_id,
                Supplier.deleted_at.is_(None),
            )
        ).scalar_one_or_none()

        if not supplier:
            raise HTTPException(status_code=404, detail="Supplier not found")

    duplicate = db.execute(
        select(FabricRoll).where(
            FabricRoll.tenant_id == tenant_id,
            FabricRoll.roll_code == payload.roll_code.strip(),
            FabricRoll.id != roll_id,
            FabricRoll.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if duplicate:
        raise HTTPException(status_code=400, detail="Roll code already exists")

    current_length = roll.current_length
    reserved_length = roll.reserved_length or 0

    if payload.initial_length < reserved_length:
        raise HTTPException(
            status_code=400,
            detail="Initial length cannot be smaller than reserved length",
        )

    if current_length > payload.initial_length:
        current_length = payload.initial_length

    roll.fabric_id = payload.fabric_id
    roll.supplier_id = payload.supplier_id
    roll.roll_code = payload.roll_code.strip()
    roll.piece_type = payload.piece_type
    roll.legacy_slot = payload.legacy_slot
    roll.initial_length = payload.initial_length
    roll.current_length = current_length
    roll.unit = payload.unit
    roll.price_per_meter = payload.price_per_meter
    roll.currency = payload.currency
    roll.purchase_date = payload.purchase_date
    roll.location = payload.location
    roll.is_scrap = payload.is_scrap
    roll.notes = payload.notes.strip() if payload.notes else None

    db.add(roll)
    db.commit()
    db.refresh(roll)

    return build_roll_response(
        roll=roll,
        fabric_name=fabric.name,
        fabric_color=getattr(fabric, "color", None),
        fabric_code=getattr(fabric, "code", None),
        supplier_name=supplier.name if supplier else None,
    )


@router.delete("/{roll_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_fabric_roll(
    roll_id: str,
    db: Session = Depends(get_db),
    membership=Depends(get_current_membership),
):
    tenant_id = membership.tenant_id

    roll = db.execute(
        select(FabricRoll).where(
            FabricRoll.id == roll_id,
            FabricRoll.tenant_id == tenant_id,
            FabricRoll.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not roll:
        raise HTTPException(status_code=404, detail="Fabric roll not found")

    from datetime import datetime, timezone

    roll.deleted_at = datetime.now(timezone.utc)
    db.add(roll)
    db.commit()
