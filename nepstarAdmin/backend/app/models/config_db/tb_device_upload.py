"""tb_device_upload 反射模型 — 设备上传记录（fast_plus 配置库，只读）。

通过 device_id 直接关联 ne.ne_id。
"""
from sqlalchemy import MetaData, Table
from ...database import config_sync_engine

try:
    tb_device_upload = Table("tb_device_upload", MetaData(), autoload_with=config_sync_engine)
except Exception:
    tb_device_upload = None
