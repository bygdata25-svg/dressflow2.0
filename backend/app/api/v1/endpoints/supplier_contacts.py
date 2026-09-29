from uuid import UUID as UUIDType

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.core.exceptions import AppException
from app.models.supplier import Supplier
from app.models.supplier_contact import SupplierContact
from app.schemas.supplier_contact import (
    SupplierContactCreate,
    SupplierContactResponse,
    SupplierContactUpdate,
)

router = APIRouter(prefix="/supplier-contacts", tags=["supplier-contacts"])


def _normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None

    normalized = value.strip()
    return normalized or None


def _get_supplier_or_404(
    db: Session,
    tenant_id,
    supplier_id: UUIDType,
) -> Supplier:
    supplier = db.execute(
        select(Supplier).where(
            Supplier.id == supplier_id,
            Supplier.tenant_id == tenant_id,
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


def _build_contact_response(
    contact: SupplierContact,
    supplier_name: str | None = None,
) -> SupplierContactResponse:
    return SupplierContactResponse(
        id=contact.id,
        tenant_id=contact.tenant_id,
        supplier_id=contact.supplier_id,
        first_name=contact.first_name,
        last_name=contact.last_name,
        phone=contact.phone,
        whatsapp_phone=contact.whatsapp_phone,
        email=contact.email,
        role=contact.role,
        is_supplier_manager=contact.is_supplier_manager,
        is_active=contact.is_active,
        notes=contact.notes,
        supplier_name=supplier_name,
    )


def _validate_whatsapp_identity(
    db: Session,
    tenant_id,
    whatsapp_phone: str | None,
    *,
    exclude_contact_id: UUIDType | None = None,
) -> None:
    normalized = _normalize_optional_text(whatsapp_phone)
    if not normalized:
        return

    query = select(SupplierContact).where(
        SupplierContact.tenant_id == tenant_id,
        SupplierContact.whatsapp_phone == normalized,
        SupplierContact.deleted_at.is_(None),
    )

    if exclude_contact_id is not None:
        query = query.where(SupplierContact.id != exclude_contact_id)

    existing = db.execute(query).scalar_one_or_none()

    if existing:
        raise AppException(
            status_code=400,
            message="WhatsApp phone is already assigned to another supplier contact",
            code="SUPPLIER_CONTACT_WHATSAPP_ALREADY_EXISTS",
        )


@router.get("")
def list_supplier_contacts(
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager", "staff")),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    supplier_id: UUIDType | None = None,
    active_only: bool = True,
    search: str | None = None,
):
    query = (
        select(SupplierContact, Supplier.name.label("supplier_name"))
        .join(
            Supplier,
            (Supplier.id == SupplierContact.supplier_id)
            & (Supplier.tenant_id == SupplierContact.tenant_id),
        )
        .where(
            SupplierContact.tenant_id == membership.tenant_id,
            SupplierContact.deleted_at.is_(None),
            Supplier.deleted_at.is_(None),
        )
    )

    if supplier_id:
        query = query.where(SupplierContact.supplier_id == supplier_id)

    if active_only:
        query = query.where(SupplierContact.is_active.is_(True))

    if search:
        like_value = f"%{search}%"
        query = query.where(
            or_(
                SupplierContact.first_name.ilike(like_value),
                SupplierContact.last_name.ilike(like_value),
                SupplierContact.phone.ilike(like_value),
                SupplierContact.whatsapp_phone.ilike(like_value),
                SupplierContact.email.ilike(like_value),
                SupplierContact.role.ilike(like_value),
                Supplier.name.ilike(like_value),
            )
        )

    total = db.execute(
        select(func.count()).select_from(query.subquery())
    ).scalar_one()

    rows = db.execute(
        query.order_by(
            Supplier.name.asc(),
            SupplierContact.first_name.asc(),
            SupplierContact.last_name.asc(),
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    return {
        "items": [
            _build_contact_response(contact, supplier_name).model_dump(mode="json")
            for contact, supplier_name in rows
        ],
        "page": page,
        "page_size": page_size,
        "total": total,
    }


@router.get("/{contact_id}", response_model=SupplierContactResponse)
def get_supplier_contact(
    contact_id: UUIDType,
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager", "staff")),
):
    row = db.execute(
        select(SupplierContact, Supplier.name.label("supplier_name"))
        .join(
            Supplier,
            (Supplier.id == SupplierContact.supplier_id)
            & (Supplier.tenant_id == SupplierContact.tenant_id),
        )
        .where(
            SupplierContact.id == contact_id,
            SupplierContact.tenant_id == membership.tenant_id,
            SupplierContact.deleted_at.is_(None),
            Supplier.deleted_at.is_(None),
        )
    ).one_or_none()

    if not row:
        raise AppException(
            status_code=404,
            message="Supplier contact not found",
            code="SUPPLIER_CONTACT_NOT_FOUND",
        )

    contact, supplier_name = row
    return _build_contact_response(contact, supplier_name)


@router.post("", response_model=SupplierContactResponse)
def create_supplier_contact(
    payload: SupplierContactCreate,
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager")),
):
    supplier = _get_supplier_or_404(
        db,
        membership.tenant_id,
        payload.supplier_id,
    )

    whatsapp_phone = _normalize_optional_text(payload.whatsapp_phone)
    _validate_whatsapp_identity(
        db,
        membership.tenant_id,
        whatsapp_phone,
    )

    contact = SupplierContact(
        tenant_id=membership.tenant_id,
        supplier_id=payload.supplier_id,
        first_name=payload.first_name.strip(),
        last_name=_normalize_optional_text(payload.last_name),
        phone=_normalize_optional_text(payload.phone),
        whatsapp_phone=whatsapp_phone,
        email=_normalize_optional_text(payload.email),
        role=_normalize_optional_text(payload.role),
        is_supplier_manager=payload.is_supplier_manager,
        is_active=payload.is_active,
        notes=_normalize_optional_text(payload.notes),
    )

    db.add(contact)
    db.commit()
    db.refresh(contact)

    return _build_contact_response(contact, supplier.name)


@router.put("/{contact_id}", response_model=SupplierContactResponse)
def update_supplier_contact(
    contact_id: UUIDType,
    payload: SupplierContactUpdate,
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager")),
):
    contact = db.execute(
        select(SupplierContact).where(
            SupplierContact.id == contact_id,
            SupplierContact.tenant_id == membership.tenant_id,
            SupplierContact.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not contact:
        raise AppException(
            status_code=404,
            message="Supplier contact not found",
            code="SUPPLIER_CONTACT_NOT_FOUND",
        )

    data = payload.model_dump(exclude_unset=True)

    if "supplier_id" in data and data["supplier_id"] is not None:
        _get_supplier_or_404(
            db,
            membership.tenant_id,
            data["supplier_id"],
        )

    if "whatsapp_phone" in data:
        normalized_whatsapp = _normalize_optional_text(data["whatsapp_phone"])
        _validate_whatsapp_identity(
            db,
            membership.tenant_id,
            normalized_whatsapp,
            exclude_contact_id=contact.id,
        )
        data["whatsapp_phone"] = normalized_whatsapp

    for field in ("last_name", "phone", "email", "role", "notes"):
        if field in data:
            data[field] = _normalize_optional_text(data[field])

    if "first_name" in data and data["first_name"] is not None:
        data["first_name"] = data["first_name"].strip()

    for field, value in data.items():
        setattr(contact, field, value)

    supplier = _get_supplier_or_404(
        db,
        membership.tenant_id,
        contact.supplier_id,
    )

    db.commit()
    db.refresh(contact)

    return _build_contact_response(contact, supplier.name)


@router.delete("/{contact_id}")
def delete_supplier_contact(
    contact_id: UUIDType,
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager")),
):
    contact = db.execute(
        select(SupplierContact).where(
            SupplierContact.id == contact_id,
            SupplierContact.tenant_id == membership.tenant_id,
            SupplierContact.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not contact:
        raise AppException(
            status_code=404,
            message="Supplier contact not found",
            code="SUPPLIER_CONTACT_NOT_FOUND",
        )

    contact.deleted_at = func.now()
    contact.is_active = False

    db.commit()

    return {"message": "Supplier contact deleted"}
