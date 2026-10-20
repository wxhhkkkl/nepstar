import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AiConsult from '@/views/AiConsult.vue'
import { bootstrapPayload } from '../fixtures/aiConsult.js'

vi.mock('@/api/aiConsultClient.js', () => ({
  loadConsultBootstrap: vi.fn(),
  listConsultSessions: vi.fn(),
  loadConsultSession: vi.fn(),
  loadConsultTurn: vi.fn(),
  createConsultSession: vi.fn(),
  endConsultSession: vi.fn(),
  AiConsultApiError: class AiConsultApiError extends Error {
    constructor(kind, status = 0, detail = '') {
      super(kind)
      this.kind = kind
      this.status = status
      this.detail = detail
    }
  },
}))
vi.mock('@/api/reportClient.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    reportParamsFromLocation: vi.fn(),
    reportRouteQueryFromLocation: vi.fn(),
  }
})

const { loadConsultBootstrap, AiConsultApiError } = await import('@/api/aiConsultClient.js')
const { reportParamsFromLocation, reportRouteQueryFromLocation } = await import('@/api/reportClient.js')

function mountWelcome() {
  return mount(AiConsult, { global: { stubs: { RouterLink: RouterLinkStub } } })
}

describe('AI consultation welcome route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    reportParamsFromLocation.mockReturnValue({ reportCode: 'R1', customerId: 1001 })
    reportRouteQueryFromLocation.mockReturnValue({ reportId: 'R1', userId: '1001' })
    loadConsultBootstrap.mockResolvedValue(structuredClone(bootstrapPayload))
  })

  it('shows a dedicated skeleton before the anonymous context is ready', () => {
    const wrapper = mountWelcome()
    expect(wrapper.find('[data-testid="ai-consult-skeleton"]').exists()).toBe(true)
    expect(wrapper.find('[aria-busy="true"]').exists()).toBe(true)
  })

  it('uses the new welcome layout without a history entry or invented visitor identity', async () => {
    loadConsultBootstrap.mockResolvedValueOnce({
      ...structuredClone(bootstrapPayload), report_score: 82,
      focus_systems: [{ name: '肺功能', score: 80 }],
    })
    const wrapper = mountWelcome()
    await flushPromises()
    expect(wrapper.get('.ai-topbar-title').text()).toContain('AI 长寿咨询')
    expect(wrapper.find('.ai-eyebrow').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('YOUR LONGEVITY COMPANION')
    expect(wrapper.get('[data-testid="ai-report-score"]').text()).toBe('82分')
    expect(wrapper.get('.ai-report-focus').text()).toContain('肺功能 · 活力值 80')
    expect(wrapper.get('.ai-hero').text()).toContain('一起读懂你的长寿报告')
    expect(wrapper.get('.ai-avatar img').attributes('src')).toContain('ai-longevity-doctor-avatar.png')
    expect(wrapper.get('.ai-topbar').findAll('button')).toHaveLength(0)
    expect(wrapper.text()).not.toContain('最近咨询')
    expect(wrapper.text()).not.toContain('GOOD MORNING · LEE')
    wrapper.unmount()
  })

  it('keeps actual report-matched plans and links to their same-report system details', async () => {
    loadConsultBootstrap.mockResolvedValueOnce({
      ...structuredClone(bootstrapPayload),
      management_plans: [{
        plan_id: 7, plan_name: '睡眠健康管理方案', system_code: 'SYS_ENDOCRINE',
        indicator_code: 'SYS_ENDOCRINE_PINEAL', indicator_name: '松果体', indicator_score: 48,
        trigger_score_below: 80,
        description: '从睡眠节律开始管理', image_url: '/assets/sleep-health-management-plan.png',
        image_alt: '睡眠管理方案产品',
      }],
    })
    const wrapper = mountWelcome()
    await flushPromises()
    expect(wrapper.get('[data-testid="ai-management-plans"] h2').text()).toBe('为你匹配的健康管理方案 1 项')
    const plan = wrapper.get('[data-testid="ai-management-plan"]')
    expect(plan.text()).toContain('松果体 · 活力值 48')
    expect(plan.text()).toContain('从睡眠节律开始管理')
    expect(plan.get('[data-testid="ai-plan-description"]').classes()).not.toContain('ai-accessibility-only')
    expect(plan.find('[data-testid="ai-plan-reason"]').exists()).toBe(false)
    expect(plan.text()).not.toContain('推荐原因')
    expect(plan.findComponent(RouterLinkStub).props('to')).toEqual({
      name: 'system-detail', params: { systemId: 'SYS_ENDOCRINE' },
      query: { reportId: 'R1', userId: '1001', fromAiConsult: '1' },
    })
    expect(plan.find('img').attributes('alt')).toBe('睡眠管理方案产品')
    wrapper.unmount()
  })

  it.each([
    { indicator_name: '松果体', indicator_score: 48 },
    { indicator_name: '松果体', indicator_score: 80, trigger_score_below: 80 },
    { indicator_name: '松果体', indicator_score: null, trigger_score_below: 80 },
    { indicator_name: '松果体', indicator_score: 48, trigger_score_below: 101 },
  ])('does not invent descriptions or matching reasons when the data is absent or inconsistent (%j)', async fields => {
    loadConsultBootstrap.mockResolvedValueOnce({ ...structuredClone(bootstrapPayload),
      management_plans: [{ plan_id: 7, plan_name: '睡眠健康管理方案', system_code: 'SYS_ENDOCRINE',
        indicator_code: 'SYS_ENDOCRINE_PINEAL', description: '   ', ...fields }],
    })
    const wrapper = mountWelcome()
    await flushPromises()
    expect(wrapper.find('[data-testid="ai-plan-description"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="ai-plan-reason"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('does not fabricate plans or a score when the report has none', async () => {
    loadConsultBootstrap.mockResolvedValueOnce({ ...structuredClone(bootstrapPayload), report_score: null })
    const wrapper = mountWelcome()
    await flushPromises()
    expect(wrapper.find('[data-testid="ai-management-plans"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="ai-report-score"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('68分')
    wrapper.unmount()
  })

  it('opens the composer directly without a required consent sheet', async () => {
    loadConsultBootstrap.mockResolvedValueOnce({ ...structuredClone(bootstrapPayload), service_status: 'available' })
    const wrapper = mountWelcome()
    await flushPromises()
    expect(wrapper.find('textarea').exists()).toBe(true)
    expect(wrapper.find('[data-testid="ai-composer"]').exists()).toBe(true)
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="ai-notice-accept"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="ai-question"]').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('shows only real bootstrap fields and keeps questions disabled while service is unavailable', async () => {
    const wrapper = mountWelcome()
    await flushPromises()
    expect(loadConsultBootstrap).toHaveBeenCalledWith('R1', 1001, { planId: null, indicatorCode: null })
    expect(wrapper.text()).toContain('本次报告总分 82 分')
    expect(wrapper.get('time').attributes('datetime')).toBe('2026-10-08')
    expect(wrapper.get('time').text()).toBe('2026.10.08')
    expect(wrapper.text()).toContain('我的肺功能活力值80分')
    expect(wrapper.text()).toContain('咨询服务暂未开放')
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.find('[data-testid="ai-question"]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).not.toContain('示例报告')
    expect(wrapper.findComponent(RouterLinkStub).props('to')).toEqual({
      name: 'home', query: { reportId: 'R1', userId: '1001' },
    })
  })

  it('does not show the standalone notice entry while the service is unavailable', async () => {
    const wrapper = mountWelcome()
    await flushPromises()
    expect(wrapper.find('[data-testid="ai-notice-open"]').exists()).toBe(false)
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('报告内容仍可查看')
  })

  it('has a controlled network error with retry and no invented report content', async () => {
    loadConsultBootstrap.mockRejectedValueOnce(new AiConsultApiError('network'))
    const wrapper = mountWelcome()
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('网络连接失败')
    expect(wrapper.text()).not.toContain('本次报告总分')
    await wrapper.get('[data-testid="ai-retry"]').trigger('click')
    await flushPromises()
    expect(loadConsultBootstrap).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('本次报告总分 82 分')
  })

  it('shows the configured maintenance notice without enabling consent or questions', async () => {
    loadConsultBootstrap.mockResolvedValueOnce({
      ...structuredClone(bootstrapPayload),
      service_status: 'maintenance',
      maintenance_text: '模型服务维护中，预计稍后恢复。',
    })
    const wrapper = mountWelcome()
    await flushPromises()
    expect(wrapper.text()).toContain('咨询服务维护中')
    expect(wrapper.text()).toContain('模型服务维护中，预计稍后恢复。')
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.get('[data-testid="ai-question"]').attributes('disabled')).toBeDefined()
  })

  it('shows maintenance before a guest can be created and does not invent report data', async () => {
    loadConsultBootstrap.mockRejectedValueOnce(new AiConsultApiError('maintenance', 503, '请稍后再试。'))
    const wrapper = mountWelcome()
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('咨询服务维护中')
    expect(wrapper.get('[role="alert"]').text()).toContain('请稍后再试。')
    expect(wrapper.text()).not.toContain('本次报告总分')
  })

  it('does not call the guest endpoint when report parameters are missing', async () => {
    reportParamsFromLocation.mockReturnValue({ reportCode: '', customerId: null })
    const wrapper = mountWelcome()
    await flushPromises()
    expect(loadConsultBootstrap).not.toHaveBeenCalled()
    expect(wrapper.get('[role="alert"]').text()).toContain('报告链接无效')
  })
})
