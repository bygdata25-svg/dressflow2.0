from datetime import datetime

from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class Tenant(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "tenants"

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    slug: Mapped[str | None] = mapped_column(String(100), nullable=True, unique=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE")
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="USD")
    timezone: Mapped[str] = mapped_column(String(100), nullable=False, default="America/Argentina/Buenos_Aires")
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    primary_color: Mapped[str | None] = mapped_column(String(20), nullable=True)
    branding_logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    branding_primary_color: Mapped[str | None] = mapped_column(String(20), nullable=True)
    branding_secondary_color: Mapped[str | None] = mapped_column(String(20), nullable=True)
    branding_accent_color: Mapped[str | None] = mapped_column(String(20), nullable=True)
    branding_surface_color: Mapped[str | None] = mapped_column(String(20), nullable=True)
    branding_sidebar_color: Mapped[str | None] = mapped_column(String(20), nullable=True)
