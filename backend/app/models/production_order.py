import uuid
from decimal import Decimal
from datetime import date, datetime

from sqlalchemy import String, Text, Integer, DateTime, Date, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class ProductionOrder(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "production_orders"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    order_number: Mapped[str] = mapped_column(String(50), nullable=False)
    workshop_supplier_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("suppliers.id", ondelete="RESTRICT"),
        nullable=False,
    )
    target_dress_name: Mapped[str] = mapped_column(String(150), nullable=False)
    target_dress_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    target_size: Mapped[str | None] = mapped_column(String(50), nullable=True)
    target_color: Mapped[str | None] = mapped_column(String(50), nullable=True)
    planned_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    produced_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="DRAFT")
    priority: Mapped[str] = mapped_column(String(20), nullable=False, default="NORMAL")
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    received_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    labor_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    additional_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    estimated_total_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    actual_total_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="USD")
    design_photo_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
