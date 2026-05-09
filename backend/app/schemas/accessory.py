from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class AccessoryBase(BaseModel):
    code: str | None = None
    name: str
    description: str | None = None
    category: str | None = None
    color: str | None = None
    size: str | None = None
    unit_cost: Decimal = Field(default=Decimal("0.00"), ge=0)
    unit_cost_currency: str = "ARS"
    sale_price: Decimal = Field(default=Decimal("0.00"), ge=0)
    sale_price_currency: str = "ARS"
    stock: int = Field(default=0, ge=0)
    min_stock: int = Field(default=0, ge=0)
    status: str = "ACTIVE"
    photo_url: str | None = None
    photo_public_id: str | None = None
    notes: str | None = None


class AccessoryCreate(AccessoryBase):
    pass


class AccessoryUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    description: str | None = None
    category: str | None = None
    color: str | None = None
    size: str | None = None
    unit_cost: Decimal | None = Field(default=None, ge=0)
    unit_cost_currency: str | None = None
    sale_price: Decimal | None = Field(default=None, ge=0)
    sale_price_currency: str | None = None
    stock: int | None = Field(default=None, ge=0)
    min_stock: int | None = Field(default=None, ge=0)
    status: str | None = None
    photo_url: str | None = None
    photo_public_id: str | None = None
    notes: str | None = None


class AccessoryResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    code: str | None = None
    name: str
    description: str | None = None
    category: str | None = None
    color: str | None = None
    size: str | None = None
    unit_cost: Decimal
    unit_cost_currency: str
    sale_price: Decimal
    sale_price_currency: str
    stock: int
    min_stock: int
    status: str
    photo_url: str | None = None
    photo_public_id: str | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PaginatedAccessoryResponse(BaseModel):
    items: list[AccessoryResponse]
    page: int
    page_size: int
    total: int
