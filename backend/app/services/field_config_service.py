from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.field_definition import FieldDefinition
from app.models.tenant_field_setting import TenantFieldSetting


def get_effective_field_config(db: Session, tenant_id, entity_name: str) -> list[dict]:
    definitions = db.execute(
        select(FieldDefinition).where(FieldDefinition.entity_name == entity_name)
    ).scalars().all()

    overrides = db.execute(
        select(TenantFieldSetting).where(
            TenantFieldSetting.tenant_id == tenant_id,
            TenantFieldSetting.entity_name == entity_name,
        )
    ).scalars().all()

    override_map = {item.field_name: item for item in overrides}

    result: list[dict] = []
    for definition in definitions:
        override = override_map.get(definition.field_name)

        result.append(
            {
                "field_name": definition.field_name,
                "label": (
                    override.label_override
                    if override and override.label_override
                    else definition.default_label
                ),
                "field_type": definition.field_type,
                "visible": override.visible if override else definition.default_visible,
                "required": override.required if override else definition.default_required,
                "editable": override.editable if override else definition.default_editable,
                "list_visible": (
                    override.list_visible if override else definition.default_list_visible
                ),
                "form_visible": (
                    override.form_visible if override else definition.default_form_visible
                ),
                "order_index": (
                    override.order_index if override else definition.default_order_index
                ),
                "help_text": (
                    override.help_text
                    if override and override.help_text is not None
                    else definition.default_help_text
                ),
                "validation_rules": (
                    override.validation_rules_override
                    if override and override.validation_rules_override is not None
                    else definition.validation_rules
                ),
                "ui_props": (
                    override.ui_props_override
                    if override and override.ui_props_override is not None
                    else definition.ui_props
                ),
            }
        )

    return sorted(result, key=lambda item: (item["order_index"], item["field_name"]))
