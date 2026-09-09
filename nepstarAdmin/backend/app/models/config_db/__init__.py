"""fast_plus 配置库反射模型

通过 device_id 关联 ne 表获取设备配置信息。
tb_device_upload: device_id → ne.ne_id
tb_upload_info: u_id → tb_device_upload.u_id (JOIN)
tb_device_qr: device_id + qr_dept_id → ne.ne_id + ne.company_id
"""

from .tb_device_qr import tb_device_qr
from .tb_upload_info import tb_upload_info
from .tb_device_upload import tb_device_upload

__all__ = ["tb_device_qr", "tb_upload_info", "tb_device_upload"]
