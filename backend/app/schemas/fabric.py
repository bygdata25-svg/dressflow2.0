from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class FabricCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)

    fabric_type: Optional[str] = Field(default=None, max_length=100)
    color: Optional[str] = Field(default=None, max_length=50)
    supplier_id: Optional[UUID] = None

    code: Optional[str] = Field(default=None, max_length=100)
    base_name: Optional[str] = Field(default=None, max_length=150)
    base_code: Optional[str] = Field(default=None, max_length=100)

    supplier_color: Optional[str] = Field(default=None, max_length=100)
    supplier_reference: Optional[str] = Field(default=None, max_length=255)

    composition: Optional[str] = Field(default=None, max_length=255)
    origin: Optional[str] = Field(default=None, max_length=100)

    width_meters: Optional[float] = None
    weight_grams: Optional[float] = None
    yield_kilos: Optional[float] = None

    default_location: Optional[str] = Field(default=None, max_length=100)
    has_scraps: bool = False

    photo_url: Optional[str] = None
    notes: Optional[str] = None


class FabricUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=150)

    fabric_type: Optional[str] = Field(default=None, max_length=100)
    color: Optional[str] = Field(default=None, max_length=50)
    supplier_id: Optional[UUID] = None

    code: Optional[str] = Field(default=None, max_length=100)
    base_name: Optional[str] = Field(default=None, max_length=150)
    base_code: Optional[str] = Field(default=None, max_length=100)

    supplier_color: Optional[str] = Field(default=None, max_length=100)
    supplier_reference: Optional[str] = Field(default=None, max_length=255)

    composition: Optional[str] = Field(default=None, max_length=255)
    origin: Optional[str] = Field(default=None, max_length=100)

    width_meters: Optional[float] = None
    weight_grams: Optional[float] = None
    yield_kilos: Optional[float] = None

    default_location: Optional[str] = Field(default=None, max_length=100)
    has_scraps: bool = False

    photo_url: Optional[str] = None
    notes: Optional[str] = None


class FabricListItem(BaseModel):
    id: UUID
    name: str
    color: Optional[str] = None
    total_stock_meters: float
    total_rolls: int
    largest_roll_length: float
    photo_url: Optional[str] = None


class RollListItem(BaseModel):
    id: UUID
    code: str
    initial_length: float
    current_length: float
    status: str


class FabricResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID

    name: str
    fabric_type: Optional[str] = None
    color: Optional[str] = None
    supplier_id: Optional[UUID] = None

    code: Optional[str] = None
    base_name: Optional[str] = None
    base_code: Optional[str] = None

    supplier_color: Optional[str] = None
    supplier_reference: Optional[str] = None

    composition: Optional[str] = None
    origin: Optional[str] = None

    width_meters: Optional[float] = None
    weight_grams: Optional[float] = None
    yield_kilos: Optional[float] = None

    default_location: Optional[str] = None
    has_scraps: bool = False

    photo_url: Optional[str] = None
    notes: Optional[str] = None
