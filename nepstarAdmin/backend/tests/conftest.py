"""Shared test fixtures."""
import asyncio

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.database import Base, get_db
from app.main import app

TEST_DB_URL = settings.DATABASE_URL.replace("platform", "platform")  # reuse main DB for now

test_engine = create_async_engine(settings.DATABASE_URL, echo=False)
TestSession = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


async def override_get_db():
    async with TestSession() as session:
        try:
            yield session
        finally:
            await session.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture
async def db():
    async with TestSession() as session:
        yield session
        await session.rollback()


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def admin_headers():
    """Return headers with a valid admin token."""
    from app.security.jwt import create_token
    token = create_token(1, "admin")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def limited_user_headers():
    """Return headers for a non-admin user (user_id=2) with limited org scope."""
    from app.security.jwt import create_token
    token = create_token(2, "testuser")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def sample_device_data():
    """Return a list of sample device records matching ne table schema."""
    return [
        {"ne_id": "DEV001", "ne_no": "SN-001", "device_name": "检测仪-A",
         "company_id": "225671", "hierarchy": "总公司/华东区",
         "device_status": 1, "online_status": 1,
         "ne_model_id": "MODEL_A", "create_date": "2025-01-01"},
        {"ne_id": "DEV002", "ne_no": "SN-002", "device_name": "检测仪-B",
         "company_id": "225671", "hierarchy": "总公司/华北区",
         "device_status": 1, "online_status": 0,
         "ne_model_id": "MODEL_B", "create_date": "2025-02-01"},
        {"ne_id": "DEV003", "ne_no": "SN-003", "device_name": "检测仪-C",
         "company_id": "999999", "hierarchy": "其他公司/华南区",
         "device_status": 0, "online_status": 1,
         "ne_model_id": "MODEL_A", "create_date": "2025-03-01"},
    ]


@pytest.fixture
def sample_config_data():
    """Return sample config DB data for tb_device_qr, tb_device_upload, tb_upload_info."""
    return {
        "qr": [
            {"device_id": "DEV001", "qr_dept_id": "225671",
             "qr_url": "https://example.com/qr/DEV001.png"},
        ],
        "device_upload": [
            {"device_id": "DEV001", "u_id": "U001", "firmware_ver": "v2.1", "hardware_ver": "H3"},
        ],
        "upload_info": [
            {"u_id": "U001", "upload_time": "2025-06-01", "file_name": "config.json"},
        ],
    }


@pytest.fixture
def sample_org_tree():
    """Return a sample organization tree for testing."""
    return [
        {
            "id": 1, "org_name": "总公司", "org_code": "HQ",
            "children": [
                {"id": 2, "org_name": "华东区", "org_code": "EAST",
                 "children": [
                     {"id": 4, "org_name": "上海分部", "org_code": "SH", "children": []},
                 ]},
                {"id": 3, "org_name": "华北区", "org_code": "NORTH",
                 "children": []},
            ],
        },
    ]
