/** 客户管理 API 函数与类型定义。 */

import api from './client';

// ---- 类型定义 ----

export interface CustomerRecord {
  customer_id: number;
  name: string | null;
  mobile: string | null;
  age: number | null;
  sex: number | null;
  latest_inspect_date: string | null;
  report_count: number;
}

export interface CustomerListParams {
  page?: number;
  page_size?: number;
  org_id?: number;
  start_date?: string;
  end_date?: string;
}

// ---- API 函数 ----

/** 获取客户列表（支持组织树、时间范围筛选，已去重） */
export async function getCustomers(params: CustomerListParams = {}) {
  return api.get('/customers', { params }) as Promise<any>;
}
