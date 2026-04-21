from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


VALID_ITEM_TYPES = {"dress", "accessory"}
VALID_CURRENCIES = {"ARS", "USD"}
VALID_PAYMENT_METHODS = {
    "cash",
    "transfer",
    "debit",
    "credit",
    "mercadopago",
    "other",
}


class SaleItemCreate(BaseModel):
    item_type: str
    dress_id: UUID | None = None
    accessory_id: UUID | None = None
    quantity: int = Field(default=1, gt=0)
    unit_price: Decimal = Field(..., ge=0)
    currency: str = "ARS"
    notes: str | None = None

    @model_validator(mode="after")
    def validate_item(self):
        self.item_type = (self.item_type or "").strip().lower()
        self.currency = (self.currency or "ARS").strip().upper()

        if self.item_type not in VALID_ITEM_TYPES:
            raise ValueError("item_type debe ser 'dress' o 'accessory'")

        if self.currency not in VALID_CURRENCIES:
            raise ValueError("currency debe ser 'ARS' o 'USD'")

        if self.item_type == "dress":
            if not self.dress_id:
                raise ValueError("dress_id es obligatorio para item_type='dress'")
            if self.accessory_id:
                raise ValueError("Un item dress no puede tener accessory_id")
        else:
            if not self.accessory_id:
                raise ValueError("accessory_id es obligatorio para item_type='accessory'")
            if self.dress_id:
                raise ValueError("Un item accessory no puede tener dress_id")

        return self


class SalePaymentCreate(BaseModel):
    payment_method: str
    amount: Decimal = Field(..., gt=0)
    currency: str = "ARS"
    reference: str | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def validate_payment(self):
        self.payment_method = (self.payment_method or "").strip().lower()
        self.currency = (self.currency or "ARS").strip().upper()

        if self.payment_method not in VALID_PAYMENT_METHODS:
            raise ValueError("payment_method inválido")

        if self.currency not in VALID_CURRENCIES:
            raise ValueError("currency debe ser 'ARS' o 'USD'")

        return self


class SaleCreate(BaseModel):
    customer_id: UUID | None = None
    sale_date: datetime | None = None
    currency: str = "ARS"
    exchange_rate: Decimal | None = Field(default=None, gt=0)
    discount_amount: Decimal = Field(default=Decimal("0.00"), ge=0)
    notes: str | None = None
    items: list[SaleItemCreate]
    payments: list[SalePaymentCreate]

    @model_validator(mode="after")
    def validate_sale(self):
        self.currency = (self.currency or "ARS").strip().upper()

        if self.currency not in VALID_CURRENCIES:
            raise ValueError("currency debe ser 'ARS' o 'USD'")

        if not self.items:
            raise ValueError("La venta debe tener al menos un item")

        if not self.payments:
            raise ValueError("La venta debe tener al menos un pago")

        return self


class SaleCancel(BaseModel):
    reason: str | None = None


class SaleItemResponse(BaseModel):
    id: UUID
    item_type: str
    dress_id: UUID | None = None
    accessory_id: UUID | None = None
    code_snapshot: str | None = None
    description_snapshot: str
    quantity: int
    unit_price: Decimal
    currency: str
    line_total: Decimal
    notes: str | None = None

    model_config = {"from_attributes": True}


class SalePaymentResponse(BaseModel):
    id: UUID
    payment_method: str
    amount: Decimal
    currency: str
    reference: str | None = None
    notes: str | None = None

    model_config = {"from_attributes": True}


class SaleResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    sale_number: str
    customer_id: UUID | None = None
    customer_full_name: str | None = None
    sale_date: datetime
    currency: str
    status: str
    subtotal_amount: Decimal
    discount_amount: Decimal
    total_amount: Decimal
    notes: str | None = None
    created_at: datetime
    updated_at: datetime
    items: list[SaleItemResponse]
    payments: list[SalePaymentResponse]

    model_config = {"from_attributes": True}


class SaleListResponse(BaseModel):
    items: list[SaleResponse]
    total: int
