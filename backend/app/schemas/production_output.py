from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProductionOrderOutputCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    code: str | None = Field(default=None, max_length=100)
    size: str | None = Field(default=None, max_length=50)
    color: str | None = Field(default=None, max_length=50)
    quantity: int = Field(default=1, ge=1)
    unit_cost: Decimal | None = Field(default=None, ge=0)
    notes: str | None = Field(default=None, max_length=2000)
    create_dress_records: bool = False


class ProductionOrderOutputResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    production_order_id: UUID
    dress_id: UUID | None = None
    name: str
    code: str | None = None
    size: str | None = None
    color: str | None = None
    quantity: int
    unit_cost: Decimal | None = None
    notes: str | None = None
