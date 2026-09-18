import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ScoreOverview from '@/components/ScoreOverview.vue'
import { reportSnapshot } from '@/data/report.js'

describe('ScoreOverview', () => {
  it('renders the approved score and warning state with reduced motion', async () => {
    window.matchMedia = vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    const wrapper = mount(ScoreOverview, { props: { report: reportSnapshot } })
    await wrapper.vm.$nextTick()
    expect(wrapper.get('#scoreValue').text()).toBe('68')
    expect(wrapper.get('#scorePanel').classes()).toContain('is-warning-score')
    expect(wrapper.get('#scorePanel').attributes('aria-label')).toContain('68分')
  })
})
