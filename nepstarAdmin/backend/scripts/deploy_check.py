"""Deployment preflight: configuration/imports + read-only DB schema + Mongo ping.

No startup hooks, seeding, migrations, chat requests, or model calls.
Only safe fixed messages/schema identifiers reach stdout.
"""

import asyncio
import importlib
from pathlib import Path
import pkgutil
import sys


BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))


def say(message):
    print(f"[check] {message}", flush=True)


async def check():
    from sqlalchemy import inspect
    from sqlalchemy.engine import make_url
    from sqlalchemy.ext.asyncio import create_async_engine

    from app.config import settings

    if settings.JWT_SECRET_KEY == "change-me-in-production" or len(settings.JWT_SECRET_KEY) < 32:
        say("JWT_SECRET_KEY 必须使用服务器专用随机密钥（至少 32 个字符）。")
        return False
    url = make_url(settings.NEPSTAR_DATABASE_URL)
    if url.drivername != "mysql+aiomysql" or url.database != "nepstar" or not url.host or url.query:
        say("请配置显式 mysql+aiomysql、库名 nepstar 的 NEPSTAR_DATABASE_URL（不含 query 参数）。")
        return False

    # Import model/route definitions, but never execute app startup/lifespan.
    from app.database import Base
    from app.models import new
    for module in pkgutil.iter_modules(new.__path__):
        importlib.import_module(f"app.models.new.{module.name}")
    importlib.import_module("app.main")
    say("配置和应用模块加载通过。")

    engine = create_async_engine(url, connect_args={"connect_timeout": 8}, echo=False)
    try:
        async with engine.connect() as connection:
            await connection.exec_driver_sql("SET SESSION TRANSACTION READ ONLY")
            if (await connection.exec_driver_sql("SELECT DATABASE()")).scalar_one() != "nepstar":
                say("数据库实际目标不是 nepstar，检查中止。")
                return False

            def schema_errors(sync_connection):
                inspector = inspect(sync_connection)
                errors = []
                existing = set(inspector.get_table_names(schema="nepstar"))
                for table in Base.metadata.tables.values():
                    if not table.name.startswith("sa_") or table.schema != "nepstar":
                        continue
                    if table.name not in existing:
                        errors.append(f"缺少表：{table.name}")
                        continue
                    columns = {col["name"]: col for col in inspector.get_columns(table.name, schema="nepstar")}
                    for column in table.columns:
                        if column.name not in columns:
                            errors.append(f"缺少字段：{table.name}.{column.name}")
                    if table.name == "sa_ai_consult_session" and "consent_id" in columns:
                        if not columns["consent_id"]["nullable"]:
                            errors.append("sa_ai_consult_session.consent_id 尚未允许为空（迁移 008）")
                    indices = {index["name"] for index in inspector.get_indexes(table.name, schema="nepstar")}
                    for index in table.indexes:
                        if index.name not in indices:
                            errors.append(f"缺少索引：{table.name}.{index.name}")
                return errors

            errors = await connection.run_sync(schema_errors)
            if errors:
                for message in errors[:30]:
                    say(message)
                say("表结构尚未就绪。首次上线需先备份并核对专用迁移方案；不能运行默认 alembic upgrade head 或 stamp。")
                return False
    finally:
        await engine.dispose()
    say("nepstar 所需表、字段和声明索引检查通过。")

    # The general/report connection may legitimately target platform. Check
    # connectivity only; all schema checks above target the dedicated nepstar.
    for name in ("DATABASE_URL", "CONFIG_DATABASE_URL"):
        raw = getattr(settings, name)
        if not raw:
            continue
        engine = create_async_engine(raw, connect_args={"connect_timeout": 8}, echo=False)
        try:
            async with engine.connect() as connection:
                await connection.exec_driver_sql("SET SESSION TRANSACTION READ ONLY")
                await connection.exec_driver_sql("SELECT 1")
        finally:
            await engine.dispose()
        say(f"{name} 只读连接检查通过。")
    if settings.MONGODB_URL:
        from motor.motor_asyncio import AsyncIOMotorClient
        client = AsyncIOMotorClient(settings.MONGODB_URL, serverSelectionTimeoutMS=8000,
                                   connectTimeoutMS=8000, socketTimeoutMS=8000)
        try:
            await client[settings.MONGODB_DB].command("ping")
        finally:
            client.close()
        say("MongoDB ping 通过（不读取报告正文）。")
    else:
        say("未配置 MONGODB_URL；报告数据源未验证。")
    say("检查不证明 AI 服务可用、账号只读权限或线上代理/真机验收完成。")
    return True


if __name__ == "__main__":
    try:
        raise SystemExit(0 if asyncio.run(asyncio.wait_for(check(), timeout=90)) else 2)
    except Exception as exc:
        say(f"检查失败（{type(exc).__name__}），请核对服务器 .env、依赖及数据库连接；未输出敏感配置。")
        raise SystemExit(2)
