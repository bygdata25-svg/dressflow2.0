from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID as UUIDType

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.core.exceptions import AppException
from app.models.trim import Trim
from app.models.tenant import Tenant
from app.schemas.trim import TrimResponse
from app.services.audit_service import create_audit_log
from app.services.cloudinary_service import delete_image, upload_image

router = APIRouter(prefix="/trims", tags=["trims"])


@router.get("")
def list_trims(
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager", "staff")),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
):
    query = select(Trim).where(
        Trim.tenant_id == membership.tenant_id,
        Trim.deleted_at.is_(None),
    )

    if search:
        like_value = f"%{search}%"
        query = query.where(
            or_(
                Trim.code.ilike(like_value),
                Trim.name.ilike(like_value),
                Trim.category.ilike(like_value),
            )
        )

    total = db.execute(select(func.count()).select_from(query.subquery())).scalar_one()

    rows = db.execute(
        query.order_by(Trim.name.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).scalars().all()

    return {
        "items": [TrimResponse.model_validate(row).model_dump(mode="json") for row in rows],
        "page": page,
        "page_size": page_size,
        "total": total,
    }


@router.post("", response_model=TrimResponse)
def create_trim(
    code: str = Form(...),
    name: str = Form(...),
    category: str | None = Form(default=None),
    unit: str = Form(default="unit"),
    current_stock: Decimal = Form(default=0),
    min_stock: Decimal = Form(default=0),
    supplier_id: UUIDType | None = Form(default=None),
    unit_cost: Decimal | None = Form(default=None),
    unit_cost_currency: str = Form(default="ARS"),
    notes: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager")),
):
    duplicate = db.execute(
        select(Trim).where(
            Trim.tenant_id == membership.tenant_id,
            Trim.code == code,
            Trim.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if duplicate:
        raise AppException(400, "Trim code already exists", "TRIM_CODE_DUPLICATE")

    photo_url = None
    photo_public_id = None

    if file is not None:
        tenant = db.execute(
            select(Tenant).where(Tenant.id == membership.tenant_id)
        ).scalar_one()

        result = upload_image(
            file_obj=file.file,
            tenant_slug=tenant.slug,
            entity="trims",
            asset_key=code.strip(),
            overwrite=True,
        )

        photo_url = result["url"]
        photo_public_id = result["public_id"]

    trim = Trim(
        tenant_id=membership.tenant_id,
        code=code.strip(),
        name=name.strip(),
        category=category.strip() if category else None,
        unit=unit.strip() if unit else "unit",
        current_stock=current_stock,
        reserved_stock=0,
        min_stock=min_stock,
        supplier_id=supplier_id,
        unit_cost=unit_cost,
        unit_cost_currency=unit_cost_currency,
        photo_url=photo_url,
        photo_public_id=photo_public_id,
        notes=notes.strip() if notes else None,
    )

    db.add(trim)
    db.flush()

    create_audit_log(
        db=db,
        tenant_id=membership.tenant_id,
        user_id=membership.user_id,
        entity_type="trim",
        entity_id=trim.id,
        action="create",
        payload={"code": trim.code, "name": trim.name},
    )

    db.commit()
    db.refresh(trim)

    return trim


@router.patch("/{trim_id}", response_model=TrimResponse)
def update_trim(
    trim_id: str,
    code: str = Form(...),
    name: str = Form(...),
    category: str | None = Form(default=None),
    unit: str = Form(default="unit"),
    current_stock: Decimal = Form(default=0),
    min_stock: Decimal = Form(default=0),
    supplier_id: UUIDType | None = Form(default=None),
    unit_cost: Decimal | None = Form(default=None),
    unit_cost_currency: str = Form(default="ARS"),
    notes: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager")),
):
    trim = db.execute(
        select(Trim).where(
            Trim.id == trim_id,
            Trim.tenant_id == membership.tenant_id,
            Trim.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    trim.unit_cost_currency = unit_cost_currency

    if not trim:
        raise AppException(404, "Trim not found", "TRIM_NOT_FOUND")

    duplicate = db.execute(
        select(Trim).where(
            Trim.tenant_id == membership.tenant_id,
            Trim.code == code,
            Trim.id != trim_id,
            Trim.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if duplicate:
        raise AppException(400, "Trim code already exists", "TRIM_CODE_DUPLICATE")

    trim.code = code.strip()
    trim.name = name.strip()
    trim.category = category.strip() if category else None
    trim.unit = unit.strip() if unit else "unit"
    trim.current_stock = current_stock
    trim.min_stock = min_stock
    trim.supplier_id = supplier_id
    trim.unit_cost = unit_cost
    trim.notes = notes.strip() if notes else None

    if file is not None:
        tenant = db.execute(
            select(Tenant).where(Tenant.id == membership.tenant_id)
        ).scalar_one()

        old_public_id = getattr(trim, "photo_public_id", None)

        result = upload_image(
            file_obj=file.file,
            tenant_slug=tenant.slug,
            entity="trims",
            asset_key=trim.code,
            overwrite=True,
        )

        trim.photo_url = result["url"]
        trim.photo_public_id = result["public_id"]

        if old_public_id:
            delete_image(old_public_id)

    db.add(trim)
    db.flush()

    create_audit_log(
        db=db,
        tenant_id=membership.tenant_id,
        user_id=membership.user_id,
        entity_type="trim",
        entity_id=trim.id,
        action="update",
        payload={"code": trim.code, "name": trim.name},
    )

    db.commit()
    db.refresh(trim)

    return trim


@router.delete("/{trim_id}")
def delete_trim(
    trim_id: str,
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager")),
):
    trim = db.execute(
        select(Trim).where(
            Trim.id == trim_id,
            Trim.tenant_id == membership.tenant_id,
            Trim.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not trim:
        raise AppException(404, "Trim not found", "TRIM_NOT_FOUND")

    if getattr(trim, "photo_public_id", None):
        delete_image(trim.photo_public_id)

    trim.deleted_at = datetime.now(timezone.utc)
    db.add(trim)
    db.flush()

    create_audit_log(
        db=db,
        tenant_id=membership.tenant_id,
        user_id=membership.user_id,
        entity_type="trim",
        entity_id=trim.id,
        action="soft_delete",
        payload={"code": trim.code, "name": trim.name},
    )

    db.commit()

    return {"message": "Trim deleted"}
