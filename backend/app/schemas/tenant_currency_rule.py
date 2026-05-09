from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class TenantCurrencyRuleBase(BaseModel):
    module: str = Field(min_length=2, max_length=50)
    price_type: str = Field(min_length=2, max_length=50)
    default_currency: str = Field(min_length=3, max_length=3)
    allow_override: bool = True


class TenantCurrencyRuleCreate(TenantCurrencyRuleBase):
    pass


class TenantCurrencyRuleUpdate(BaseModel):
    default_currency: str | None = Field(default=None, min_length=3, max_length=3)
    allow_override: bool | None = None


class TenantCurrencyRuleRead(TenantCurrencyRuleBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
