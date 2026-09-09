"""Read-only reflected model for old system `ne` (device) table."""

import logging

from sqlalchemy import MetaData, Table
from sqlalchemy.exc import NoSuchTableError

from ...database import sync_engine

logger = logging.getLogger(__name__)

try:
    ne_table = Table("ne", MetaData(), autoload_with=sync_engine, keep_existing=True)
except NoSuchTableError:
    logger.warning("Old system table 'ne' not found — device features may be unavailable.")
    ne_table = None
