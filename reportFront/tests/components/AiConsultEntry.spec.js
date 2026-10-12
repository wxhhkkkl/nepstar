import { mount, RouterLinkStub } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AiConsultEntry from '@/components/AiConsultEntry.vue'
import { reportAssets } from '@/data/report.js'

describe('AiConsultEntry', () => {
  it('opens the consultation route with an accessible label', () => {
    const to = { name: 'ai-consult', query: { reportId: 'R1', userId: '1001' } }
    const wrapper = mount(AiConsultEntry, {
      props: { to, avatar: reportAssets.aiDoctorAvatar },
      global: { stubs: { RouterLink: RouterLinkStub } },
    })
    expect(wrapper.getComponent(RouterLinkStub).props('to')).toEqual(to)
    expect(wrapper.getComponent(RouterLinkStub).attributes('aria-label')).toContain('AI 长寿咨询')
    expect(wrapper.get('img').attributes('alt')).toBe('AI 长寿顾问卡通医生头像')
  })
})
