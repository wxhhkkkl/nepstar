import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AiConsult from '@/views/AiConsult.vue'
import { bootstrapPayload } from '../fixtures/aiConsult.js'

vi.mock('@/api/aiConsultClient.js', () => ({
  loadConsultBootstrap: vi.fn(),
  listConsultSessions: vi.fn(),
  loadConsultSession: vi.fn(),
  loadConsultTurn: vi.fn(),
  createConsultSession: vi.fn(),
  endConsultSession: vi.fn(),
  grantConsultConsent: vi.fn(),
  deleteConsultSession: vi.fn(),
  ensureConsultSession: vi.fn(),
  loadStoredConsultSession: vi.fn(),
  streamConsultQuestion: vi.fn(),
  streamConsultRetry: vi.fn(),
  stopConsultGeneration: vi.fn(),
  submitConsultFeedback: vi.fn(),
  AiConsultApiError: class AiConsultApiError extends Error {
    constructor(kind, status = 0, detail = '', retryAfterSeconds = null) {
      super(kind)
      this.kind = kind
      this.status = status
      this.detail = detail
      this.retryAfterSeconds = retryAfterSeconds
    }
  },
}))
vi.mock('@/api/reportClient.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    reportParamsFromLocation: vi.fn(),
    reportRouteQueryFromLocation: vi.fn(),
  }
})

const client = await import('@/api/aiConsultClient.js')
const { reportParamsFromLocation, reportRouteQueryFromLocation } = await import('@/api/reportClient.js')
const SESSION_ID = '11111111-1111-4111-8111-111111111111'
const mountedConversations = []

function mountConversation() {
  const wrapper = mount(AiConsult, { global: { stubs: { RouterLink: RouterLinkStub } } })
  mountedConversations.push(wrapper)
  return wrapper
}

function available() {
  return { ...structuredClone(bootstrapPayload), service_status: 'available' }
}

describe('AI consultation conversation candidate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('scrollTo', vi.fn())
    reportParamsFromLocation.mockReturnValue({ reportCode: 'R1', customerId: 1001 })
    reportRouteQueryFromLocation.mockReturnValue({ reportId: 'R1', userId: '1001' })
    client.loadConsultBootstrap.mockResolvedValue(available())
    client.createConsultSession.mockResolvedValue(SESSION_ID)
    client.endConsultSession.mockResolvedValue({ id: SESSION_ID, status: 'ended' })
    client.loadStoredConsultSession.mockResolvedValue(null)
    client.listConsultSessions.mockResolvedValue({ sessions: [], nextCursor: null })
    client.loadConsultTurn.mockRejectedValue(new client.AiConsultApiError('network'))
  })
  afterEach(async () => {
    for (const wrapper of mountedConversations.splice(0)) wrapper.unmount()
    await flushPromises()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it.each(['disabled', 'consult.disabled'])('keeps the conversation but blocks send and retry after an emergency pause (%s)', async kind => {
    client.streamConsultQuestion.mockRejectedValueOnce(new client.AiConsultApiError(kind, 503))
    const wrapper = mountConversation()
    await flushPromises()
    await wrapper.get('[data-testid="ai-question"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="ai-admission-status"]').text()).toContain('AI 咨询服务已暂停')
    expect(wrapper.get('[aria-label="发送问题"]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('当前对话仍可阅读')
    await wrapper.get('#aiQuestionInput').setValue('稍后再问的问题')
    await wrapper.get('[data-testid="ai-composer"]').trigger('submit')
    expect(client.streamConsultQuestion).toHaveBeenCalledTimes(1)
    expect(wrapper.findAll('.ai-user-question')).toHaveLength(1)
    wrapper.unmount()
  })

  it('blocks all new questions when bootstrap reports zero remaining answers', async () => {
    client.loadConsultBootstrap.mockResolvedValueOnce({ ...available(), remaining_today: 0 })
    const wrapper = mountConversation()
    await flushPromises()
    await wrapper.get('#aiQuestionInput').setValue('我还可以咨询吗？')
    expect(wrapper.get('[data-testid="ai-question"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[aria-label="发送问题"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="ai-admission-status"]').text()).toContain('今天的咨询次数已用完')
    await wrapper.get('[data-testid="ai-composer"]').trigger('submit')
    expect(client.createConsultSession).not.toHaveBeenCalled()
    expect(client.streamConsultQuestion).not.toHaveBeenCalled()
    expect(wrapper.get('#aiQuestionInput').element.value).toBe('我还可以咨询吗？')
    wrapper.unmount()
  })

  it.each(['daily_limit', 'global_budget_exhausted'])('stops duplicate submissions after %s', async (kind) => {
    client.loadConsultBootstrap.mockResolvedValueOnce({ ...available(), remaining_today: 2 })
    client.streamConsultQuestion.mockRejectedValueOnce(new client.AiConsultApiError(kind, 429))
    const wrapper = mountConversation()
    await flushPromises()
    await wrapper.get('[data-testid="ai-question"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="ai-admission-status"]').text()).toContain('已用完')
    if (kind === 'daily_limit') expect(wrapper.get('[data-testid="ai-quota-note"]').text()).toContain('0')
    await wrapper.get('#aiQuestionInput').setValue('保留这条新问题')
    await wrapper.get('[data-testid="ai-composer"]').trigger('submit')
    await flushPromises()
    expect(client.streamConsultQuestion).toHaveBeenCalledTimes(1)
    expect(wrapper.findAll('.ai-user-question')).toHaveLength(1)
    expect(wrapper.get('#aiQuestionInput').element.value).toBe('保留这条新问题')
    wrapper.unmount()
  })

  it.each(['rate_limited', 'capacity_busy'])('waits for server Retry-After before resending %s with the original key', async (kind) => {
    vi.useFakeTimers()
    client.streamConsultQuestion.mockRejectedValueOnce(new client.AiConsultApiError(kind, 429, '', 2))
      .mockResolvedValueOnce(undefined)
    const wrapper = mountConversation()
    await flushPromises()
    await wrapper.get('[data-testid="ai-question"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="ai-admission-status"]').text()).toContain('2 秒')
    expect(wrapper.get('[data-testid="ai-resend-question"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-testid="ai-resend-question"]').trigger('click')
    expect(client.streamConsultQuestion).toHaveBeenCalledTimes(1)
    const firstKey = client.streamConsultQuestion.mock.calls[0][4].requestId
    await vi.advanceTimersByTimeAsync(2000)
    expect(wrapper.get('[data-testid="ai-resend-question"]').attributes('disabled')).toBeUndefined()
    await wrapper.get('[data-testid="ai-resend-question"]').trigger('click')
    await flushPromises()
    expect(client.streamConsultQuestion).toHaveBeenCalledTimes(2)
    expect(client.streamConsultQuestion.mock.calls[1][4].requestId).toBe(firstKey)
    expect(wrapper.findAll('.ai-user-question')).toHaveLength(1)
    wrapper.unmount()
  })

  it('updates remaining answers after a successful retry and blocks new questions at zero', async () => {
    client.loadConsultBootstrap.mockResolvedValueOnce({ ...available(), remaining_today: 1 })
    client.streamConsultQuestion.mockImplementationOnce(async (_r, _c, _s, _q, options) => {
      options.onEvent('accepted', { turn_id: 7, generation_id: 8 })
      throw new client.AiConsultApiError('consult.failed')
    })
    client.streamConsultRetry.mockImplementationOnce(async (_r, _c, _s, _t, _g, options) => {
      options.onEvent('accepted', { turn_id: 7, generation_id: 9 })
      options.onEvent('completed', { answer: '重试完成', remaining_today: 0 })
    })
    const wrapper = mountConversation()
    await flushPromises()
    await wrapper.get('[data-testid="ai-question"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="ai-retry"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="ai-quota-note"]').text()).toContain('0')
    expect(wrapper.get('[data-testid="ai-admission-status"]').text()).toContain('已用完')
    expect(wrapper.findAll('.ai-user-question')).toHaveLength(1)
    wrapper.unmount()
  })

  it('uses the configured question limit and prevents oversized prompts from creating a session', async () => {
    client.loadConsultBootstrap.mockResolvedValueOnce({ ...available(), max_question_chars: 20 })
    const wrapper = mountConversation()
    await flushPromises()
    expect(wrapper.get('#aiQuestionInput').attributes('maxlength')).toBe('20')
    await wrapper.get('#aiQuestionInput').setValue('问'.repeat(21))
    await wrapper.get('[data-testid="ai-composer"]').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('每次最多可输入 20 字')
    expect(client.createConsultSession).not.toHaveBeenCalled()
    expect(client.streamConsultQuestion).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('allows long questions without an HTML cap or exhausted allowance when limits are unlimited', async () => {
    client.loadConsultBootstrap.mockResolvedValueOnce({ ...available(), max_question_chars: 0, remaining_today: null })
    client.streamConsultQuestion.mockResolvedValueOnce(undefined)
    const wrapper = mountConversation()
    await flushPromises()
    expect(wrapper.get('#aiQuestionInput').attributes('maxlength')).toBeUndefined()
    const question = '问'.repeat(600)
    await wrapper.get('#aiQuestionInput').setValue(question)
    expect(wrapper.get('.ai-composer-note small').text()).toBe('600')
    await wrapper.get('[data-testid="ai-composer"]').trigger('submit')
    await flushPromises()
    expect(client.createConsultSession).toHaveBeenCalledTimes(1)
    expect(client.streamConsultQuestion).toHaveBeenCalledWith(
      'R1', 1001, SESSION_ID, question, expect.any(Object),
    )
    expect(wrapper.text()).not.toContain('每次最多可输入')
    wrapper.unmount()
  })

  it('prefills a verified plan question without creating a session or sending it', async () => {
    reportRouteQueryFromLocation.mockReturnValue({
      reportId: 'R1', userId: '1001', planId: '17', indicatorCode: 'SYS_LUNG_SLEEP',
      returnSystem: 'SYS_LUNG',
    })
    client.loadConsultBootstrap.mockResolvedValueOnce({
      ...available(),
      entry_context: {
        type: 'plan', plan_id: 17, plan_name: '睡眠健康管理方案',
        system_code: 'SYS_LUNG', indicator_code: 'SYS_LUNG_SLEEP',
        indicator_name: '呼吸睡眠', indicator_score: 79, trigger_score_below: 80,
      },
    })
    const wrapper = mountConversation()
    await flushPromises()
    expect(client.loadConsultBootstrap).toHaveBeenCalledWith('R1', 1001, {
      planId: 17, indicatorCode: 'SYS_LUNG_SLEEP',
    })
    expect(wrapper.get('[data-testid="ai-entry-context"]').text()).toContain('睡眠健康管理方案')
    expect(wrapper.get('#aiQuestionInput').element.value).toBe('为什么会为我推荐「睡眠健康管理方案」？')
    expect(client.createConsultSession).not.toHaveBeenCalled()
    expect(client.ensureConsultSession).not.toHaveBeenCalled()
    expect(client.streamConsultQuestion).not.toHaveBeenCalled()
  })

  it('starts blank and never fetches recent or previous sessions', async () => {
    reportRouteQueryFromLocation.mockReturnValue({
      reportId: 'R1', userId: '1001', planId: '17', indicatorCode: 'SYS_LUNG_SLEEP',
    })
    client.loadConsultBootstrap.mockResolvedValue({
      ...available(),
      entry_context: {
        type: 'plan', plan_id: 17, plan_name: '睡眠健康管理方案',
        indicator_code: 'SYS_LUNG_SLEEP', indicator_name: '呼吸睡眠',
        indicator_score: 79, trigger_score_below: 80,
      },
    })
    client.loadStoredConsultSession.mockResolvedValueOnce({
      id: SESSION_ID, source: 'plan', source_plan_id: 17,
      source_indicator_code: 'SYS_LUNG_SLEEP',
      turns: [{ id: 2, question: '方案旧问题', status: 'completed', answer: '方案旧回答', evidence: [] }],
    })
    client.listConsultSessions.mockResolvedValueOnce({
      sessions: [{ id: SESSION_ID, report_code: 'R1', title: '最近咨询' }], nextCursor: null,
    })
    const wrapper = mountConversation()
    await flushPromises()
    expect(client.loadStoredConsultSession).not.toHaveBeenCalled()
    expect(client.listConsultSessions).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="ai-conversation"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="ai-sessions"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('方案旧回答')
  })

  it('creates a new report-bound session on every consultation entry', async () => {
    const nextSession = '22222222-2222-4222-8222-222222222222'
    client.createConsultSession.mockResolvedValueOnce(SESSION_ID).mockResolvedValueOnce(nextSession)
    let answerNumber = 0
    client.streamConsultQuestion.mockImplementation(async (_report, _customer, _session, _question, options) => {
      answerNumber += 1
      options.onEvent('accepted', { turn_id: answerNumber, generation_id: answerNumber })
      options.onEvent('completed', { answer: `第${answerNumber}次咨询回答` })
    })

    const first = mountConversation()
    await flushPromises()
    await first.get('[data-testid="ai-question"]').trigger('click')
    await flushPromises()
    expect(first.get('[data-testid="ai-conversation"]').text()).toContain('第1次咨询回答')
    first.unmount()

    const second = mountConversation()
    await flushPromises()
    expect(second.find('[data-testid="ai-conversation"]').exists()).toBe(false)
    expect(second.text()).not.toContain('第1次咨询回答')
    await second.get('[data-testid="ai-question"]').trigger('click')
    await flushPromises()
    expect(client.createConsultSession).toHaveBeenNthCalledWith(2, 'R1', 1001, null)
    expect(client.streamConsultQuestion).toHaveBeenNthCalledWith(
      2, 'R1', 1001, nextSession, bootstrapPayload.suggested_questions[0], expect.any(Object),
    )
    expect(second.get('[data-testid="ai-conversation"]').text()).toContain('第2次咨询回答')
    second.unmount()
  })

  it('enables questions without requiring the removed consent fields or endpoint', async () => {
    const payload = available()
    delete payload.notice
    delete payload.consent_status
    client.loadConsultBootstrap.mockResolvedValueOnce(payload)
    const wrapper = mountConversation()
    await flushPromises()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(client.grantConsultConsent).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="ai-composer"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="ai-question"]').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('blocks subsequent questions after an explicit processing withdrawal', async () => {
    client.createConsultSession.mockRejectedValueOnce(new client.AiConsultApiError('processing_withdrawn', 403))
    const wrapper = mountConversation()
    await flushPromises()
    await wrapper.get('#aiQuestionInput').setValue('呼吸睡眠怎么样？')
    await wrapper.get('[data-testid="ai-composer"]').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('当前咨询已停止使用报告数据')
    expect(wrapper.get('[aria-label="发送问题"]').attributes('disabled')).toBeDefined()
    expect(client.streamConsultQuestion).not.toHaveBeenCalled()
    expect(client.grantConsultConsent).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('shows a completed answer and expandable same-report citations', async () => {
    client.streamConsultQuestion.mockImplementation(async (_report, _customer, _session, _question, options) => {
      options.onEvent('accepted', { turn_id: 7 })
      options.onEvent('delta', { text: '这项指标本次结果可以结合报告理解。' })
      options.onEvent('evidence', { items: [{
        id: 'ev1', kind: 'report', label: '呼吸睡眠', report_date: '2026-07-29',
        route: '#/system/SYS_LUNG/indicator/SYS_LUNG_SLEEP_BREATHING?reportId=R1&customerId=1001',
        follow_up_questions: ['你每晚是否容易醒来？', '白天会感到疲惫吗？'],
      }] })
      options.onEvent('completed', { answer: '这项指标本次结果可以结合报告理解。' })
      return { answer: '这项指标本次结果可以结合报告理解。' }
    })
    const wrapper = mountConversation()
    await flushPromises()
    await wrapper.get('[data-testid="ai-question"]').trigger('click')
    await flushPromises()
    expect(client.createConsultSession).toHaveBeenCalledWith('R1', 1001, null)
    expect(client.streamConsultQuestion).toHaveBeenCalledWith(
      'R1', 1001, SESSION_ID, bootstrapPayload.suggested_questions[0], expect.any(Object),
    )
    expect(wrapper.get('[data-testid="ai-conversation"]').text()).toContain('这项指标本次结果')
    expect(wrapper.get('[data-testid="ai-evidence"]').text()).toContain('呼吸睡眠')
    expect(wrapper.get('[data-testid="ai-feedback"]').text()).toContain('这条回答有帮助吗')
    expect(wrapper.get('.ai-followup-prompts').text()).toContain('你每晚是否容易醒来？')
    const link = wrapper.findAllComponents(RouterLinkStub).find((node) => node.text() === '查看详情')
    expect(link).toBeTruthy()
  })

  it('restores model follow-ups, hides old prompts, and filters questions already asked', async () => {
    client.streamConsultQuestion.mockImplementation(async (_report, _customer, _session, question, options) => {
      options.onEvent('accepted', { turn_id: 1, generation_id: 1 })
      options.onEvent('evidence', { items: [{
        id: 'ev1', kind: 'report', label: '呼吸睡眠',
        follow_up_questions: ['你每晚是否容易醒来？', '睡前作息规律吗？'],
      }] })
      options.onEvent('completed', { answer: `已回答：${question}` })
    })
    const wrapper = mountConversation()
    await flushPromises()
    await wrapper.get('#aiQuestionInput').setValue('你每晚是否容易醒来？')
    await wrapper.get('[data-testid="ai-composer"]').trigger('submit')
    await flushPromises()
    const prompts = wrapper.findAll('.ai-followup-prompts button')
    expect(prompts).toHaveLength(1)
    expect(prompts[0].text()).toBe('睡前作息规律吗？')
    expect(wrapper.findAll('.ai-followup-prompts')).toHaveLength(1)
  })

  it('sends a current-session follow-up once and does not offer it again after completion', async () => {
    const askedPrompt = '你每晚是否容易醒来？'
    const route = '#/system/SYS_LUNG/indicator/SYS_LUNG_SLEEP_BREATHING?reportId=R1&customerId=1001'
    let call = 0
    client.streamConsultQuestion.mockImplementation(async (_report, _customer, _session, _question, options) => {
      call += 1
      options.onEvent('accepted', { turn_id: call, generation_id: call })
      options.onEvent('evidence', { items: [{
        id: 'ev2', kind: 'report', label: '呼吸睡眠', route,
        follow_up_questions: [askedPrompt, '白天会感到疲惫吗？'],
      }] })
      options.onEvent('completed', { answer: call === 1 ? '这项指标需要关注。' : '可以继续结合你补充的作息了解。' })
    })

    const wrapper = mountConversation()
    await flushPromises()
    await wrapper.get('[data-testid="ai-question"]').trigger('click')
    await flushPromises()
    const prompt = wrapper.findAll('[data-testid="ai-followup-prompt"]')
      .find((button) => button.text() === askedPrompt)
    expect(prompt).toBeDefined()
    await prompt.trigger('click')
    await flushPromises()

    expect(client.streamConsultQuestion).toHaveBeenCalledWith(
      'R1', 1001, SESSION_ID, askedPrompt, expect.any(Object),
    )
    const remainingPrompts = wrapper.findAll('[data-testid="ai-followup-prompt"]')
    expect(remainingPrompts).toHaveLength(1)
    expect(remainingPrompts[0].text()).toBe('白天会感到疲惫吗？')
    expect(wrapper.get('[data-testid="ai-conversation"]').text()).toContain(askedPrompt)
  })

  it('renders backend-maintained actions only in the current consultation entry', async () => {
    const action = {
      id: 'action1', kind: 'maintained', source_type: 'action',
      label: '呼吸睡眠 · 行动建议', report_date: null, text: '保持规律作息',
      route: '#/system/SYS_LUNG/indicator/SYS_LUNG_SLEEP_BREATHING?reportId=R1&customerId=1001',
    }
    const evidence = [
      { id: 'ev1', kind: 'report', label: '呼吸睡眠', report_date: '2026-07-29',
        route: '#/system/SYS_LUNG/indicator/SYS_LUNG_SLEEP_BREATHING?reportId=R1&customerId=1001' },
      action,
    ]
    client.streamConsultQuestion.mockImplementation(async (_report, _customer, _session, _question, options) => {
      options.onEvent('accepted', { turn_id: 7, generation_id: 8 })
      options.onEvent('evidence', { items: evidence })
      options.onEvent('completed', { answer: '这项指标可结合报告结果理解。' })
    })

    const live = mountConversation()
    await flushPromises()
    await live.get('[data-testid="ai-question"]').trigger('click')
    await flushPromises()
    expect(live.get('[data-testid="ai-maintained-actions"]').text()).toContain('保持规律作息')
    expect(live.get('[data-testid="ai-maintained-actions"]').text()).toContain('来自指标后台维护')
    expect(live.get('[data-testid="ai-evidence"]').text()).toContain('后台维护行动建议')
    live.unmount()

    const nextEntry = mountConversation()
    await flushPromises()
    expect(nextEntry.find('[data-testid="ai-conversation"]').exists()).toBe(false)
    expect(nextEntry.text()).not.toContain('保持规律作息')
    expect(client.loadConsultTurn).not.toHaveBeenCalled()
  })

  it('keeps the reading position when a reply arrives above the page bottom', async () => {
    let emit
    let finish
    client.streamConsultQuestion.mockImplementation((_report, _customer, _session, _question, options) => new Promise((resolve) => {
      emit = options.onEvent
      finish = resolve
    }))
    const originalHeight = Object.getOwnPropertyDescriptor(document.documentElement, 'scrollHeight')
    const originalY = Object.getOwnPropertyDescriptor(window, 'scrollY')
    const originalViewport = Object.getOwnPropertyDescriptor(window, 'innerHeight')
    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 2000 })
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 100 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 })
    try {
      const wrapper = mountConversation()
      await flushPromises()
      await wrapper.get('[data-testid="ai-question"]').trigger('click')
      await flushPromises()
      const priorScrolls = window.scrollTo.mock.calls.length
      window.dispatchEvent(new Event('scroll'))
      emit('accepted', { turn_id: 7, generation_id: 8 })
      emit('completed', { answer: '服务端确认的新回答' })
      await flushPromises()
      expect(window.scrollTo).toHaveBeenCalledTimes(priorScrolls)
      expect(wrapper.get('[data-testid="ai-new-reply"]').text()).toContain('查看最新')
      await wrapper.get('[data-testid="ai-new-reply"]').trigger('click')
      await flushPromises()
      expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 2000, left: 0, behavior: 'auto' })
      expect(wrapper.find('[data-testid="ai-new-reply"]').exists()).toBe(false)
      finish()
      await flushPromises()
      wrapper.unmount()
    } finally {
      if (originalHeight) Object.defineProperty(document.documentElement, 'scrollHeight', originalHeight)
      else delete document.documentElement.scrollHeight
      if (originalY) Object.defineProperty(window, 'scrollY', originalY)
      else delete window.scrollY
      if (originalViewport) Object.defineProperty(window, 'innerHeight', originalViewport)
      else delete window.innerHeight
    }
  })

  it('keeps a failed answer visibly incomplete with no stale evidence', async () => {
    client.streamConsultQuestion.mockRejectedValue(new client.AiConsultApiError('consult.unsafe_answer'))
    const wrapper = mountConversation()
    await flushPromises()
    await wrapper.get('[data-testid="ai-question"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="ai-conversation"]').text()).toContain('本次回答未完成')
    expect(wrapper.find('[data-testid="ai-evidence"]').exists()).toBe(false)
    expect(wrapper.get('[role="alert"]').text()).toContain('本次回答未完成')
  })

  it('retries a pre-accepted network failure in place with the same idempotency key', async () => {
    const requestIds = []
    client.streamConsultQuestion
      .mockImplementationOnce(async (_report, _customer, _session, _question, options) => {
        requestIds.push(options.requestId)
        throw new client.AiConsultApiError('network')
      })
      .mockImplementationOnce(async (_report, _customer, _session, _question, options) => {
        requestIds.push(options.requestId)
        options.onEvent('accepted', { turn_id: 7, generation_id: 8 })
        options.onEvent('completed', { answer: '重试后恢复的回答' })
      })
    const wrapper = mountConversation()
    await flushPromises()
    const question = bootstrapPayload.suggested_questions[0]
    await wrapper.get('[data-testid="ai-question"]').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('.ai-user-question')).toHaveLength(1)
    expect(wrapper.get('.ai-user-question').text()).toBe(question)
    expect(wrapper.get('[data-testid="ai-resend-question"]').text()).toBe('重试发送原问题')
    await wrapper.get('[data-testid="ai-resend-question"]').trigger('click')
    await flushPromises()

    expect(requestIds).toHaveLength(2)
    expect(requestIds[1]).toBe(requestIds[0])
    expect(wrapper.findAll('.ai-user-question')).toHaveLength(1)
    expect(wrapper.get('[data-testid="ai-conversation"]').text()).toContain('重试后恢复的回答')
    expect(wrapper.find('[data-testid="ai-resend-question"]').exists()).toBe(false)
  })

  it('checks status when an idempotent resend replays a server turn that is still running', async () => {
    client.streamConsultQuestion
      .mockRejectedValueOnce(new client.AiConsultApiError('network'))
      .mockImplementationOnce(async (_report, _customer, _session, _question, options) => {
        options.onEvent('accepted', { turn_id: 7, generation_id: 8 })
        throw new client.AiConsultApiError('in_progress')
      })
    client.loadConsultTurn
      .mockResolvedValueOnce({ id: 7, status: 'incomplete', generation_id: 8, can_retry: false, evidence: [] })
      .mockResolvedValueOnce({
        id: 7, status: 'completed', generation_id: 8, answer: '已完成的原请求回答',
        evidence: [{ id: 'ev1', kind: 'report', label: '本次报告' }],
      })
    const wrapper = mountConversation()
    await flushPromises()
    await wrapper.get('[data-testid="ai-question"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="ai-resend-question"]').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('.ai-user-question')).toHaveLength(1)
    expect(wrapper.get('[data-testid="ai-check-status"]').text()).toContain('查询回答状态')
    await wrapper.get('#aiQuestionInput').setValue('下一条问题先保留')
    expect(wrapper.get('[aria-label="发送问题"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-testid="ai-check-status"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="ai-conversation"]').text()).toContain('已完成的原请求回答')
    expect(wrapper.find('[data-testid="ai-check-status"]').exists()).toBe(false)
    expect(wrapper.get('#aiQuestionInput').element.value).toBe('下一条问题先保留')
    expect(wrapper.get('[aria-label="发送问题"]').attributes('disabled')).toBeUndefined()
  })

  it('stops new questions when maintenance begins after the welcome page loaded', async () => {
    client.streamConsultQuestion.mockRejectedValue(
      new client.AiConsultApiError('maintenance', 503, '服务维护中，请稍后再试。'),
    )
    const wrapper = mountConversation()
    await flushPromises()
    await wrapper.get('[data-testid="ai-question"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('咨询服务维护中')
    expect(wrapper.text()).toContain('服务维护中，请稍后再试。')
    expect(wrapper.find('[data-testid="ai-composer"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="ai-question"]').attributes('disabled')).toBeDefined()
  })

  it('recovers a completed server turn after the answer stream disconnects', async () => {
    client.streamConsultQuestion.mockImplementation(async (_report, _customer, _session, _question, options) => {
      options.onEvent('accepted', { turn_id: 7, generation_id: 8 })
      throw new client.AiConsultApiError('network')
    })
    client.loadConsultTurn.mockResolvedValue({
      id: 7, status: 'completed', answer: '服务端已确认的回答',
      evidence: [{ id: 'ev1', kind: 'report', label: '本次报告' }], feedback_value: null,
    })
    const wrapper = mountConversation()
    await flushPromises()
    await wrapper.get('[data-testid="ai-question"]').trigger('click')
    await flushPromises()
    expect(client.loadConsultTurn).toHaveBeenCalledWith('R1', 1001, SESSION_ID, 7)
    expect(wrapper.get('[data-testid="ai-conversation"]').text()).toContain('服务端已确认的回答')
    expect(wrapper.get('[data-testid="ai-evidence"]').text()).toContain('本次报告')
    expect(wrapper.text()).not.toContain('网络连接失败，本次回答未完成')
  })

  it('does not show a draft when a disconnected turn is still incomplete', async () => {
    client.streamConsultQuestion.mockImplementation(async (_report, _customer, _session, _question, options) => {
      options.onEvent('accepted', { turn_id: 7, generation_id: 8 })
      throw new client.AiConsultApiError('incomplete')
    })
    client.loadConsultTurn.mockResolvedValue({ id: 7, status: 'incomplete', answer: null, evidence: [] })
    const wrapper = mountConversation()
    await flushPromises()
    await wrapper.get('[data-testid="ai-question"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="ai-conversation"]').text()).toContain('本次回答未完成')
    expect(wrapper.get('[data-testid="ai-conversation"]').text()).not.toContain('服务端已确认的回答')
    expect(wrapper.find('[data-testid="ai-maintained-actions"]').exists()).toBe(false)
  })

  it('shows urgent-care guidance without presenting it as a report-backed diagnosis', async () => {
    client.streamConsultQuestion.mockRejectedValue(new client.AiConsultApiError(
      'consult.urgent_help', 422, '胸痛伴呼吸困难需要尽快评估，请立即联系当地急救服务。',
    ))
    const wrapper = mountConversation()
    await flushPromises()
    await wrapper.get('[data-testid="ai-question"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('请立即联系当地急救服务')
    expect(wrapper.get('[data-testid="ai-conversation"]').text()).toContain('本次回答未完成')
    expect(wrapper.find('[data-testid="ai-evidence"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="ai-feedback"]').exists()).toBe(false)
  })

  it('shows a clear clinician referral when a question asks for diagnosis or medication decisions', async () => {
    client.streamConsultQuestion.mockRejectedValue(new client.AiConsultApiError('consult.clinical_boundary', 422))
    const wrapper = mountConversation()
    await flushPromises()
    await wrapper.get('[data-testid="ai-question"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('不能根据这份报告为你确诊、开处方或决定调整药物')
    expect(wrapper.get('[role="alert"]').text()).toContain('请联系医生或药师')
    expect(wrapper.get('[data-testid="ai-conversation"]').text()).toContain('本次回答未完成')
    expect(wrapper.find('[data-testid="ai-evidence"]').exists()).toBe(false)
  })

  it('rates only a completed answer in the current consultation', async () => {
    client.streamConsultQuestion.mockImplementation(async (_report, _customer, _session, _question, options) => {
      options.onEvent('accepted', { turn_id: 7, generation_id: 8 })
      options.onEvent('evidence', { items: [{ id: 'ev1', kind: 'report', label: '本次报告' }] })
      options.onEvent('completed', { answer: '已核对的回答' })
    })
    client.submitConsultFeedback.mockResolvedValue({ turn_id: 7, feedback_value: 'unhelpful', feedback_reason: 'unclear' })
    const wrapper = mountConversation()
    await flushPromises()
    await wrapper.get('[data-testid="ai-question"]').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('[data-testid="ai-feedback"]')).toHaveLength(1)
    expect(wrapper.get('[data-testid="ai-feedback"]').text()).not.toContain('已记录：有帮助')
    await wrapper.get('[data-testid="ai-feedback"]').findAll('button')[1].trigger('click')
    expect(wrapper.get('[data-testid="ai-feedback"]').text()).toContain('可选原因')
    await wrapper.get('[data-testid="ai-feedback"]').findAll('button').find((node) => node.text() === '看不懂').trigger('click')
    await flushPromises()
    expect(client.submitConsultFeedback).toHaveBeenCalledWith('R1', 1001, SESSION_ID, 7, false, 'unclear')
    expect(wrapper.get('[data-testid="ai-feedback"]').text()).toContain('已记录：没有帮助')
  })

  it('does not claim feedback was saved when the request fails', async () => {
    client.streamConsultQuestion.mockImplementation(async (_report, _customer, _session, _question, options) => {
      options.onEvent('accepted', { turn_id: 7, generation_id: 8 })
      options.onEvent('evidence', { items: [{ id: 'ev1', kind: 'report', label: '本次报告' }] })
      options.onEvent('completed', { answer: '已核对的回答' })
    })
    client.submitConsultFeedback.mockRejectedValue(new client.AiConsultApiError('network'))
    const wrapper = mountConversation()
    await flushPromises()
    await wrapper.get('[data-testid="ai-question"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="ai-feedback"]').findAll('button')[0].trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="ai-feedback"]').text()).toContain('评价未保存，请重试')
    expect(wrapper.get('[data-testid="ai-feedback"]').text()).not.toContain('已记录：有帮助')
  })

  it('stops an accepted generation without publishing a late answer', async () => {
    client.streamConsultQuestion.mockImplementation((_report, _customer, _session, _question, options) => new Promise((_resolve, reject) => {
      options.onEvent('accepted', { turn_id: 7, generation_id: 8 })
      options.signal.addEventListener('abort', () => reject(new client.AiConsultApiError('incomplete')))
    }))
    client.stopConsultGeneration.mockResolvedValue({ turn_id: 7, generation_id: 8, status: 'stopped' })
    const wrapper = mountConversation()
    await flushPromises()
    await wrapper.get('[data-testid="ai-question"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="ai-stop"]').text()).toBe('停止生成')
    await wrapper.get('[data-testid="ai-stop"]').trigger('click')
    await flushPromises()
    expect(client.stopConsultGeneration).toHaveBeenCalledWith('R1', 1001, SESSION_ID, 7, 8)
    expect(wrapper.get('[data-testid="ai-conversation"]').text()).toContain('已停止，本次回答未完成')
    expect(wrapper.find('[data-testid="ai-feedback"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="ai-stop"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="ai-retry"]').text()).toBe('重新生成')
  })

  it('retries a failed live answer without adding a second question bubble', async () => {
    client.streamConsultQuestion.mockImplementation(async (_report, _customer, _session, _question, options) => {
      options.onEvent('accepted', { turn_id: 7, generation_id: 8 })
      throw new client.AiConsultApiError('consult.provider_unavailable')
    })
    client.streamConsultRetry.mockImplementation(async (_report, _customer, _session, _turn, _generation, options) => {
      options.onEvent('accepted', { turn_id: 7, generation_id: 9 })
      options.onEvent('completed', { answer: '已核对的新回答' })
    })
    const wrapper = mountConversation()
    await flushPromises()
    await wrapper.get('[data-testid="ai-question"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="ai-retry"]').text()).toBe('重新生成')
    await wrapper.get('[data-testid="ai-retry"]').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('.ai-user-question')).toHaveLength(1)
    expect(wrapper.get('[data-testid="ai-conversation"]').text()).toContain('已核对的新回答')
    expect(wrapper.find('.ai-chat-error').exists()).toBe(false)
  })

  it('keeps permanent server records out of the report-side history UI', async () => {
    const wrapper = mountConversation()
    await flushPromises()
    expect(wrapper.find('[data-testid="ai-sessions"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="ai-sessions-toggle"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="ai-delete-open"]').exists()).toBe(false)
    expect(client.listConsultSessions).not.toHaveBeenCalled()
    expect(client.loadConsultSession).not.toHaveBeenCalled()
    expect(client.deleteConsultSession).not.toHaveBeenCalled()
  })
})
