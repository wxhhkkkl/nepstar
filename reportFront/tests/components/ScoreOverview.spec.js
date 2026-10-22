import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ScoreOverview from '@/components/ScoreOverview.vue'
import { toReportViewModel } from '@/data/reportAdapter.js'
import { assets, reportDto } from '../fixtures/reportDto.js'

function reportWith(features) {
  const report = toReportViewModel(reportDto, { assets })
  return { ...report, features }
}

describe('ScoreOverview', () => {
  beforeEach(() => {
    window.matchMedia = vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  })

  it.each([
    [98, 'excellent', '优秀'], [90, 'good', '良好'],
    [80, 'improve', '建议改善'], [70, 'attention', '重点关注'],
    [null, 'unknown', '暂无评分'],
  ])('shows the matching score status for %s instead of a fixed positive label', (score, key, label) => {
    const report = { ...reportWith({ save_report_enabled: false }), score }
    const wrapper = mount(ScoreOverview, { props: { report } })
    expect(wrapper.get('#scorePanel').attributes('data-score-level')).toBe(key)
    expect(wrapper.get('.score-core em').text()).toBe(label)
    if (score === null) expect(wrapper.get('#scoreValue').text()).toBe('—')
    wrapper.unmount()
  })

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
