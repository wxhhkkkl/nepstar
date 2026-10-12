"""跨进程匿名入口总量限制，计数只在 nepstar 配置行内更新。"""

from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.new.sa_ai_consult import SAAiConsultSettings


class GuestEntryDisabled(Exception):
    """入口关闭、未配置或限流上限未明确设置。"""

    def __init__(self, maintenance_text: str | None = None):
        self.maintenance_text = maintenance_text


def public_maintenance_text(config: SAAiConsultSettings | None) -> str | None:
    """只返回后台公开维护说明；不将内部配置或异常详情暴露给访客。"""
    value = getattr(config, "maintenance_text", None)
    if not isinstance(value, str):
        return None
    return value.strip()[:500] or None


class GuestRateLimited(Exception):
    def __init__(self, retry_after_seconds: int):
        self.retry_after_seconds = retry_after_seconds


async def reserve_guest_creation(db: AsyncSession, *, now: datetime | None = None) -> None:
    """在与 guest INSERT 相同的事务中调用；锁住单例行避免并发超发。"""
    result = await db.execute(
        select(SAAiConsultSettings)
        .where(SAAiConsultSettings.id == 1)
        .with_for_update()
    )
    config = result.scalar_one_or_none()
    maintenance_text = public_maintenance_text(config)
    if maintenance_text or config is None or not config.enabled or config.guest_create_limit_per_minute <= 0:
        raise GuestEntryDisabled(maintenance_text)

    current = now or datetime.now(UTC).replace(tzinfo=None)
    if current.tzinfo is not None:
        current = current.astimezone(UTC).replace(tzinfo=None)
    window = current.replace(second=0, microsecond=0)
    if config.guest_create_window_start != window:
        config.guest_create_window_start = window
        config.guest_create_count = 0
    if config.guest_create_count >= config.guest_create_limit_per_minute:
        retry_at = window + timedelta(minutes=1)
        raise GuestRateLimited(max(1, int((retry_at - current).total_seconds() + 0.999999)))
    config.guest_create_count += 1
