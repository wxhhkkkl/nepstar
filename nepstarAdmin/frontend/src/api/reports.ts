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

export type PushStatus = 'pending' | 'success' | 'failed' | 'skipped';
export type PushTrigger = 'manual' | 'auto';

export interface PushResult {
  record_id: number;
  status: PushStatus;
  failure_reason: string | null;
}

export interface PushRecord {
  id: number;
  report_id: number | null;
  report_code: string;
  device_sn: string | null;
  trigger_type: PushTrigger;
  operator_id: number | null;
  status: PushStatus;
  failure_reason: string | null;
  response_summary: string | null;
  created_at: string | null;
  finished_at: string | null;
}

export interface PushRecordListParams {
  page?: number;
  page_size?: number;
  start_date?: string;
  end_date?: string;
  status?: PushStatus;
  trigger_type?: PushTrigger;
  sn?: string;
}

export interface PushRecordListResponse {
  records: PushRecord[];
  total: number;
  page: number;
  page_size: number;
}

/** 后端 failure_reason → i18n key 后缀。 */
export const PUSH_REASON_KEYS: Record<string, string> = {
  'delivery.config_missing': 'pushReasonConfigMissing',
  'delivery.disabled': 'pushReasonDisabled',
  'delivery.timeout': 'pushReasonTimeout',
  'delivery.network': 'pushReasonNetwork',
  'delivery.rejected': 'pushReasonRejected',
  'delivery.bad_response': 'pushReasonBadResponse',
  'delivery.interrupted': 'pushReasonInterrupted',
  'report.not_found': 'pushReasonNotFound',
  'report.invalid': 'pushReasonInvalid',
};

// ---- API 函数 ----

/** 获取检测报告列表（支持组织树、时间范围、设备SN筛选） */
export async function getReports(params: ReportListParams = {}) {
  return api.get('/reports', { params }) as Promise<any>;
}

/** 获取单条报告详情 */
export async function getReportDetail(reportId: number) {
  return api.get(`/reports/${reportId}`) as Promise<any>;
}

/** 人工再次推送（同步等待 ≤5 秒） */
export async function pushReport(reportId: number) {
  return api.post(`/reports/${reportId}/push`) as Promise<any>;
}

/** 推送记录列表 */
export async function getPushRecords(params: PushRecordListParams = {}) {
  return api.get('/reports/push-records', { params }) as Promise<any>;
}

/** 按推送记录重发 */
export async function repushRecord(logId: number) {
  return api.post(`/reports/push-records/${logId}/repush`) as Promise<any>;
}
