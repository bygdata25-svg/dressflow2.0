from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.core.exceptions import AppException
from app.models.fabric import Fabric
from app.models.fabric_roll import FabricRoll
from app.models.fabric_movement import FabricMovement
from app.schemas.fabric_movement import FabricMovementCreate, FabricMovementResponse
from app.services.audit_service import create_audit_log

router = APIRouter(prefix="/fabric-movements", tags=["fabric-movements"])


def build_movement_response(db: Session, movement: FabricMovement) -> FabricMovementResponse:
    roll = db.execute(
        select(FabricRoll).where(FabricRoll.id == movement.fabric_roll_id)
    ).scalar_one_or_none()

    fabric_name = None
    roll_code = None

    if roll:
        roll_code = roll.roll_code
        fabric = db.execute(
            select(Fabric).where(Fabric.id == roll.fabric_id)
        ).scalar_one_or_none()
        fabric_name = fabric.name if fabric else None

    return FabricMovementResponse(
        id=movement.id,
        tenant_id=movement.tenant_id,
        fabric_roll_id=movement.fabric_roll_id,
        type=movement.type,
        quantity=movement.quantity,
        reference=movement.reference,
        notes=movement.notes,
        roll_code=roll_code,
        fabric_name=fabric_name,
    )


@router.get("")
def list_fabric_movements(
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager", "staff")),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
    type: str | None = None,
):
    query = select(FabricMovement).where(
        FabricMovement.tenant_id == membership.tenant_id,
    )

    if type:
        query = query.where(FabricMovement.type == type)

    if search:
        like_value = f"%{search}%"

        matching_roll_ids = db.execute(
            select(FabricRoll.id).where(
                FabricRoll.tenant_id == membership.tenant_id,
                FabricRoll.deleted_at.is_(None),
                FabricRoll.roll_code.ilike(like_value),
            )
        ).scalars().all()

        matching_fabric_ids = db.execute(
            select(Fabric.id).where(
                Fabric.tenant_id == membership.tenant_id,
                Fabric.deleted_at.is_(None),
                Fabric.name.ilike(like_value),
            )
        ).scalars().all()

        fabric_rolls_by_fabric = []
        if matching_fabric_ids:
            fabric_rolls_by_fabric = db.execute(
                select(FabricRoll.id).where(
                    FabricRoll.tenant_id == membership.tenant_id,
                    FabricRoll.deleted_at.is_(None),
                    FabricRoll.fabric_id.in_(matching_fabric_ids),
                )
            ).scalars().all()

        all_roll_ids = list(set((matching_roll_ids or []) + (fabric_rolls_by_fabric or [])))

        if all_roll_ids:
            query = query.where(
                or_(
                    FabricMovement.fabric_roll_id.in_(all_roll_ids),
                    FabricMovement.reference.ilike(like_value),
                )
            )
        else:
            query = query.where(FabricMovement.reference.ilike(like_value))

    total = db.execute(select(func.count()).select_from(query.subquery())).scalar_one()

    rows = db.execute(
        query.order_by(FabricMovement.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).scalars().all()

    return {
        "items": [build_movement_response(db, row).model_dump(mode="json") for row in rows],
        "page": page,
        "page_size": page_size,
        "total": total,
    }


@router.post("", response_model=FabricMovementResponse)
def create_fabric_movement(
    payload: FabricMovementCreate,
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager")),
):
    movement_type = payload.type.upper()

    if movement_type not in {"IN", "OUT", "ADJUSTMENT"}:
        raise AppException(400, "Invalid movement type", "FABRIC_MOVEMENT_INVALID_TYPE")

    if payload.quantity <= 0:
        raise AppException(400, "Quantity must be greater than zero", "FABRIC_MOVEMENT_INVALID_QUANTITY")

    roll = db.execute(
        select(FabricRoll).where(
            FabricRoll.id == payload.fabric_roll_id,
            FabricRoll.tenant_id == membership.tenant_id,
            FabricRoll.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not roll:
        raise AppException(404, "Fabric roll not found", "FABRIC_ROLL_NOT_FOUND")

    current_length = Decimal(str(roll.current_length))
    quantity = Decimal(str(payload.quantity))

    if movement_type == "IN":
        new_length = current_length + quantity
    elif movement_type == "OUT":
        new_length = current_length - quantity
        if new_length < 0:
            raise AppException(
                400,
                "Movement would leave the roll with negative stock",
                "FABRIC_MOVEMENT_NEGATIVE_STOCK",
            )
    else:  # ADJUSTMENT
        new_length = quantity

    roll.current_length = new_length
    roll.status = "DEPLETED" if new_length == 0 else "AVAILABLE"

    movement = FabricMovement(
        tenant_id=membership.tenant_id,
        fabric_roll_id=payload.fabric_roll_id,
        type=movement_type,
        quantity=payload.quantity,
        reference=payload.reference,
        notes=payload.notes,
    )

    db.add(movement)
    db.flush()

    create_audit_log(
        db=db,
        tenant_id=membership.tenant_id,
        user_id=membership.user_id,
        entity_type="fabric_movement",
        entity_id=movement.id,
        action="create",
        payload={
            "fabric_roll_id": str(movement.fabric_roll_id),
            "type": movement.type,
            "quantity": str(movement.quantity),
            "new_current_length": str(new_length),
        },
    )

    db.commit()
    db.refresh(movement)

    return build_movement_response(db, movement)
