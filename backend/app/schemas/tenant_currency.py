from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class TenantCurrencyBase(BaseModel):
    currency_code: str = Field(min_length=3, max_length=3)
    symbol: str = Field(min_length=1, max_length=8)
    is_base: bool = False
    is_enabled: bool = True
    display_order: int = 0


class TenantCurrencyCreate(TenantCurrencyBase):
    pass


class TenantCurrencyUpdate(BaseModel):
    symbol: str | None = Field(default=None, min_length=1, max_length=8)
    is_base: bool | None = None
    is_enabled: bool | None = None
    display_order: int | None = None


class TenantCurrencyRead(TenantCurrencyBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
