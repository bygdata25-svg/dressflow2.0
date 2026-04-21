from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class FabricMovementCreate(BaseModel):
    fabric_roll_id: UUID
    type: str = Field(min_length=1, max_length=30)
    quantity: Decimal
    reference: str | None = Field(default=None, max_length=150)
    notes: str | None = Field(default=None, max_length=2000)


class FabricMovementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    fabric_roll_id: UUID
    type: str
    quantity: Decimal
    reference: str | None = None
    notes: str | None = None
    roll_code: str | None = None
    fabric_name: str | None = None
