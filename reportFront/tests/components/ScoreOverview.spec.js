import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ScoreOverview from '@/components/ScoreOverview.vue'
import { toReportViewModel } from '@/data/reportAdapter.js'
import { assets, reportDto } from '../fixtures/reportDto.js'

function reportWith(features) {
  const report = toReportViewModel(reportDto, { assets })
  return { ...report, features }
}

describe('ScoreOverview', () => {
  it('renders the approved score and warning state with reduced motion', async () => {
    window.matchMedia = vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    const wrapper = mount(ScoreOverview, { props: { report: toReportViewModel(reportDto, { assets }) } })
    await wrapper.vm.$nextTick()
    expect(wrapper.get('#scoreValue').text()).toBe('68')
    expect(wrapper.get('#scorePanel').classes()).toContain('is-warning-score')
    expect(wrapper.get('#scorePanel').attributes('aria-label')).toContain('68分')
  })

  it('shows the save button only when the interface turns it on', async () => {
    const off = mount(ScoreOverview, { props: { report: reportWith({ save_report_enabled: false }) } })
    expect(off.find('#saveReport').exists()).toBe(false)
    const on = mount(ScoreOverview, { props: { report: reportWith({ save_report_enabled: true }) } })
    expect(on.find('#saveReport').exists()).toBe(true)
  })
})
