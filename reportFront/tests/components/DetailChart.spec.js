import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DetailChart from '@/components/DetailChart.vue'

describe('chart score and missing-value semantics', () => {
  it.each([[null, '—'], [0, '0']])('keeps summary score %s distinct from its indicator average', (score, text) => {
    const wrapper = mount(DetailChart, { props: { system: {
      id: 'male', name: '男性功能', score,
      visualization: { type: 'radial-orbit', value: score, series: [90, 80], categories: ['甲', '乙'], unit: '活力值' },
    } } })
    expect(wrapper.get('.detail-radar .score-value').text()).toBe(text)
  })

  it('does not count missing network indicators as zero when displaying the average', () => {
    const wrapper = mount(DetailChart, { props: { system: {
      id: 'immune', name: '免疫力', score: 85,
      visualization: { type: 'network', series: [90, null, 80], categories: ['甲', '乙', '丙'] },
    } } })
    expect(wrapper.get('.network-score').text()).toBe('85')
    expect(wrapper.findAll('.detail-network-item strong').map(node => node.text())).toEqual(['90', '—', '80'])
  })
})
