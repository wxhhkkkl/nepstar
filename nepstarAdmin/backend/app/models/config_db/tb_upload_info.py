"""tb_upload_info 反射模型 — 上传信息（fast_plus 配置库，只读）。

通过 u_id 与 tb_device_upload 关联获取完整配置数据。
"""
from sqlalchemy import MetaData, Table
from ...database import config_sync_engine

try:
    tb_upload_info = Table("tb_upload_info", MetaData(), autoload_with=config_sync_engine)
except Exception:
    tb_upload_info = None
