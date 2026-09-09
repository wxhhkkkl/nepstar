"""Read-only reflected model for old system `customer` table.

This table stores end-user/customer information. All queries are SELECT-only —
never write, update, or delete records in this table.
"""

import logging

from sqlalchemy import MetaData, Table
from sqlalchemy.exc import NoSuchTableError

from ...database import sync_engine

logger = logging.getLogger(__name__)

try:
    customer_table = Table("customer", MetaData(), autoload_with=sync_engine, keep_existing=True)
except NoSuchTableError:
    logger.warning("旧系统 'customer' 表未找到 — 客户管理功能不可用。")
    customer_table = None
