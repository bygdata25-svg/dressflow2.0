from pydantic import BaseModel, Field


class FieldConfigResponse(BaseModel):
    field_name: str
    label: str
    field_type: str

    visible: bool
    required: bool
    editable: bool

    list_visible: bool
    form_visible: bool
    order_index: int
    help_text: str | None = None

    # Nuevo
    validation_rules: dict | None = None
    ui_props: dict | None = None


class TenantFieldSettingUpdate(BaseModel):
    field_name: str = Field(min_length=1, max_length=100)
    visible: bool
    required: bool
    editable: bool
    list_visible: bool
    form_visible: bool
    order_index: int
    label_override: str | None = Field(default=None, max_length=150)
    help_text: str | None = None

    # Nuevo: opcionales para no romper la UI actual
    validation_rules_override: dict | None = None
    ui_props_override: dict | None = None


class TenantFieldSettingBulkUpdate(BaseModel):
    entity_name: str = Field(min_length=1, max_length=50)
    items: list[TenantFieldSettingUpdate]
