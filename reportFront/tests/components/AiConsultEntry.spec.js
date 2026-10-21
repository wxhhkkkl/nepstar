import { mount, RouterLinkStub } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AiConsultEntry from '@/components/AiConsultEntry.vue'
import { reportAssets } from '@/data/report.js'

describe('AiConsultEntry', () => {
  afterEach(() => vi.useRealTimers())

  it('opens the consultation route with an accessible label', () => {
    const to = { name: 'ai-consult', query: { reportId: 'R1', userId: '1001' } }
    const wrapper = mount(AiConsultEntry, {
      props: { to, avatar: reportAssets.aiDoctorAvatar },
      global: { stubs: { RouterLink: RouterLinkStub } },
    })
    expect(wrapper.getComponent(RouterLinkStub).props('to')).toEqual(to)
    expect(wrapper.getComponent(RouterLinkStub).attributes('aria-label')).toContain('AI 长寿咨询')
    expect(wrapper.get('img').attributes('alt')).toBe('AI 长寿顾问卡通医生头像')
    expect(wrapper.find('small').exists()).toBe(false)
    wrapper.unmount()
  })

  it('collapses while scrolling, waits for a full idle second, and keeps navigation available', async () => {
    vi.useFakeTimers()
    const wrapper = mount(AiConsultEntry, {
      props: { to: { name: 'ai-consult' }, avatar: reportAssets.aiDoctorAvatar },
      global: { stubs: { RouterLink: RouterLinkStub } },
    })
    window.dispatchEvent(new Event('scroll'))
    await wrapper.vm.$nextTick()
    expect(wrapper.classes()).toContain('is-compact')
    await vi.advanceTimersByTimeAsync(900)
    window.dispatchEvent(new Event('scroll'))
    await vi.advanceTimersByTimeAsync(900)
    expect(wrapper.classes()).toContain('is-compact')
    await vi.advanceTimersByTimeAsync(100)
    expect(wrapper.classes()).not.toContain('is-compact')
    await wrapper.trigger('click')
    expect(wrapper.emitted('navigate')).toHaveLength(1)
    const schedule = vi.spyOn(window, 'setTimeout')
    const clear = vi.spyOn(window, 'clearTimeout')
    const remove = vi.spyOn(window, 'removeEventListener')
    window.dispatchEvent(new Event('scroll'))
    const timer = schedule.mock.results.at(-1).value
    wrapper.unmount()
    expect(clear).toHaveBeenCalledWith(timer)
    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function))
  })

  it('keeps the label expanded for keyboard focus', async () => {
    vi.useFakeTimers()
    const wrapper = mount(AiConsultEntry, {
      props: { to: { name: 'ai-consult' }, avatar: reportAssets.aiDoctorAvatar },
      global: { stubs: { RouterLink: RouterLinkStub } },
    })
    window.dispatchEvent(new Event('scroll'))
    await wrapper.trigger('focus')
    window.dispatchEvent(new Event('scroll'))
    await wrapper.vm.$nextTick()
    expect(wrapper.classes()).not.toContain('is-compact')
    await wrapper.trigger('blur')
    window.dispatchEvent(new Event('scroll'))
    await wrapper.vm.$nextTick()
    expect(wrapper.classes()).toContain('is-compact')
    wrapper.unmount()
  })
})
