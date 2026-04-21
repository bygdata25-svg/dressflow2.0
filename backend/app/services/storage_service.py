import os
import shutil
import uuid
from pathlib import Path
from uuid import uuid4
from fastapi import UploadFile

UPLOAD_ROOT = Path("uploads")
BASE_UPLOAD_DIR = Path("frontend/public/uploads")
DRESS_UPLOAD_DIR = UPLOAD_ROOT / "dresses"


def ensure_upload_dirs() -> None:
    DRESS_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def save_dress_image(file, tenant_id: str, dress_id: str) -> tuple[str, str]:
    ensure_upload_dirs()

    extension = Path(file.filename).suffix.lower() or ".jpg"
    generated_name = f"{tenant_id}_{dress_id}_{uuid.uuid4().hex}{extension}"
    destination = DRESS_UPLOAD_DIR / generated_name

    with destination.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_path = str(destination)
    file_url = f"/uploads/dresses/{generated_name}"
    return file_path, file_url

def save_production_order_image(file: UploadFile, tenant_id: str, order_id: str) -> tuple[str, str]:
    extension = Path(file.filename or "").suffix.lower() or ".jpg"
    folder = BASE_UPLOAD_DIR / "production-orders" / tenant_id / order_id
    folder.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid4().hex}{extension}"
    file_path = folder / filename

    with file_path.open("wb") as buffer:
        buffer.write(file.file.read())

    relative_file_path = str(file_path).replace("\\", "/")
    public_url = relative_file_path.replace("frontend/public", "")

    return relative_file_path, public_url

def delete_local_file(file_path: str) -> None:
    if file_path and os.path.exists(file_path):
        os.remove(file_path)
