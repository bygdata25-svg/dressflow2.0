from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProductionOrderCreate(BaseModel):
    order_number: str | None = Field(default=None, min_length=1, max_length=50)
    workshop_supplier_id: UUID
    target_dress_name: str = Field(min_length=1, max_length=150)
    target_dress_code: str | None = Field(default=None, max_length=100)
    target_size: str | None = Field(default=None, max_length=50)
    target_color: str | None = Field(default=None, max_length=50)
    planned_quantity: int = Field(default=1, ge=1)
    priority: str = Field(default="NORMAL", max_length=20)
    due_date: date | None = None
    notes: str | None = Field(default=None, max_length=4000)
    design_photo_url: str | None = None


class ProductionOrderReceive(BaseModel):
    produced_quantity: int = Field(ge=0)
    status: str = Field(default="PARTIALLY_RECEIVED", max_length=30)
    received_notes: str | None = Field(default=None, max_length=4000)


class ProductionOrderCostsUpdate(BaseModel):
    labor_cost: Decimal = Field(default=0, ge=0)
    additional_cost: Decimal = Field(default=0, ge=0)
    currency: str = Field(default="USD", max_length=10)


class ProductionOrderCostSummary(BaseModel):
    estimated_material_cost: Decimal
    actual_material_cost: Decimal
    labor_cost: Decimal
    additional_cost: Decimal
    estimated_total_cost: Decimal
    actual_total_cost: Decimal
    estimated_unit_cost: Decimal
    actual_unit_cost: Decimal
    currency: str


class ProductionOrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    order_number: str
    workshop_supplier_id: UUID
    workshop_supplier_name: str | None = None
    target_dress_name: str
    target_dress_code: str | None = None
    target_size: str | None = None
    target_color: str | None = None
    planned_quantity: int
    produced_quantity: int
    status: str
    priority: str
    due_date: date | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    notes: str | None = None
    received_notes: str | None = None
    labor_cost: Decimal
    additional_cost: Decimal
    estimated_total_cost: Decimal
    actual_total_cost: Decimal
    currency: str
    design_photo_url: str | None = None
    tenant_name: str | None = None
    tenant_logo_url: str | None = None
    tenant_primary_color: str | None = None


class ProductionOrderMaterialAdd(BaseModel):
    fabric_roll_id: UUID
    planned_quantity: Decimal
    unit: str = Field(default="meters", max_length=20)
    notes: str | None = Field(default=None, max_length=2000)


class ProductionOrderMaterialReturn(BaseModel):
    returned_quantity: Decimal = Field(ge=0)
    waste_quantity: Decimal = Field(default=0, ge=0)
    notes: str | None = Field(default=None, max_length=2000)


class ProductionOrderMaterialResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    production_order_id: UUID
    material_type: str
    fabric_roll_id: UUID | None = None
    description_snapshot: str | None = None
    planned_quantity: Decimal
    delivered_quantity: Decimal
    consumed_quantity: Decimal
    returned_quantity: Decimal
    waste_quantity: Decimal
    unit: str
    unit_cost_snapshot: Decimal | None = None
    notes: str | None = None
    roll_code: str | None = None
    roll_current_length: Decimal | None = None
    roll_reserved_length: Decimal | None = None
    issued_at: datetime | None = None
    returned_at: datetime | None = None


class ProductionOrderEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    event_type: str
    payload: dict | None = None
    created_at: datetime
