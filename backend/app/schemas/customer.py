from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CustomerCreate(BaseModel):
    code: str | None = Field(default=None, max_length=50)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    tax_id: str | None = Field(default=None, max_length=32)
    notes: str | None = Field(default=None, max_length=2000)


class CustomerUpdate(BaseModel):
    code: str | None = Field(default=None, max_length=50)
    first_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    tax_id: str | None = Field(default=None, max_length=32)
    notes: str | None = Field(default=None, max_length=2000)


class CustomerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    code: str
    first_name: str
    last_name: str
    email: str | None = None
    phone: str | None = None
    tax_id: str | None = None
    notes: str | None = None


class PaginatedCustomerResponse(BaseModel):
    items: list[CustomerResponse]
    page: int
    page_size: int
    total: int
