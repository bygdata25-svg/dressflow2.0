from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class SupplierCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)

    supplier_code: str | None = Field(default=None, max_length=50)
    origin: str | None = Field(default=None, max_length=100)

    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    notes: str | None = Field(default=None, max_length=2000)

    supplier_type: str = Field(default="FABRIC_SUPPLIER", max_length=30)


class SupplierUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=150)

    supplier_code: str | None = Field(default=None, max_length=50)
    origin: str | None = Field(default=None, max_length=100)

    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    notes: str | None = Field(default=None, max_length=2000)

    supplier_type: str = Field(default="FABRIC_SUPPLIER", max_length=30)


class SupplierResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID

    name: str
    supplier_code: str | None = None
    origin: str | None = None

    email: str | None = None
    phone: str | None = None
    notes: str | None = None

    supplier_type: str
