"""Unit tests for oss_service — oss2 client mocked, no network."""

from unittest.mock import MagicMock, patch

import pytest

from app.config import settings
from app.services import oss_service


def test_upload_image_builds_namespaced_key_and_public_url(monkeypatch):
    monkeypatch.setattr(settings, "OSS_ENDPOINT", "oss-cn-test.aliyuncs.com")
    monkeypatch.setattr(settings, "OSS_BUCKET", "nepstar")
    bucket = MagicMock()
    with patch.object(oss_service, "build_bucket", return_value=bucket):
        url = oss_service.upload_image(b"image-bytes", ".png", "image/png")

    args, kwargs = bucket.put_object.call_args
    key = args[0]
    assert key.startswith("health/products/")
    assert key.endswith(".png")
    assert url == f"https://nepstar.oss-cn-test.aliyuncs.com/{key}"


def test_upload_image_wraps_failures_as_business_error(monkeypatch):
    monkeypatch.setattr(settings, "OSS_ENDPOINT", "oss-cn-test.aliyuncs.com")
    with patch.object(oss_service, "build_bucket", side_effect=RuntimeError("no config")):
        with pytest.raises(ValueError, match="product.upload_failed"):
            oss_service.upload_image(b"x", ".jpg", "image/jpeg")
