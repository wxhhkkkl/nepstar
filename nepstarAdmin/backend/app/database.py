"""SQLAlchemy async engine and session configuration."""

from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
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
