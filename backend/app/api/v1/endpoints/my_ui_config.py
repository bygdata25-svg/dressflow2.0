from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.schemas.ui_config import FieldConfigResponse
from app.services.field_config_service import get_effective_field_config

router = APIRouter(prefix="/my-ui-config", tags=["my-ui-config"])


@router.get("/{entity_name}", response_model=list[FieldConfigResponse])
def get_my_ui_config(
    entity_name: str,
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager", "staff")),
):
    return get_effective_field_config(
        db=db,
        tenant_id=membership.tenant_id,
        entity_name=entity_name,
    )
