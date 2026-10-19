// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import ElementPlus, { ElMessage, ElMessageBox } from 'element-plus';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('@/api/aiConsult', () => ({
  activateAiConsultRuleVersion: vi.fn(),
  createAiConsultRuleDraft: vi.fn(),
  fetchAiConsultAdminAudit: vi.fn(),
  fetchAiConsultAdminSettings: vi.fn(),
  fetchAiConsultAdminOperations: vi.fn(),
  fetchAiConsultRuleVersion: vi.fn(),
  fetchAiConsultRuleVersions: vi.fn(),
  publishAiConsultRuleVersion: vi.fn(),
  updateAiConsultAdminSettings: vi.fn(),
  updateAiConsultServiceState: vi.fn(),
}));

import {
  fetchAiConsultAdminAudit,
  fetchAiConsultAdminOperations,
  fetchAiConsultAdminSettings,
  fetchAiConsultRuleVersions,
  updateAiConsultAdminSettings,
  updateAiConsultServiceState,
} from '@/api/aiConsult';
import { useAuthStore } from '@/stores/auth';
import AiConsultSettings from '../AiConsultSettings.vue';

function mountSettings(options: { roles?: string[]; actions?: string[] } = {}) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const auth = useAuthStore();
  auth.roles = options.roles ?? ['admin'];
  auth.menus = [{ id: 1, route_path: '/health', children: [
    { id: 42, route_path: '/health/ai-consult-settings' },
  ] }];
  auth.permissions = options.actions?.length ? { '42': options.actions } : {};
  return mount(AiConsultSettings, { global: { plugins: [pinia, ElementPlus] } });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchAiConsultAdminSettings).mockResolvedValue({ data: {
    settings: {
      configured: true, id: 1, enabled: false, provider_code: 'openai_compatible', model_code: 'test',
      maintenance_text: '', notice_version: '', notice_text: '', data_scope_text: '',
      guest_create_limit_per_minute: 0, daily_success_limit: 0, per_minute_limit: 0,
      global_daily_token_limit: 100000, max_concurrent_generations: 0, max_question_chars: 500, row_version: 1, updated_at: null,
    },
    runtime: {
      provider_code: 'openai_compatible', model_code: 'test', provider_secret_configured: false,
      provider_matches_settings: true, feature_gates: { guest: false, sessions: false, answers: false, operations: false },
      can_enable: false, activation_block_reason: '尚未开放',
    },
  } } as any);
  vi.mocked(fetchAiConsultRuleVersions).mockResolvedValue({ data: {
    rules: [], active_rule_version_id: null, limit: 50, offset: 0,
  } } as any);
  vi.mocked(fetchAiConsultAdminAudit).mockResolvedValue({ data: {
    entries: [], limit: 20, offset: 0, has_more: false,
  } } as any);
});

describe('AiConsultSettings', () => {
  async function serviceConfig(enabled = false, canEnable = true) {
    const initial = await vi.mocked(fetchAiConsultAdminSettings).mock.results[0].value;
    return { ...initial.data, settings: { ...initial.data.settings, enabled },
      runtime: { ...initial.data.runtime, can_enable: canEnable, activation_block_reason: canEnable ? '' : '部署已禁用' } };
  }

  it('confirms enable, uses the dedicated endpoint and keeps unsaved quota changes', async () => {
    const wrapper = mountSettings();
    await flushPromises();
    const ready = await serviceConfig();
    vi.mocked(fetchAiConsultAdminSettings).mockResolvedValue({ data: ready } as any);
    wrapper.unmount();
    const page = mountSettings();
    await flushPromises();
    const quota = page.findAllComponents({ name: 'ElInputNumber' }).find(c => c.attributes('data-testid') === 'quota-daily_success_limit')!;
    quota.vm.$emit('update:modelValue', 55);
    const confirm = vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue('confirm' as any);
    vi.mocked(updateAiConsultServiceState).mockResolvedValueOnce({ data: {
      ...ready, settings: { ...ready.settings, enabled: true, row_version: 2 },
    } } as any);
    const control = page.findComponent({ name: 'ElSwitch' });
    await (control.props('beforeChange') as () => Promise<boolean>)();
    await flushPromises();
    expect(confirm).toHaveBeenCalled();
    expect(updateAiConsultServiceState).toHaveBeenCalledWith({ enabled: true, expected_row_version: 1 });
    expect(control.props('modelValue')).toBe(true);
    expect(quota.props('modelValue')).toBe(55);
    expect(updateAiConsultAdminSettings).not.toHaveBeenCalled();
    confirm.mockRestore(); page.unmount();
  });

  it('allows emergency pause even when enabling is blocked by the deployment', async () => {
    const page = mountSettings(); await flushPromises();
    const enabled = await serviceConfig(true, false);
    page.unmount();
    vi.mocked(fetchAiConsultAdminSettings).mockResolvedValue({ data: enabled } as any);
    const wrapper = mountSettings(); await flushPromises();
    const control = wrapper.findComponent({ name: 'ElSwitch' });
    expect(control.props('disabled')).toBe(false);
    const confirm = vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue('confirm' as any);
    vi.mocked(updateAiConsultServiceState).mockResolvedValueOnce({ data: {
      ...enabled, settings: { ...enabled.settings, enabled: false, row_version: 2 },
    } } as any);
    await (control.props('beforeChange') as () => Promise<boolean>)(); await flushPromises();
    expect(updateAiConsultServiceState).toHaveBeenCalledWith({ enabled: false, expected_row_version: 1 });
    expect(control.props('modelValue')).toBe(false);
    expect(control.props('disabled')).toBe(true);
    confirm.mockRestore(); wrapper.unmount();
  });

  it('does not change state or call the backend after cancelling confirmation', async () => {
    const page = mountSettings(); await flushPromises(); const ready = await serviceConfig(); page.unmount();
    vi.mocked(fetchAiConsultAdminSettings).mockResolvedValue({ data: ready } as any);
    const wrapper = mountSettings(); await flushPromises();
    const confirm = vi.spyOn(ElMessageBox, 'confirm').mockRejectedValue('cancel');
    const control = wrapper.findComponent({ name: 'ElSwitch' });
    await (control.props('beforeChange') as () => Promise<boolean>)();
    expect(updateAiConsultServiceState).not.toHaveBeenCalled();
    expect(control.props('modelValue')).toBe(false);
    confirm.mockRestore(); wrapper.unmount();
  });

  it('refreshes the actual switch state after a conflict instead of showing a false success', async () => {
    const page = mountSettings(); await flushPromises(); const ready = await serviceConfig(); page.unmount();
    vi.mocked(fetchAiConsultAdminSettings).mockResolvedValue({ data: ready } as any);
    const wrapper = mountSettings(); await flushPromises();
    const confirm = vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue('confirm' as any);
    const notify = vi.spyOn(ElMessage, 'error').mockImplementation(() => ({ close: vi.fn() } as any));
    vi.mocked(updateAiConsultServiceState).mockRejectedValueOnce({ code: 409, message: 'consult.admin_version_conflict' });
    vi.mocked(fetchAiConsultAdminSettings).mockResolvedValueOnce({ data: {
      ...ready, settings: { ...ready.settings, enabled: true, row_version: 3 },
    } } as any);
    const control = wrapper.findComponent({ name: 'ElSwitch' });
    await (control.props('beforeChange') as () => Promise<boolean>)(); await flushPromises();
    expect(control.props('modelValue')).toBe(true);
    expect(notify).toHaveBeenCalledWith('服务状态已被其他管理员更新，已重新读取，请确认后重试。');
    confirm.mockRestore(); notify.mockRestore(); wrapper.unmount();
  });

  it('a view-only user cannot use the switch, including its handler directly', async () => {
    const wrapper = mountSettings({ roles: ['operator'], actions: ['view'] });
    await flushPromises();
    const control = wrapper.findComponent({ name: 'ElSwitch' });
    expect(control.props('disabled')).toBe(true);
    await (control.props('beforeChange') as () => Promise<boolean>)();
    expect(updateAiConsultServiceState).not.toHaveBeenCalled(); wrapper.unmount();
  });

  it('saves visible quotas and preserves the deployment-controlled limits', async () => {
    const wrapper = mountSettings();
    await flushPromises();
    const changes = {
      daily_success_limit: 20, per_minute_limit: 4,
      global_daily_token_limit: 120000, max_question_chars: 250,
    };
    const initial = await vi.mocked(fetchAiConsultAdminSettings).mock.results[0].value;
    vi.mocked(updateAiConsultAdminSettings).mockResolvedValueOnce({ data: {
      ...initial.data, settings: { ...initial.data.settings, ...changes, row_version: 2 },
    } } as any);
    for (const [key, value] of Object.entries(changes)) {
      const control = wrapper.findAllComponents({ name: 'ElInputNumber' })
        .find((item) => item.attributes('data-testid') === `quota-${key}`);
      expect(control).toBeDefined();
      control!.vm.$emit('update:modelValue', value);
    }
    await wrapper.findAll('button').find((button) => button.text().includes('保存额度设置'))!.trigger('click');
    await flushPromises();
    expect(updateAiConsultAdminSettings).toHaveBeenCalledWith(expect.objectContaining({
      ...changes, guest_create_limit_per_minute: 0, max_concurrent_generations: 0,
      enabled: false, expected_row_version: 1,
    }));
    expect(wrapper.findAllComponents({ name: 'ElInputNumber' })
      .find((item) => item.attributes('data-testid') === 'quota-max_question_chars')!.props('modelValue')).toBe(250);
    wrapper.unmount();
  });

  it('saves all six quotas as zero and explains that zero means unlimited', async () => {
    const wrapper = mountSettings();
    await flushPromises();
    const initial = await vi.mocked(fetchAiConsultAdminSettings).mock.results[0].value;
    const quotas = Object.fromEntries([
      'guest_create_limit_per_minute', 'daily_success_limit', 'per_minute_limit',
      'global_daily_token_limit', 'max_concurrent_generations', 'max_question_chars',
    ].map((key) => [key, 0]));
    vi.mocked(updateAiConsultAdminSettings).mockResolvedValueOnce({ data: {
      ...initial.data, settings: { ...initial.data.settings, ...quotas, row_version: 2 },
    } } as any);
    for (const control of wrapper.findAllComponents({ name: 'ElInputNumber' })) {
      expect(control.props('min')).toBe(0);
      control.vm.$emit('update:modelValue', 0);
    }
    expect(wrapper.findAll('.inline-hint').filter((hint) => hint.text().includes('0 表示不限制'))).toHaveLength(6);
    await wrapper.findAll('button').find((button) => button.text().includes('保存额度设置'))!.trigger('click');
    await flushPromises();
    expect(updateAiConsultAdminSettings).toHaveBeenCalledWith(expect.objectContaining(quotas));
    wrapper.unmount();
  });

  it('blocks a cleared quota instead of accidentally sending the backend default zero', async () => {
    const wrapper = mountSettings();
    await flushPromises();
    const control = wrapper.findAllComponents({ name: 'ElInputNumber' })
      .find((item) => item.attributes('data-testid') === 'quota-daily_success_limit');
    expect(control).toBeDefined();
    control!.vm.$emit('update:modelValue', undefined);
    await wrapper.findAll('button').find((button) => button.text().includes('保存额度设置'))!.trigger('click');
    await flushPromises();
    expect(updateAiConsultAdminSettings).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(wrapper.text()).toContain('请输入 0–1000 之间的整数'));
    wrapper.unmount();
  });

  it('keeps the draft and shows a field error when the server rejects a quota', async () => {
    vi.mocked(updateAiConsultAdminSettings).mockRejectedValueOnce({ detail: [{
      loc: ['body', 'max_question_chars'], msg: 'Input should be less than or equal to 500',
    }] });
    const errorMessage = vi.spyOn(ElMessage, 'error').mockImplementation(() => ({ close: vi.fn() } as any));
    const wrapper = mountSettings();
    await flushPromises();
    await wrapper.findAll('button').find((button) => button.text().includes('保存额度设置'))!.trigger('click');
    await flushPromises();
    await vi.waitFor(() => expect(wrapper.text()).toContain('请输入 0–500 之间的整数'));
    expect(wrapper.findAllComponents({ name: 'ElInputNumber' })
      .find((item) => item.attributes('data-testid') === 'quota-max_question_chars')!.props('modelValue')).toBe(500);
    expect(errorMessage).toHaveBeenCalledWith('配置未保存，请检查标记的额度项。');
    wrapper.unmount();
    errorMessage.mockRestore();
  });

  it.each([
    ['daily_success_limit', 1001],
    ['per_minute_limit', 61], ['global_daily_token_limit', 100000001],
    ['max_question_chars', -1],
    ['daily_success_limit', 2.5],
  ])('rejects invalid %s=%s before saving', async (field, value) => {
    const wrapper = mountSettings();
    await flushPromises();
    const control = wrapper.findAllComponents({ name: 'ElInputNumber' })
      .find((item) => item.attributes('data-testid') === `quota-${field}`);
    control!.vm.$emit('update:modelValue', value);
    await wrapper.findAll('button').find((button) => button.text().includes('保存额度设置'))!.trigger('click');
    await flushPromises();
    expect(updateAiConsultAdminSettings).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(wrapper.find('.el-form-item__error').exists()).toBe(true));
    wrapper.unmount();
  });
  it('shows candidate settings without loading overview data', async () => {
    const wrapper = mountSettings();
    await flushPromises();
    const text = wrapper.text();
    expect(text).toContain('服务未开放');
    expect(text).toContain('保存额度设置');
    expect(fetchAiConsultAdminOperations).not.toHaveBeenCalled();
  });

  it('does not expose a provider secret value', async () => {
    const wrapper = mountSettings();
    await flushPromises();
    expect(wrapper.text()).toContain('未配置');
    expect(wrapper.text()).not.toContain('api_key');
  });

  it('does not fetch protected settings without the page view permission', async () => {
    vi.mocked(fetchAiConsultAdminSettings).mockClear();
    const wrapper = mountSettings({ roles: [], actions: [] });
    await flushPromises();

    expect(wrapper.text()).toContain('没有查看 AI 咨询设置的权限');
    expect(fetchAiConsultAdminSettings).not.toHaveBeenCalled();
    expect(wrapper.text()).not.toContain('保存额度设置');
    wrapper.unmount();
  });

  it('shows a read-only view when granted view but not edit or publish', async () => {
    vi.mocked(fetchAiConsultRuleVersions).mockResolvedValueOnce({ data: {
      rules: [
        { id: 1, version: 'draft-1', status: 'draft', active: false, created_at: '2026-10-09', published_at: null },
        { id: 2, version: 'old-1', status: 'retired', active: false, created_at: '2026-10-08', published_at: '2026-10-08' },
      ], active_rule_version_id: null, limit: 50, offset: 0,
    } } as any);
    const wrapper = mountSettings({ roles: ['operator'], actions: ['view'] });
    await flushPromises();

    expect(wrapper.text()).toContain('运行环境状态');
    expect(wrapper.text()).toContain('查看操作记录');
    const buttonTexts = wrapper.findAll('button').map((button) => button.text());
    expect(buttonTexts.some((text) => text.includes('保存额度设置'))).toBe(false);
    expect(buttonTexts.some((text) => text.includes('新建规则草稿'))).toBe(false);
    expect(buttonTexts.some((text) => text.includes('发布'))).toBe(false);
    const fields = wrapper.findAll('input');
    expect(fields.length).toBeGreaterThan(0);
    expect(fields.every((field) => (field.element as HTMLInputElement).disabled)).toBe(true);
    wrapper.unmount();
  });

  it('keeps publishing separate from edit permission', async () => {
    vi.mocked(fetchAiConsultRuleVersions).mockResolvedValueOnce({ data: {
      rules: [{
        id: 3, version: 'draft-3', status: 'draft', active: false,
        created_at: '2026-10-09', published_at: null,
      }],
      active_rule_version_id: null, limit: 50, offset: 0,
    } } as any);
    const wrapper = mountSettings({ roles: ['operator'], actions: ['view', 'publish'] });
    await flushPromises();

    const buttonTexts = wrapper.findAll('button').map((button) => button.text());
    expect(buttonTexts.some((text) => text.trim() === '发布')).toBe(true);
    expect(buttonTexts.some((text) => text.includes('新建规则草稿'))).toBe(false);
    expect(buttonTexts.some((text) => text.includes('保存额度设置'))).toBe(false);
    wrapper.unmount();
  });

  it('saves only a disabled candidate using the current row version', async () => {
    vi.mocked(updateAiConsultAdminSettings).mockResolvedValueOnce({ data: {
      settings: {
        configured: true, id: 1, enabled: false, provider_code: 'openai_compatible', model_code: 'test',
        maintenance_text: '', notice_version: '', notice_text: '', data_scope_text: '',
        guest_create_limit_per_minute: 0, daily_success_limit: 0, per_minute_limit: 0,
        global_daily_token_limit: 100000, max_concurrent_generations: 0, row_version: 2, updated_at: null,
      },
      runtime: {
        provider_code: 'openai_compatible', model_code: 'test', provider_secret_configured: false,
        provider_matches_settings: true, feature_gates: { guest: false, sessions: false, answers: false, operations: false },
        can_enable: false, activation_block_reason: '尚未开放',
      },
    } } as any);

    const wrapper = mountSettings();
    await flushPromises();
    const saveButton = wrapper.findAll('button').find((button) => button.text().includes('保存额度设置'));
    expect(saveButton).toBeDefined();
    await saveButton!.trigger('click');
    await flushPromises();

    expect(updateAiConsultAdminSettings).toHaveBeenCalledWith(expect.objectContaining({
      model_code: 'test',
      enabled: false,
      expected_row_version: 1,
    }));
    expect(wrapper.text()).toContain('服务未开放');
    wrapper.unmount();
  });

  it('translates a stale settings version into a refresh-and-retry message', async () => {
    vi.mocked(updateAiConsultAdminSettings).mockRejectedValueOnce({ detail: 'consult.admin_version_conflict' });
    const errorMessage = vi.spyOn(ElMessage, 'error').mockImplementation(() => ({ close: vi.fn() } as any));

    const wrapper = mountSettings();
    await flushPromises();
    const saveButton = wrapper.findAll('button').find((button) => button.text().includes('保存额度设置'));
    await saveButton!.trigger('click');
    await flushPromises();

    expect(errorMessage).toHaveBeenCalledWith('配置已被其他管理员更新，请刷新后重试。');
    wrapper.unmount();
    errorMessage.mockRestore();
  });

  it('opens safe audit history and pages through empty results', async () => {
    vi.mocked(fetchAiConsultAdminAudit)
      .mockResolvedValueOnce({ data: {
        entries: [{
          id: 9,
          actor_admin_id: 42,
          action: 'settings.update',
          target_id: '1',
          change_summary: {
            changed_fields: ['model_code'], from_row_version: 1, to_row_version: 2,
          },
          occurred_at: '2026-10-09T03:04:05Z',
        }],
        limit: 20, offset: 0, has_more: true,
      } } as any)
      .mockResolvedValueOnce({ data: {
        entries: [], limit: 20, offset: 20, has_more: false,
      } } as any);

    const wrapper = mountSettings();
    await flushPromises();
    const openButton = wrapper.findAll('button').find((button) => button.text().includes('查看操作记录'));
    expect(openButton).toBeDefined();
    await openButton!.trigger('click');
    await flushPromises();

    expect(fetchAiConsultAdminAudit).toHaveBeenNthCalledWith(1, { limit: 20, offset: 0 });
    expect(wrapper.text()).toContain('管理操作记录');
    expect(wrapper.text()).toContain('更新候选设置');
    expect(wrapper.text()).toContain('模型名称');
    expect(wrapper.text()).not.toContain('原始审计 JSON');

    const nextButton = wrapper.findAll('button')
      .find((button) => button.text().trim() === '下一页');
    expect(nextButton).toBeDefined();
    expect((nextButton!.element as HTMLButtonElement).disabled).toBe(false);
    await nextButton!.trigger('click');
    await flushPromises();

    expect(fetchAiConsultAdminAudit).toHaveBeenNthCalledWith(2, { limit: 20, offset: 20 });
    expect(wrapper.text()).toContain('暂无管理操作记录');
    wrapper.unmount();
  });
});
