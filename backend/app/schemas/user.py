from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class UserCreate(BaseModel):
    email: str
    password: str
    first_name: str
    last_name: str
    role: str = "admin"


class UserUpdate(BaseModel):
    first_name: str
    last_name: str
    role: str
    is_active: bool


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    first_name: str
    last_name: str
    role: str
    is_active: bool

class UserResetPassword(BaseModel):
    new_password: str = Field(min_length=6, max_length=128)

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
