from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, or_, and_
from sqlalchemy.orm import Session

from app.api.deps import get_current_membership, get_current_user
from app.core.database import get_db
from app.core.exceptions import AppException
from app.models.appointment import Appointment
from app.models.user import User, UserTenant
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentRead,
    AppointmentUpdate,
)

router = APIRouter(
    prefix="/appointments",
    tags=["appointments"],
)


@router.get("", response_model=list[AppointmentRead])
def list_appointments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_membership: UserTenant = Depends(get_current_membership),
    status: str | None = Query(default=None),
    appointment_type: str | None = Query(default=None),
    source_type: str | None = Query(default=None),
    from_date: datetime | None = Query(default=None),
    to_date: datetime | None = Query(default=None),
    scope: str = Query(default="mine"),
    priority: str | None = Query(default=None),
    assigned_user_id: UUID | None = Query(default=None),
    process_type_id: UUID | None = Query(default=None),
    production_order_id: UUID | None = Query(default=None),
):
    query = select(Appointment).where(
        Appointment.tenant_id == current_membership.tenant_id
    )

    normalized_scope = scope.strip().lower()

    if normalized_scope not in {"mine", "all"}:
        raise AppException(
            status_code=400,
            message="Invalid appointments scope",
            code="INVALID_APPOINTMENTS_SCOPE",
        )

    user_role = str(current_membership.role or "").upper()

    if normalized_scope == "all":
        if user_role not in {"ADMIN", "MANAGER", "SUPERADMIN"}:
            raise AppException(
                status_code=403,
                message="Appointments scope not allowed",
                code="APPOINTMENTS_SCOPE_NOT_ALLOWED",
            )
    else:
        query = query.where(
            or_(
                Appointment.assigned_user_id == current_user.id,
                and_(
                    Appointment.assigned_user_id.is_(None),
                    Appointment.appointment_type == "PRODUCTION_STAGE",
                ),
            )
        )

    if status:
        query = query.where(
            Appointment.status == status.strip().upper()
        )

    if appointment_type:
        query = query.where(
            Appointment.appointment_type == appointment_type.strip().upper()
        )

    if source_type:
        query = query.where(
            Appointment.source_type == source_type.strip().upper()
        )

    if priority:
        query = query.where(
            Appointment.priority == priority.strip().upper()
        )

    if assigned_user_id:
        query = query.where(
            Appointment.assigned_user_id == assigned_user_id
        )

    if process_type_id:
        query = query.where(
            Appointment.process_type_id == process_type_id
        )

    if production_order_id:
        query = query.where(
            Appointment.production_order_id == production_order_id
        )

    if from_date:
        query = query.where(Appointment.start_at >= from_date)

    if to_date:
        query = query.where(Appointment.start_at <= to_date)

    appointments = db.execute(
        query.order_by(Appointment.start_at.asc())
    ).scalars().all()

    return appointments


@router.get("/today", response_model=list[AppointmentRead])
def list_today_appointments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_membership: UserTenant = Depends(get_current_membership),
    scope: str = Query(default="mine"),
):
    now = datetime.now(timezone.utc)
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end = now.replace(hour=23, minute=59, second=59, microsecond=999999)

    query = select(Appointment).where(
        Appointment.tenant_id == current_membership.tenant_id,
        Appointment.start_at >= start,
        Appointment.start_at <= end,
    )

    normalized_scope = scope.strip().lower()

    if normalized_scope not in {"mine", "all"}:
        raise AppException(
            status_code=400,
            message="Invalid appointments scope",
            code="INVALID_APPOINTMENTS_SCOPE",
        )

    user_role = str(current_membership.role or "").upper()

    if normalized_scope == "all":
        if user_role not in {"ADMIN", "MANAGER", "SUPERADMIN"}:
            raise AppException(
                status_code=403,
                message="Appointments scope not allowed",
                code="APPOINTMENTS_SCOPE_NOT_ALLOWED",
            )
    else:
        query = query.where(
            or_(
                Appointment.assigned_user_id == current_user.id,
                and_(
                    Appointment.assigned_user_id.is_(None),
                    Appointment.appointment_type == "PRODUCTION_STAGE",
                ),
            )
        )

    appointments = db.execute(
        query.order_by(Appointment.start_at.asc())
    ).scalars().all()

    return appointments


@router.get("/upcoming", response_model=list[AppointmentRead])
def list_upcoming_appointments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_membership: UserTenant = Depends(get_current_membership),
    limit: int = Query(default=100, ge=1, le=200),
    scope: str = Query(default="mine"),
    appointment_type: str | None = Query(default=None),
    source_type: str | None = Query(default=None),
):
    query = select(Appointment).where(
        Appointment.tenant_id == current_membership.tenant_id,
        Appointment.status.in_(["SCHEDULED", "CONFIRMED"]),
    )

    normalized_scope = scope.strip().lower()

    if normalized_scope not in {"mine", "all"}:
        raise AppException(
            status_code=400,
            message="Invalid appointments scope",
            code="INVALID_APPOINTMENTS_SCOPE",
        )

    user_role = str(current_membership.role or "").upper()

    if normalized_scope == "all":
        if user_role not in {"ADMIN", "MANAGER", "SUPERADMIN"}:
            raise AppException(
                status_code=403,
                message="Appointments scope not allowed",
                code="APPOINTMENTS_SCOPE_NOT_ALLOWED",
            )
    else:
        query = query.where(
            or_(
                Appointment.assigned_user_id == current_user.id,
                and_(
                    Appointment.assigned_user_id.is_(None),
                    Appointment.appointment_type == "PRODUCTION_STAGE",
                ),
            )
        )

    if appointment_type:
        query = query.where(
            Appointment.appointment_type == appointment_type.strip().upper()
        )

    if source_type:
        query = query.where(
            Appointment.source_type == source_type.strip().upper()
        )

    appointments = db.execute(
        query.order_by(Appointment.start_at.asc()).limit(limit)
    ).scalars().all()

    return appointments


@router.get("/{appointment_id}", response_model=AppointmentRead)
def get_appointment(
    appointment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_membership: UserTenant = Depends(get_current_membership),
):
    appointment = db.execute(
        select(Appointment).where(
            Appointment.id == appointment_id,
            Appointment.tenant_id == current_membership.tenant_id,
        )
    ).scalar_one_or_none()

    if appointment is None:
        raise AppException(
            status_code=404,
            message="Appointment not found",
            code="APPOINTMENT_NOT_FOUND",
        )

    return appointment


@router.post("", response_model=AppointmentRead)
def create_appointment(
    payload: AppointmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_membership: UserTenant = Depends(get_current_membership),
):
    appointment = Appointment(
        tenant_id=current_membership.tenant_id,
        title=payload.title,
        description=payload.description,
        appointment_type=payload.appointment_type,
        status=payload.status,
        source_type=payload.source_type,
        source_id=payload.source_id,
        process_type_id=payload.process_type_id,
        start_at=payload.start_at,
        end_at=payload.end_at,
        customer_id=payload.customer_id,
        dress_id=payload.dress_id,
        loan_id=payload.loan_id,
        production_order_id=payload.production_order_id,
        assigned_user_id=payload.assigned_user_id,
        priority=payload.priority,
        color=payload.color,
        notes=payload.notes,
    )

    db.add(appointment)
    db.commit()
    db.refresh(appointment)

    return appointment


@router.put("/{appointment_id}", response_model=AppointmentRead)
def update_appointment(
    appointment_id: UUID,
    payload: AppointmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_membership: UserTenant = Depends(get_current_membership),
):
    appointment = db.execute(
        select(Appointment).where(
            Appointment.id == appointment_id,
            Appointment.tenant_id == current_membership.tenant_id,
        )
    ).scalar_one_or_none()

    if appointment is None:
        raise AppException(
            status_code=404,
            message="Appointment not found",
            code="APPOINTMENT_NOT_FOUND",
        )

    data = payload.model_dump(exclude_unset=True)

    for field, value in data.items():
        setattr(appointment, field, value)

    db.commit()
    db.refresh(appointment)

    return appointment


@router.delete("/{appointment_id}")
def delete_appointment(
    appointment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_membership: UserTenant = Depends(get_current_membership),
):
    appointment = db.execute(
        select(Appointment).where(
            Appointment.id == appointment_id,
            Appointment.tenant_id == current_membership.tenant_id,
        )
    ).scalar_one_or_none()

    if appointment is None:
        raise AppException(
            status_code=404,
            message="Appointment not found",
            code="APPOINTMENT_NOT_FOUND",
        )

    db.delete(appointment)
    db.commit()

    return {"message": "Appointment deleted"}
