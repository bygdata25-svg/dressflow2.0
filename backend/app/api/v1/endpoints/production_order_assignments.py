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
from app.models.supplier_contact import SupplierContact
from app.models.user import User, UserTenant
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
        supplier_contact_id=row.supplier_contact_id,
        assigned_user_id=row.assigned_user_id,
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
        supplier_contact_name=getattr(row, "supplier_contact_name", None),
        supplier_contact_whatsapp=getattr(row, "supplier_contact_whatsapp", None),
        assigned_user_name=getattr(row, "assigned_user_name", None),
        process_code=getattr(row, "process_code", None),
        process_name=getattr(row, "process_name", None),
        process_color=getattr(row, "process_color", None),
        process_icon=getattr(row, "process_icon", None),
    )


def _get_assignable_user_or_404(
    db: Session,
    tenant_id,
    user_id: uuid.UUID | None,
) -> User | None:
    if user_id is None:
        return None

    user = (
        db.query(User)
        .join(UserTenant, UserTenant.user_id == User.id)
        .filter(
            User.id == user_id,
            UserTenant.tenant_id == tenant_id,
            User.deleted_at.is_(None),
            User.is_active.is_(True),
        )
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario asignado no encontrado, inactivo o fuera del tenant.",
        )

    return user


def _user_display_name(user: User | None) -> str | None:
    if not user:
        return None

    full_name = f"{user.first_name or ''} {user.last_name or ''}".strip()
    return full_name or user.email


def _get_supplier_contact_or_404(
    db: Session,
    tenant_id,
    supplier_id: uuid.UUID,
    contact_id: uuid.UUID | None,
) -> SupplierContact | None:
    if contact_id is None:
        return None

    contact = (
        db.query(SupplierContact)
        .filter(
            SupplierContact.id == contact_id,
            SupplierContact.tenant_id == tenant_id,
            SupplierContact.supplier_id == supplier_id,
            SupplierContact.deleted_at.is_(None),
            SupplierContact.is_active.is_(True),
        )
        .first()
    )

    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "Contacto del proveedor no encontrado, inactivo "
                "o no pertenece al proveedor seleccionado."
            ),
        )

    return contact


def _supplier_contact_display_name(contact: SupplierContact | None) -> str | None:
    if not contact:
        return None

    return f"{contact.first_name or ''} {contact.last_name or ''}".strip() or None


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
            assigned_user_id=assignment.assigned_user_id,
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
    appointment.assigned_user_id = assignment.assigned_user_id
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
            SupplierContact.first_name.label("supplier_contact_first_name"),
            SupplierContact.last_name.label("supplier_contact_last_name"),
            SupplierContact.whatsapp_phone.label("supplier_contact_whatsapp"),
            User.first_name.label("assigned_user_first_name"),
            User.last_name.label("assigned_user_last_name"),
            User.email.label("assigned_user_email"),
            ProductionProcessType.code.label("process_code"),
            ProductionProcessType.name.label("process_name"),
            ProductionProcessType.color.label("process_color"),
            ProductionProcessType.icon.label("process_icon"),
        )
        .join(Supplier, Supplier.id == ProductionOrderAssignment.supplier_id)
        .outerjoin(
            SupplierContact,
            SupplierContact.id == ProductionOrderAssignment.supplier_contact_id,
        )
        .outerjoin(User, User.id == ProductionOrderAssignment.assigned_user_id)
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

    for (
        assignment,
        supplier_name,
        supplier_contact_first_name,
        supplier_contact_last_name,
        supplier_contact_whatsapp,
        assigned_user_first_name,
        assigned_user_last_name,
        assigned_user_email,
        process_code,
        process_name,
        process_color,
        process_icon,
    ) in rows:
        assignment.supplier_name = supplier_name
        contact_name = f"{supplier_contact_first_name or ''} {supplier_contact_last_name or ''}".strip()
        assignment.supplier_contact_name = contact_name or None
        assignment.supplier_contact_whatsapp = supplier_contact_whatsapp
        assigned_name = f"{assigned_user_first_name or ''} {assigned_user_last_name or ''}".strip()
        assignment.assigned_user_name = assigned_name or assigned_user_email
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

    assigned_user = _get_assignable_user_or_404(
        db,
        membership.tenant_id,
        payload.assigned_user_id,
    )

    supplier_contact = _get_supplier_contact_or_404(
        db,
        membership.tenant_id,
        payload.supplier_id,
        payload.supplier_contact_id,
    )

    assignment = ProductionOrderAssignment(
        tenant_id=membership.tenant_id,
        production_order_id=production_order_id,
        supplier_id=payload.supplier_id,
        process_type_id=payload.process_type_id,
        supplier_contact_id=payload.supplier_contact_id,
        assigned_user_id=payload.assigned_user_id,
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
    assignment.supplier_contact_name = _supplier_contact_display_name(supplier_contact)
    assignment.supplier_contact_whatsapp = (
        supplier_contact.whatsapp_phone if supplier_contact else None
    )
    assignment.assigned_user_name = _user_display_name(assigned_user)
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

    assigned_user = None
    if "assigned_user_id" in data:
        assigned_user = _get_assignable_user_or_404(
            db,
            membership.tenant_id,
            data["assigned_user_id"],
        )

    effective_supplier_id = data.get("supplier_id", assignment.supplier_id)

    # Si cambia el proveedor y no se informa un nuevo contacto,
    # limpiamos el contacto anterior para no dejar una relación inválida.
    if (
        "supplier_id" in data
        and data["supplier_id"] != assignment.supplier_id
        and "supplier_contact_id" not in data
    ):
        data["supplier_contact_id"] = None

    supplier_contact = None
    if "supplier_contact_id" in data:
        supplier_contact = _get_supplier_contact_or_404(
            db,
            membership.tenant_id,
            effective_supplier_id,
            data["supplier_contact_id"],
        )
    else:
        supplier_contact = _get_supplier_contact_or_404(
            db,
            membership.tenant_id,
            effective_supplier_id,
            assignment.supplier_contact_id,
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

    if "assigned_user_id" not in data:
        assigned_user = _get_assignable_user_or_404(
            db,
            membership.tenant_id,
            assignment.assigned_user_id,
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
    assignment.supplier_contact_name = _supplier_contact_display_name(supplier_contact)
    assignment.supplier_contact_whatsapp = (
        supplier_contact.whatsapp_phone if supplier_contact else None
    )
    assignment.assigned_user_name = _user_display_name(assigned_user)
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
