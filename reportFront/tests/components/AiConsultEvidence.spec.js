import { mount, RouterLinkStub } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AiConsultEvidence from '@/components/AiConsultEvidence.vue'
import { citationToReportRoute } from '@/data/aiConsultEvidence.js'

const reportQuery = { reportId: 'R1', userId: '1001', guest_token: 'must-not-travel' }
const indicator = {
  id: 'ev1', kind: 'report', label: '呼吸睡眠', report_date: '2026-07-29',
  route: '#/system/SYS_LUNG/indicator/SYS_LUNG_SLEEP_BREATHING?reportId=R1&customerId=1001',
}

describe('AI consultation evidence links', () => {
  it('shows a compact source and links to the same report without carrying a guest token', async () => {
    const wrapper = mount(AiConsultEvidence, {
      props: { items: [indicator], reportCode: 'R1', customerId: 1001, reportQuery },
      global: { stubs: { RouterLink: RouterLinkStub } },
    })
    expect(wrapper.get('summary').text()).toContain('查看报告依据')
    expect(wrapper.text()).toContain('报告日期 2026-07-29')
    const link = wrapper.getComponent(RouterLinkStub)
    expect(link.props('to')).toEqual({
      name: 'indicator-detail',
      params: { systemId: 'SYS_LUNG', indicatorCode: 'SYS_LUNG_SLEEP_BREATHING' },
      query: { reportId: 'R1', userId: '1001', fromAiConsult: '1' },
    })
    await link.trigger('click')
    expect(wrapper.emitted('navigate')).toHaveLength(1)
  })

  it('never makes a cross-report or malformed citation navigable', () => {
    const cases = [
      { ...indicator, route: indicator.route.replace('reportId=R1', 'reportId=R2') },
      { ...indicator, route: indicator.route.replace('customerId=1001', 'customerId=9999') },
      { ...indicator, route: '#/system/SYS_LUNG/indicator/../../admin?reportId=R1&customerId=1001' },
      { ...indicator, route: 'https://example.test/?reportId=R1&customerId=1001' },
    ]
    for (const item of cases) {
      expect(citationToReportRoute(item, 'R1', 1001, reportQuery)).toBeNull()
    }
    const wrapper = mount(AiConsultEvidence, {
      props: { items: cases, reportCode: 'R1', customerId: 1001, reportQuery },
      global: { stubs: { RouterLink: RouterLinkStub } },
    })
    expect(wrapper.findComponent(RouterLinkStub).exists()).toBe(false)
  })

  it('supports system and total-report citations without inventing indicator routes', () => {
    expect(citationToReportRoute({ ...indicator, route: '#/system/SYS_LUNG?reportId=R1&customerId=1001' }, 'R1', 1001)).toMatchObject({
      name: 'system-detail', params: { systemId: 'SYS_LUNG' },
    })
    expect(citationToReportRoute({ ...indicator, route: '#/?reportId=R1&customerId=1001' }, 'R1', 1001)).toMatchObject({
      name: 'home',
    })
  })
})
