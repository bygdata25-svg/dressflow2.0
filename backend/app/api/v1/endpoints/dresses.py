from uuid import UUID as UUIDType

from fastapi import APIRouter, Depends, Query, UploadFile, File
from sqlalchemy import select, func, or_, update
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.core.exceptions import AppException
from app.models.capsule import Capsule
from app.models.customer import Customer
from app.models.dress import Dress
from app.models.dress_image import DressImage
from app.models.loan import Loan
from app.schemas.dress import (
    DressCreate,
    DressUpdate,
    DressResponse,
    DressImageResponse,
)
from app.services.audit_service import create_audit_log
from app.services.cloudinary_service import upload_image, delete_image
from app.models.dress_status_history import DressStatusHistory

router = APIRouter(prefix="/dresses", tags=["dresses"])


def build_dress_response(db: Session, dress: Dress) -> DressResponse:
    main_image = db.execute(
        select(DressImage)
        .where(DressImage.dress_id == dress.id)
        .order_by(
            DressImage.is_primary.desc(),
            DressImage.position.asc(),
            DressImage.created_at.asc(),
        )
    ).scalars().first()

    capsule_name = None
    if getattr(dress, "capsule_id", None):
        capsule = db.execute(
            select(Capsule).where(
                Capsule.id == dress.capsule_id,
                Capsule.deleted_at.is_(None),
            )
        ).scalar_one_or_none()
        capsule_name = capsule.name if capsule else None

    return DressResponse(
        id=dress.id,
        tenant_id=dress.tenant_id,
        code=dress.code,
        name=dress.name,
        description=dress.description,
        size=dress.size,
        color=dress.color,
        sale_price=dress.sale_price,
        rental_price=dress.rental_price,
        status=dress.status,
        main_image_url=(
            main_image.file_url
            if main_image
            else dress.photo_url
        ),
        capsule_id=getattr(dress, "capsule_id", None),
        capsule_name=capsule_name,
    )


def validate_capsule_for_tenant(
    db: Session,
    tenant_id,
    capsule_id,
):
    if not capsule_id:
        return None

    capsule = db.execute(
        select(Capsule).where(
            Capsule.id == capsule_id,
            Capsule.tenant_id == tenant_id,
            Capsule.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not capsule:
        raise AppException(
            400,
            "Capsule does not exist for this tenant",
            "CAPSULE_NOT_FOUND_FOR_TENANT",
        )

    return capsule


@router.get("")
def list_dresses(
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager", "staff")),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
    status: str | None = None,
    capsule_id: UUIDType | None = None,
):
    query = select(Dress).where(
        Dress.tenant_id == membership.tenant_id,
        Dress.deleted_at.is_(None),
    )

    if search:
        like_value = f"%{search}%"
        query = query.where(
            or_(
                Dress.name.ilike(like_value),
                Dress.code.ilike(like_value),
            )
        )

    if status:
        query = query.where(Dress.status == status)

    if capsule_id:
        query = query.where(Dress.capsule_id == capsule_id)

    total_query = select(func.count()).select_from(query.subquery())
    total = db.execute(total_query).scalar_one()

    query = (
        query.order_by(Dress.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    rows = db.execute(query).scalars().all()

    return {
        "items": [build_dress_response(db, row).model_dump(mode="json") for row in rows],
        "page": page,
        "page_size": page_size,
        "total": total,
    }


@router.get("/{dress_id}", response_model=DressResponse)
def get_dress(
    dress_id: UUIDType,
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager", "staff")),
):
    dress = db.execute(
        select(Dress).where(
            Dress.id == dress_id,
            Dress.tenant_id == membership.tenant_id,
            Dress.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not dress:
        raise AppException(404, "Dress not found", "DRESS_NOT_FOUND")

    return build_dress_response(db, dress)


@router.get("/{dress_id}/loans")
def get_dress_loans(
    dress_id: UUIDType,
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager", "staff")),
):
    dress = db.execute(
        select(Dress).where(
            Dress.id == dress_id,
            Dress.tenant_id == membership.tenant_id,
        )
    ).scalar_one_or_none()

    if not dress:
        raise AppException(404, "Dress not found", "DRESS_NOT_FOUND")

    loans = db.execute(
        select(Loan)
        .where(
            Loan.dress_id == dress_id,
            Loan.tenant_id == membership.tenant_id,
            Loan.deleted_at.is_(None),
        )
        .order_by(Loan.created_at.desc())
    ).scalars().all()

    result = []

    for loan in loans:
        customer = db.execute(
            select(Customer).where(Customer.id == loan.customer_id)
        ).scalar_one_or_none()

        result.append(
            {
                "id": str(loan.id),
                "start_date": str(loan.start_date),
                "expected_return_date": str(loan.expected_return_date) if loan.expected_return_date else None,
                "actual_return_date": str(loan.actual_return_date) if loan.actual_return_date else None,
                "status": loan.status,
                "customer_name": (
                    f"{customer.first_name} {customer.last_name}" if customer else None
                ),
            }
        )

    return result


@router.post("", response_model=DressResponse)
def create_dress(
    payload: DressCreate,
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager")),
):
    existing = db.execute(
        select(Dress).where(
            Dress.tenant_id == membership.tenant_id,
            Dress.code == payload.code,
            Dress.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if existing:
        raise AppException(400, "Dress code already exists for this tenant", "DRESS_DUPLICATE_CODE")

    validate_capsule_for_tenant(
        db=db,
        tenant_id=membership.tenant_id,
        capsule_id=getattr(payload, "capsule_id", None),
    )

    dress = Dress(
        tenant_id=membership.tenant_id,
        capsule_id=getattr(payload, "capsule_id", None),
        code=payload.code,
        name=payload.name,
        description=payload.description,
        size=payload.size,
        color=payload.color,
        sale_price=payload.sale_price,
        rental_price=payload.rental_price,
        status="AVAILABLE",
        photo_url=payload.photo_url,
    )

    db.add(dress)
    db.flush()

    create_audit_log(
        db=db,
        tenant_id=membership.tenant_id,
        user_id=membership.user_id,
        entity_type="dress",
        entity_id=dress.id,
        action="create",
        payload={
            "code": dress.code,
            "name": dress.name,
            "status": dress.status,
            "capsule_id": str(dress.capsule_id) if dress.capsule_id else None,
        },
    )

    db.commit()
    db.refresh(dress)

    return build_dress_response(db, dress)


@router.put("/{dress_id}", response_model=DressResponse)
def update_dress(
    dress_id: UUIDType,
    payload: DressUpdate,
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager")),
):
    dress = db.execute(
        select(Dress).where(
            Dress.id == dress_id,
            Dress.tenant_id == membership.tenant_id,
            Dress.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not dress:
        raise AppException(404, "Dress not found", "DRESS_NOT_FOUND")

    duplicate = db.execute(
        select(Dress).where(
            Dress.tenant_id == membership.tenant_id,
            Dress.code == payload.code,
            Dress.id != dress_id,
            Dress.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if duplicate:
        raise AppException(400, "Dress code already exists for this tenant", "DRESS_DUPLICATE_CODE")

    validate_capsule_for_tenant(
        db=db,
        tenant_id=membership.tenant_id,
        capsule_id=getattr(payload, "capsule_id", None),
    )

    previous_status = dress.status
    new_status = payload.status

    dress.capsule_id = getattr(payload, "capsule_id", None)
    dress.code = payload.code
    dress.name = payload.name
    dress.description = payload.description
    dress.size = payload.size
    dress.color = payload.color
    dress.status = new_status
    dress.sale_price = payload.sale_price
    dress.rental_price = payload.rental_price

    if previous_status != new_status:
        history = DressStatusHistory(
            tenant_id=membership.tenant_id,
            dress_id=dress.id,
            from_status=previous_status,
            to_status=new_status,
            created_by=membership.user_id,
        )
        db.add(history)

    create_audit_log(
        db=db,
        tenant_id=membership.tenant_id,
        user_id=membership.user_id,
        entity_type="dress",
        entity_id=dress.id,
        action="update",
        payload={
            "code": dress.code,
            "name": dress.name,
            "status": dress.status,
            "capsule_id": str(dress.capsule_id) if dress.capsule_id else None,
        },
    )

    db.commit()
    db.refresh(dress)

    return build_dress_response(db, dress)


@router.delete("/{dress_id}")
def delete_dress(
    dress_id: UUIDType,
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager")),
):
    dress = db.execute(
        select(Dress).where(
            Dress.id == dress_id,
            Dress.tenant_id == membership.tenant_id,
            Dress.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not dress:
        raise AppException(404, "Dress not found", "DRESS_NOT_FOUND")

    dress.deleted_at = func.now()

    create_audit_log(
        db=db,
        tenant_id=membership.tenant_id,
        user_id=membership.user_id,
        entity_type="dress",
        entity_id=dress.id,
        action="soft_delete",
        payload={
            "code": dress.code,
            "name": dress.name,
            "capsule_id": str(dress.capsule_id) if dress.capsule_id else None,
        },
    )

    db.commit()

    return {"message": "Dress deleted"}


@router.get("/{dress_id}/images", response_model=list[DressImageResponse])
def list_dress_images(
    dress_id: UUIDType,
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager", "staff")),
):
    dress = db.execute(
        select(Dress).where(
            Dress.id == dress_id,
            Dress.tenant_id == membership.tenant_id,
        )
    ).scalar_one_or_none()

    if not dress:
        raise AppException(404, "Dress not found", "DRESS_NOT_FOUND")

    images = db.execute(
        select(DressImage)
        .where(
            DressImage.dress_id == dress_id,
            DressImage.tenant_id == membership.tenant_id,
        )
        .order_by(
            DressImage.is_primary.desc(),
            DressImage.position.asc(),
            DressImage.created_at.asc(),
        )
    ).scalars().all()

    return images


@router.post("/{dress_id}/images", response_model=DressImageResponse)
def upload_dress_image(
    dress_id: UUIDType,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager")),
):
    dress = db.execute(
        select(Dress).where(
            Dress.id == dress_id,
            Dress.tenant_id == membership.tenant_id,
            Dress.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not dress:
        raise AppException(404, "Dress not found", "DRESS_NOT_FOUND")

    content_type = (file.content_type or "").lower()
    if content_type not in {"image/jpeg", "image/png", "image/webp", "image/jpg"}:
        raise AppException(400, "Unsupported image format", "IMAGE_INVALID_FORMAT")

    result = upload_image(
        file_obj=file.file,
        tenant_slug=str(membership.tenant_id),
        entity="dresses",
        asset_key=dress.code,
        overwrite=True,
    )
    file_url = result["url"]
    public_id = result["public_id"]

    current_count = db.execute(
        select(func.count()).select_from(
            select(DressImage).where(DressImage.dress_id == dress_id).subquery()
        )
    ).scalar_one()

    has_primary = db.execute(
        select(DressImage).where(
            DressImage.dress_id == dress_id,
            DressImage.is_primary.is_(True),
        )
    ).scalars().first()

    image = DressImage(
        tenant_id=membership.tenant_id,
        dress_id=dress_id,
        file_path=public_id,
        file_url=file_url,
        is_primary=has_primary is None,
        position=current_count,
    )

    db.add(image)
    db.flush()

    if image.is_primary:
        dress.photo_url = file_url
        if hasattr(dress, "photo_public_id"):
            dress.photo_public_id = public_id

    create_audit_log(
        db=db,
        tenant_id=membership.tenant_id,
        user_id=membership.user_id,
        entity_type="dress_image",
        entity_id=image.id,
        action="create",
        payload={"dress_id": str(dress_id), "file_url": image.file_url},
    )

    db.commit()
    db.refresh(image)
    db.refresh(dress)

    return image

@router.post("/{dress_id}/images/{image_id}/set-primary")
def set_primary_dress_image(
    dress_id: UUIDType,
    image_id: UUIDType,
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager")),
):
    dress = db.execute(
        select(Dress).where(
            Dress.id == dress_id,
            Dress.tenant_id == membership.tenant_id,
            Dress.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not dress:
        raise AppException(404, "Dress not found", "DRESS_NOT_FOUND")

    image = db.execute(
        select(DressImage).where(
            DressImage.id == image_id,
            DressImage.dress_id == dress_id,
            DressImage.tenant_id == membership.tenant_id,
        )
    ).scalar_one_or_none()

    if not image:
        raise AppException(404, "Dress image not found", "DRESS_IMAGE_NOT_FOUND")

    db.execute(
        update(DressImage)
        .where(
            DressImage.dress_id == dress_id,
            DressImage.tenant_id == membership.tenant_id,
        )
        .values(is_primary=False)
    )

    image.is_primary = True
    dress.photo_url = image.file_url
    if hasattr(dress, "photo_public_id"):
        dress.photo_public_id = image.file_path

    create_audit_log(
        db=db,
        tenant_id=membership.tenant_id,
        user_id=membership.user_id,
        entity_type="dress_image",
        entity_id=image.id,
        action="set_primary",
        payload={"dress_id": str(dress_id)},
    )

    db.commit()

    return {"message": "Primary image updated"}


@router.get("/{dress_id}/status-history")
def get_dress_status_history(
    dress_id: UUIDType,
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager", "staff")),
):
    from app.models.user import User

    rows = db.execute(
        select(
            DressStatusHistory,
            User.first_name,
            User.last_name,
            User.email,
        )
        .outerjoin(User, User.id == DressStatusHistory.created_by)
        .where(
            DressStatusHistory.dress_id == dress_id,
            DressStatusHistory.tenant_id == membership.tenant_id,
        )
        .order_by(DressStatusHistory.created_at.desc())
    ).all()

    result = []

    for history, first_name, last_name, email in rows:
        full_name = (
            f"{(first_name or '').strip()} {(last_name or '').strip()}".strip()
        )

        if not full_name:
            full_name = email or "Usuario"

        result.append({
            "from": history.from_status,
            "to": history.to_status,
            "date": history.created_at.isoformat() if history.created_at else None,
            "user": full_name,
        })

    return result


@router.delete("/{dress_id}/images/{image_id}")
def delete_dress_image(
    dress_id: UUIDType,
    image_id: UUIDType,
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager")),
):
    dress = db.execute(
        select(Dress).where(
            Dress.id == dress_id,
            Dress.tenant_id == membership.tenant_id,
            Dress.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not dress:
        raise AppException(404, "Dress not found", "DRESS_NOT_FOUND")

    image = db.execute(
        select(DressImage).where(
            DressImage.id == image_id,
            DressImage.dress_id == dress_id,
            DressImage.tenant_id == membership.tenant_id,
        )
    ).scalar_one_or_none()

    if not image:
        raise AppException(404, "Dress image not found", "DRESS_IMAGE_NOT_FOUND")

    deleted_public_id = image.file_path
    was_primary = image.is_primary

    db.delete(image)
    db.flush()

    try:
        delete_image(deleted_public_id)
    except Exception:
        pass

    next_primary = db.execute(
        select(DressImage)
        .where(
            DressImage.dress_id == dress_id,
            DressImage.tenant_id == membership.tenant_id,
        )
        .order_by(
            DressImage.position.asc(),
            DressImage.created_at.asc(),
        )
    ).scalars().first()

    if next_primary and was_primary:
        next_primary.is_primary = True
        dress.photo_url = next_primary.file_url
        if hasattr(dress, "photo_public_id"):
            dress.photo_public_id = next_primary.file_path
    elif was_primary:
        dress.photo_url = None
        if hasattr(dress, "photo_public_id"):
            dress.photo_public_id = None

    create_audit_log(
        db=db,
        tenant_id=membership.tenant_id,
        user_id=membership.user_id,
        entity_type="dress_image",
        entity_id=image_id,
        action="delete",
        payload={"dress_id": str(dress_id)},
    )

    db.commit()

    return {"message": "Dress image deleted"}
