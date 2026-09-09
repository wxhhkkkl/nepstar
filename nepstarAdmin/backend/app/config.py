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
    COMPANY_ID: str = "225671"  # 全局设备过滤——所有设备查询强制限制此company_id
    DEPT_ID: str = "225671"  # 全局报告部门过滤——所有检测报告查询强制限制此dept_id
    REPORT_BASE_URL: str = "https://kj101.jiankangzhan.com/common.html"  # 检测报告展示页基础URL

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
