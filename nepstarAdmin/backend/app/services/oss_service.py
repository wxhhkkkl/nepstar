"""Aliyun OSS upload helper (商品图片). Credentials come from Settings/.env only."""

import uuid

from oss2 import Auth, Bucket

from ..config import settings

OBJECT_PREFIX = "health/products"


def build_bucket() -> Bucket:
    """Build the OSS bucket client from configuration (kept separate for testing)."""
    if not (settings.OSS_ENDPOINT and settings.OSS_ACCESSKEY_ID and settings.OSS_ACCESSKEY_KEY):
        raise RuntimeError(
            "OSS is not configured (OSS_ENDPOINT/OSS_ACCESSKEY_ID/OSS_ACCESSKEY_KEY)"
        )
    return Bucket(
        Auth(settings.OSS_ACCESSKEY_ID, settings.OSS_ACCESSKEY_KEY),
        settings.OSS_ENDPOINT,
        settings.OSS_BUCKET,
    )


def _public_url(key: str) -> str:
    return f"https://{settings.OSS_BUCKET}.{settings.OSS_ENDPOINT}/{key}"


def upload_image(data: bytes, ext: str = ".jpg", content_type: str | None = None) -> str:
    """Upload image bytes to OSS and return the public URL.

    Raises ValueError('product.upload_failed') on any OSS/config failure so the
    API layer can return a business error instead of a 500.
    """
    key = f"{OBJECT_PREFIX}/{uuid.uuid4().hex}{ext}"
    try:
        bucket = build_bucket()
        headers = {"Content-Type": content_type} if content_type else None
        bucket.put_object(key, data, headers=headers)
    except Exception as exc:  # noqa: BLE001 - surface as business error
        raise ValueError("product.upload_failed") from exc
    return _public_url(key)
