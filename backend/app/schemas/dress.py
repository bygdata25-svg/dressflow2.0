from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class DressImageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    dress_id: UUID
    file_url: str
    is_primary: bool
    position: int


class DressCreate(BaseModel):
    code: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=150)
    description: str | None = Field(default=None, max_length=2000)
    size: str | None = Field(default=None, max_length=50)
    color: str | None = Field(default=None, max_length=50)
    sale_price: Decimal | None = None
    sale_currency: str | None = None
    rental_price: Decimal | None = None
    rental_currency: str | None = None
    capsule_id: UUID | None = None
    photo_url: str | None = None


class DressUpdate(BaseModel):
    code: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=150)
    description: str | None = Field(default=None, max_length=2000)
    size: str | None = Field(default=None, max_length=50)
    color: str | None = Field(default=None, max_length=50)
    status: str = Field(min_length=1, max_length=30)
    sale_price: Decimal | None = None
    sale_currency: str | None = None
    rental_price: Decimal | None = None
    rental_currency: str | None = None
    capsule_id: UUID | None = None
    photo_url: str | None = None


class DressResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    code: str
    name: str
    description: str | None = None
    size: str | None = None
    color: str | None = None
    status: str
    sale_price: Decimal | None = None
    sale_currency: str | None = None
    rental_price: Decimal | None = None
    rental_currency: str | None = None
    main_image_url: str | None = None
    capsule_id: UUID | None = None
    capsule_name: str | None = None
    photo_url: str | None = None
