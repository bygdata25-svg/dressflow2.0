import uuid

from sqlalchemy import String, Text, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class Fabric(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "fabrics"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    fabric_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    color: Mapped[str | None] = mapped_column(String(50), nullable=True)
    supplier_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("suppliers.id", ondelete="SET NULL"),
        nullable=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    deleted_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    photo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    code: Mapped[str | None] = mapped_column(String(100), nullable=True)

    base_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    base_code: Mapped[str | None] = mapped_column(String(100), nullable=True)

    supplier_color: Mapped[str | None] = mapped_column(String(100), nullable=True)
    supplier_reference: Mapped[str | None] = mapped_column(String(255), nullable=True)

    composition: Mapped[str | None] = mapped_column(String(255), nullable=True)
    origin: Mapped[str | None] = mapped_column(String(100), nullable=True)

    width_meters: Mapped[float | None] = mapped_column(nullable=True)
    weight_grams: Mapped[float | None] = mapped_column(nullable=True)
    yield_kilos: Mapped[float | None] = mapped_column(nullable=True)

    default_location: Mapped[str | None] = mapped_column(String(100), nullable=True)
    has_scraps: Mapped[bool] = mapped_column(default=False)

    is_active: Mapped[bool] = mapped_column(default=True)
