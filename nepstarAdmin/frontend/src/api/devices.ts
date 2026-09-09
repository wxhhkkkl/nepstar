import api from './client';

/** 设备列表查询参数 */
export interface DeviceListParams {
  page?: number;
  page_size?: number;
  keyword?: string;
  org_id?: number | null;
}

/** 设备更新请求体 */
export interface DeviceUpdateData {
  org_id?: number;
  report_language?: string;
}

/** 组织树节点 */
export interface OrgTreeNode {
  id: number;
  org_name: string;
  org_code: string;
  children: OrgTreeNode[];
}

/** 获取组织树（受用户数据范围限制） */
export async function getOrganizationsTree(): Promise<OrgTreeNode[]> {
  const r = await api.get('/organizations/tree');
  return r.data;
}

/** 获取设备列表 */
export async function getDevices(params: DeviceListParams) {
  return api.get('/devices', { params });
}

/** 更新设备信息（组织、报告语言）。非 200 则抛出错误 */
export async function updateDevice(deviceId: string, data: DeviceUpdateData) {
  const r: any = await api.put(`/devices/${deviceId}`, data);
  if (r.code !== 200) {
    throw new Error(r.message || '操作失败');
  }
  return r;
}

/** 获取设备变更日志 */
export async function getDeviceChangeLogs(deviceId: string) {
  const r = await api.get(`/devices/${deviceId}/change-logs`);
  return r.data;
}

/** 获取设备配置信息（二维码 + 硬件配置） */
export async function getDeviceConfig(deviceId: string) {
  const r = await api.get(`/devices/${deviceId}/config`);
  return r.data;
}
