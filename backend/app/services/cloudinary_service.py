from __future__ import annotations

import os
import re
from typing import BinaryIO

import cloudinary
import cloudinary.uploader

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True,
)


def _safe_segment(value: str) -> str:
    """
    Sanitiza un segmento para usarlo en public_id/folder.
    """
    value = (value or "").strip().lower()
    value = re.sub(r"[^a-z0-9_-]+", "-", value)
    value = re.sub(r"-{2,}", "-", value).strip("-")
    return value or "unknown"


def build_asset_path(
    tenant_slug: str,
    entity: str,
    asset_key: str,
) -> str:
    """
    Genera el public_id base en Cloudinary.
    """
    tenant = _safe_segment(tenant_slug)
    entity_name = _safe_segment(entity)
    key = _safe_segment(asset_key)
    return f"dressflow/tenants/{tenant}/{entity_name}/{key}"


def upload_image(
    file_obj: BinaryIO,
    tenant_slug: str,
    entity: str,
    asset_key: str,
    overwrite: bool = True,
) -> dict:
    """
    Sube imagen a Cloudinary con ruta consistente por tenant.
    """
    public_id = build_asset_path(
        tenant_slug=tenant_slug,
        entity=entity,
        asset_key=asset_key,
    )

    result = cloudinary.uploader.upload(
        file_obj,
        public_id=public_id,
        overwrite=overwrite,
        resource_type="image",
    )

    return {
        "url": result.get("secure_url"),
        "public_id": result.get("public_id"),
        "width": result.get("width"),
        "height": result.get("height"),
        "format": result.get("format"),
    }


def delete_image(public_id: str | None) -> None:
    if not public_id:
        return

    cloudinary.uploader.destroy(public_id, resource_type="image")
