from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class AccessorySaleCreate(BaseModel):
    accessory_id: UUID
    customer_id: UUID | None = None
    sale_date: datetime | None = None
    quantity: int = Field(default=1, gt=0)
    unit_price: Decimal | None = Field(default=None, ge=0)
    currency: str = "ARS"
    payment_method: str | None = None
    notes: str | None = None


class AccessorySaleCancel(BaseModel):
    reason: str | None = None


class AccessorySaleResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    accessory_id: UUID
    customer_id: UUID | None = None
    sale_date: datetime
    quantity: int
    unit_price: Decimal
    total_price: Decimal
    currency: str
    payment_method: str | None = None
    notes: str | None = None
    status: str
    sale_number: str | None = None

    accessory_code: str | None = None
    accessory_name: str | None = None
    customer_full_name: str | None = None

    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PaginatedAccessorySaleResponse(BaseModel):
    items: list[AccessorySaleResponse]
    page: int
    page_size: int
    total: int
