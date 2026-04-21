import uuid
from decimal import Decimal
from datetime import datetime

from sqlalchemy import String, Text, Numeric, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class ProductionOrderMaterial(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "production_order_materials"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    production_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("production_orders.id", ondelete="CASCADE"),
        nullable=False,
    )
    material_type: Mapped[str] = mapped_column(String(30), nullable=False)
    fabric_roll_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("fabric_rolls.id", ondelete="RESTRICT"),
        nullable=True,
    )
    trim_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("trims.id", ondelete="RESTRICT"),
        nullable=True,
    )
    description_snapshot: Mapped[str | None] = mapped_column(String(255), nullable=True)
    planned_quantity: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    delivered_quantity: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    consumed_quantity: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    returned_quantity: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    waste_quantity: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    unit: Mapped[str] = mapped_column(String(20), nullable=False, default="meters")
    unit_cost_snapshot: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    issued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    returned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
