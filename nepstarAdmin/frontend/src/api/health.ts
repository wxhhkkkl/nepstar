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

// ---- products (商品) ----

export const PRODUCT_MAX_IMAGE_COUNT = 10;
export const PRODUCT_MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export interface ProductImage {
  id?: number;
  url: string;
  sort_order: number;
}

export interface ProductListItem {
  id: number;
  name: string;
  description?: string | null;
  cover_url?: string | null;
  status: number;
  sort_order: number;
  created_at?: string;
  updated_at?: string | null;
}

export interface ProductDetail extends ProductListItem {
  detail_html?: string | null;
  images: ProductImage[];
}

export interface ProductPayload {
  name?: string;
  description?: string | null;
  detail_html?: string | null;
  status?: number;
  sort_order?: number;
  images?: { url: string; sort_order: number }[];
}

export async function fetchProducts(params: { page?: number; page_size?: number; keyword?: string } = {}) {
  return api.get('/products', { params });
}

export async function fetchProduct(id: number) {
  return api.get(`/products/${id}`);
}

export async function createProduct(payload: ProductPayload) {
  return api.post('/products', payload);
}

export async function updateProduct(id: number, payload: ProductPayload) {
  return api.put(`/products/${id}`, payload);
}

export async function deleteProduct(id: number) {
  return api.delete(`/products/${id}`);
}

export async function uploadProductImage(file: File) {
  const form = new FormData();
  form.append('file', file);
  return api.post('/products/upload-image', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

// ---- plans (健康方案) ----

export interface PlanListItem {
  id: number;
  name: string;
  description?: string | null;
  status: number;
  sort_order: number;
  product_count: number;
  indicator_count: number;
  created_at?: string;
  updated_at?: string | null;
}

export interface PlanProductLink {
  product_id: number;
  name: string;
  cover_url?: string | null;
  sort_order: number;
}

export interface PlanIndicatorLink {
  indicator_id: number;
  level: 1 | 2;
  code: string;
  name: string;
  parent_id: number | null;
  parent_name?: string | null;
  status: number;
}

export interface PlanDetail extends PlanListItem {
  products: PlanProductLink[];
  indicators: PlanIndicatorLink[];
}

export interface PlanPayload {
  name?: string;
  description?: string | null;
  status?: number;
  sort_order?: number;
  product_ids?: number[];
  indicator_ids?: number[];
}

export async function fetchPlans(params: { page?: number; page_size?: number; keyword?: string } = {}) {
  return api.get('/plans', { params });
}

export async function fetchPlan(id: number) {
  return api.get(`/plans/${id}`);
}

export async function createPlan(payload: PlanPayload) {
  return api.post('/plans', payload);
}

export async function updatePlan(id: number, payload: PlanPayload) {
  return api.put(`/plans/${id}`, payload);
}

export async function deletePlan(id: number) {
  return api.delete(`/plans/${id}`);
}
