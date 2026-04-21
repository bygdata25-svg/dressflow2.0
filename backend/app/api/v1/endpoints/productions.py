from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_membership
from app.models.fabric import Fabric
from app.models.fabric_roll import FabricRoll

from app.schemas.production import (
    FabricAvailabilityCheckRequest,
    FabricAvailabilityCheckResponse,
)

router = APIRouter(prefix="/production", tags=["production"])


# ============================================
# LOGICA CENTRAL
# ============================================
def evaluate_fabric_for_production(rolls, required_meters: float):
    total_available = sum(float(r.current_length or 0) for r in rolls)
    largest_roll = max((float(r.current_length or 0) for r in rolls), default=0)

    has_total_stock = total_available >= required_meters
    has_single_roll_enough = largest_roll >= required_meters

    if not has_total_stock:
        status = "INSUFFICIENT_STOCK"
        alert_message = "Stock insuficiente para completar la orden."
    elif not has_single_roll_enough:
        status = "TOTAL_OK_BUT_NO_SINGLE_ROLL"
        alert_message = "Hay stock total suficiente, pero ningún rollo individual alcanza el metraje requerido."
    else:
        status = "OK"
        alert_message = "Tela disponible para producción."

    return (
        total_available,
        largest_roll,
        has_total_stock,
        has_single_roll_enough,
        status,
        alert_message,
    )


# ============================================
# ENDPOINT
# ============================================
@router.post("/check-fabric-availability", response_model=FabricAvailabilityCheckResponse)
def check_fabric_availability(
    payload: FabricAvailabilityCheckRequest,
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

    rolls = db.execute(
        select(Roll).where(
            Roll.tenant_id == tenant_id,
            Roll.fabric_id == payload.fabric_id,
            Roll.deleted_at.is_(None),
        )
    ).scalars().all()

    (
        total_available,
        largest_roll,
        has_total_stock,
        has_single_roll_enough,
        status,
        alert_message,
    ) = evaluate_fabric_for_production(rolls, payload.required_meters)

    return FabricAvailabilityCheckResponse(
        fabric_id=payload.fabric_id,
        required_meters=payload.required_meters,
        total_available_meters=total_available,
        largest_roll_length=largest_roll,
        has_total_stock=has_total_stock,
        has_single_roll_enough=has_single_roll_enough,
        status=status,
        alert_message=alert_message,
    )
