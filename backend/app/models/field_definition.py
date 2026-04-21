from sqlalchemy import String, Boolean, Integer, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class FieldDefinition(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "field_definitions"
    __table_args__ = (
        UniqueConstraint("entity_name", "field_name", name="uq_field_definitions_entity_field"),
    )

    entity_name: Mapped[str] = mapped_column(String(50), nullable=False)
    field_name: Mapped[str] = mapped_column(String(100), nullable=False)

    default_label: Mapped[str] = mapped_column(String(150), nullable=False)
    field_type: Mapped[str] = mapped_column(String(50), nullable=False, default="text")

    default_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    default_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    default_editable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    default_list_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    default_form_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    default_order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    default_help_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Nuevo: reglas de validación base
    validation_rules: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Nuevo: props visuales base
    ui_props: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
