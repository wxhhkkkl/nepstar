import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SystemDetail from '@/views/SystemDetail.vue'
import { reportDto } from '../fixtures/reportDto.js'

vi.mock('@/api/reportClient.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, fetchSystemDetail: vi.fn(), reportParamsFromLocation: vi.fn() }
})

const { fetchSystemDetail, reportParamsFromLocation, ReportApiError } = await import('@/api/reportClient.js')

const byId = (id) => reportDto.systems.find((s) => s.system_code === id)

async function mountDetail(systemId) {
  fetchSystemDetail.mockImplementation(async (_code, code) => {
    const system = byId(code)
    if (!system) throw new ReportApiError('system_not_found')
    return { report_code: reportDto.report.report_code, system }
  })
  reportParamsFromLocation.mockReturnValue({ reportCode: 'R1', customerId: 1001 })
  const wrapper = mount(SystemDetail, {
    props: { systemId },
    global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
  })
  await flushPromises()
  return wrapper
}

describe('SystemDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each([
    'SYS_CARDIO', 'SYS_LUNG', 'SYS_ENDOCRINE', 'SYS_BONE', 'SYS_DIGEST', 'SYS_FEMALE', 'SYS_IMMUNE',
  ])('renders shared data for %s', async (id) => {
    const wrapper = await mountDetail(id)
    expect(wrapper.get('[data-system-id]').attributes('data-system-id')).toBe(id)
    expect(wrapper.findAll('.detail-indicator-list article').length).toBeGreaterThan(0)
    expect(wrapper.get('.detail-chart').attributes('data-chart-type')).toBeTruthy()
  })

  it('shows only the matching recommendations', async () => {
    expect((await mountDetail('SYS_ENDOCRINE')).text()).toContain('睡眠健康')
    expect((await mountDetail('SYS_ENDOCRINE')).text()).not.toContain('钙流失健康')
    expect((await mountDetail('SYS_BONE')).text()).toContain('钙流失健康')
    expect((await mountDetail('SYS_CARDIO')).find('.detail-product-recommendation').exists()).toBe(false)
  })

  it('renders direct measurements only when provided', async () => {
    expect((await mountDetail('SYS_CARDIO')).find('#directBlock').exists()).toBe(true)
    expect((await mountDetail('SYS_BONE')).find('#directBlock').exists()).toBe(false)
  })

  it('renders the copy maintained in the backend', async () => {
    const wrapper = await mountDetail('SYS_BONE')
    expect(wrapper.text()).toContain('骨质疏松是本次骨骼维度的主要影响项。')
    expect(wrapper.text()).toContain('评估钙与维生素 D 摄入')
  })

  it('shows a recoverable error state for an unknown system', async () => {
    const wrapper = await mountDetail('SYS_UNKNOWN')
    expect(wrapper.find('[data-testid="report-error"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('该系统不属于此报告')
  })

  it('shows the unavailable state when the data source fails', async () => {
    fetchSystemDetail.mockRejectedValue(new ReportApiError('unavailable'))
    reportParamsFromLocation.mockReturnValue({ reportCode: 'R1', customerId: 1001 })
    const wrapper = mount(SystemDetail, {
      props: { systemId: 'SYS_BONE' },
      global: { stubs: { RouterLink: true } },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('报告服务暂时不可用')
  })

  it('shows the not-found state when the link has no report parameters', async () => {
    reportParamsFromLocation.mockReturnValue({ reportCode: '', customerId: null })
    const wrapper = mount(SystemDetail, {
      props: { systemId: 'SYS_BONE' },
      global: { stubs: { RouterLink: true } },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('报告打不开')
  })
})
