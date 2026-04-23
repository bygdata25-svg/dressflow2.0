from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_membership
from app.core.database import get_db
from app.models.accessory import Accessory
from app.models.tenant import Tenant
from app.schemas.accessory import (
    AccessoryResponse,
    PaginatedAccessoryResponse,
)
from app.services.cloudinary_service import delete_image, upload_image

router = APIRouter(prefix="/accessories", tags=["accessories"])


def get_accessory_or_404(db: Session, tenant_id: UUID, accessory_id: UUID) -> Accessory:
    accessory = db.execute(
        select(Accessory).where(
            Accessory.id == accessory_id,
            Accessory.tenant_id == tenant_id,
            Accessory.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not accessory:
        raise HTTPException(status_code=404, detail="Accesorio no encontrado")

    return accessory


@router.get("", response_model=PaginatedAccessoryResponse)
def list_accessories(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    search: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    category: str | None = Query(default=None),
    membership=Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    tenant_id = membership.tenant_id

    stmt = select(Accessory).where(
        Accessory.tenant_id == tenant_id,
        Accessory.deleted_at.is_(None),
    )

    if search:
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Accessory.code.ilike(pattern),
                Accessory.name.ilike(pattern),
                Accessory.category.ilike(pattern),
                Accessory.color.ilike(pattern),
                Accessory.size.ilike(pattern),
                Accessory.notes.ilike(pattern),
            )
        )

    if status_filter:
        stmt = stmt.where(Accessory.status == status_filter)

    if category:
        stmt = stmt.where(Accessory.category == category)

    count_stmt = select(func.count()).select_from(Accessory).where(
        Accessory.tenant_id == tenant_id,
        Accessory.deleted_at.is_(None),
    )

    if search:
        pattern = f"%{search.strip()}%"
        count_stmt = count_stmt.where(
            or_(
                Accessory.code.ilike(pattern),
                Accessory.name.ilike(pattern),
                Accessory.category.ilike(pattern),
                Accessory.color.ilike(pattern),
                Accessory.size.ilike(pattern),
                Accessory.notes.ilike(pattern),
            )
        )

    if status_filter:
        count_stmt = count_stmt.where(Accessory.status == status_filter)

    if category:
        count_stmt = count_stmt.where(Accessory.category == category)

    total = db.execute(count_stmt).scalar_one()

    items = db.execute(
        stmt.order_by(Accessory.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).scalars().all()

    return {
        "items": items,
        "page": page,
        "page_size": page_size,
        "total": total,
    }


@router.get("/{accessory_id}", response_model=AccessoryResponse)
def get_accessory(
    accessory_id: UUID,
    membership=Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    return get_accessory_or_404(db, membership.tenant_id, accessory_id)


@router.post("", response_model=AccessoryResponse, status_code=status.HTTP_201_CREATED)
def create_accessory(
    code: str | None = Form(default=None),
    name: str = Form(...),
    description: str | None = Form(default=None),
    category: str | None = Form(default=None),
    color: str | None = Form(default=None),
    size: str | None = Form(default=None),
    unit_cost: Decimal = Form(default=Decimal("0.00")),
    sale_price: Decimal = Form(default=Decimal("0.00")),
    stock: int = Form(default=0),
    min_stock: int = Form(default=0),
    status_value: str = Form(default="ACTIVE", alias="status"),
    notes: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    membership=Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    tenant_id = membership.tenant_id

    normalized_code = code.strip() if code else None
    if normalized_code:
        existing = db.execute(
            select(Accessory).where(
                Accessory.tenant_id == tenant_id,
                Accessory.code == normalized_code,
                Accessory.deleted_at.is_(None),
            )
        ).scalar_one_or_none()

        if existing:
            raise HTTPException(status_code=400, detail="Ya existe un accesorio con ese código")

    photo_url = None
    photo_public_id = None

    if file is not None:
        tenant = db.execute(
            select(Tenant).where(Tenant.id == tenant_id)
        ).scalar_one()

        asset_key = normalized_code or name.strip().replace(" ", "_")

        result = upload_image(
            file_obj=file.file,
            tenant_slug=tenant.slug,
            entity="accessories",
            asset_key=asset_key,
            overwrite=True,
        )

        photo_url = result["url"]
        photo_public_id = result["public_id"]

    accessory = Accessory(
        tenant_id=tenant_id,
        code=normalized_code,
        name=name.strip(),
        description=description.strip() if description else None,
        category=category.strip() if category else None,
        color=color.strip() if color else None,
        size=size.strip() if size else None,
        unit_cost=unit_cost,
        sale_price=sale_price,
        stock=stock,
        min_stock=min_stock,
        status=status_value,
        photo_url=photo_url,
        photo_public_id=photo_public_id,
        notes=notes.strip() if notes else None,
    )

    db.add(accessory)
    db.commit()
    db.refresh(accessory)

    return accessory


@router.put("/{accessory_id}", response_model=AccessoryResponse)
def update_accessory(
    accessory_id: UUID,
    code: str | None = Form(default=None),
    name: str | None = Form(default=None),
    description: str | None = Form(default=None),
    category: str | None = Form(default=None),
    color: str | None = Form(default=None),
    size: str | None = Form(default=None),
    unit_cost: Decimal | None = Form(default=None),
    sale_price: Decimal | None = Form(default=None),
    stock: int | None = Form(default=None),
    min_stock: int | None = Form(default=None),
    status_value: str | None = Form(default=None, alias="status"),
    notes: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    membership=Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    tenant_id = membership.tenant_id
    accessory = get_accessory_or_404(db, tenant_id, accessory_id)

    normalized_code = code.strip() if code else None
    if code is not None:
        if normalized_code:
            existing = db.execute(
                select(Accessory).where(
                    Accessory.tenant_id == tenant_id,
                    Accessory.code == normalized_code,
                    Accessory.id != accessory_id,
                    Accessory.deleted_at.is_(None),
                )
            ).scalar_one_or_none()

            if existing:
                raise HTTPException(status_code=400, detail="Ya existe un accesorio con ese código")

        accessory.code = normalized_code

    if name is not None:
        accessory.name = name.strip()

    if description is not None:
        accessory.description = description.strip() or None

    if category is not None:
        accessory.category = category.strip() or None

    if color is not None:
        accessory.color = color.strip() or None

    if size is not None:
        accessory.size = size.strip() or None

    if unit_cost is not None:
        accessory.unit_cost = unit_cost

    if sale_price is not None:
        accessory.sale_price = sale_price

    if stock is not None:
        accessory.stock = stock

    if min_stock is not None:
        accessory.min_stock = min_stock

    if status_value is not None:
        accessory.status = status_value

    if notes is not None:
        accessory.notes = notes.strip() or None

    if file is not None:
        tenant = db.execute(
            select(Tenant).where(Tenant.id == tenant_id)
        ).scalar_one()

        old_public_id = getattr(accessory, "photo_public_id", None)

        asset_key = accessory.code or accessory.name.replace(" ", "_")

        result = upload_image(
            file_obj=file.file,
            tenant_slug=tenant.slug,
            entity="accessories",
            asset_key=asset_key,
            overwrite=True,
        )

        accessory.photo_url = result["url"]
        accessory.photo_public_id = result["public_id"]

        if old_public_id:
            delete_image(old_public_id)

    accessory.updated_at = datetime.utcnow()

    db.add(accessory)
    db.commit()
    db.refresh(accessory)

    return accessory


@router.delete("/{accessory_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_accessory(
    accessory_id: UUID,
    membership=Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    accessory = get_accessory_or_404(db, membership.tenant_id, accessory_id)

    if getattr(accessory, "photo_public_id", None):
        delete_image(accessory.photo_public_id)

    accessory.deleted_at = datetime.utcnow()
    accessory.updated_at = datetime.utcnow()

    db.add(accessory)
    db.commit()

    return None
