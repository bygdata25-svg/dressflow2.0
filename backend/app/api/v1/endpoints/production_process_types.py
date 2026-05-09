import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import asc
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_membership
from app.models.production_process_type import ProductionProcessType
from app.schemas.production_process_type import (
    ProductionProcessTypeCreate,
    ProductionProcessTypeUpdate,
    ProductionProcessTypeOut,
)

router = APIRouter(prefix="/production-process-types", tags=["Production Process Types"])


@router.get("", response_model=list[ProductionProcessTypeOut])
def list_production_process_types(
    db: Session = Depends(get_db),
    membership=Depends(get_current_membership),
):
    return (
        db.query(ProductionProcessType)
        .filter(
            ProductionProcessType.tenant_id == membership.tenant_id,
            ProductionProcessType.deleted_at.is_(None),
        )
        .order_by(asc(ProductionProcessType.sort_order), asc(ProductionProcessType.name))
        .all()
    )


@router.post("", response_model=ProductionProcessTypeOut, status_code=status.HTTP_201_CREATED)
def create_production_process_type(
    payload: ProductionProcessTypeCreate,
    db: Session = Depends(get_db),
    membership=Depends(get_current_membership),
):
    existing = (
        db.query(ProductionProcessType)
        .filter(
            ProductionProcessType.tenant_id == membership.tenant_id,
            ProductionProcessType.code == payload.code,
            ProductionProcessType.deleted_at.is_(None),
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe un tipo de proceso con ese código.",
        )

    item = ProductionProcessType(
        tenant_id=membership.tenant_id,
        code=payload.code,
        name=payload.name,
        sort_order=payload.sort_order,
        color=payload.color,
        icon=payload.icon,
        active=payload.active,
    )

    db.add(item)
    db.commit()
    db.refresh(item)

    return item


@router.put("/{process_type_id}", response_model=ProductionProcessTypeOut)
def update_production_process_type(
    process_type_id: uuid.UUID,
    payload: ProductionProcessTypeUpdate,
    db: Session = Depends(get_db),
    membership=Depends(get_current_membership),
):
    item = (
        db.query(ProductionProcessType)
        .filter(
            ProductionProcessType.id == process_type_id,
            ProductionProcessType.tenant_id == membership.tenant_id,
            ProductionProcessType.deleted_at.is_(None),
        )
        .first()
    )

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tipo de proceso no encontrado.",
        )

    data = payload.model_dump(exclude_unset=True)

    if "code" in data and data["code"] != item.code:
        duplicated = (
            db.query(ProductionProcessType)
            .filter(
                ProductionProcessType.tenant_id == membership.tenant_id,
                ProductionProcessType.code == data["code"],
                ProductionProcessType.id != item.id,
                ProductionProcessType.deleted_at.is_(None),
            )
            .first()
        )

        if duplicated:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ya existe otro tipo de proceso con ese código.",
            )

    for field, value in data.items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)

    return item


@router.delete("/{process_type_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_production_process_type(
    process_type_id: uuid.UUID,
    db: Session = Depends(get_db),
    membership=Depends(get_current_membership),
):
    item = (
        db.query(ProductionProcessType)
        .filter(
            ProductionProcessType.id == process_type_id,
            ProductionProcessType.tenant_id == membership.tenant_id,
            ProductionProcessType.deleted_at.is_(None),
        )
        .first()
    )

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tipo de proceso no encontrado.",
        )

    item.deleted_at = datetime.now(timezone.utc)
    item.active = False

    db.commit()

    return None
