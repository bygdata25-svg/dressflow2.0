from datetime import date
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class LoanCreate(BaseModel):
    dress_id: UUID
    customer_id: UUID
    start_date: date
    expected_return_date: date | None = None
    notes: str | None = Field(default=None, max_length=2000)
    loan_type: str = Field(default="LOAN", max_length=20)
    amount: float | None = Field(default=None, ge=0)

    @field_validator("loan_type")
    @classmethod
    def validate_loan_type(cls, value: str) -> str:
        normalized = (value or "").strip().upper()
        if normalized not in {"LOAN", "RENTAL"}:
            raise ValueError("loan_type must be LOAN or RENTAL")
        return normalized


class LoanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    dress_id: UUID
    customer_id: UUID
    start_date: date
    expected_return_date: date | None = None
    actual_return_date: date | None = None
    status: str
    loan_type: str
    amount: float | None = None
    notes: str | None = None
    dress_code: str | None = None
    dress_name: str | None = None
    customer_full_name: str | None = None
