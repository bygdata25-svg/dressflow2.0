import uuid
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import asc
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_membership
from app.models.appointment import Appointment
from app.models.production_order import ProductionOrder
from app.models.production_order_assignment import ProductionOrderAssignment
from app.models.production_process_type import ProductionProcessType
from app.models.supplier import Supplier
from app.schemas.production_order_assignment import (
    ProductionOrderAssignmentCreate,
    ProductionOrderAssignmentUpdate,
    ProductionOrderAssignmentDetailOut,
)

router = APIRouter(tags=["Production Order Assignments"])


def _default_end_at(start_at: datetime | None) -> datetime | None:
    if not start_at:
        return None

    return start_at + timedelta(hours=1)


def _assignment_status_to_appointment_status(status_value: str | None) -> str:
    status_upper = str(status_value or "").upper()

    if status_upper in {"DONE", "COMPLETED", "FINISHED"}:
        return "COMPLETED"

    if status_upper in {"CANCELLED", "CANCELED"}:
        return "CANCELLED"

    if status_upper in {"IN_PROGRESS", "STARTED"}:
        return "CONFIRMED"

    return "SCHEDULED"


def build_assignment_detail(row: ProductionOrderAssignment) -> ProductionOrderAssignmentDetailOut:
    return ProductionOrderAssignmentDetailOut(
        id=row.id,
        tenant_id=row.tenant_id,
        production_order_id=row.production_order_id,
        supplier_id=row.supplier_id,
        process_type_id=row.process_type_id,
        appointment_id=row.appointment_id,
        status=str(
            row.status.value
            if hasattr(row.status, "value")
            else row.status
        ),
        estimated_cost=row.estimated_cost,
        actual_cost=row.actual_cost,
        started_at=row.started_at,
        finished_at=row.finished_at,
        notes=row.notes,
        created_at=row.created_at,
        updated_at=row.updated_at,
        deleted_at=row.deleted_at,
        supplier_name=getattr(row, "supplier_name", None),
        process_code=getattr(row, "process_code", None),
        process_name=getattr(row, "process_name", None),
        process_color=getattr(row, "process_color", None),
        process_icon=getattr(row, "process_icon", None),
    )


def _build_assignment_title(
    order: ProductionOrder,
    process_type: ProductionProcessType,
) -> str:
    process_name = process_type.name or process_type.code or "Producción"
    order_number = order.order_number or str(order.id)[:8]

    return f"{process_name} · {order_number}"


def _sync_assignment_appointment(
    db: Session,
    assignment: ProductionOrderAssignment,
    order: ProductionOrder,
    process_type: ProductionProcessType,
) -> Appointment | None:
    """
    Crea o actualiza el evento de agenda vinculado a una asignación
    de etapa/proceso de producción.

    Regla:
    - Si la asignación tiene started_at, se crea/actualiza appointment.
    - Si todavía no tiene started_at, no se crea appointment para evitar
      eventos sin fecha en agenda.
    """

    if not assignment.started_at:
        return None

    appointment = None

    if assignment.appointment_id:
        appointment = (
            db.query(Appointment)
            .filter(
                Appointment.id == assignment.appointment_id,
                Appointment.tenant_id == assignment.tenant_id,
            )
            .first()
        )

    title = _build_assignment_title(order, process_type)

    if appointment is None:
        appointment = Appointment(
            tenant_id=assignment.tenant_id,
            title=title,
            description=assignment.notes,
            appointment_type="PRODUCTION_STAGE",
            status=_assignment_status_to_appointment_status(assignment.status),
            source_type="PRODUCTION_ASSIGNMENT",
            source_id=assignment.id,
            production_order_id=assignment.production_order_id,
            process_type_id=assignment.process_type_id,
            assigned_user_id=None,
            start_at=assignment.started_at,
            end_at=assignment.finished_at or _default_end_at(assignment.started_at),
            priority="MEDIUM",
            color=getattr(process_type, "color", None),
            notes=assignment.notes,
        )

        db.add(appointment)
        db.flush()

        assignment.appointment_id = appointment.id

        return appointment

    appointment.title = title
    appointment.description = assignment.notes
    appointment.status = _assignment_status_to_appointment_status(assignment.status)
    appointment.source_type = "PRODUCTION_ASSIGNMENT"
    appointment.source_id = assignment.id
    appointment.production_order_id = assignment.production_order_id
    appointment.process_type_id = assignment.process_type_id
    appointment.start_at = assignment.started_at
    appointment.end_at = assignment.finished_at or _default_end_at(assignment.started_at)
    appointment.color = getattr(process_type, "color", None)
    appointment.notes = assignment.notes

    return appointment


def _cancel_assignment_appointment(
    db: Session,
    assignment: ProductionOrderAssignment,
) -> None:
    if not assignment.appointment_id:
        return

    appointment = (
        db.query(Appointment)
        .filter(
            Appointment.id == assignment.appointment_id,
            Appointment.tenant_id == assignment.tenant_id,
        )
        .first()
    )

    if appointment:
        appointment.status = "CANCELLED"
        appointment.notes = (
            f"{appointment.notes or ''}\n\nCancelado automáticamente al eliminar la asignación."
        ).strip()


@router.get(
    "/production-orders/{production_order_id}/assignments",
    response_model=list[ProductionOrderAssignmentDetailOut],
)
def list_production_order_assignments(
    production_order_id: uuid.UUID,
    db: Session = Depends(get_db),
    membership=Depends(get_current_membership),
):
    order = (
        db.query(ProductionOrder)
        .filter(
            ProductionOrder.id == production_order_id,
            ProductionOrder.tenant_id == membership.tenant_id,
            ProductionOrder.deleted_at.is_(None),
        )
        .first()
    )

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Orden de producción no encontrada.",
        )

    rows = (
        db.query(
            ProductionOrderAssignment,
            Supplier.name.label("supplier_name"),
            ProductionProcessType.code.label("process_code"),
            ProductionProcessType.name.label("process_name"),
            ProductionProcessType.color.label("process_color"),
            ProductionProcessType.icon.label("process_icon"),
        )
        .join(Supplier, Supplier.id == ProductionOrderAssignment.supplier_id)
        .join(
            ProductionProcessType,
            ProductionProcessType.id == ProductionOrderAssignment.process_type_id,
        )
        .filter(
            ProductionOrderAssignment.tenant_id == membership.tenant_id,
            ProductionOrderAssignment.production_order_id == production_order_id,
            ProductionOrderAssignment.deleted_at.is_(None),
        )
        .order_by(asc(ProductionProcessType.sort_order), asc(Supplier.name))
        .all()
    )

    result: list[ProductionOrderAssignmentDetailOut] = []

    for assignment, supplier_name, process_code, process_name, process_color, process_icon in rows:
        assignment.supplier_name = supplier_name
        assignment.process_code = process_code
        assignment.process_name = process_name
        assignment.process_color = process_color
        assignment.process_icon = process_icon
        result.append(build_assignment_detail(assignment))

    return result


@router.post(
    "/production-orders/{production_order_id}/assignments",
    response_model=ProductionOrderAssignmentDetailOut,
    status_code=status.HTTP_201_CREATED,
)
def create_production_order_assignment(
    production_order_id: uuid.UUID,
    payload: ProductionOrderAssignmentCreate,
    db: Session = Depends(get_db),
    membership=Depends(get_current_membership),
):
    order = (
        db.query(ProductionOrder)
        .filter(
            ProductionOrder.id == production_order_id,
            ProductionOrder.tenant_id == membership.tenant_id,
            ProductionOrder.deleted_at.is_(None),
        )
        .first()
    )

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Orden de producción no encontrada.",
        )

    supplier = (
        db.query(Supplier)
        .filter(
            Supplier.id == payload.supplier_id,
            Supplier.tenant_id == membership.tenant_id,
            Supplier.deleted_at.is_(None),
        )
        .first()
    )

    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Proveedor/taller no encontrado.",
        )

    process_type = (
        db.query(ProductionProcessType)
        .filter(
            ProductionProcessType.id == payload.process_type_id,
            ProductionProcessType.tenant_id == membership.tenant_id,
            ProductionProcessType.deleted_at.is_(None),
            ProductionProcessType.active.is_(True),
        )
        .first()
    )

    if not process_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tipo de proceso no encontrado o inactivo.",
        )

    assignment = ProductionOrderAssignment(
        tenant_id=membership.tenant_id,
        production_order_id=production_order_id,
        supplier_id=payload.supplier_id,
        process_type_id=payload.process_type_id,
        status=payload.status,
        estimated_cost=payload.estimated_cost,
        actual_cost=payload.actual_cost,
        started_at=payload.started_at,
        finished_at=payload.finished_at,
        notes=payload.notes,
    )

    db.add(assignment)
    db.flush()

    _sync_assignment_appointment(
        db=db,
        assignment=assignment,
        order=order,
        process_type=process_type,
    )

    db.commit()
    db.refresh(assignment)

    assignment.supplier_name = supplier.name
    assignment.process_code = process_type.code
    assignment.process_name = process_type.name
    assignment.process_color = process_type.color
    assignment.process_icon = process_type.icon

    return build_assignment_detail(assignment)


@router.put(
    "/production-order-assignments/{assignment_id}",
    response_model=ProductionOrderAssignmentDetailOut,
)
def update_production_order_assignment(
    assignment_id: uuid.UUID,
    payload: ProductionOrderAssignmentUpdate,
    db: Session = Depends(get_db),
    membership=Depends(get_current_membership),
):
    assignment = (
        db.query(ProductionOrderAssignment)
        .filter(
            ProductionOrderAssignment.id == assignment_id,
            ProductionOrderAssignment.tenant_id == membership.tenant_id,
            ProductionOrderAssignment.deleted_at.is_(None),
        )
        .first()
    )

    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asignación de proceso no encontrada.",
        )

    order = (
        db.query(ProductionOrder)
        .filter(
            ProductionOrder.id == assignment.production_order_id,
            ProductionOrder.tenant_id == membership.tenant_id,
            ProductionOrder.deleted_at.is_(None),
        )
        .first()
    )

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Orden de producción no encontrada.",
        )

    data = payload.model_dump(exclude_unset=True)

    supplier = None
    process_type = None

    if "supplier_id" in data:
        supplier = (
            db.query(Supplier)
            .filter(
                Supplier.id == data["supplier_id"],
                Supplier.tenant_id == membership.tenant_id,
                Supplier.deleted_at.is_(None),
            )
            .first()
        )

        if not supplier:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Proveedor/taller no encontrado.",
            )

    if "process_type_id" in data:
        process_type = (
            db.query(ProductionProcessType)
            .filter(
                ProductionProcessType.id == data["process_type_id"],
                ProductionProcessType.tenant_id == membership.tenant_id,
                ProductionProcessType.deleted_at.is_(None),
                ProductionProcessType.active.is_(True),
            )
            .first()
        )

        if not process_type:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tipo de proceso no encontrado o inactivo.",
            )

    for field, value in data.items():
        setattr(assignment, field, value)

    if supplier is None:
        supplier = (
            db.query(Supplier)
            .filter(
                Supplier.id == assignment.supplier_id,
                Supplier.tenant_id == membership.tenant_id,
                Supplier.deleted_at.is_(None),
            )
            .first()
        )

    if process_type is None:
        process_type = (
            db.query(ProductionProcessType)
            .filter(
                ProductionProcessType.id == assignment.process_type_id,
                ProductionProcessType.tenant_id == membership.tenant_id,
                ProductionProcessType.deleted_at.is_(None),
            )
            .first()
        )

    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Proveedor/taller no encontrado.",
        )

    if not process_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tipo de proceso no encontrado.",
        )

    _sync_assignment_appointment(
        db=db,
        assignment=assignment,
        order=order,
        process_type=process_type,
    )

    db.commit()
    db.refresh(assignment)

    assignment.supplier_name = supplier.name
    assignment.process_code = process_type.code
    assignment.process_name = process_type.name
    assignment.process_color = process_type.color
    assignment.process_icon = process_type.icon

    return build_assignment_detail(assignment)


@router.delete(
    "/production-order-assignments/{assignment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_production_order_assignment(
    assignment_id: uuid.UUID,
    db: Session = Depends(get_db),
    membership=Depends(get_current_membership),
):
    assignment = (
        db.query(ProductionOrderAssignment)
        .filter(
            ProductionOrderAssignment.id == assignment_id,
            ProductionOrderAssignment.tenant_id == membership.tenant_id,
            ProductionOrderAssignment.deleted_at.is_(None),
        )
        .first()
    )

    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asignación de proceso no encontrada.",
        )

    assignment.deleted_at = datetime.now(timezone.utc)

    _cancel_assignment_appointment(
        db=db,
        assignment=assignment,
    )

    db.commit()

    return None
