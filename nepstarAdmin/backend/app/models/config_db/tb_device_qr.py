"""tb_device_qr 反射模型 — 二维码存储（fast_plus 配置库，只读）。"""
from sqlalchemy import MetaData, Table
from ...database import config_sync_engine

try:
    tb_device_qr = Table("tb_device_qr", MetaData(), autoload_with=config_sync_engine)
except Exception:
    tb_device_qr = None
