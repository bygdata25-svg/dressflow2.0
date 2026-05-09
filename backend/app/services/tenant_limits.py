from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.tenant import Tenant
from app.models.user import User, UserTenant


def get_tenant_active_users_count(db: Session, tenant_id) -> int:
    return (
        db.query(func.count(UserTenant.user_id))
        .join(User, User.id == UserTenant.user_id)
        .filter(
            UserTenant.tenant_id == tenant_id,
            User.is_active.is_(True),
        )
        .scalar()
        or 0
    )


def validate_tenant_user_limit(db: Session, tenant_id) -> None:
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()

    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant no encontrado.",
        )

    active_users_count = get_tenant_active_users_count(db, tenant_id)

    if active_users_count >= tenant.max_users:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El tenant alcanzó el límite máximo de usuarios permitidos ({tenant.max_users}).",
        )
