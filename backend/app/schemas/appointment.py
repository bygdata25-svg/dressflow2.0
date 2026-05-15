from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime


class AppointmentBase(BaseModel):
    title: str
    description: Optional[str] = None

    appointment_type: str = "FITTING"
    status: str = "SCHEDULED"

    # -----------------------------------------
    # NUEVO
    # -----------------------------------------

    source_type: str = "MANUAL"

    source_id: Optional[UUID] = None

    process_type_id: Optional[UUID] = None

    # -----------------------------------------

    start_at: datetime
    end_at: Optional[datetime] = None

    customer_id: Optional[UUID] = None
    dress_id: Optional[UUID] = None
    loan_id: Optional[UUID] = None

    production_order_id: Optional[UUID] = None

    assigned_user_id: Optional[UUID] = None

    priority: str = "MEDIUM"

    color: Optional[str] = None
    notes: Optional[str] = None


class AppointmentCreate(AppointmentBase):
    pass


class AppointmentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None

    appointment_type: Optional[str] = None
    status: Optional[str] = None

    # -----------------------------------------
    # NUEVO
    # -----------------------------------------

    source_type: Optional[str] = None

    source_id: Optional[UUID] = None

    process_type_id: Optional[UUID] = None

    # -----------------------------------------

    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None

    customer_id: Optional[UUID] = None
    dress_id: Optional[UUID] = None
    loan_id: Optional[UUID] = None

    production_order_id: Optional[UUID] = None

    assigned_user_id: Optional[UUID] = None

    priority: Optional[str] = None

    color: Optional[str] = None
    notes: Optional[str] = None


class AppointmentRead(AppointmentBase):
    id: UUID
    tenant_id: UUID

    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
