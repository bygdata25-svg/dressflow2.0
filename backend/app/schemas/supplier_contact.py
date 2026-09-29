from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SupplierContactBase(BaseModel):
    supplier_id: UUID

    first_name: str = Field(min_length=1, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)

    phone: str | None = Field(default=None, max_length=50)
    whatsapp_phone: str | None = Field(default=None, max_length=50)
    email: str | None = Field(default=None, max_length=255)

    role: str | None = Field(default=None, max_length=100)

    is_supplier_manager: bool = False
    is_active: bool = True

    notes: str | None = Field(default=None, max_length=2000)


class SupplierContactCreate(SupplierContactBase):
    pass


class SupplierContactUpdate(BaseModel):
    supplier_id: UUID | None = None

    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)

    phone: str | None = Field(default=None, max_length=50)
    whatsapp_phone: str | None = Field(default=None, max_length=50)
    email: str | None = Field(default=None, max_length=255)

    role: str | None = Field(default=None, max_length=100)

    is_supplier_manager: bool | None = None
    is_active: bool | None = None

    notes: str | None = Field(default=None, max_length=2000)


class SupplierContactResponse(SupplierContactBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID

    supplier_name: str | None = None
