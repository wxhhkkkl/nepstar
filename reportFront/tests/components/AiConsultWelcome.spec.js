import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AiConsult from '@/views/AiConsult.vue'
import { bootstrapPayload } from '../fixtures/aiConsult.js'

vi.mock('@/api/aiConsultClient.js', () => ({
  loadConsultBootstrap: vi.fn(),
  AiConsultApiError: class AiConsultApiError extends Error {
    constructor(kind) { super(kind); this.kind = kind }
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

  it('shows only real bootstrap fields and keeps questions disabled while service is unavailable', async () => {
    const wrapper = mountWelcome()
    await flushPromises()
    expect(loadConsultBootstrap).toHaveBeenCalledWith('R1', 1001)
    expect(wrapper.text()).toContain('本次报告总分 82 分')
    expect(wrapper.text()).toContain('2026-10-08')
    expect(wrapper.text()).toContain('我的肺功能活力值80分')
    expect(wrapper.text()).toContain('咨询服务暂未开放')
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.find('[data-testid="ai-question"]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).not.toContain('示例报告')
    expect(wrapper.findComponent(RouterLinkStub).props('to')).toEqual({
      name: 'home', query: { reportId: 'R1', userId: '1001' },
    })
  })

  it('shows the current notice and scope without recording consent while the model is closed', async () => {
    const wrapper = mountWelcome()
    await flushPromises()
    await wrapper.get('[data-testid="ai-notice-open"]').trigger('click')
    expect(wrapper.get('[role="dialog"]').text()).toContain('测试用健康数据处理告知。')
    expect(wrapper.get('[role="dialog"]').text()).toContain('仅使用当前报告指标和本次问题。')
    expect(wrapper.get('[role="dialog"]').text()).toContain('test-provider')
    expect(wrapper.get('[role="dialog"]').text()).not.toContain('同意并继续')
    await wrapper.get('[data-testid="ai-notice-close"]').trigger('click')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
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

  it('does not call the guest endpoint when report parameters are missing', async () => {
    reportParamsFromLocation.mockReturnValue({ reportCode: '', customerId: null })
    const wrapper = mountWelcome()
    await flushPromises()
    expect(loadConsultBootstrap).not.toHaveBeenCalled()
    expect(wrapper.get('[role="alert"]').text()).toContain('报告链接无效')
  })
})
