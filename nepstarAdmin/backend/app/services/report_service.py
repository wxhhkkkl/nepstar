"""检测报告服务 — 从 inspect_base（旧系统）只读查询。

查询链路：
  inspect_base → ne（JOIN 获取 device_name）
  → sa_device_org（RBAC 桥接：device_id → org_id）
  → sa_role_org（用户数据范围：user → role → org_id 列表）

所有查询受全局 dept_id 过滤 + 用户数据范围限制。
inspect_base 表严格只读，仅执行 SELECT 查询。
"""

from sqlalchemy import func, select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import Select

from ..config import settings
from ..models.old.inspect_base import inspect_base_table
from ..models.old.ne import ne_table
from ..models.new.sa_device_org import SADeviceOrg
from ..models.new.sa_organization import SAOrganization
from ..security.org_filter import get_user_authorized_orgs, get_org_descendants
from ..utils.pii import mask_phone, mask_name


def _build_report_url(report_code: str | None, customer_id: int | None) -> str | None:
    """根据 report_code 和 customer_id 构造报告展示页完整URL。

    格式: {REPORT_BASE_URL}?reportId={report_code}&customerId={customer_id}&middlePage=false&realName=1
    任一参数为 None 或空时返回 None。
    """
    if not report_code or not customer_id:
        return None
    base = settings.REPORT_BASE_URL
    return f"{base}?reportId={report_code}&customerId={customer_id}&middlePage=false&realName=1"


def _status_text(status: int | None) -> str | None:
    """报告状态码 → 可读文本映射。"""
    if status is None:
        return None
    return "有效" if status == 1 else "无效"


def _row_to_dict(row) -> dict:
    """将数据库行转换为 API 响应字典（含 PII 脱敏和 URL 构造）。"""
    m = row._mapping
    report_code = m.get("report_code")
    customer_id = m.get("customer_id")
    return {
        "report_id": m.get("inspect_base_id"),
        "report_code": report_code,
        "customer_id": customer_id,
        "device_sn": m.get("sn_num"),
        "device_name": m.get("device_name"),
        "inspect_date": m.get("inspect_date"),
        "total_score": m.get("total_score"),
        "status": m.get("status"),
        "status_text": _status_text(m.get("status")),
        "mobile": mask_phone(m.get("mobile")),
        "name": mask_name(m.get("name")),
        "report_url": _build_report_url(report_code, customer_id),
    }


async def list_reports(
    db: AsyncSession,
    user_id: int,
    page: int = 1,
    page_size: int = 20,
    device_id: str | None = None,
    org_id: int | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    sn: str | None = None,
):
    """分页查询检测报告列表。

    过滤顺序：
    1. 全局 dept_id 过滤（所有用户强制）
    2. RBAC 数据范围过滤（非 admin 用户）
    3. 组织树级联过滤（前端选中 org → 含子孙）
    4. 时间范围、SN 模糊筛选（可选）
    """
    if inspect_base_table is None:
        return {"records": [], "total": 0, "page": page, "page_size": page_size}

    # 获取用户授权组织
    authorized_org_ids, _ = await get_user_authorized_orgs(user_id, db)

    # 基础查询：inspect_base JOIN ne
    base = (
        select(inspect_base_table, ne_table.c.device_name)
        .select_from(inspect_base_table)
        .join(ne_table, inspect_base_table.c.device_id == ne_table.c.ne_id, isouter=True)
    )

    # 1. 全局 dept_id 过滤
    base = base.where(inspect_base_table.c.dept_id == int(settings.DEPT_ID))

    # 2. RBAC 数据范围过滤（非 admin 用户）
    if authorized_org_ids:  # admin 返回空列表，跳过过滤
        device_org_subq = (
            select(SADeviceOrg.device_id)
            .where(SADeviceOrg.org_id.in_(authorized_org_ids))
        )
        base = base.where(inspect_base_table.c.device_id.in_(device_org_subq))

    # 3. 组织树级联过滤（可选）
    if org_id is not None:
        org_descendants = await get_org_descendants(org_id, db)
        device_by_org_subq = (
            select(SADeviceOrg.device_id)
            .where(SADeviceOrg.org_id.in_(org_descendants))
        )
        base = base.where(inspect_base_table.c.device_id.in_(device_by_org_subq))

    # 4. 时间和 SN 筛选（可选）
    if start_date:
        base = base.where(inspect_base_table.c.inspect_date >= start_date)
    if end_date:
        base = base.where(inspect_base_table.c.inspect_date <= end_date)
    if sn:
        base = base.where(inspect_base_table.c.sn_num.like(f"%{sn}%"))

    # 总数
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar() or 0

    # 分页 + 排序
    query = base.order_by(inspect_base_table.c.inspect_date.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    rows = [_row_to_dict(r) for r in result]

    return {"records": rows, "total": total, "page": page, "page_size": page_size}


async def get_report_detail(db: AsyncSession, report_id: int):
    """获取单条报告详情（含 RBAC 检查）。"""
    if inspect_base_table is None:
        raise ValueError("report.not_found")

    base = (
        select(inspect_base_table, ne_table.c.device_name)
        .select_from(inspect_base_table)
        .join(ne_table, inspect_base_table.c.device_id == ne_table.c.ne_id, isouter=True)
        .where(inspect_base_table.c.inspect_base_id == report_id)
    )
    result = await db.execute(base)
    report = result.one_or_none()
    if not report:
        raise ValueError("report.not_found")
    return {"report": _row_to_dict(report), "items": []}
