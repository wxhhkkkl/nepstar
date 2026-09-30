import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import IndicatorDetail from '@/views/IndicatorDetail.vue'

vi.mock('@/api/reportClient.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    fetchIndicatorDetail: vi.fn(),
    reportParamsFromLocation: vi.fn(),
    reportRouteQueryFromLocation: vi.fn(),
  }
})

const {
  fetchIndicatorDetail,
  reportParamsFromLocation,
  reportRouteQueryFromLocation,
  ReportApiError,
} = await import('@/api/reportClient.js')

const payload = {
  report_code: 'R1',
  system: { system_code: 'SYS_IMMUNE', name: '免疫力' },
  indicator: {
    indicator_code: 'SYS_IMMUNE_LYMPH', name: '淋巴结', score: 92,
    last_score: 90, score_change: 2, abnormal_level: 1,
    status_text: '正常', description: '淋巴结参与免疫应答。',
    interpretation: '本次结果表现稳定。', actions: ['保持规律作息', '适量运动'],
    trend: [
      { report_code: 'OLD', date: '2026-07-01', score: 86 },
      { report_code: 'R1', date: '2026-09-01', score: 92 },
    ],
  },
}

function mountDetail(props = {}, data = payload, error = null) {
  reportParamsFromLocation.mockReturnValue({ reportCode: 'R1', customerId: 1001 })
  reportRouteQueryFromLocation.mockReturnValue({ reportId: 'R1', userId: '1001' })
  if (error) fetchIndicatorDetail.mockRejectedValue(error)
  else fetchIndicatorDetail.mockResolvedValue(data)
  return mount(IndicatorDetail, {
    props: { systemId: 'SYS_IMMUNE', indicatorCode: 'SYS_IMMUNE_LYMPH', ...props },
    global: { stubs: { RouterLink: RouterLinkStub } },
  })
}

describe('IndicatorDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
  })

  it('shows a structured skeleton while the request is pending', () => {
    const wrapper = mountDetail()
    expect(wrapper.find('[data-testid="indicator-detail-skeleton"]').exists()).toBe(true)
    expect(wrapper.find('[aria-busy="true"]').exists()).toBe(true)
  })

  it('renders real score, explanation, history and actions without removed modules', async () => {
    const wrapper = mountDetail()
    await flushPromises()
    expect(fetchIndicatorDetail).toHaveBeenCalledWith('R1', 'SYS_IMMUNE_LYMPH', 1001)
    expect(wrapper.text()).toContain('淋巴结详情')
    expect(wrapper.text()).toContain('92')
    expect(wrapper.text()).toContain('淋巴结参与免疫应答。')
    expect(wrapper.text()).toContain('86')
    expect(wrapper.text()).toContain('保持规律作息')
    expect(wrapper.find('.indicator-trend-chart').exists()).toBe(true)
    expect(wrapper.findAll('.indicator-trend-labels time').map((label) => label.attributes('datetime')))
      .toEqual(['2026-07-01', '2026-09-01'])
    expect(wrapper.findAll('.indicator-trend-labels time').map((label) => label.findAll('span').map((part) => part.text())))
      .toEqual([['2026', '07-01'], ['2026', '09-01']])
    expect(wrapper.text()).not.toContain('本次表现')
    expect(wrapper.text()).not.toContain('返回免疫力详情')
    expect(wrapper.text()).not.toContain('AI 长寿咨询')
    expect(wrapper.text()).not.toContain('产品推荐')
  })

  it('uses the top back control to return to the same system and report', async () => {
    const wrapper = mountDetail()
    await flushPromises()
    const back = wrapper.findComponent(RouterLinkStub)
    expect(back.props('to')).toEqual({
      name: 'system-detail', params: { systemId: 'SYS_IMMUNE' },
      query: { reportId: 'R1', userId: '1001' },
    })
  })

  it('shows first-record message and hides empty advice rather than fabricating a chart', async () => {
    const data = structuredClone(payload)
    data.indicator.trend = [{ report_code: 'R1', date: '2026-09-01', score: 92 }]
    data.indicator.actions = []
    data.indicator.interpretation = null
    const wrapper = mountDetail({}, data)
    await flushPromises()
    expect(wrapper.text()).toContain('本次为首次有效记录')
    expect(wrapper.find('.indicator-trend-chart').exists()).toBe(false)
    expect(wrapper.find('.indicator-actions').exists()).toBe(false)
  })

  it('does not treat a missing historical score as a real zero', async () => {
    const data = structuredClone(payload)
    data.indicator.trend = [
      { report_code: 'OLD', date: '2026-07-01', score: null },
      { report_code: 'R1', date: '2026-09-01', score: 92 },
    ]
    const wrapper = mountDetail({}, data)
    await flushPromises()
    expect(wrapper.find('.indicator-trend-chart').exists()).toBe(false)
    expect(wrapper.text()).toContain('本次为首次有效记录')
  })

  it('shows an explicit indicator error and never falls back to another indicator', async () => {
    const wrapper = mountDetail({}, payload, new ReportApiError('indicator_not_found'))
    await flushPromises()
    expect(wrapper.text()).toContain('该指标不属于此报告')
    expect(wrapper.find('[data-testid="report-error"]').exists()).toBe(true)
  })

  it('rejects an API payload for a different indicator even if the request succeeds', async () => {
    const data = structuredClone(payload)
    data.indicator.indicator_code = 'SYS_IMMUNE_OTHER'
    const wrapper = mountDetail({}, data)
    await flushPromises()
    expect(wrapper.text()).toContain('该指标不属于此报告')
    expect(wrapper.text()).not.toContain('淋巴结参与免疫应答。')
  })
})
