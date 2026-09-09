// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import ElementPlus from 'element-plus';
import { createI18n } from 'vue-i18n';
import zhCN from '@/i18n/zh-CN.json';
import type { IndicatorNode } from '@/api/health';

vi.mock('@/api/health', () => ({
  fetchIndicatorTree: vi.fn(),
  createIndicator: vi.fn(),
  updateIndicator: vi.fn(),
  deleteIndicator: vi.fn(),
}));

import { fetchIndicatorTree, createIndicator, deleteIndicator } from '@/api/health';
import IndicatorList from '../IndicatorList.vue';

const i18n = createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': zhCN } });

function tree(): IndicatorNode[] {
  return [
    {
      id: 1, parent_id: null, code: 'HT001', name: '体重管理', description: '', status: 1, sort_order: 1,
      children: [{ id: 4, parent_id: 1, code: 'HT0011', name: '体脂率', description: '', status: 1, sort_order: 1, children: [] }],
    },
  ];
}

function mountPage() {
  return mount(IndicatorList, {
    global: { plugins: [ElementPlus, i18n] },
  });
}

beforeEach(() => {
  vi.mocked(fetchIndicatorTree).mockResolvedValue({ data: tree() } as any);
});

describe('IndicatorList', () => {
  it('fetches the indicator tree on mount and renders level-1 rows', async () => {
    const wrapper = mountPage();
    await flushPromises();
    expect(fetchIndicatorTree).toHaveBeenCalled();
    expect(wrapper.text()).toContain('体重管理');
    expect(wrapper.text()).toContain('HT001');
  });

  it('shows no-data state when backend returns empty', async () => {
    vi.mocked(fetchIndicatorTree).mockResolvedValue({ data: [] } as any);
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.text()).toContain('暂无数据');
  });

  it('calls deleteIndicator for a level-1 row without children', async () => {
    vi.mocked(fetchIndicatorTree).mockResolvedValue({
      data: [{ id: 9, parent_id: null, code: 'HT009', name: '空一级', description: '', status: 1, sort_order: 1, children: [] }],
    } as any);
    vi.mocked(deleteIndicator).mockResolvedValue({} as any);
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.text()).toContain('空一级');
    expect(wrapper.find('.lvl-tag.l1').exists()).toBe(true);
  });

  it('renders the add-child affordance on level-1 rows', async () => {
    const wrapper = mountPage();
    await flushPromises();
    // expand arrow + operation column buttons exist on the level-1 row
    expect(wrapper.findAll('button').some((b) => b.text().includes('添加二级'))).toBe(true);
  });

  it('opens create dialog and submits a level-2 indicator under a parent', async () => {
    vi.mocked(createIndicator).mockResolvedValue({ data: { id: 5 } } as any);
    const wrapper = mountPage();
    await flushPromises();
    const addChildBtn = wrapper.findAll('button').find((b) => b.text().includes('添加二级'));
    expect(addChildBtn).toBeTruthy();
    await addChildBtn!.trigger('click');
    expect(wrapper.text()).toContain('新增二级指标');
  });
});
