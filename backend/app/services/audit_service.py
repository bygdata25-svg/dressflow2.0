from app.models.audit_log import AuditLog


def create_audit_log(
    db,
    tenant_id,
    user_id,
    entity_type: str,
    entity_id,
    action: str,
    payload: dict | None = None,
):
    log = AuditLog(
        tenant_id=tenant_id,
        user_id=user_id,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        payload=payload,
    )
    db.add(log)
