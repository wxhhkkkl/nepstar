"""Read-only reflected model for old system `inspect_base` (inspection report) table.

This table stores inspection report metadata. All queries are SELECT-only —
never write, update, or delete records in this table.
"""

import logging

from sqlalchemy import MetaData, Table
from sqlalchemy.exc import NoSuchTableError

from ...database import sync_engine

logger = logging.getLogger(__name__)

try:
    inspect_base_table = Table("inspect_base", MetaData(), autoload_with=sync_engine, keep_existing=True)
except NoSuchTableError:
    logger.warning("旧系统 'inspect_base' 表未找到 — 检测报告功能不可用。")
    inspect_base_table = None
