from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.tenant_sequence import TenantSequence


ENTITY_PREFIXES = {
    "customer": "CUS",
    "supplier": "SUP",
    "production_order": "OP",
    "sale": "VEN",
}


def get_next_sequence_value(db: Session, tenant_id: UUID, entity: str) -> int:
    row = db.execute(
        select(TenantSequence)
        .where(
            TenantSequence.tenant_id == tenant_id,
            TenantSequence.entity == entity,
        )
        .with_for_update()
    ).scalar_one_or_none()

    if not row:
        row = TenantSequence(
            tenant_id=tenant_id,
            entity=entity,
            last_value=1,
        )
        db.add(row)
        db.flush()
        return 1

    row.last_value += 1
    row.updated_at = datetime.utcnow()
    db.add(row)
    db.flush()
    return row.last_value


def build_sequential_code(entity: str, number: int, digits: int = 5) -> str:
    prefix = ENTITY_PREFIXES[entity]
    return f"{prefix}-{str(number).zfill(digits)}"


def get_next_code(db: Session, tenant_id: UUID, entity: str, digits: int = 5) -> str:
    next_value = get_next_sequence_value(db, tenant_id, entity)
    return build_sequential_code(entity, next_value, digits)
