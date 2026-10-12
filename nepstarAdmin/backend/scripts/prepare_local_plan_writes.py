"""Add the one missing plan field to the explicitly isolated local database."""

import argparse
import asyncio
import json
import os

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

try:
    from .local_ai_runtime import DEFAULT_LOCAL_URL, local_write_url
except ImportError:
    from local_ai_runtime import DEFAULT_LOCAL_URL, local_write_url


async def prepare(raw_url: str, *, apply: bool) -> int:
    local_write_url(raw_url)
    engine = create_async_engine(raw_url, echo=False, pool_pre_ping=True)
    try:
        async with engine.connect() as connection:
            columns = await connection.execute(
                text("SHOW COLUMNS FROM nepstar.sa_plan LIKE 'trigger_score_below'")
            )
            if columns.first() is not None:
                print(json.dumps({"status": "ready", "changed": False}))
                return 0
        if not apply:
            print(json.dumps({"status": "needs_local_schema_update", "changed": False}))
            return 0
        async with engine.begin() as connection:
            await connection.execute(text(
                "ALTER TABLE nepstar.sa_plan "
                "ADD COLUMN trigger_score_below INT NOT NULL DEFAULT 80"
            ))
        print(json.dumps({"status": "ready", "changed": True}))
        return 0
    finally:
        await engine.dispose()


def main() -> int:
    parser = argparse.ArgumentParser(description="Prepare only local isolated plan writes")
    parser.add_argument("--apply", action="store_true", help="add the missing local plan column")
    args = parser.parse_args()
    raw_url = os.environ.get("AI_CONSULT_LOCAL_RUNTIME_URL", DEFAULT_LOCAL_URL)
    try:
        return asyncio.run(prepare(raw_url, apply=args.apply))
    except Exception as exc:
        print(json.dumps({"status": "blocked", "error_category": type(exc).__name__}))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
