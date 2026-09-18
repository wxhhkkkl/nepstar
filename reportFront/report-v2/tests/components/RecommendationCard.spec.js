import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import RecommendationCard from '@/components/RecommendationCard.vue'
import { reportSnapshot } from '@/data/report.js'

const system = (id) => reportSnapshot.systems.find((item) => item.id === id)

describe('RecommendationCard', () => {
  it.each([
    ['endocrine', '睡眠健康', '松果体', '深蓝金色睡眠健康管理礼盒'],
    ['bone', '钙流失健康', '骨质疏松', '墨绿金色钙流失健康管理礼盒'],
  ])('renders the %s recommendation completely', (id, title, issue, alt) => {
    const wrapper = mount(RecommendationCard, { props: { system: system(id) }, global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } })
    expect(wrapper.text()).toContain(title)
    expect(wrapper.text()).toContain(issue)
    expect(wrapper.get('img').attributes('alt')).toBe(alt)
    expect(wrapper.get('.issue-plan-visual').classes()).toContain('product-contain')
  })

  it('does not render when no recommendation exists', () => {
    expect(mount(RecommendationCard, { props: { system: system('cardio') }, global: { stubs: { RouterLink: true } } }).html()).toBe('<!--v-if-->')
  })
})
