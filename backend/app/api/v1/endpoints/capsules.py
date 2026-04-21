from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.models.capsule import Capsule
from app.models.dress import Dress
from app.schemas.capsule import CapsuleCreate, CapsuleUpdate

router = APIRouter(prefix="/capsules", tags=["capsules"])


@router.get("")
def list_capsules(
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager", "staff")),
):
    tenant_id = membership.tenant_id

    rows = db.execute(
        select(Capsule)
        .where(
            Capsule.tenant_id == tenant_id,
            Capsule.deleted_at.is_(None),
        )
        .order_by(Capsule.name.asc())
    ).scalars().all()

    result = []
    for capsule in rows:
        dresses_count = db.execute(
            select(func.count()).select_from(Dress).where(
                Dress.tenant_id == tenant_id,
                Dress.deleted_at.is_(None),
                Dress.capsule_id == capsule.id,
            )
        ).scalar_one()

        result.append(
            {
                "id": str(capsule.id),
                "name": capsule.name,
                "description": capsule.description,
                "is_active": capsule.is_active,
                "dresses_count": dresses_count,
            }
        )

    return result


@router.post("", status_code=status.HTTP_201_CREATED)
def create_capsule(
    payload: CapsuleCreate,
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager")),
):
    tenant_id = membership.tenant_id

    existing = db.execute(
        select(Capsule).where(
            Capsule.tenant_id == tenant_id,
            Capsule.deleted_at.is_(None),
            func.lower(Capsule.name) == payload.name.strip().lower(),
        )
    ).scalar_one_or_none()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe una cápsula con ese nombre.",
        )

    capsule = Capsule(
        tenant_id=tenant_id,
        name=payload.name.strip(),
        description=payload.description,
        is_active=payload.is_active,
    )

    db.add(capsule)
    db.commit()
    db.refresh(capsule)

    return {
        "id": str(capsule.id),
        "name": capsule.name,
        "description": capsule.description,
        "is_active": capsule.is_active,
    }


@router.get("/{capsule_id}")
def get_capsule(
    capsule_id: str,
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager", "staff")),
):
    tenant_id = membership.tenant_id

    capsule = db.execute(
        select(Capsule).where(
            Capsule.id == capsule_id,
            Capsule.tenant_id == tenant_id,
            Capsule.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not capsule:
        raise HTTPException(status_code=404, detail="Cápsula no encontrada.")

    dresses_count = db.execute(
        select(func.count()).select_from(Dress).where(
            Dress.tenant_id == tenant_id,
            Dress.deleted_at.is_(None),
            Dress.capsule_id == capsule.id,
        )
    ).scalar_one()

    return {
        "id": str(capsule.id),
        "name": capsule.name,
        "description": capsule.description,
        "is_active": capsule.is_active,
        "dresses_count": dresses_count,
    }


@router.patch("/{capsule_id}")
def update_capsule(
    capsule_id: str,
    payload: CapsuleUpdate,
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager")),
):
    tenant_id = membership.tenant_id

    capsule = db.execute(
        select(Capsule).where(
            Capsule.id == capsule_id,
            Capsule.tenant_id == tenant_id,
            Capsule.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not capsule:
        raise HTTPException(status_code=404, detail="Cápsula no encontrada.")

    data = payload.dict(exclude_unset=True)

    if "name" in data:
        normalized_name = data["name"].strip()

        existing = db.execute(
            select(Capsule).where(
                Capsule.tenant_id == tenant_id,
                Capsule.deleted_at.is_(None),
                func.lower(Capsule.name) == normalized_name.lower(),
                Capsule.id != capsule.id,
            )
        ).scalar_one_or_none()

        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ya existe una cápsula con ese nombre.",
            )

        capsule.name = normalized_name

    if "description" in data:
        capsule.description = data["description"]

    if "is_active" in data:
        capsule.is_active = data["is_active"]

    db.add(capsule)
    db.commit()
    db.refresh(capsule)

    return {
        "id": str(capsule.id),
        "name": capsule.name,
        "description": capsule.description,
        "is_active": capsule.is_active,
    }


@router.delete("/{capsule_id}")
def delete_capsule(
    capsule_id: str,
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager")),
):
    tenant_id = membership.tenant_id

    capsule = db.execute(
        select(Capsule).where(
            Capsule.id == capsule_id,
            Capsule.tenant_id == tenant_id,
            Capsule.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not capsule:
        raise HTTPException(status_code=404, detail="Cápsula no encontrada.")

    dresses_using_capsule = db.execute(
        select(func.count()).select_from(Dress).where(
            Dress.tenant_id == tenant_id,
            Dress.deleted_at.is_(None),
            Dress.capsule_id == capsule.id,
        )
    ).scalar_one()

    if dresses_using_capsule > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede eliminar la cápsula porque tiene vestidos asignados.",
        )

    from datetime import datetime
    capsule.deleted_at = datetime.utcnow()

    db.add(capsule)
    db.commit()

    return {"ok": True}
