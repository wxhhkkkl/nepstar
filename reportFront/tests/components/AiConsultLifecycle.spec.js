import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import AiConsult from '@/views/AiConsult.vue'
import { bootstrapPayload } from '../fixtures/aiConsult.js'

vi.mock('@/api/aiConsultClient.js', async importOriginal => ({
  ...await importOriginal(),
  loadConsultBootstrap: vi.fn(), createConsultSession: vi.fn(),
  streamConsultQuestion: vi.fn(), endConsultSession: vi.fn(), loadConsultTurn: vi.fn(),
}))
vi.mock('@/api/reportClient.js', async importOriginal => ({
  ...await importOriginal(),
  reportParamsFromLocation: () => ({ reportCode: 'R1', customerId: 1001 }),
  reportRouteQueryFromLocation: () => ({ reportId: 'R1', userId: '1001' }),
}))
const api = await import('@/api/aiConsultClient.js')
const ID = '11111111-1111-4111-8111-111111111111'
const wrappers = []

async function conversation() {
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/', name: 'home', component: { template: '<p>报告首页</p>' } },
    { path: '/ai-consult', name: 'ai-consult', component: AiConsult },
    { path: '/system/:systemId', name: 'system-detail', component: { template: '<p>指标</p>' } },
    { path: '/system/:systemId/indicator/:indicatorCode', name: 'indicator-detail', component: { template: '<p>指标</p>' } },
  ] })
  await router.push('/ai-consult')
  const wrapper = mount(RouterView, { attachTo: document.body, global: { plugins: [router] } })
  wrappers.push(wrapper)
  await flushPromises()
  await wrapper.get('[data-testid="ai-question"]').trigger('click')
  await flushPromises()
  return { wrapper, router }
}

describe('consultation leave and idle lifecycle', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubGlobal('scrollTo', vi.fn())
    api.loadConsultBootstrap.mockResolvedValue({ ...structuredClone(bootstrapPayload), service_status: 'available' })
    api.createConsultSession.mockResolvedValue(ID)
    api.endConsultSession.mockResolvedValue({ id: ID, status: 'ended' })
    api.streamConsultQuestion.mockImplementation(async (_report, _customer, _session, _question, options) => {
      await options.onEvent('accepted', { turn_id: 1, generation_id: 1 })
      await options.onEvent('completed', { answer: 'Synthetic reviewed answer', remaining_today: 10 })
    })
  })
  afterEach(() => {
    for (const wrapper of wrappers.splice(0)) wrapper.unmount()
    document.body.innerHTML = ''
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('keeps a conversation active when return confirmation is cancelled', async () => {
    const { router } = await conversation()
    const navigation = router.push('/')
    await flushPromises()
    expect(document.querySelector('[role="dialog"]').textContent).toContain('结束本次咨询？')
    document.querySelector('[data-testid="ai-leave-cancel"]').click()
    await navigation
    expect(router.currentRoute.value.path).toBe('/ai-consult')
    expect(api.endConsultSession).not.toHaveBeenCalled()
  })

  it('ends the session before confirmed navigation and does not close twice on unmount', async () => {
    const { router } = await conversation()
    const navigation = router.push('/')
    await flushPromises()
    document.querySelector('[data-testid="ai-leave-confirm"]').click()
    await navigation
    await flushPromises()
    expect(api.endConsultSession).toHaveBeenCalledExactlyOnceWith('R1', 1001, ID, { keepalive: false })
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('counts idle time from the latest user message and starts a fresh conversation afterwards', async () => {
    vi.useFakeTimers()
    const { wrapper } = await conversation()
    await vi.advanceTimersByTimeAsync(9 * 60 * 1000)
    await wrapper.get('#aiQuestionInput').setValue('A new synthetic message')
    await wrapper.get('[data-testid="ai-composer"]').trigger('submit')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000 - 1)
    expect(api.endConsultSession).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    await flushPromises()
    expect(api.endConsultSession).toHaveBeenCalledTimes(1)
    expect(wrapper.get('[data-testid="ai-admission-status"]').text()).toContain('本次咨询已结束')
    expect(wrapper.get('[aria-label="发送问题"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-testid="ai-start-again"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="ai-conversation"]').exists()).toBe(false)
    await wrapper.get('[data-testid="ai-question"]').trigger('click')
    await flushPromises()
    expect(api.createConsultSession).toHaveBeenCalledTimes(2)
  })

  it('sends an authenticated keepalive ending on pagehide', async () => {
    await conversation()
    window.dispatchEvent(new Event('pagehide'))
    await flushPromises()
    expect(api.endConsultSession).toHaveBeenCalledExactlyOnceWith('R1', 1001, ID, { keepalive: true })
  })

  it('ends a session whose creation arrives after confirmed departure', async () => {
    let finishCreation
    api.createConsultSession.mockImplementationOnce(() => new Promise(resolve => { finishCreation = resolve }))
    const { router } = await conversation()
    const navigation = router.push('/')
    await flushPromises()
    document.querySelector('[data-testid="ai-leave-confirm"]').click()
    await navigation
    finishCreation(ID)
    await flushPromises()
    expect(api.endConsultSession).toHaveBeenCalledExactlyOnceWith('R1', 1001, ID, { keepalive: true })
    expect(api.streamConsultQuestion).not.toHaveBeenCalled()
  })

  it('ends a session whose creation arrives after the component is removed', async () => {
    let finishCreation
    api.createConsultSession.mockImplementationOnce(() => new Promise(resolve => { finishCreation = resolve }))
    const { wrapper } = await conversation()
    wrapper.unmount()
    finishCreation(ID)
    await flushPromises()
    expect(api.endConsultSession).toHaveBeenCalledExactlyOnceWith('R1', 1001, ID, { keepalive: true })
    expect(api.streamConsultQuestion).not.toHaveBeenCalled()
  })

  it('does not restore a late answer after the session is ended', async () => {
    let finishRecovery
    api.streamConsultQuestion.mockImplementationOnce(async (_report, _customer, _session, _question, options) => {
      await options.onEvent('accepted', { turn_id: 1, generation_id: 1 })
      throw new api.AiConsultApiError('network')
    })
    api.loadConsultTurn.mockImplementationOnce(() => new Promise(resolve => { finishRecovery = resolve }))
    const { wrapper } = await conversation()
    expect(api.loadConsultTurn).toHaveBeenCalled()
    window.dispatchEvent(new Event('pagehide'))
    await flushPromises()
    finishRecovery({ id: 1, status: 'completed', answer: 'A late answer', evidence: [{ id: 'ev1' }] })
    await flushPromises()
    expect(wrapper.text()).not.toContain('A late answer')
    expect(wrapper.get('[data-testid="ai-admission-status"]').text()).toContain('本次咨询已结束')
  })
})
