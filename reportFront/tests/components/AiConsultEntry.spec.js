import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AiConsultEntry from '@/components/AiConsultEntry.vue'
import { reportAssets } from '@/data/report.js'

describe('AiConsultEntry', () => {
  it('opens the local consultation design with an accessible label', () => {
    const wrapper = mount(AiConsultEntry, { props: { href: reportAssets.aiConsultImage, avatar: reportAssets.aiDoctorAvatar } })
    expect(wrapper.get('a').attributes('href')).toBe(reportAssets.aiConsultImage)
    expect(wrapper.get('a').attributes('aria-label')).toContain('AI 长寿咨询')
    expect(wrapper.get('img').attributes('alt')).toBe('AI 长寿顾问卡通医生头像')
  })
})
