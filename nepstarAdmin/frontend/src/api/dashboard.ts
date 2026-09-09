/** 数据看板 API */

import api from './client';

export interface DashboardStats {
  device_count: number;
  report_count: number;
  customer_count: number;
}

export interface TrendPoint {
  label: string;
  report_count: number;
  customer_count: number;
}

export interface DashboardTrend {
  granularity: 'daily' | 'weekly' | 'monthly';
  points: TrendPoint[];
}

export interface DashboardResponse {
  stats: DashboardStats;
  trend: DashboardTrend;
}

export async function getDashboard(params?: { start_date?: string; end_date?: string }) {
  return api.get('/dashboard', { params }) as Promise<any>;
}
