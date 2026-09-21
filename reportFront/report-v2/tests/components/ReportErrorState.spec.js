import { mount, RouterLinkStub } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { ERROR_KINDS } from '@/api/reportClient.js'
import ReportErrorState from '@/components/ReportErrorState.vue'

function mountError(kind, props = {}) {
  return mount(ReportErrorState, {
    props: { kind, ...props },
    global: { stubs: { RouterLink: RouterLinkStub } },
  })
}

describe('ReportErrorState', () => {
  it('shows a complete, retryable network placeholder', () => {
    const wrapper = mountError(ERROR_KINDS.NETWORK)

    expect(wrapper.get('[data-testid="report-error"]').classes()).toContain('report-error-page')
    expect(wrapper.get('[role="alert"]').text()).toContain('网络连接失败')
    expect(wrapper.get('.report-error-art').attributes('aria-hidden')).toBe('true')
    expect(wrapper.get('.report-error-retry').text()).toBe('重新加载')
    expect(wrapper.text()).toContain('请检查网络后重试')
  })

  it('does not show network guidance for a missing report', () => {
    const wrapper = mountError(ERROR_KINDS.NOT_FOUND)

    expect(wrapper.text()).toContain('报告打不开')
    expect(wrapper.text()).not.toContain('网络已恢复')
    expect(wrapper.find('.report-error-retry').exists()).toBe(false)
  })

  it.each([
    [ERROR_KINDS.NOT_READY, '报告尚未生成完成', 'progress', '刷新状态'],
    [ERROR_KINDS.UNAVAILABLE, '报告服务暂时不可用', 'service', '重新加载'],
    [ERROR_KINDS.SYSTEM_NOT_FOUND, '该系统不属于此报告', 'missing', null],
    [ERROR_KINDS.INDICATOR_NOT_FOUND, '该指标不属于此报告', 'missing', null],
    [ERROR_KINDS.ROUTE_NOT_FOUND, '页面未找到', 'route', null],
  ])('renders the %s state with an appropriate illustration and action', (kind, title, visual, action) => {
    const wrapper = mountError(kind)

    expect(wrapper.get('#errorTitle').text()).toBe(title)
    expect(wrapper.get('.report-error-art').attributes('data-visual')).toBe(visual)
    expect(wrapper.find('.report-error-retry').exists()).toBe(Boolean(action))
    if (action) expect(wrapper.get('.report-error-retry').text()).toBe(action)
  })

  it('links an invalid indicator back to its parent system', () => {
    const backTo = { name: 'system-detail', params: { systemId: 'SYS_MALE' }, query: { reportId: 'R1', customerId: '1' } }
    const wrapper = mountError(ERROR_KINDS.INDICATOR_NOT_FOUND, { backTo, backLabel: '返回系统详情' })

    expect(wrapper.findComponent(RouterLinkStub).props('to')).toEqual(backTo)
    expect(wrapper.get('.report-error-retry').text()).toBe('返回系统详情')
  })

  it('keeps retry as the primary action and offers a secondary return when a service fails', () => {
    const backTo = { name: 'home', query: { reportId: 'R1', customerId: '1' } }
    const wrapper = mountError(ERROR_KINDS.UNAVAILABLE, { backTo, backLabel: '返回报告首页' })

    expect(wrapper.get('button.report-error-retry').text()).toBe('重新加载')
    expect(wrapper.findComponent(RouterLinkStub).props('to')).toEqual(backTo)
    expect(wrapper.get('.report-error-secondary').text()).toBe('返回报告首页')
  })
})
