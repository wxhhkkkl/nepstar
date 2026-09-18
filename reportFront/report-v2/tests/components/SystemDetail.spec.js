import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SystemDetail from '@/views/SystemDetail.vue'

const mountDetail = (systemId) => mount(SystemDetail, {
  props: { systemId },
  global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
})

describe('SystemDetail', () => {
  it.each(['cardio', 'lung', 'endocrine', 'bone', 'digest', 'female', 'immune'])('renders shared data for %s', (id) => {
    const wrapper = mountDetail(id)
    expect(wrapper.get('[data-system-id]').attributes('data-system-id')).toBe(id)
    expect(wrapper.findAll('.detail-indicator-list article').length).toBeGreaterThan(0)
    expect(wrapper.get('.detail-chart').attributes('data-chart-type')).toBeTruthy()
  })

  it('shows only the matching recommendations', () => {
    expect(mountDetail('endocrine').text()).toContain('睡眠健康')
    expect(mountDetail('endocrine').text()).not.toContain('钙流失健康')
    expect(mountDetail('bone').text()).toContain('钙流失健康')
    expect(mountDetail('cardio').find('.detail-product-recommendation').exists()).toBe(false)
  })

  it('renders direct measurements only when provided', () => {
    expect(mountDetail('cardio').find('#directBlock').exists()).toBe(true)
    expect(mountDetail('bone').find('#directBlock').exists()).toBe(false)
  })

  it('provides a recoverable unknown-system state', () => {
    const wrapper = mountDetail('unknown')
    expect(wrapper.text()).toContain('暂未找到该系统')
    expect(wrapper.find('.detail-back').exists()).toBe(true)
  })
})
