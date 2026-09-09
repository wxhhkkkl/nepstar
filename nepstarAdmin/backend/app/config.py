"""Application configuration via Pydantic Settings."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "mysql+aiomysql://root:root@localhost:3306/smart_admin"
    CONFIG_DATABASE_URL: str = ""
    NEPSTAR_DATABASE_URL: str = ""  # 系统表(sa_*)所在库，读/写
    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_EXPIRATION_SECONDS: int = 7200
    JWT_ALGORITHM: str = "HS256"
    LOGIN_MAX_FAILURES: int = 5
    LOCKOUT_MINUTES: int = 30
    PASSWORD_MIN_LENGTH: int = 8
    DEFAULT_LANG: str = "zh-CN"
    LOG_LEVEL: str = "INFO"
    COMPANY_ID: str = "225721"  # 全局设备过滤——所有设备查询强制限制此company_id
    DEPT_ID: str = "225721"  # 全局报告部门过滤——所有检测报告查询强制限制此dept_id
    REPORT_BASE_URL: str = "https://kj101.jiankangzhan.com/common.html"  # 检测报告展示页基础URL
    # 阿里云 OSS —— 商品图片存储（bucket 名称固定 nepstar；凭据只存 .env，禁止入库/入代码）
    OSS_BUCKET: str = "nepstar"
    OSS_ENDPOINT: str = ""  # 例 oss-cn-hangzhou.aliyuncs.com（来自 .env）
    OSS_ACCESSKEY_ID: str = ""
    OSS_ACCESSKEY_KEY: str = ""
    # 商品图片上传约束（前端上传控件需与此一致）
    OSS_UPLOAD_MAX_BYTES: int = 10 * 1024 * 1024  # 单张 ≤ 10MB
    PRODUCT_MAX_IMAGE_COUNT: int = 10  # 单商品图片总数上限

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
