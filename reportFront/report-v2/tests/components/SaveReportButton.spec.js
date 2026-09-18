import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import SaveReportButton from '@/components/SaveReportButton.vue'

describe('SaveReportButton', () => {
  it('downloads the local long image and resets feedback', async () => {
    vi.useFakeTimers()
    const wrapper = mount(SaveReportButton, { props: { href: './长寿指数报告V2_手机长图.png' } })
    expect(wrapper.get('a').attributes('download')).toBeDefined()
    wrapper.get('a').element.addEventListener('click', (event) => event.preventDefault(), { once: true })
    await wrapper.get('a').trigger('click')
    expect(wrapper.text()).toContain('已保存')
    vi.advanceTimersByTime(1800)
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('保存报告')
    vi.useRealTimers()
  })
})
