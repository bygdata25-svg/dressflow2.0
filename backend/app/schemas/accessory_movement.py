from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class AccessoryMovementCreate(BaseModel):
    accessory_id: UUID
    type: str
    quantity: int = Field(..., gt=0)
    reference: str | None = None
    notes: str | None = None


class AccessoryMovementResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    accessory_id: UUID
    type: str
    quantity: int
    reference: str | None = None
    notes: str | None = None
    created_at: datetime

    accessory_code: str | None = None
    accessory_name: str | None = None

    model_config = {"from_attributes": True}


class PaginatedAccessoryMovementResponse(BaseModel):
    items: list[AccessoryMovementResponse]
    page: int
    page_size: int
    total: int
