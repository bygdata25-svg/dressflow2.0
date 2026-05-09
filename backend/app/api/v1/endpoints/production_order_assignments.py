import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import asc
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_membership
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


def build_assignment_detail(row: ProductionOrderAssignment) -> ProductionOrderAssignmentDetailOut:
    return ProductionOrderAssignmentDetailOut(
        id=row.id,
        tenant_id=row.tenant_id,
        production_order_id=row.production_order_id,
        supplier_id=row.supplier_id,
        process_type_id=row.process_type_id,
        status=row.status,
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
        .join(ProductionProcessType, ProductionProcessType.id == ProductionOrderAssignment.process_type_id)
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

    data = payload.model_dump(exclude_unset=True)

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

    db.commit()
    db.refresh(assignment)

    row = (
        db.query(
            ProductionOrderAssignment,
            Supplier.name.label("supplier_name"),
            ProductionProcessType.code.label("process_code"),
            ProductionProcessType.name.label("process_name"),
            ProductionProcessType.color.label("process_color"),
            ProductionProcessType.icon.label("process_icon"),
        )
        .join(Supplier, Supplier.id == ProductionOrderAssignment.supplier_id)
        .join(ProductionProcessType, ProductionProcessType.id == ProductionOrderAssignment.process_type_id)
        .filter(ProductionOrderAssignment.id == assignment.id)
        .first()
    )

    assignment, supplier_name, process_code, process_name, process_color, process_icon = row

    assignment.supplier_name = supplier_name
    assignment.process_code = process_code
    assignment.process_name = process_name
    assignment.process_color = process_color
    assignment.process_icon = process_icon

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

    db.commit()

    return None
