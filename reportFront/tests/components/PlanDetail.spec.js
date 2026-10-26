import { it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import PlanDetail from '@/views/PlanDetail.vue'
import { planDetail } from '../fixtures/planDetail.js'
import { fetchPlanDetail } from '@/api/reportClient.js'
import { createPlanNavigation, consumeSourceReading } from '@/utils/planNavigation.js'

vi.mock('@/api/reportClient.js', async original => ({ ...await original(), fetchPlanDetail: vi.fn() }))
beforeEach(() => { vi.stubGlobal('scrollTo', vi.fn()); fetchPlanDetail.mockReset(); fetchPlanDetail.mockResolvedValue(structuredClone(planDetail)) })

async function page(path = '/plans/17?reportId=R1&userId=1001&indicatorCode=SYS_ENDOCRINE_PINEAL') {
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/', name: 'home', component: { template: '<div />' } },
    { path: '/plans/:planId', name: 'plan-detail', component: PlanDetail },
    { path: '/system/:systemId/indicator/:indicatorCode', name: 'indicator-detail', component: { template: '<div />' } },
    { path: '/ai-consult', name: 'ai-consult', component: { template: '<div />' } },
  ] })
  await router.push(path)
  const wrapper = mount(RouterView, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}
it('reads a direct link, keeps the full title and real score without diagnosis', async () => {
  const { wrapper } = await page()
  expect(fetchPlanDetail).toHaveBeenCalledWith('R1', 17, 1001, 'SYS_ENDOCRINE_PINEAL')
  expect(wrapper.get('h1').text()).toBe(planDetail.plan.name)
  expect(wrapper.text()).toContain('98')
  expect(wrapper.text()).not.toContain('异常')
  expect(wrapper.findAll('[aria-expanded]').length).toBe(0)
  wrapper.unmount()
})
it('does not fetch a default report when identity is missing', async () => {
  fetchPlanDetail.mockClear()
  const { wrapper } = await page('/plans/17')
  expect(fetchPlanDetail).not.toHaveBeenCalled()
  expect(wrapper.text()).toContain('报告')
  wrapper.unmount()
})
it('ignores a mismatched or late response', async () => {
  fetchPlanDetail.mockResolvedValue({ ...planDetail, report_code: 'other' })
  const { wrapper } = await page()
  expect(wrapper.find('h1').text()).not.toBe(planDetail.plan.name)
  wrapper.unmount()
})

it('uses one indicator target for both actions and opens AI without submitting a question', async () => {
  const { wrapper, router } = await page()
  const navigate = vi.spyOn(router, 'push').mockResolvedValue(undefined)
  await wrapper.get('.plan-indicator-shortcut').trigger('click')
  await flushPromises()
  await wrapper.get('.plan-secondary').trigger('click')
  await flushPromises()
  expect(navigate).toHaveBeenCalledTimes(2)
  expect(navigate.mock.calls[0][0]).toEqual(navigate.mock.calls[1][0])
  expect(navigate.mock.calls[0][0].params.indicatorCode).toBe('SYS_ENDOCRINE_PINEAL')
  await wrapper.get('.plan-primary').trigger('click')
  await flushPromises()
  expect(navigate.mock.calls[2][0]).toMatchObject({ name: 'ai-consult', query: { fromPlan: '1', reportId: 'R1', userId: '1001', planId: '17', indicatorCode: 'SYS_ENDOCRINE_PINEAL' } })
  expect(fetchPlanDetail).toHaveBeenCalledTimes(1)
  wrapper.unmount()
})

it('keeps plan content readable and disables AI during maintenance', async () => {
  fetchPlanDetail.mockResolvedValue({ ...planDetail, consult: { status: 'maintenance', message: '服务维护中' } })
  const { wrapper } = await page()
  expect(wrapper.get('.plan-primary').attributes('disabled')).toBeDefined()
  expect(wrapper.text()).toContain('服务维护中')
  expect(wrapper.get('h1').text()).toBe(planDetail.plan.name)
  wrapper.unmount()
})

it('restores an AI list even when that source itself was opened from an older plan', async () => {
  const base = { reportId: 'R1', userId: '1001' }
  const olderKey = createPlanNavigation({ ...base, planId: '8', indicatorCode: 'SYS_BONE_OSTEO' }, { name: 'home', query: base })
  const aiQuery = { ...base, fromPlan: '1', planId: '8', indicatorCode: 'SYS_BONE_OSTEO', planNavKey: olderKey }
  const currentKey = createPlanNavigation({ ...base, planId: '17', indicatorCode: 'SYS_ENDOCRINE_PINEAL' },
    { name: 'ai-consult', query: aiQuery }, { scrollY: 320, plansExpanded: true })
  const { wrapper, router } = await page(`/plans/17?reportId=R1&userId=1001&indicatorCode=SYS_ENDOCRINE_PINEAL&planNavKey=${currentKey}`)
  await router.push({ name: 'ai-consult', query: aiQuery })
  expect(consumeSourceReading(aiQuery, 'ai-consult')).toMatchObject({ plansExpanded: true, scrollY: 320 })
  wrapper.unmount()
})
