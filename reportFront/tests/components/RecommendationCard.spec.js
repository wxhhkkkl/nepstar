import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import RecommendationCard from '@/components/RecommendationCard.vue'
import { toReportViewModel } from '@/data/reportAdapter.js'
import { reportDto } from '../fixtures/reportDto.js'

const report = toReportViewModel(reportDto)
const system = (systemCode) => report.systems.find((item) => item.systemCode === systemCode)

describe('RecommendationCard', () => {
  it.each([
    ['SYS_ENDOCRINE', '睡眠健康', '松果体', '深蓝金色礼盒'],
    ['SYS_BONE', '钙流失健康', '骨质疏松', '墨绿金色礼盒'],
  ])('renders the %s recommendation completely', (id, title, issue, alt) => {
    const wrapper = mount(RecommendationCard, { props: { system: system(id) }, global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } })
    expect(wrapper.text()).toContain(title)
    expect(wrapper.text()).toContain(issue)
    expect(wrapper.get('img').attributes('alt')).toBe(alt)
    expect(wrapper.get('.issue-plan-visual').classes()).toContain('product-contain')
  })

  it('does not render when no recommendation exists', () => {
    expect(mount(RecommendationCard, { props: { system: system('SYS_CARDIO') }, global: { stubs: { RouterLink: true } } }).html()).toBe('<!--v-if-->')
  })

  it('opens AI consultation from the detail page and preserves the system as its return target', () => {
    const originalUrl = window.location.href
    window.history.replaceState({}, '', '/#/system/SYS_ENDOCRINE?reportId=R1&userId=1001')
    try {
      const wrapper = mount(RecommendationCard, {
        props: { system: system('SYS_ENDOCRINE'), variant: 'detail' },
        global: { stubs: { RouterLink: { props: ['to'], template: '<a :data-name="to.name" :data-report="to.query.reportId" :data-user="to.query.userId" :data-plan="to.query.planId" :data-indicator="to.query.indicatorCode" :data-return-system="to.query.returnSystem"><slot /></a>' } } },
      })
      const destination = wrapper.get('.detail-product-action')
      expect(destination.attributes('data-name')).toBe('ai-consult')
      expect(destination.attributes('data-report')).toBe('R1')
      expect(destination.attributes('data-user')).toBe('1001')
      expect(destination.attributes('data-plan')).toBe('1')
      expect(destination.attributes('data-indicator')).toBe('SYS_ENDOCRINE_PINEAL')
      expect(destination.attributes('data-return-system')).toBe('SYS_ENDOCRINE')
    } finally {
      window.history.replaceState({}, '', originalUrl)
    }
  })
})
