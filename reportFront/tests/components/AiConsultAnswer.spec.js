import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AiConsultAnswer from '@/components/AiConsultAnswer.vue'

const evidence = [{ id: 'ev1', kind: 'report', label: '呼吸睡眠', report_date: '2026-07-29',
  route: '#/system/SYS_LUNG/indicator/SYS_LUNG_SLEEP_BREATHING?reportId=R1&customerId=1001' }]
const fact = '报告日期 2026-07-29：呼吸睡眠活力值 90 分。'
const render = (props = {}) => mount(AiConsultAnswer, {
  props: { answer: fact, evidence, reportCode: 'R1', customerId: 1001, ...props },
})

describe('AI consultation answer presentation', () => {
  it('renders server-appended cited report scores, including zero, as metric cards', () => {
    const wrapper = render()
    expect(wrapper.get('.ai-answer-metric > strong').text()).toBe('90')
    expect(wrapper.get('.ai-answer-metric > span').text()).toBe('呼吸睡眠')
    expect(wrapper.get('.ai-visually-hidden').text()).toBe(fact)
    expect(render({ answer: fact.replace('90', '0') }).get('.ai-answer-metric > strong').text()).toBe('0')
  })

  it.each([
    { evidence: [] },
    { evidence: [{ ...evidence[0], report_date: '2026-07-30' }] },
    { evidence: [{ ...evidence[0], label: '肺活量' }] },
    { evidence: [{ ...evidence[0], route: evidence[0].route.replace('reportId=R1', 'reportId=R2') }] },
    { answer: fact.replace('90', '101') },
    { answer: '用户说呼吸睡眠 90 分，但尚未核对。' },
  ])('keeps uncited or unrecognized score text unchanged (%j)', props => {
    const wrapper = render(props)
    expect(wrapper.find('[data-testid="ai-answer-metrics"]').exists()).toBe(false)
    expect(wrapper.text()).toBe(props.answer || fact)
  })

  it('shows stream text progressively without prematurely converting partial facts', () => {
    const wrapper = render({ streaming: true })
    expect(wrapper.classes()).toContain('ai-answer-text--streaming')
    expect(wrapper.find('[data-testid="ai-answer-metrics"]').exists()).toBe(false)
    expect(wrapper.text()).toBe(fact)
  })

  it('formats headings and action lists as escaped text, never executable HTML', () => {
    const wrapper = render({ answer: '# 日常健康管理\n1. 保持规律作息。\n2. <img src=x onerror=alert(1)>', evidence: [] })
    expect(wrapper.get('h2').text()).toBe('日常健康管理')
    expect(wrapper.findAll('li')).toHaveLength(2)
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('<img src=x onerror=alert(1)>')
  })
})
