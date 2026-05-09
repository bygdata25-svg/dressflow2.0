from pydantic import BaseModel, EmailStr, Field, ConfigDict, validator
import re
from typing import Optional

HEX_COLOR_RE = re.compile(r"^#(?:[0-9a-fA-F]{6})$")

class PublicTenantBrandingResponse(BaseModel):
    name: str
    slug: str | None = None
    logo_url: str | None = None
    primary_color: str | None = None


class TenantBrandingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    slug: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    currency: str
    timezone: str
    logo_url: str | None = None
    primary_color: str | None = None
    tenant_plan: str = "PRO"
    tenant_plan_label: str = "DressFlow Pro"

    max_users: int = 3
    active_users: int = 0
    available_users: int = 0


class TenantBrandingUpdateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=50)
    currency: str = Field(default="USD", min_length=3, max_length=10)
    timezone: str = Field(default="America/Argentina/Buenos_Aires", min_length=3, max_length=100)
    primary_color: str | None = Field(default=None, max_length=20)

class TenantBrandingRead(BaseModel):
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    accent_color: Optional[str] = None
    surface_color: Optional[str] = None
    sidebar_color: Optional[str] = None


class TenantBrandingUpdate(BaseModel):
    logo_url: Optional[str] = Field(default=None, max_length=500)
    primary_color: Optional[str] = Field(default=None, max_length=20)
    secondary_color: Optional[str] = Field(default=None, max_length=20)
    accent_color: Optional[str] = Field(default=None, max_length=20)
    surface_color: Optional[str] = Field(default=None, max_length=20)
    sidebar_color: Optional[str] = Field(default=None, max_length=20)

    @validator(
        "primary_color",
        "secondary_color",
        "accent_color",
        "surface_color",
        "sidebar_color",
        pre=True,
    )
    @classmethod
    def validate_hex_color(cls, value):
        if value in (None, ""):
            return value
        if not isinstance(value, str) or not HEX_COLOR_RE.match(value):
            raise ValueError("Color must be a valid HEX value like #AABBCC")
        return value


class TenantRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    slug: str
    branding: TenantBrandingRead
    tenant_plan: str = "PRO"
    tenant_plan_label: str = "DressFlow Pro"

    max_users: int = 3
    active_users: int = 0
    available_users: int = 0
