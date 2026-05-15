from sqlalchemy import (
    Column,
    String,
    Text,
    ForeignKey,
    DateTime,
)

from sqlalchemy.dialects.postgresql import UUID

from sqlalchemy.sql import func

import uuid

from app.core.database import Base


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    title = Column(
        String(180),
        nullable=False,
    )

    description = Column(Text)

    appointment_type = Column(
        String(40),
        nullable=False,
        default="FITTING",
    )

    status = Column(
        String(40),
        nullable=False,
        default="SCHEDULED",
    )

    # -----------------------------------------
    # NUEVO
    # -----------------------------------------

    source_type = Column(
        String(40),
        nullable=False,
        default="MANUAL",
        index=True,
    )

    source_id = Column(
        UUID(as_uuid=True),
        index=True,
    )

    process_type_id = Column(
        UUID(as_uuid=True),
        ForeignKey(
            "production_process_types.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    # -----------------------------------------

    start_at = Column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )

    end_at = Column(
        DateTime(timezone=True),
    )

    customer_id = Column(
        UUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="SET NULL"),
    )

    dress_id = Column(
        UUID(as_uuid=True),
        ForeignKey("dresses.id", ondelete="SET NULL"),
    )

    loan_id = Column(
        UUID(as_uuid=True),
        ForeignKey("loans.id", ondelete="SET NULL"),
    )

    production_order_id = Column(
        UUID(as_uuid=True),
        ForeignKey(
            "production_orders.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    assigned_user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    priority = Column(
        String(20),
        nullable=False,
        default="MEDIUM",
    )

    color = Column(String(20))

    notes = Column(Text)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
