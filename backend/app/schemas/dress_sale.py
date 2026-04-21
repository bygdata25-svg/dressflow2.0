from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class DressSaleBase(BaseModel):
    dress_id: UUID
    customer_id: Optional[UUID] = None
    sale_date: Optional[datetime] = None
    sale_price: Decimal = Field(..., gt=0)
    currency: str = "USD"
    payment_method: Optional[str] = None
    notes: Optional[str] = None


class DressSaleCreate(DressSaleBase):
    pass


class DressSaleUpdate(BaseModel):
    customer_id: Optional[UUID] = None
    sale_date: Optional[datetime] = None
    sale_price: Optional[Decimal] = Field(default=None, gt=0)
    currency: Optional[str] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None


class DressSaleCancel(BaseModel):
    reason: Optional[str] = None


class DressSaleResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    dress_id: UUID
    customer_id: Optional[UUID] = None
    sale_date: datetime
    sale_price: Decimal
    currency: str
    payment_method: Optional[str] = None
    notes: Optional[str] = None
    status: str

    dress_code: Optional[str] = None
    dress_name: Optional[str] = None
    dress_size: Optional[str] = None
    dress_color: Optional[str] = None

    customer_full_name: Optional[str] = None
    
    sale_number: str | None = None

    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DressSaleListResponse(BaseModel):
    items: list[DressSaleResponse]
    total: int
