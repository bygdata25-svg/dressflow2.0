import uuid

from sqlalchemy import String, Boolean, Integer, Text, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class TenantFieldSetting(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "tenant_field_settings"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "entity_name",
            "field_name",
            name="uq_tenant_field_settings_tenant_entity_field",
        ),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )

    entity_name: Mapped[str] = mapped_column(String(50), nullable=False)
    field_name: Mapped[str] = mapped_column(String(100), nullable=False)

    visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    editable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    list_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    form_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    label_override: Mapped[str | None] = mapped_column(String(150), nullable=True)
    help_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Nuevo: override por tenant de reglas de validación
    validation_rules_override: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Nuevo: override por tenant de props visuales
    ui_props_override: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
