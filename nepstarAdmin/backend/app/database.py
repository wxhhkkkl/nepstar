"""SQLAlchemy async engine and session configuration."""

from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from .config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False, pool_size=10, max_overflow=20)
sync_engine = create_engine(settings.DATABASE_URL.replace("+aiomysql", "+pymysql"), echo=False)

# 配置库fast_plus独立连接（不同RDS实例），仅用于只读查询
if settings.CONFIG_DATABASE_URL:
    config_engine = create_async_engine(settings.CONFIG_DATABASE_URL, echo=False, pool_size=5, max_overflow=10)
    config_sync_engine = create_engine(
        settings.CONFIG_DATABASE_URL.replace("+aiomysql", "+pymysql"), echo=False
    )
else:
    config_engine = None
    config_sync_engine = None

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# 系统表(sa_*)所在 schema，取自 NEPSTAR_DATABASE_URL 的库名；未配置则为 None（用连接默认库）
def _resolve_nepstar_schema() -> str | None:
    if not settings.NEPSTAR_DATABASE_URL:
        return None
    try:
        return make_url(settings.NEPSTAR_DATABASE_URL).database
    except Exception:
        return None


NEPSTAR_SCHEMA: str | None = _resolve_nepstar_schema()


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()


class AiConsultStorageConfigurationError(RuntimeError):
    """AI 咨询写库目标未明确限定在 nepstar。"""


def validate_ai_consult_database_url(raw_url: str) -> None:
    """拒绝旧库、其他驱动及未指定库名的咨询写连接。"""
    if not raw_url:
        raise AiConsultStorageConfigurationError("AI consult requires NEPSTAR_DATABASE_URL")
    try:
        url = make_url(raw_url)
    except ArgumentError as exc:
        raise AiConsultStorageConfigurationError("Invalid AI consult database URL") from exc
    if url.drivername != "mysql+aiomysql" or url.database != "nepstar" or not url.host:
        raise AiConsultStorageConfigurationError("AI consult writes require mysql+aiomysql/nepstar")


@lru_cache(maxsize=1)
def _ai_consult_sessionmaker(raw_url: str) -> async_sessionmaker[AsyncSession]:
    validate_ai_consult_database_url(raw_url)
    # Quota admission locks the settings row, then reads committed attempts.
    # A repeatable-read snapshot taken by the earlier guest check would be stale.
    consult_engine = create_async_engine(
        raw_url, echo=False, pool_size=5, max_overflow=10,
        isolation_level="READ COMMITTED",
    )
    return async_sessionmaker(consult_engine, class_=AsyncSession, expire_on_commit=False)


def get_ai_consult_sessionmaker() -> async_sessionmaker[AsyncSession]:
    """咨询业务只用独立的 nepstar 写连接，不回退到通用 get_db。"""
    return _ai_consult_sessionmaker(settings.NEPSTAR_DATABASE_URL)


def ai_consult_storage_ready() -> bool:
    """启动时仅检查连接目标；不尝试连接或写入数据库。"""
    try:
        get_ai_consult_sessionmaker()
    except AiConsultStorageConfigurationError:
        return False
    return True


async def get_ai_consult_db() -> AsyncSession:
    async with get_ai_consult_sessionmaker()() as session:
        yield session
