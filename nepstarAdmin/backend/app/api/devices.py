"""Device management API routes — list, update, change-logs, config/qr."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..schemas.device import DeviceConfigResponse, DeviceUpdate
from ..schemas.response import ApiResponse
from ..security.rbac import check_permission, get_current_user
from ..services import device_service

router = APIRouter(prefix="/devices", tags=["devices"])


@router.get("")
async def list_devices(
    page: int = 1,
    page_size: int = 10,
    keyword: str = "",
    org_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """设备列表——支持组织树筛选、数据权限隔离、全局 COMPANY_ID 过滤。

    - org_id: 选中组织 ID → 自动包含所有子孙组织设备
    - 数据范围: 用户仅能看到其角色授权的组织范围内的设备
    - COMPANY_ID: 所有查询强制限定 COMPANY_ID
    """
    data = await device_service.list_devices(
        db, user.id, page=page, page_size=page_size, keyword=keyword, org_id=org_id
    )
    return ApiResponse(data=data)


@router.put("/{device_id}")
async def update_device_endpoint(
    device_id: str,
    req: DeviceUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(check_permission),
):
    """编辑设备——名称、组织归属、报告语言。

    需要"设备管理"菜单权限 (check_permission)。
    """
    try:
        await device_service.update_device(db, device_id, req, user.id)
        return ApiResponse()
    except ValueError as e:
        msg = str(e)
        if msg == "device.not_found":
            return ApiResponse(code=404, message=msg)
        elif msg == "device.org_not_authorized":
            return ApiResponse(code=403, message="无权分配到该组织")
        return ApiResponse(code=400, message=msg)
        return ApiResponse(code=404, message=str(e))


@router.get("/{device_id}/change-logs")
async def get_change_logs(
    device_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """设备组织变更日志。"""
    logs = await device_service.get_device_change_logs(db, device_id)
    return ApiResponse(data=logs)


@router.get("/{device_id}/config")
async def get_device_config(
    device_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """设备配置信息——二维码 URL + 硬件配置参数（来自 fast_plus 配置库）。

    配置库连接失败时返回 503 并包含友好错误信息。
    """
    from ..database import config_engine
    from ..models.old.ne import ne_table

    # 先验证设备是否存在
    if ne_table is None:
        return ApiResponse(code=503, message="Main database unavailable")

    result = await db.execute(
        __import__("sqlalchemy").select(ne_table).where(ne_table.c.ne_id == device_id)
    )
    device = result.one_or_none()
    if not device:
        return ApiResponse(code=404, message="device.not_found")

    if config_engine is None:
        return ApiResponse(code=503, message="Configuration database not configured")

    try:
        config_data = await device_service.query_config_db(
            db, device.ne_no or device_id, device.company_id or ""
        )
        return ApiResponse(data=config_data)
    except Exception:
        return ApiResponse(
            code=503, message="Configuration database unavailable"
        )
