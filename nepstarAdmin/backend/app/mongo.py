"""报告文档的 MongoDB 客户端（只读）。

报告本体不在 MySQL，而在 MongoDB 的 receive_report 库（见 data-model.md §2）。
本模块只负责连接生命周期与集合访问，不做业务组装——组装在 report_view_service，
读取与错误归并在 report_source。

驱动版本：motor 3.5.x（对应 pymongo 4.8）。报告库为 MongoDB 4.2，
motor 3.6+ 依赖 pymongo>=4.9 并要求 MongoDB 4.4+，不可升级。
"""

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorCollection, AsyncIOMotorDatabase

from .config import settings

_client: AsyncIOMotorClient | None = None


class MongoNotConfiguredError(RuntimeError):
    """未配置 MONGODB_URL，报告数据源不可用。"""


def is_configured() -> bool:
    return bool(settings.MONGODB_URL)


def _ensure_client() -> AsyncIOMotorClient:
    """惰性建立客户端。构造本身不做 IO，真正的超时在发命令时生效。"""
    global _client
    if _client is not None:
        return _client
    if not is_configured():
        raise MongoNotConfiguredError("MONGODB_URL 未配置")
    _client = AsyncIOMotorClient(
        settings.MONGODB_URL,
        serverSelectionTimeoutMS=settings.MONGODB_TIMEOUT_MS,
        socketTimeoutMS=settings.MONGODB_TIMEOUT_MS,
        connectTimeoutMS=settings.MONGODB_TIMEOUT_MS,
        # 只读用途，不重试：重试会把尾延迟推高，与接口 3 秒预算冲突（FR-038、SC-013）
        retryWrites=False,
    )
    return _client


async def connect() -> None:
    """应用启动时预热。未配置 MONGODB_URL 时静默跳过（本地/测试环境可无报告数据源）。"""
    if is_configured():
        _ensure_client()


async def close() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None


def get_database() -> AsyncIOMotorDatabase:
    return _ensure_client()[settings.MONGODB_DB]


def get_report_collection() -> AsyncIOMotorCollection:
    """报告文档集合。_id 即报告编号（report_code）。"""
    return get_database()[settings.MONGODB_COLLECTION]
