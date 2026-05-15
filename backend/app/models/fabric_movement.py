import uuid
from decimal import Decimal

from sqlalchemy import String, Text, Numeric, ForeignKey, Column
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class FabricMovement(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "fabric_movements"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    fabric_roll_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("fabric_rolls.id", ondelete="CASCADE"),
        nullable=False,
    )
    type: Mapped[str] = mapped_column(String(30), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    reference: Mapped[str | None] = mapped_column(String(150), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes_key = Column(String(160), nullable=True)
    notes_params = Column(JSONB, nullable=True)
    production_order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("production_orders.id", ondelete="SET NULL"),
        nullable=True,
    )
    movement_reason: Mapped[str | None] = mapped_column(String(50), nullable=True)
