// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import ElementPlus from 'element-plus';
import { createI18n } from 'vue-i18n';
import zhCN from '@/i18n/zh-CN.json';

vi.mock('@/api/health', () => ({
  fetchPlan: vi.fn(),
}));

import { fetchPlan } from '@/api/health';
import PlanDetailDialog from '../PlanDetailDialog.vue';

const i18n = createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': zhCN } });

function mountDialog() {
  return mount(PlanDetailDialog, {
    props: { visible: true, plan: { id: 7, name: '体重管理方案' } },
    global: { plugins: [ElementPlus, i18n] },
  });
}

beforeEach(() => {
  vi.mocked(fetchPlan).mockResolvedValue({
    data: {
      id: 7,
      name: '体重管理方案',
      description: '目标描述',
      status: 1,
      sort_order: 0,
      product_count: 1,
      indicator_count: 3,
      products: [{ product_id: 2, name: '复合维生素', cover_url: 'https://x/a.jpg', sort_order: 0 }],
      indicators: [
        { indicator_id: 1, level: 1, code: 'HT001', name: '体重管理', parent_id: null, parent_name: null, status: 1 },
        { indicator_id: 4, level: 2, code: 'HT0011', name: '体脂率', parent_id: 1, parent_name: '体重管理', status: 1 },
        { indicator_id: 5, level: 2, code: 'HT0012', name: '基础代谢', parent_id: 1, parent_name: '体重管理', status: 0 },
      ],
    },
  } as any);
});

describe('PlanDetailDialog', () => {
  it('loads the plan detail on open', async () => {
    mountDialog();
    await flushPromises();
    expect(fetchPlan).toHaveBeenCalledWith(7);
  });

  it('shows the linked products and grouped indicators', async () => {
    const wrapper = mountDialog();
    await flushPromises();
    const text = wrapper.text();
    expect(text).toContain('复合维生素');
    expect(text).toContain('体重管理');
    expect(text).toContain('体脂率');
    expect(text).toContain('基础代谢');
    // level-2 items render nested inside the level-1 group
    expect(wrapper.findAll('.group')).toHaveLength(1);
    expect(wrapper.findAll('.group .l2')).toHaveLength(2);
  });

  it('marks a stopped indicator with the disabled tag (spec edge case "已停用")', async () => {
    const wrapper = mountDialog();
    await flushPromises();
    // repo-wide vocabulary for status 0 is 禁用 (common.disabled)
    expect(wrapper.text()).toContain('禁用');
    const stopped = wrapper.findAll('.group .l2').filter((n) => n.text().includes('基础代谢'));
    expect(stopped[0].text()).toContain('禁用');
    const active = wrapper.findAll('.group .l2').filter((n) => n.text().includes('体脂率'));
    expect(active[0].text()).not.toContain('禁用');
  });
});
