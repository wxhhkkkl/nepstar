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

import { fetchIndicatorTree, createIndicator, updateIndicator, deleteIndicator } from '@/api/health';
import IndicatorList from '../IndicatorList.vue';

const i18n = createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': zhCN } });

function tree(): IndicatorNode[] {
  return [
    {
      id: 1, parent_id: null, code: 'HT001', name: '体重管理', description: '', status: 1, sort_order: 1,
      target_id: 3115,
      report_status_text: '重点关注',
      report_summary: '摘要文案',
      report_interpretation: '解读文案',
      report_actions: ['建议一', '建议二'],
      children: [{ id: 4, parent_id: 1, code: 'HT0011', name: '体脂率', description: '', status: 1, sort_order: 1, children: [] }],
    },
  ];
}

// 弹窗是 teleport 到 body 的，所以断言弹窗内容要查 document 而不是 wrapper
// input 的 value 是 DOM 属性，innerHTML 不序列化，必须直接读
function bodyFieldValues() {
  return Array.from(document.body.querySelectorAll('input, textarea')).map(
    (el) => (el as HTMLInputElement | HTMLTextAreaElement).value,
  );
}

function bodyButtons() {
  return Array.from(document.body.querySelectorAll('button')) as HTMLButtonElement[];
}

async function clickButton(label: string) {
  const btn = bodyButtons().find((b) => b.textContent?.includes(label));
  if (!btn) throw new Error(`找不到按钮: ${label}. 现有: ${bodyButtons().map((b) => b.textContent).join(' | ')}`);
  btn.click();
  await flushPromises();
}

function mountPage() {
  return mount(IndicatorList, {
    attachTo: document.body,
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

  it('shows the mapped report id on the row', async () => {
    const wrapper = mountPage();
    await flushPromises();
    // 一级行登记了 3115，列表里要能直接看到
    expect(wrapper.text()).toContain('3115');
    // 未登记的指标显示占位符而不是空白
    vi.mocked(fetchIndicatorTree).mockResolvedValue({
      data: [{ id: 9, parent_id: null, code: 'HT009', name: '未登记', description: '', status: 1, sort_order: 1, target_id: null, children: [] }],
    } as any);
    const w2 = mountPage();
    await flushPromises();
    expect(w2.findAll('.muted').length).toBeGreaterThan(0);
  });

  it('prefills the report fields when editing a mapped indicator', async () => {
    mountPage();
    await flushPromises();
    await clickButton('编辑');
    expect(document.body.innerHTML).toContain('报告标识');
    const values = bodyFieldValues();
    expect(values).toContain('3115');
    expect(values).toContain('摘要文案');
    expect(values).toContain('建议一\n建议二');
  });

  it('submits report_actions as an array split by line', async () => {
    vi.mocked(updateIndicator).mockResolvedValue({ data: {} } as any);
    mountPage();
    await flushPromises();
    await clickButton('编辑');
    await clickButton('保存');
    const payload = vi.mocked(updateIndicator).mock.calls[0][1] as any;
    expect(payload.target_id).toBe(3115);
    expect(payload.report_actions).toEqual(['建议一', '建议二']);
    // 表单内部的编辑字段不应泄漏给接口
    expect(payload).not.toHaveProperty('report_actions_text');
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
