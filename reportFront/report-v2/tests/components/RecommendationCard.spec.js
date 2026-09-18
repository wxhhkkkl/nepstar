import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import RecommendationCard from '@/components/RecommendationCard.vue'
import { toReportViewModel } from '@/data/reportAdapter.js'
import { reportDto } from '../fixtures/reportDto.js'

const report = toReportViewModel(reportDto)
const system = (id) => report.systems.find((item) => item.id === id)

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
})
