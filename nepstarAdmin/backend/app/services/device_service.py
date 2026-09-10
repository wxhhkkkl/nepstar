"""Device service — ne 表只读查询，org 关联写入 sa_device_org，配置写入 sa_device_config。

组织筛选逻辑：
- 无 org_id / 根节点 → 仅 COMPANY_ID 过滤，显示全部设备
- 非根节点 → 通过 sa_device_org 查找该组织及子孙下的设备
"""

import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..models.new.sa_device_change_log import SADeviceChangeLog
from ..models.new.sa_device_config import SADeviceConfig
from ..models.new.sa_device_org import SADeviceOrg
from ..models.new.sa_organization import SAOrganization
from ..models.old.ne import ne_table
from ..security.org_filter import get_org_descendants, get_user_authorized_orgs, is_admin


async def list_devices(
    db: AsyncSession,
    user_id: int,
    page: int = 1,
    page_size: int = 10,
    keyword: str = "",
    org_id: int | None = None,
):
    """查询设备列表。

    - COMPANY_ID 全局过滤始终生效
    - 未选组织或选中根节点 → 全量（仅 COMPANY_ID 过滤）
    - 选中非根节点 → 通过 sa_device_org 筛选该节点及子孙下的设备
    """
    print(f"[DEBUG] list_devices: ne_table={ne_table is not None}, COMPANY_ID={settings.COMPANY_ID}, user_id={user_id}")

    if ne_table is None:
        print("[DEBUG] list_devices: ne_table is None — returning empty")
        return {"records": [], "total": 0, "page": page, "page_size": page_size}

    # DEBUG: 检查 ne 表中 company_id 列的实际值分布
    debug_count = await db.execute(
        select(func.count()).select_from(ne_table)
    )
    print(f"[DEBUG] list_devices: ne total rows (no filter) = {debug_count.scalar()}")
    debug_company = await db.execute(
        select(func.count()).select_from(ne_table).where(ne_table.c.company_id == settings.COMPANY_ID)
    )
    print(f"[DEBUG] list_devices: ne rows with company_id={settings.COMPANY_ID} = {debug_company.scalar()}")

    base = (
        select(
            ne_table,
            SADeviceOrg.org_id.label("_org_id"),
            SAOrganization.org_name.label("_org_name"),
            SADeviceConfig.report_language.label("_report_language"),
        )
        .select_from(ne_table)
        .outerjoin(SADeviceOrg, ne_table.c.ne_id == SADeviceOrg.device_id)
        .outerjoin(SAOrganization, SADeviceOrg.org_id == SAOrganization.id)
        .outerjoin(SADeviceConfig, ne_table.c.ne_id == SADeviceConfig.device_id)
        .where(ne_table.c.company_id == settings.COMPANY_ID)
    )

    # 数据权限：admin 跳过限制；普通用户只能看到授权组织范围内的设备
    authorized_org_ids = None  # None = 无限制 (admin)
    if not await is_admin(user_id, db):
        authorized_org_ids, _ = await get_user_authorized_orgs(user_id, db)
        if authorized_org_ids:
            authorized_device_ids = (
                select(SADeviceOrg.device_id)
                .where(SADeviceOrg.org_id.in_(authorized_org_ids))
            )
            base = base.where(ne_table.c.ne_id.in_(authorized_device_ids))
        else:
            # 非 admin 且无授权组织 → 无权限查看任何设备
            return {"records": [], "total": 0, "page": page, "page_size": page_size}

    # 组织筛选：选中非根节点时，在数据权限基础上进一步过滤
    if org_id is not None:
        root_result = await db.execute(
            select(SAOrganization.parent_id).where(SAOrganization.id == org_id)
        )
        is_root = root_result.scalar() is None

        if not is_root:
            descendant_ids = await get_org_descendants(org_id, db)
            # 用户选中范围与数据权限取交集
            visible_ids = (
                list(set(descendant_ids) & set(authorized_org_ids))
                if authorized_org_ids is not None else descendant_ids
            )
            if visible_ids:
                org_device_ids = (
                    select(SADeviceOrg.device_id)
                    .where(SADeviceOrg.org_id.in_(visible_ids))
                )
                base = base.where(ne_table.c.ne_id.in_(org_device_ids))
            else:
                # 选中组织不在用户权限范围内 → 空结果
                return {"records": [], "total": 0, "page": page, "page_size": page_size}

    # 关键词搜索
    if keyword:
        base = base.where(
            ne_table.c.device_name.contains(keyword)
            | ne_table.c.ne_no.contains(keyword)
            | ne_table.c.ne_id.contains(keyword)
        )

    # 分页
    subq = base.subquery()
    total = (await db.execute(select(func.count()).select_from(subq))).scalar() or 0
    print(f"[DEBUG] list_devices: final total after all filters = {total}")

    result = await db.execute(
        select(subq).order_by(subq.c.create_date.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = [dict(r._mapping) for r in result]
    print(f"[DEBUG] list_devices: returned {len(rows)} rows")
    if rows:
        print(f"[DEBUG] list_devices: first row keys={list(rows[0].keys())}, _org_id={rows[0].get('_org_id')}, _org_name={rows[0].get('_org_name')}")
    else:
        print("[DEBUG] list_devices: zero rows returned — check COMPANY_ID filter and outer joins")
    return {"records": rows, "total": total, "page": page, "page_size": page_size}


async def update_device(db: AsyncSession, device_id: str, data, user_id: int):
    """更新设备——org 关联写入 sa_device_org，报告语言写入 sa_device_config。

    - org_id → UPSERT sa_device_org (device_id UK)
    - report_language → UPSERT sa_device_config
    - org 变更时记录到 sa_device_change_log
    """
    if ne_table is None:
        raise ValueError("device.not_found")

    result = await db.execute(select(ne_table).where(ne_table.c.ne_id == device_id))
    device = result.one_or_none()
    if not device:
        raise ValueError("device.not_found")

    updated = False

    # org_id → upsert sa_device_org
    if data.org_id is not None:
        # 权限校验：非 admin 用户只能分配到授权组织范围内
        if not await is_admin(user_id, db):
            authorized_ids, _ = await get_user_authorized_orgs(user_id, db)
            if data.org_id not in authorized_ids:
                raise ValueError("device.org_not_authorized")

        existing = await db.execute(
            select(SADeviceOrg).where(SADeviceOrg.device_id == device_id)
        )
        org_row = existing.scalar_one_or_none()
        old_org_id = org_row.org_id if org_row else None

        if org_row:
            if org_row.org_id != data.org_id:
                # 记录变更日志
                db.add(SADeviceChangeLog(
                    device_id=device_id,
                    from_org=str(old_org_id),
                    to_org=str(data.org_id),
                    changed_by=user_id,
                ))
                org_row.org_id = data.org_id
                updated = True
        else:
            db.add(SADeviceOrg(device_id=device_id, org_id=data.org_id))
            db.add(SADeviceChangeLog(
                device_id=device_id,
                from_org=None,
                to_org=str(data.org_id),
                changed_by=user_id,
            ))
            updated = True

    # report_language → upsert sa_device_config
    if data.report_language is not None:
        config_result = await db.execute(
            select(SADeviceConfig).where(SADeviceConfig.device_id == device_id)
        )
        config = config_result.scalar_one_or_none()
        if config:
            config.report_language = data.report_language
        else:
            db.add(SADeviceConfig(device_id=device_id, report_language=data.report_language))
        updated = True

    if updated:
        await db.commit()

    return device


async def get_device_change_logs(db: AsyncSession, device_id: str):
    """查询设备组织变更日志。"""
    result = await db.execute(
        select(SADeviceChangeLog)
        .where(SADeviceChangeLog.device_id == device_id)
        .order_by(SADeviceChangeLog.changed_at.desc())
    )
    return [
        {
            "id": r.id,
            "device_id": r.device_id,
            "from_org": r.from_org,
            "to_org": r.to_org,
            "changed_by": r.changed_by,
            "changed_at": r.changed_at,
        }
        for r in result.scalars().all()
    ]


async def query_config_db(db: AsyncSession, device_sn: str, company_id: str):
    """从 fast_plus 配置库查询设备二维码和硬件配置。

    配置库通过 device_sn（序列号，对应 ne.ne_no）关联设备：
    - tb_device_qr: WHERE device_sn = ne_no → qr_url（二维码文本地址）
    - tb_device_upload: WHERE device_sn = ne_no → 设备上传记录
    - tb_upload_info: JOIN tb_device_upload ON u_id → 详细配置信息
    """
    from ..database import config_engine
    from ..models.config_db import tb_device_qr, tb_device_upload, tb_upload_info

    if config_engine is None:
        return {"ne_id": device_sn, "qr_url": None, "upload_info": None, "device_upload": None}

    qr_url = None
    device_upload = None
    upload_info = None

    logger = logging.getLogger("uvicorn")
    try:
        async with config_engine.connect() as conn:
            # tb_device_qr 通过 device_sn（序列号）查询二维码
            if tb_device_qr is not None and "device_sn" in tb_device_qr.columns:
                qr_result = await conn.execute(
                    select(tb_device_qr).where(
                        tb_device_qr.c.device_sn == device_sn,
                    )
                )
                qr_row = qr_result.one_or_none()
                if qr_row:
                    qr_url = getattr(qr_row, "qr_url", None)
                    logger.info(f"config_db: tb_device_qr found device_sn={device_sn}, qr_url={qr_url}")
                else:
                    logger.info(f"config_db: tb_device_qr no row for device_sn={device_sn}")

            # tb_device_upload 通过 device_sn 关联，再通过 u_id JOIN tb_upload_info
            if tb_device_upload is not None and "device_sn" in tb_device_upload.columns:
                du_result = await conn.execute(
                    select(tb_device_upload).where(
                        tb_device_upload.c.device_sn == device_sn
                    )
                )
                du_row = du_result.one_or_none()
                if du_row:
                    device_upload = dict(du_row._mapping)
                    u_id = device_upload.get("u_id")
                    logger.info(f"config_db: tb_device_upload found device_sn={device_sn}, u_id={u_id}")
                    # 通过 u_id 查询 tb_upload_info 获取版本信息
                    if u_id and tb_upload_info is not None:
                        ui_result = await conn.execute(
                            select(tb_upload_info).where(
                                tb_upload_info.c.u_id == u_id
                            )
                        )
                        ui_row = ui_result.one_or_none()
                        if ui_row:
                            upload_info = dict(ui_row._mapping)
                            logger.info(f"config_db: tb_upload_info found u_id={u_id}")
                        else:
                            logger.info(f"config_db: tb_upload_info no row for u_id={u_id}")
                else:
                    logger.info(f"config_db: tb_device_upload no row for device_sn={device_sn}")
    except Exception as e:
        logger.warning(f"config_db: query failed: {e}")

    return {
        "ne_id": device_sn,
        "qr_url": qr_url,
        "upload_info": upload_info,
        "device_upload": device_upload,
    }
