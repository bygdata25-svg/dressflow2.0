from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_membership
from app.core.database import get_db
from app.models.accessory import Accessory
from app.models.accessory_movement import AccessoryMovement
from app.schemas.accessory_movement import (
    AccessoryMovementCreate,
    AccessoryMovementResponse,
    PaginatedAccessoryMovementResponse,
)

router = APIRouter(prefix="/accessory-movements", tags=["accessory-movements"])


def build_movement_response(movement: AccessoryMovement, accessory: Accessory | None = None) -> AccessoryMovementResponse:
    return AccessoryMovementResponse(
        id=movement.id,
        tenant_id=movement.tenant_id,
        accessory_id=movement.accessory_id,
        type=movement.type,
        quantity=movement.quantity,
        reference=movement.reference,
        notes=movement.notes,
        created_at=movement.created_at,
        accessory_code=getattr(accessory, "code", None),
        accessory_name=getattr(accessory, "name", None),
    )


@router.get("", response_model=PaginatedAccessoryMovementResponse)
def list_accessory_movements(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    search: str | None = Query(default=None),
    movement_type: str | None = Query(default=None, alias="type"),
    accessory_id: UUID | None = Query(default=None),
    membership=Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    tenant_id = membership.tenant_id

    stmt = (
        select(AccessoryMovement, Accessory)
        .join(Accessory, Accessory.id == AccessoryMovement.accessory_id)
        .where(
            AccessoryMovement.tenant_id == tenant_id,
            AccessoryMovement.deleted_at.is_(None),
        )
    )

    if search:
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Accessory.code.ilike(pattern),
                Accessory.name.ilike(pattern),
                AccessoryMovement.reference.ilike(pattern),
                AccessoryMovement.notes.ilike(pattern),
            )
        )

    if movement_type:
        stmt = stmt.where(AccessoryMovement.type == movement_type)

    if accessory_id:
        stmt = stmt.where(AccessoryMovement.accessory_id == accessory_id)

    count_stmt = select(func.count()).select_from(AccessoryMovement).where(
        AccessoryMovement.tenant_id == tenant_id,
        AccessoryMovement.deleted_at.is_(None),
    )

    if movement_type:
        count_stmt = count_stmt.where(AccessoryMovement.type == movement_type)

    if accessory_id:
        count_stmt = count_stmt.where(AccessoryMovement.accessory_id == accessory_id)

    total = db.execute(count_stmt).scalar_one()

    rows = db.execute(
        stmt.order_by(AccessoryMovement.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    return {
        "items": [build_movement_response(movement, accessory) for movement, accessory in rows],
        "page": page,
        "page_size": page_size,
        "total": total,
    }


@router.post("", response_model=AccessoryMovementResponse, status_code=status.HTTP_201_CREATED)
def create_accessory_movement(
    payload: AccessoryMovementCreate,
    membership=Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    tenant_id = membership.tenant_id

    accessory = db.execute(
        select(Accessory).where(
            Accessory.id == payload.accessory_id,
            Accessory.tenant_id == tenant_id,
            Accessory.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not accessory:
        raise HTTPException(status_code=404, detail="Accesorio no encontrado")

    movement_type = payload.type.strip().upper()

    if movement_type not in {"IN", "OUT", "ADJUST"}:
        raise HTTPException(status_code=400, detail="Tipo de movimiento inválido")

    if movement_type == "IN":
        accessory.stock += payload.quantity
    elif movement_type == "OUT":
        if accessory.stock < payload.quantity:
            raise HTTPException(status_code=400, detail="Stock insuficiente")
        accessory.stock -= payload.quantity
    elif movement_type == "ADJUST":
        accessory.stock = payload.quantity

    accessory.updated_at = datetime.utcnow()

    movement = AccessoryMovement(
        tenant_id=tenant_id,
        accessory_id=payload.accessory_id,
        type=movement_type,
        quantity=payload.quantity,
        reference=payload.reference,
        notes=payload.notes,
    )

    db.add(movement)
    db.add(accessory)
    db.commit()
    db.refresh(movement)

    return build_movement_response(movement, accessory)
