import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AiConsultEntry from '@/components/AiConsultEntry.vue'

describe('AiConsultEntry', () => {
  it('opens the local consultation design with an accessible label', () => {
    const wrapper = mount(AiConsultEntry, { props: { href: './AI长寿咨询聊天页设计稿.png', avatar: './AI长寿咨询-卡通医生形象.png' } })
    expect(wrapper.get('a').attributes('href')).toContain('AI长寿咨询聊天页设计稿.png')
    expect(wrapper.get('a').attributes('aria-label')).toContain('AI 长寿咨询')
    expect(wrapper.get('img').attributes('alt')).toBe('AI 长寿顾问卡通医生头像')
  })
})
