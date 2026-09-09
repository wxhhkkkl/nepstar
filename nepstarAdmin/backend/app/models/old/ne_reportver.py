"""Read-only reflected model for old system ne_reportver table."""

import logging

from sqlalchemy import MetaData, Table
from sqlalchemy.exc import NoSuchTableError

from ...database import sync_engine

logger = logging.getLogger(__name__)

try:
    ne_reportver_table = Table("ne_reportver", MetaData(), autoload_with=sync_engine, keep_existing=True)
except NoSuchTableError:
    logger.warning("Old system table 'ne_reportver' not found — report features will be unavailable.")
    ne_reportver_table = None
