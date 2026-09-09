import api from '@/api/client';

export interface IndicatorNode {
  id: number;
  parent_id: number | null;
  code: string;
  name: string;
  description?: string | null;
  status: number;
  sort_order: number;
  children: IndicatorNode[];
}

export interface IndicatorPayload {
  parent_id?: number | null;
  code?: string;
  name?: string;
  description?: string | null;
  sort_order?: number;
  status?: number;
}

export async function fetchIndicatorTree(params: { keyword?: string; status?: number } = {}) {
  return api.get('/indicators/tree', { params });
}

export async function createIndicator(payload: IndicatorPayload) {
  return api.post('/indicators', payload);
}

export async function updateIndicator(id: number, payload: IndicatorPayload) {
  return api.put(`/indicators/${id}`, payload);
}

export async function deleteIndicator(id: number) {
  return api.delete(`/indicators/${id}`);
}
