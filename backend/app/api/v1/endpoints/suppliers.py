from uuid import UUID as UUIDType

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.core.exceptions import AppException
from app.models.supplier import Supplier
from app.schemas.supplier import SupplierCreate, SupplierResponse
from app.services.audit_service import create_audit_log

router = APIRouter(prefix="/suppliers", tags=["suppliers"])


@router.get("")
def list_suppliers(
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager", "staff")),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
):
    query = select(Supplier).where(
        Supplier.tenant_id == membership.tenant_id,
        Supplier.deleted_at.is_(None),
    )

    if search:
        like_value = f"%{search}%"
        query = query.where(
            or_(
                Supplier.name.ilike(like_value),
                Supplier.email.ilike(like_value),
                Supplier.phone.ilike(like_value),
                Supplier.supplier_type.ilike(like_value),
            )
        )

    total = db.execute(
        select(func.count()).select_from(query.subquery())
    ).scalar_one()

    rows = db.execute(
        query.order_by(Supplier.name.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).scalars().all()

    return {
        "items": [
            SupplierResponse.model_validate(row).model_dump(mode="json")
            for row in rows
        ],
        "page": page,
        "page_size": page_size,
        "total": total,
    }


@router.get("/{supplier_id}", response_model=SupplierResponse)
def get_supplier(
    supplier_id: UUIDType,
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager", "staff")),
):
    supplier = db.execute(
        select(Supplier).where(
            Supplier.id == supplier_id,
            Supplier.tenant_id == membership.tenant_id,
            Supplier.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not supplier:
        raise AppException(
            status_code=404,
            message="Supplier not found",
            code="SUPPLIER_NOT_FOUND",
        )

    return supplier


@router.post("", response_model=SupplierResponse)
def create_supplier(
    payload: SupplierCreate,
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager")),
):
    valid_types = {"FABRIC_SUPPLIER", "WORKSHOP", "BOTH"}
    supplier_type = payload.supplier_type.upper()

    if supplier_type not in valid_types:
        raise AppException(
            status_code=400,
            message="Invalid supplier type",
            code="INVALID_SUPPLIER_TYPE",
        )

    supplier = Supplier(
        tenant_id=membership.tenant_id,
        name=payload.name,
        supplier_code=payload.supplier_code,   # ✅ FIX
        origin=payload.origin,                 # ✅ FIX
        email=payload.email,
        phone=payload.phone,
        notes=payload.notes,
        supplier_type=supplier_type,
    )

    db.add(supplier)
    db.flush()

    db.commit()
    db.refresh(supplier)

    return supplier

@router.put("/{supplier_id}", response_model=SupplierResponse)
def update_supplier(
    supplier_id: UUIDType,
    payload: SupplierCreate,
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager")),
):
    supplier = db.execute(
        select(Supplier).where(
            Supplier.id == supplier_id,
            Supplier.tenant_id == membership.tenant_id,
            Supplier.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not supplier:
        raise AppException(
            status_code=404,
            message="Supplier not found",
            code="SUPPLIER_NOT_FOUND",
        )

    valid_types = {"FABRIC_SUPPLIER", "WORKSHOP", "BOTH"}
    supplier_type = payload.supplier_type.upper()

    if supplier_type not in valid_types:
        raise AppException(
            status_code=400,
            message="Invalid supplier type",
            code="INVALID_SUPPLIER_TYPE",
        )

    supplier.name = payload.name
    supplier.supplier_code = payload.supplier_code   # ✅ FIX
    supplier.origin = payload.origin                 # ✅ FIX
    supplier.email = payload.email
    supplier.phone = payload.phone
    supplier.notes = payload.notes
    supplier.supplier_type = supplier_type

    db.commit()
    db.refresh(supplier)

    return supplier

@router.delete("/{supplier_id}")
def delete_supplier(
    supplier_id: UUIDType,
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager")),
):
    supplier = db.execute(
        select(Supplier).where(
            Supplier.id == supplier_id,
            Supplier.tenant_id == membership.tenant_id,
            Supplier.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not supplier:
        raise AppException(
            status_code=404,
            message="Supplier not found",
            code="SUPPLIER_NOT_FOUND",
        )

    supplier.deleted_at = func.now()

    create_audit_log(
        db=db,
        tenant_id=membership.tenant_id,
        user_id=membership.user_id,
        entity_type="supplier",
        entity_id=supplier.id,
        action="soft_delete",
        payload={
            "name": supplier.name,
            "supplier_type": supplier.supplier_type,
        },
    )

    db.commit()

    return {"message": "Supplier deleted"}
