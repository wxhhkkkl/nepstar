"""基于 sa_role_org 的 RBAC 数据权限过滤。

替换旧的 user_id==1 硬编码绕过，实现真正的角色级数据范围控制：
1. 通过 sa_user_role 获取用户角色
2. 通过 sa_role_org 获取角色授权的组织 ID 列表
3. 结合 sa_organization 获取 org_code 用于 ne.company_id 过滤
管理员检测通过 sa_role.role_code = 'admin' 判断，不再依赖 user_id==1。
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.new.sa_junctions import SARoleOrg, SAUserRole
from ..models.new.sa_organization import SAOrganization
from ..models.new.sa_role import SARole


async def is_admin(user_id: int, db: AsyncSession) -> bool:
    """检查用户是否拥有 admin 角色（role_code='admin'）。"""
    result = await db.execute(
        select(SARole).join(SAUserRole, SARole.id == SAUserRole.role_id)
        .where(SAUserRole.user_id == user_id, SARole.role_code == "admin", SARole.status == 1)
    )
    return result.scalar_one_or_none() is not None


async def get_user_authorized_orgs(user_id: int, db: AsyncSession) -> tuple[list[int], list[str]]:
    """返回用户授权范围内的 (org_id 列表, org_code 列表)。

    Admin 角色返回空列表表示无过滤限制。
    普通用户通过 sa_user_role → sa_role_org 获取角色级数据权限。
    """
    if await is_admin(user_id, db):
        return [], []

    # 获取用户角色
    role_result = await db.execute(
        select(SAUserRole.role_id).where(SAUserRole.user_id == user_id)
    )
    role_ids = [r[0] for r in role_result.all()]
    if not role_ids:
        return [], []

    # 获取角色授权的组织
    org_result = await db.execute(
        select(SARoleOrg.org_id).where(SARoleOrg.role_id.in_(role_ids))
    )
    org_ids = list({r[0] for r in org_result.all()})
    if not org_ids:
        return [], []

    # 获取 org_code
    orgs_result = await db.execute(
        select(SAOrganization.org_code).where(SAOrganization.id.in_(org_ids))
    )
    org_codes = [r[0] for r in orgs_result.all()]

    return org_ids, org_codes


async def get_org_descendants(org_id: int, db: AsyncSession) -> list[int]:
    """获取组织及其所有子孙节点的 org_id 列表（向下级联）。

    通过递归查询 sa_organization.parent_id 获取完整子树。
    用于组织树节点选中时的设备过滤。
    """
    all_ids = [org_id]
    to_check = [org_id]

    while to_check:
        children_result = await db.execute(
            select(SAOrganization.id).where(SAOrganization.parent_id.in_(to_check))
        )
        child_ids = [r[0] for r in children_result.all()]
        if not child_ids:
            break
        all_ids.extend(child_ids)
        to_check = child_ids

    return all_ids
