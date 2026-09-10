// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import ElementPlus from 'element-plus';
import { createI18n } from 'vue-i18n';
import zhCN from '@/i18n/zh-CN.json';

vi.mock('@/api/health', () => ({
  fetchProducts: vi.fn(),
  fetchIndicatorTree: vi.fn(),
  fetchPlan: vi.fn(),
  createPlan: vi.fn(),
  updatePlan: vi.fn(),
}));

import { createPlan, fetchIndicatorTree, fetchProducts } from '@/api/health';
import PlanEditDialog from '../PlanEditDialog.vue';

const i18n = createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': zhCN } });

function mountDialog() {
  return mount(PlanEditDialog, {
    props: { visible: true, plan: null },
    global: { plugins: [ElementPlus, i18n] },
  });
}

beforeEach(() => {
  vi.mocked(fetchProducts).mockResolvedValue({
    data: { records: [{ id: 5, name: '商品A' }, { id: 6, name: '商品B' }], total: 2 },
  } as any);
  vi.mocked(fetchIndicatorTree).mockResolvedValue({
    data: [
      {
        id: 1, parent_id: null, code: 'HT001', name: '体重管理', status: 1, sort_order: 1,
        children: [
          { id: 4, parent_id: 1, code: 'HT0011', name: '体脂率', status: 1, sort_order: 1, children: [] },
          { id: 5, parent_id: 1, code: 'HT0012', name: '基础代谢', status: 1, sort_order: 2, children: [] },
        ],
      },
    ],
  } as any);
  vi.mocked(createPlan).mockResolvedValue({ data: { id: 1 } } as any);
});

describe('PlanEditDialog', () => {
  it('loads product options and indicator tree on open', async () => {
    const wrapper = mountDialog();
    await flushPromises();
    expect(fetchProducts).toHaveBeenCalled();
    expect(fetchIndicatorTree).toHaveBeenCalled();
  });

  it('strict-precise: checked keys map 1:1 to indicator_ids (no children auto-added)', async () => {
    const wrapper = mountDialog();
    await flushPromises();
    (wrapper.vm as any).syncIndicatorsFromKeys([1]); // user ticked only the L1 node
    expect((wrapper.vm as any).buildPayload().indicator_ids).toEqual([1]);
  });

  it('de-duplicates repeated indicator keys', async () => {
    const wrapper = mountDialog();
    await flushPromises();
    (wrapper.vm as any).syncIndicatorsFromKeys([1, 1, 4, 4, 5]);
    expect((wrapper.vm as any).buildPayload().indicator_ids).toEqual([1, 4, 5]);
  });

  it('preserves and reorders the selected products', async () => {
    const wrapper = mountDialog();
    await flushPromises();
    (wrapper.vm as any).setProductIds([5, 6]);
    expect((wrapper.vm as any).buildPayload().product_ids).toEqual([5, 6]);
    (wrapper.vm as any).moveProduct(1, -1);
    expect((wrapper.vm as any).buildPayload().product_ids).toEqual([6, 5]);
    (wrapper.vm as any).removeProduct(0);
    expect((wrapper.vm as any).buildPayload().product_ids).toEqual([5]);
  });

  it('builds a payload with the form fields', async () => {
    const wrapper = mountDialog();
    await flushPromises();
    (wrapper.vm as any).form.name = '体重管理方案';
    (wrapper.vm as any).form.status = 0;
    const payload = (wrapper.vm as any).buildPayload();
    expect(payload.name).toBe('体重管理方案');
    expect(payload.status).toBe(0);
  });
});
