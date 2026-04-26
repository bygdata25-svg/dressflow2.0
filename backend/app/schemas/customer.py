from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


def normalize_tax_id(value: str | None) -> str | None:
    if not value:
        return None

    digits = "".join(filter(str.isdigit, value))

    if not digits:
        return None

    return digits


def is_valid_cuit_cuil(value: str) -> bool:
    digits = normalize_tax_id(value)

    if not digits or len(digits) != 11:
        return False

    weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
    total = sum(int(digits[i]) * weights[i] for i in range(10))

    check_digit = 11 - (total % 11)

    if check_digit == 11:
        check_digit = 0
    elif check_digit == 10:
        check_digit = 9

    return check_digit == int(digits[10])


def validate_document(value: str | None) -> str | None:
    digits = normalize_tax_id(value)

    if not digits:
        return None

    # DNI
    if len(digits) in (7, 8):
        return digits

    # CUIT / CUIL
    if len(digits) == 11:
        if not is_valid_cuit_cuil(digits):
            raise ValueError("CUIT/CUIL inválido")

        return digits

    raise ValueError("Documento inválido")


class CustomerCreate(BaseModel):
    code: str | None = Field(default=None, max_length=50)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    tax_id: str | None = Field(default=None, max_length=32)
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("tax_id")
    @classmethod
    def validate_tax_id(cls, value: str | None) -> str | None:
        return validate_document(value)


class CustomerUpdate(BaseModel):
    code: str | None = Field(default=None, max_length=50)
    first_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    tax_id: str | None = Field(default=None, max_length=32)
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("tax_id")
    @classmethod
    def validate_tax_id(cls, value: str | None) -> str | None:
        return validate_document(value)


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
