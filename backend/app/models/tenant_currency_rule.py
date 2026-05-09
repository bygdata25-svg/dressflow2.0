import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class TenantCurrencyRule(Base):
    __tablename__ = "tenant_currency_rules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    module = Column(String(50), nullable=False)
    price_type = Column(String(50), nullable=False)
    default_currency = Column(String(3), nullable=False)
    allow_override = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime(timezone=False), server_default=func.now(), nullable=False)

    tenant = relationship("Tenant")

    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "module",
            "price_type",
            name="uq_tenant_currency_rule",
        ),
    )
