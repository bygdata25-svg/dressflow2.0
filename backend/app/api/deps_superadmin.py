from fastapi import Depends

from app.api.deps import get_current_user
from app.core.exceptions import AppException


def require_superuser(current_user=Depends(get_current_user)):
    if not getattr(current_user, "is_superuser", False):
        raise AppException(
            status_code=403,
            message="Superuser access required",
            code="SUPERUSER_REQUIRED",
        )
    return current_user
