"""Per-test ASGI client for the health-module API tests.

pytest-asyncio runs each test in its own event loop. The shared conftest engine
caches aiomysql connections bound to the loop that created them, so reusing them
in the next test's loop crashes on Windows (proactor). This helper builds a fresh
engine per test and disposes it in the same loop.
"""

from contextlib import asynccontextmanager

from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.database import get_db
from app.main import app


@asynccontextmanager
async def make_client():
    engine = create_async_engine(settings.DATABASE_URL)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def _override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            yield ac
    finally:
        app.dependency_overrides.pop(get_db, None)
        await engine.dispose()
