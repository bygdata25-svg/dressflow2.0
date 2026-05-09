from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProductionOrderAssignmentBase(BaseModel):
    supplier_id: UUID
    process_type_id: UUID

    status: str = Field(default="PENDING", max_length=30)

    estimated_cost: Decimal = Decimal("0.00")
    actual_cost: Decimal = Decimal("0.00")

    started_at: datetime | None = None
    finished_at: datetime | None = None

    notes: str | None = None


class ProductionOrderAssignmentCreate(ProductionOrderAssignmentBase):
    pass


class ProductionOrderAssignmentUpdate(BaseModel):
    supplier_id: UUID | None = None
    process_type_id: UUID | None = None

    status: str | None = Field(default=None, max_length=30)

    estimated_cost: Decimal | None = None
    actual_cost: Decimal | None = None

    started_at: datetime | None = None
    finished_at: datetime | None = None

    notes: str | None = None


class ProductionOrderAssignmentOut(ProductionOrderAssignmentBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    production_order_id: UUID

    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


class ProductionOrderAssignmentDetailOut(ProductionOrderAssignmentOut):
    supplier_name: str | None = None
    process_code: str | None = None
    process_name: str | None = None
    process_color: str | None = None
    process_icon: str | None = None
