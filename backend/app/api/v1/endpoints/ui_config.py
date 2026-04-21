from uuid import UUID

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.tenant_field_setting import TenantFieldSetting
from app.schemas.ui_config import FieldConfigResponse, TenantFieldSettingBulkUpdate
from app.services.field_config_service import get_effective_field_config

router = APIRouter(prefix="/ui-config", tags=["ui-config"])


def require_superuser(user=Depends(get_current_user)):
    if not getattr(user, "is_superuser", False):
        raise HTTPException(status_code=403, detail="Superuser required")
    return user


@router.get("/{entity_name}", response_model=list[FieldConfigResponse])
def get_ui_config(
    entity_name: str,
    tenant_id: UUID = Query(...),
    db: Session = Depends(get_db),
    user=Depends(require_superuser),
):
    return get_effective_field_config(db, tenant_id, entity_name)


@router.put("/{entity_name}", response_model=list[FieldConfigResponse])
def update_ui_config(
    entity_name: str,
    payload: TenantFieldSettingBulkUpdate,
    tenant_id: UUID = Query(...),
    db: Session = Depends(get_db),
    user=Depends(require_superuser),
):
    existing = db.execute(
        select(TenantFieldSetting).where(
            TenantFieldSetting.tenant_id == tenant_id,
            TenantFieldSetting.entity_name == entity_name,
        )
    ).scalars().all()

    existing_map = {item.field_name: item for item in existing}

    for item in payload.items:
        row = existing_map.get(item.field_name)

        if row is None:
            row = TenantFieldSetting(
                tenant_id=tenant_id,
                entity_name=entity_name,
                field_name=item.field_name,
            )
            db.add(row)

        row.visible = item.visible
        row.required = item.required
        row.editable = item.editable
        row.list_visible = item.list_visible
        row.form_visible = item.form_visible
        row.order_index = item.order_index
        row.label_override = item.label_override
        row.help_text = item.help_text

        # Nuevo
        row.validation_rules_override = item.validation_rules_override
        row.ui_props_override = item.ui_props_override

    db.commit()

    return get_effective_field_config(db, tenant_id, entity_name)
