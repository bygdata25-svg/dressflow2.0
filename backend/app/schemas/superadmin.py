from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class SuperadminTenantCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    slug: str = Field(min_length=2, max_length=100)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=50)
    currency: str = Field(default="USD", min_length=3, max_length=10)
    timezone: str = Field(
        default="America/Argentina/Buenos_Aires",
        min_length=3,
        max_length=100,
    )


class SuperadminAdminUserCreate(BaseModel):
    first_name: str = Field(min_length=2, max_length=100)
    last_name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class SuperadminCreateTenantRequest(BaseModel):
    tenant: SuperadminTenantCreate
    admin_user: SuperadminAdminUserCreate


class SuperadminTenantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    slug: str | None = None
    status: str

    email: EmailStr | None = None
    phone: str | None = None

    currency: str
    timezone: str

    max_users: int = 3
    active_users: int = 0
    available_users: int = 0


class SuperadminTenantListItemResponse(SuperadminTenantResponse):
    admin_membership_id: UUID | None = None
    admin_user_name: str | None = None
    admin_user_email: EmailStr | None = None


class SuperadminTenantWithAdminResponse(BaseModel):
    tenant: SuperadminTenantResponse
    admin_user_id: UUID
    admin_user_email: EmailStr
