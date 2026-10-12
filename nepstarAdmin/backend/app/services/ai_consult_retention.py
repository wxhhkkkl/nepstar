"""AI 咨询永久留存策略：清理入口显式禁用，防止误删咨询内容。"""

import argparse
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession


@dataclass(frozen=True)
class PurgeCounts:
    sessions: int = 0
    turns: int = 0
    generations: int = 0
    hard_deleted_sessions: int = 0
    guests: int = 0
    consents: int = 0


def _permanent_retention_error() -> RuntimeError:
    return RuntimeError("AI consultation records are retained permanently; automatic cleanup is disabled")


async def purge_retention_batch(
    db: AsyncSession,
    *,
    now=None,
    limit: int = 100,
) -> PurgeCounts:
    """保留旧调度器调用签名，但绝不查询或修改数据库。"""
    del db, now, limit
    raise _permanent_retention_error()


async def run_retention_job(*, max_batches: int = 100, batch_size: int = 100) -> PurgeCounts:
    """任何调度误触发都在获取数据库连接前失败，避免自动删除永久留存内容。"""
    del max_batches, batch_size
    raise _permanent_retention_error()


def main() -> None:
    parser = argparse.ArgumentParser(description="AI consultation content is retained permanently")
    parser.add_argument("--apply", action="store_true", help=argparse.SUPPRESS)
    parser.parse_args()
    parser.error("永久留存策略已启用，AI 咨询自动清理已停用；没有执行数据库操作")


if __name__ == "__main__":
    main()
