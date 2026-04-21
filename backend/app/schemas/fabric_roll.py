from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class FabricRollCreate(BaseModel):
    fabric_id: UUID
    roll_code: str = Field(min_length=1, max_length=100)

    initial_length: Decimal
    unit: str = Field(default="meters", max_length=20)

    supplier_id: UUID | None = None
    price_per_meter: Decimal | None = None
    purchase_date: date | None = None

    # nuevos
    piece_type: str | None = None
    legacy_slot: str | None = None
    location: str | None = None
    currency: str | None = "USD"
    is_scrap: bool = False

    notes: str | None = Field(default=None, max_length=2000)


class FabricRollUpdate(BaseModel):
    fabric_id: UUID
    roll_code: str = Field(min_length=1, max_length=100)

    initial_length: Decimal
    unit: str = Field(default="meters", max_length=20)

    supplier_id: UUID | None = None
    price_per_meter: Decimal | None = None
    purchase_date: date | None = None

    piece_type: str | None = None
    legacy_slot: str | None = None
    location: str | None = None
    currency: str | None = "USD"
    is_scrap: bool = False

    notes: str | None = Field(default=None, max_length=2000)


class FabricRollResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    fabric_id: UUID

    roll_code: str
    piece_type: str | None = None
    legacy_slot: str | None = None

    initial_length: Decimal
    current_length: Decimal
    reserved_length: Decimal

    unit: str
    status: str

    price_per_meter: Decimal | None = None
    currency: str | None = None
    purchase_date: date | None = None

    location: str | None = None
    is_scrap: bool

    notes: str | None = None

    fabric_name: str | None = None
    fabric_color: str | None = None
    fabric_code: str | None = None
    supplier_id: UUID | None = None
    supplier_name: str | None = None
