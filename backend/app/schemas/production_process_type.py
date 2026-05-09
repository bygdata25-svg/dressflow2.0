from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProductionProcessTypeBase(BaseModel):
    code: str = Field(..., min_length=2, max_length=50)
    name: str = Field(..., min_length=2, max_length=100)
    sort_order: int = 100
    color: str | None = None
    icon: str | None = None
    active: bool = True


class ProductionProcessTypeCreate(ProductionProcessTypeBase):
    pass


class ProductionProcessTypeUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=2, max_length=50)
    name: str | None = Field(default=None, min_length=2, max_length=100)
    sort_order: int | None = None
    color: str | None = None
    icon: str | None = None
    active: bool | None = None


class ProductionProcessTypeOut(ProductionProcessTypeBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None
