/** 检测报告 API 函数与类型定义。 */

import api from './client';

// ---- 类型定义 ----

export interface ReportRecord {
  report_id: number;
  report_code: string | null;
  customer_id: number | null;
  device_sn: string | null;
  device_name: string | null;
  inspect_date: string | null;
  total_score: number | null;
  status: number | null;
  status_text: string | null;
  mobile: string | null;
  name: string | null;
  report_url: string | null;
}

export interface ReportListParams {
  page?: number;
  page_size?: number;
  org_id?: number;
  start_date?: string;
  end_date?: string;
  sn?: string;
}

export interface ReportListResponse {
  records: ReportRecord[];
  total: number;
  page: number;
  page_size: number;
}

export interface ReportDetailResponse {
  report: ReportRecord;
}

// ---- API 函数 ----

/** 获取检测报告列表（支持组织树、时间范围、设备SN筛选） */
export async function getReports(params: ReportListParams = {}) {
  return api.get('/reports', { params }) as Promise<any>;
}

/** 获取单条报告详情 */
export async function getReportDetail(reportId: number) {
  return api.get(`/reports/${reportId}`) as Promise<any>;
}
