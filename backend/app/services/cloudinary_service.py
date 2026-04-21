import cloudinary
import cloudinary.uploader
import os

CLOUDINARY_ENABLED = all([
    os.getenv("CLOUDINARY_CLOUD_NAME"),
    os.getenv("CLOUDINARY_API_KEY"),
    os.getenv("CLOUDINARY_API_SECRET"),
])

if CLOUDINARY_ENABLED:
    cloudinary.config(
        cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
        api_key=os.getenv("CLOUDINARY_API_KEY"),
        api_secret=os.getenv("CLOUDINARY_API_SECRET"),
        secure=True,
    )


def upload_image(file, folder: str):
    if not CLOUDINARY_ENABLED or not file:
        return None, None

    result = cloudinary.uploader.upload(
        file.file,
        folder=folder,
    )

    return result.get("secure_url"), result.get("public_id")


def delete_image(public_id: str | None):
    if not CLOUDINARY_ENABLED or not public_id:
        return

    cloudinary.uploader.destroy(public_id)
