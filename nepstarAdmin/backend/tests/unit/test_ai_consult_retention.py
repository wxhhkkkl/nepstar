"""永久留存策略：历史清理作业不得触碰数据库。"""

import asyncio
import sys

import pytest

from app.services import ai_consult_retention as retention


class NoDatabaseAccess:
    async def execute(self, *_args, **_kwargs):
        raise AssertionError("永久留存路径不得查询数据库")

    async def delete(self, *_args, **_kwargs):
        raise AssertionError("永久留存路径不得删除数据库数据")


@pytest.mark.asyncio
async def test_retention_batch_fails_before_reading_or_deleting_any_data():
    with pytest.raises(RuntimeError, match="retained permanently"):
        await retention.purge_retention_batch(NoDatabaseAccess())


@pytest.mark.asyncio
async def test_scheduled_retention_job_fails_before_opening_database(monkeypatch):
    def forbidden_sessionmaker():
        raise AssertionError("永久留存路径不得创建数据库连接")

    monkeypatch.setattr(retention, "get_ai_consult_sessionmaker", forbidden_sessionmaker, raising=False)
    with pytest.raises(RuntimeError, match="retained permanently"):
        await retention.run_retention_job()


def test_legacy_cli_refuses_cleanup_even_with_apply(monkeypatch, capsys):
    monkeypatch.setattr(sys, "argv", ["ai_consult_retention", "--apply"])
    with pytest.raises(SystemExit) as error:
        retention.main()
    assert error.value.code == 2
    assert "自动清理已停用" in capsys.readouterr().err
