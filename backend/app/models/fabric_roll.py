import uuid
from decimal import Decimal

from sqlalchemy import String, Text, Numeric, ForeignKey, DateTime, Date
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class FabricRoll(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "fabric_rolls"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    fabric_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("fabrics.id", ondelete="CASCADE"),
        nullable=False,
    )
    supplier_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("suppliers.id", ondelete="SET NULL"),
        nullable=True,
    )
    roll_code: Mapped[str] = mapped_column(String(100), nullable=False)
    initial_length: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    current_length: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False, default="meters")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="AVAILABLE")

    price_per_meter: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    purchase_date: Mapped[Date | None] = mapped_column(Date, nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    deleted_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reserved_length: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    piece_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    legacy_slot: Mapped[str | None] = mapped_column(String(50), nullable=True)

    location: Mapped[str | None] = mapped_column(String(100), nullable=True)

    is_scrap: Mapped[bool] = mapped_column(default=False)
    is_active: Mapped[bool] = mapped_column(default=True)

    currency: Mapped[str | None] = mapped_column(String(10), default="USD")

    import_batch: Mapped[str | None] = mapped_column(String(100), nullable=True)
    import_row_number: Mapped[int | None] = mapped_column(nullable=True)
