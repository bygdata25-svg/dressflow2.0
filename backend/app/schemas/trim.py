from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class TrimCreate(BaseModel):
    code: str = Field(min_length=1, max_length=60)
    name: str = Field(min_length=1, max_length=150)
    category: str | None = Field(default=None, max_length=80)
    unit: str = Field(default="unit", max_length=20)
    current_stock: Decimal = Field(default=0, ge=0)
    min_stock: Decimal = Field(default=0, ge=0)
    supplier_id: UUID | None = None
    unit_cost: Decimal | None = Field(default=None, ge=0)
    unit_cost_currency: str = "ARS"
    photo_url: str | None = None
    photo_public_id: str | None = None
    notes: str | None = Field(default=None, max_length=2000)

class TrimUpdate(BaseModel):
    code: str = Field(min_length=1, max_length=60)
    name: str = Field(min_length=1, max_length=150)
    category: str | None = Field(default=None, max_length=80)
    unit: str = Field(default="unit", max_length=20)
    current_stock: Decimal = Field(default=0, ge=0)
    min_stock: Decimal = Field(default=0, ge=0)
    supplier_id: UUID | None = None
    unit_cost: Decimal | None = Field(default=None, ge=0)
    unit_cost_currency: str = "ARS"
    photo_url: str | None = None
    photo_public_id: str | None = None
    notes: str | None = Field(default=None, max_length=2000)

class TrimResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    code: str
    name: str
    category: str | None = None
    unit: str
    current_stock: Decimal
    reserved_stock: Decimal
    min_stock: Decimal
    supplier_id: UUID | None = None
    unit_cost: Decimal | None = None
    unit_cost_currency: str = "ARS"
    photo_url: str | None = None
    photo_public_id: str | None = None
    notes: str | None = None
