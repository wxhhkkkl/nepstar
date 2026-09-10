"""客户管理服务 — 从 inspect_base 去重客户并关联 customer 表查询。

查询链路：
  inspect_base（去重 customer_id + 聚合统计）
  → customer（JOIN 获取客户详情）
  → RBAC 桥接（inspect_base.device_id → sa_device_org → 用户授权 org）

所有查询受全局 dept_id 过滤。inspect_base 和 customer 表严格只读。
"""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..models.new.sa_device_org import SADeviceOrg
from ..models.old.customer import customer_table
from ..models.old.inspect_base import inspect_base_table
from ..security.org_filter import get_org_descendants, get_user_authorized_orgs
from ..utils.pii import mask_name, mask_phone


def _row_to_dict(row) -> dict:
    """将数据库行转换为 API 响应字典（含 PII 脱敏和性别映射）。"""
    m = row._mapping
    raw_sex = m.get("sex")
    if raw_sex is not None:
        sex_text = "女" if raw_sex == 0 else "男"
    else:
        sex_text = None
    return {
        "customer_id": m.get("customer_id"),
        "name": mask_name(m.get("name")),
        "mobile": mask_phone(m.get("mobile")),
        "age": m.get("age"),
        "sex": raw_sex,
        "sex_text": sex_text,  # 0=女, 其他=男
        "height": m.get("height"),
        "weight": m.get("weight"),
        "latest_inspect_date": m.get("latest_inspect_date"),
        "report_count": m.get("report_count") or 0,
    }


async def list_customers(
    db: AsyncSession,
    user_id: int,
    page: int = 1,
    page_size: int = 20,
    org_id: int | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
):
    """分页查询客户列表（去重，聚合报告统计）。

    查询步骤：
    1. 子查询：从 inspect_base 中按 dept_id + RBAC 过滤，GROUP BY customer_id
    2. 聚合：MAX(inspect_date) + COUNT(*)
    3. JOIN customer 表获取客户详情
    4. 可选：org 级联过滤、时间范围过滤
    """
    if inspect_base_table is None:
        return {"records": [], "total": 0, "page": page, "page_size": page_size}
    if customer_table is None:
        raise ValueError("customer.table_not_found")

    # 获取用户授权组织
    authorized_org_ids, _ = await get_user_authorized_orgs(user_id, db)

    # 构建 inspect_base 过滤子查询（去重 + 聚合）
    agg_q = (
        select(
            inspect_base_table.c.customer_id,
            func.max(inspect_base_table.c.inspect_date).label("latest_inspect_date"),
            func.count("*").label("report_count"),
        )
        .where(inspect_base_table.c.dept_id == int(settings.DEPT_ID))
        .where(inspect_base_table.c.customer_id.isnot(None))
    )

    # RBAC 过滤
    if authorized_org_ids:
        device_org_subq = (
            select(SADeviceOrg.device_id)
            .where(SADeviceOrg.org_id.in_(authorized_org_ids))
        )
        agg_q = agg_q.where(inspect_base_table.c.device_id.in_(device_org_subq))

    # 组织树级联过滤
    if org_id is not None:
        org_descendants = await get_org_descendants(org_id, db)
        device_by_org_subq = (
            select(SADeviceOrg.device_id)
            .where(SADeviceOrg.org_id.in_(org_descendants))
        )
        agg_q = agg_q.where(inspect_base_table.c.device_id.in_(device_by_org_subq))

    agg_q = agg_q.group_by(inspect_base_table.c.customer_id)
    agg_subq = agg_q.subquery("agg")

    # 自动检测 customer 表的列名（不同环境可能不同）
    _customer_cols = {c.name for c in customer_table.columns}
    _name_col = next((n for n in ["user_name", "userName", "name", "nick_name"] if n in _customer_cols), None)
    _mobile_col = next((m for m in ["mobile", "userTel"] if m in _customer_cols), None)
    _age_col = "age" if "age" in _customer_cols else None
    _sex_col = "sex" if "sex" in _customer_cols else None
    _height_col = "height" if "height" in _customer_cols else None
    _weight_col = "weight" if "weight" in _customer_cols else None

    if not _name_col or not _mobile_col:
        raise ValueError("customer.table_not_found")

    # 主查询：JOIN customer 表
    base_cols = [
        customer_table.c.customer_id,
        customer_table.c[_name_col].label("name"),
        customer_table.c[_mobile_col].label("mobile"),
    ]
    if _age_col:
        base_cols.append(customer_table.c[_age_col].label("age"))
    if _sex_col:
        base_cols.append(customer_table.c[_sex_col].label("sex"))
    if _height_col:
        base_cols.append(customer_table.c[_height_col].label("height"))
    if _weight_col:
        base_cols.append(customer_table.c[_weight_col].label("weight"))
    base_cols.append(agg_subq.c.latest_inspect_date)
    base_cols.append(agg_subq.c.report_count)

    base = (
        select(*base_cols)
        .select_from(agg_subq)
        .join(customer_table, agg_subq.c.customer_id == customer_table.c.customer_id)
    )

    # 时间范围过滤（基于聚合后的 latest_inspect_date）
    if start_date:
        base = base.where(agg_subq.c.latest_inspect_date >= start_date)
    if end_date:
        base = base.where(agg_subq.c.latest_inspect_date <= end_date)

    # 排序 + 分页
    base = base.order_by(agg_subq.c.latest_inspect_date.desc())
    query = base.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    rows = [_row_to_dict(r) for r in result]

    # 总数（对聚合子查询再包一层计数）
    count_q = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    return {"records": rows, "total": total, "page": page, "page_size": page_size}
