import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createConsultSession, guestTokenStorageKey, loadConsultBootstrap, loadConsultTurn, stopConsultGeneration, streamConsultQuestion, streamConsultRetry, submitConsultFeedback } from '@/api/aiConsultClient.js'
import { bootstrapPayload } from '../fixtures/aiConsult.js'

const TOKEN = 'a'.repeat(43)
const SESSION = '11111111-1111-4111-8111-111111111111'
const REQUEST = '22222222-2222-4222-8222-222222222222'

function frame(event, seq, extra = {}) {
  return `event: ${event}\ndata: ${JSON.stringify({
    session_id: SESSION, turn_id: 1, generation_id: 2, seq, ...extra,
  })}\n\n`
}

function streamedResponse(parts) {
  const encoder = new TextEncoder()
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'Content-Type': 'text/event-stream; charset=utf-8' }),
    body: new ReadableStream({
      start(controller) {
        for (const part of parts) controller.enqueue(encoder.encode(part))
        controller.close()
      },
    }),
  }
}

describe('AI consultation SSE client', () => {
  beforeEach(() => {
    sessionStorage.clear()
    sessionStorage.setItem(guestTokenStorageKey('R1', 1001), TOKEN)
    vi.unstubAllGlobals()
  })

  it('sends the token only in the header and consumes validated events in order', async () => {
    const events = []
    const body = [
      frame('accepted', 1), frame('status', 2, { phase: 'answering' }),
      frame('delta', 3, { text: '已核对的回答' }),
      frame('evidence', 4, { items: [{ id: 'ev1', kind: 'report' }] }),
      frame('completed', 5, { answer: '已核对的回答' }),
    ].join('')
    const fetchMock = vi.fn().mockResolvedValue(streamedResponse([body.slice(0, 19), body.slice(19)]))
    vi.stubGlobal('fetch', fetchMock)
    const completed = await streamConsultQuestion('R1', 1001, SESSION, '请解读报告', {
      requestId: REQUEST, onEvent: (event, data) => events.push([event, data]),
    })
    expect(completed.answer).toBe('已核对的回答')
    expect(events.map(([event]) => event)).toEqual(['accepted', 'status', 'delta', 'evidence', 'completed'])
    expect(fetchMock.mock.calls[0][0]).toContain(`/${SESSION}/turns?report_code=R1`)
    expect(fetchMock.mock.calls[0][0]).not.toContain(TOKEN)
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${TOKEN}`)
    expect(fetchMock.mock.calls[0][1].headers['Idempotency-Key']).toBe(REQUEST)
  })

  it('discards a stale generation and rejects a stream without completion', async () => {
    const stale = frame('delta', 0, { generation_id: 999, text: '过期内容' })
    const fetchMock = vi.fn().mockResolvedValueOnce(streamedResponse([
      frame('accepted', 1), stale, frame('completed', 2, { answer: '可信答案' }),
    ])).mockResolvedValueOnce(streamedResponse([
      frame('accepted', 1), frame('delta', 2, { text: '未完成' }),
    ]))
    vi.stubGlobal('fetch', fetchMock)
    const events = []
    await streamConsultQuestion('R1', 1001, SESSION, '问题', {
      requestId: REQUEST, onEvent: (event) => events.push(event),
    })
    expect(events).toEqual(['accepted', 'completed'])
    await expect(streamConsultQuestion('R1', 1001, SESSION, '问题', {
      requestId: REQUEST,
    })).rejects.toMatchObject({ kind: 'incomplete' })
  })

  it('rejects a different turn instead of silently treating it as a stale generation', async () => {
    const fetchMock = vi.fn().mockResolvedValue(streamedResponse([
      frame('accepted', 1),
      frame('delta', 2, { turn_id: 99, text: '串到其他轮次的内容' }),
      frame('completed', 3, { answer: '本轮完成' }),
    ]))
    vi.stubGlobal('fetch', fetchMock)
    const events = []

    await expect(streamConsultQuestion('R1', 1001, SESSION, '问题', {
      requestId: REQUEST, onEvent: (event) => events.push(event),
    })).rejects.toMatchObject({ kind: 'invalid_stream' })
    expect(events).toEqual(['accepted'])
  })

  it('forwards caller cancellation to fetch and reports an interrupted stream', async () => {
    let fetchSignal
    const fetchMock = vi.fn((_url, options) => new Promise((_resolve, reject) => {
      fetchSignal = options.signal
      options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    }))
    vi.stubGlobal('fetch', fetchMock)
    const caller = new AbortController()
    const pending = streamConsultQuestion('R1', 1001, SESSION, '保持原问题', {
      requestId: REQUEST, signal: caller.signal,
    })

    caller.abort()
    await expect(pending).rejects.toMatchObject({ kind: 'incomplete' })
    expect(fetchSignal.aborted).toBe(true)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ question: '保持原问题' })
  })

  it('classifies the client deadline separately from a network interruption', async () => {
    vi.useFakeTimers()
    try {
      const fetchMock = vi.fn((_url, options) => new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
      }))
      vi.stubGlobal('fetch', fetchMock)
      const pending = streamConsultQuestion('R1', 1001, SESSION, '保持原问题', { requestId: REQUEST })
      const result = expect(pending).rejects.toMatchObject({ kind: 'timeout' })
      await vi.advanceTimersByTimeAsync(65001)
      await result
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ question: '保持原问题' })
    } finally {
      vi.useRealTimers()
    }
  })

  it('maps the server preparation deadline to the timeout recovery flow', async () => {
    const events = []
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamedResponse([
      frame('accepted', 1),
      frame('error', 2, { code: 'consult.timeout', message: '请查询状态或重试', retryable: true }),
    ])))
    await expect(streamConsultQuestion('R1', 1001, SESSION, '问题', {
      requestId: REQUEST, onEvent: (event) => events.push(event),
    })).rejects.toMatchObject({ kind: 'timeout', detail: '请查询状态或重试' })
    expect(events).toEqual(['accepted'])
  })

  it('does not accept malformed or cross-session events as an answer', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(streamedResponse([
      frame('accepted', 1), frame('completed', 2, { session_id: 'someone-else', answer: '越界答案' }),
    ])).mockResolvedValueOnce(streamedResponse([
      frame('accepted', 1), frame('error', 2, { code: 'consult.unsafe_answer' }),
    ]))
    vi.stubGlobal('fetch', fetchMock)
    await expect(streamConsultQuestion('R1', 1001, SESSION, '问题', { requestId: REQUEST }))
      .rejects.toMatchObject({ kind: 'invalid_stream' })
    await expect(streamConsultQuestion('R1', 1001, SESSION, '问题', { requestId: REQUEST }))
      .rejects.toMatchObject({ kind: 'consult.unsafe_answer' })
  })

  it('reports a daily quota rejection before starting a stream', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 429,
      json: async () => ({ code: 429, message: 'consult.daily_limit' }),
    }))
    await expect(streamConsultQuestion('R1', 1001, SESSION, '问题', { requestId: REQUEST }))
      .rejects.toMatchObject({ kind: 'daily_limit', status: 429 })
  })

  it.each(['question', 'session'])('keeps safe Retry-After metadata for %s requests', async (type) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 429, headers: new Headers({ 'Retry-After': '7' }),
      json: async () => ({ code: 429, message: 'consult.rate_limited', data: { retry_after_seconds: 7 } }),
    }))
    const pending = type === 'question'
      ? streamConsultQuestion('R1', 1001, SESSION, '问题', { requestId: REQUEST })
      : createConsultSession('R1', 1001)
    await expect(pending).rejects.toMatchObject({ kind: 'rate_limited', retryAfterSeconds: 7 })
  })

  it.each([null, true, -1, 0, 86401, 2.5, '2'])('rejects unsafe wait values: %s', async (value) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 429, headers: new Headers({ 'Retry-After': '-1' }),
      json: async () => ({ code: 429, message: 'consult.rate_limited', data: { retry_after_seconds: value } }),
    }))
    await expect(streamConsultQuestion('R1', 1001, SESSION, '问题', { requestId: REQUEST }))
      .rejects.toMatchObject({ retryAfterSeconds: null })
  })

  it('uses a valid Retry-After header when the payload has no wait value', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 429, headers: new Headers({ 'Retry-After': '5' }),
      json: async () => ({ code: 429, message: 'consult.capacity_busy' }),
    }))
    await expect(streamConsultQuestion('R1', 1001, SESSION, '问题', { requestId: REQUEST }))
      .rejects.toMatchObject({ kind: 'capacity_busy', retryAfterSeconds: 5 })
  })

  it('keeps the public maintenance notice when no new answer can start', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 503,
      json: async () => ({ code: 503, message: 'consult.maintenance', data: {
        maintenance_text: '服务维护中，请稍后再试。',
      } }),
    }))
    await expect(streamConsultQuestion('R1', 1001, SESSION, '问题', { requestId: REQUEST }))
      .rejects.toMatchObject({ kind: 'maintenance', status: 503, detail: '服务维护中，请稍后再试。' })
  })

  it('shows maintenance before guest creation instead of retrying with a fabricated report', async () => {
    sessionStorage.clear()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false, status: 503,
      json: async () => ({ code: 503, message: 'consult.maintenance', data: {
        maintenance_text: '模型服务维护中。',
      } }),
    })
    vi.stubGlobal('fetch', fetchMock)
    await expect(loadConsultBootstrap('R1', 1001))
      .rejects.toMatchObject({ kind: 'maintenance', detail: '模型服务维护中。' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toContain('/guest-contexts')
  })

  it('clears a legacy stored session ID and starts a blank consultation entry', async () => {
    const key = `${guestTokenStorageKey('R1', 1001)}:session`
    sessionStorage.setItem(key, SESSION)
    sessionStorage.setItem(guestTokenStorageKey('R1', 1001), TOKEN)
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ code: 200, data: { ...bootstrapPayload, service_status: 'available' } }),
    })
    vi.stubGlobal('fetch', fetchMock)
    expect(await loadConsultBootstrap('R1', 1001)).toMatchObject({ service_status: 'available' })
    expect(sessionStorage.getItem(key)).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${TOKEN}`)
  })

  it('reads one authorized persisted turn with the token only in a header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({
      code: 200, data: { id: 7, question: '问题', status: 'completed', answer: '回答', evidence: [{ id: 'ev1' }] },
    }) })
    vi.stubGlobal('fetch', fetchMock)
    expect(await loadConsultTurn('R1', 1001, SESSION, 7)).toMatchObject({ id: 7, answer: '回答' })
    expect(fetchMock.mock.calls[0][0]).toContain(`/sessions/${SESSION}/turns/7?report_code=R1`)
    expect(fetchMock.mock.calls[0][0]).not.toContain(TOKEN)
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${TOKEN}`)
    await expect(loadConsultTurn('R1', 1001, SESSION, 0)).rejects.toMatchObject({ kind: 'session_not_found' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('creates a fresh session for this entry without storing its ID in the browser', async () => {
    const other = '33333333-3333-4333-8333-333333333333'
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ code: 200, data: { id: other, report_code: 'R1', source: 'home' } }),
    })
    vi.stubGlobal('fetch', fetchMock)
    expect(await createConsultSession('R1', 1001)).toBe(other)
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${TOKEN}`)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ report_code: 'R1', source: 'home' })
    expect(sessionStorage.getItem(`${guestTokenStorageKey('R1', 1001)}:session`)).toBeNull()
  })

  it('submits scoped feedback with the guest token in a header only', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ code: 200, data: { turn_id: 7, feedback_value: 'unhelpful', feedback_reason: 'unclear' } }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const result = await submitConsultFeedback('R1', 1001, SESSION, 7, false, 'unclear')
    expect(result.feedback_value).toBe('unhelpful')
    expect(fetchMock.mock.calls[0][0]).toContain(`/sessions/${SESSION}/turns/7/feedback?report_code=R1`)
    expect(fetchMock.mock.calls[0][0]).not.toContain(TOKEN)
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${TOKEN}`)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ helpful: false, reason: 'unclear' })
  })

  it('rejects invalid feedback locally without a request', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(submitConsultFeedback('R1', 1001, SESSION, 0, true)).rejects.toMatchObject({ kind: 'session_not_found' })
    await expect(submitConsultFeedback('R1', 1001, SESSION, 7, true, 'unclear')).rejects.toMatchObject({ kind: 'invalid_feedback' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('stops only the exact accepted generation and keeps the token out of the URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ code: 200, data: { turn_id: 7, generation_id: 8, status: 'stopped' } }),
    })
    vi.stubGlobal('fetch', fetchMock)
    await stopConsultGeneration('R1', 1001, SESSION, 7, 8)
    expect(fetchMock.mock.calls[0][0]).toContain(`/sessions/${SESSION}/turns/7/stop?report_code=R1`)
    expect(fetchMock.mock.calls[0][0]).not.toContain(TOKEN)
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${TOKEN}`)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ generation_id: 8 })
    await expect(stopConsultGeneration('R1', 1001, SESSION, 7, 0)).rejects.toMatchObject({ kind: 'invalid_stop' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries one turn using its previous generation without creating a new question', async () => {
    const events = []
    const fetchMock = vi.fn().mockResolvedValue(streamedResponse([
      frame('accepted', 1, { turn_id: 7, generation_id: 9 }),
      frame('completed', 2, { turn_id: 7, generation_id: 9, answer: '已核对的新回答' }),
    ]))
    vi.stubGlobal('fetch', fetchMock)
    const result = await streamConsultRetry('R1', 1001, SESSION, 7, 8, {
      onEvent: (event) => events.push(event),
    })
    expect(result.answer).toBe('已核对的新回答')
    expect(events).toEqual(['accepted', 'completed'])
    expect(fetchMock.mock.calls[0][0]).toContain(`/sessions/${SESSION}/turns/7/retry?report_code=R1`)
    expect(fetchMock.mock.calls[0][0]).not.toContain(TOKEN)
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${TOKEN}`)
    expect(fetchMock.mock.calls[0][1].headers['Idempotency-Key']).toBeUndefined()
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ generation_id: 8 })
  })

  it('rejects a retry stream that responds with another turn or an old generation', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(streamedResponse([
      frame('accepted', 1, { turn_id: 99, generation_id: 9 }),
    ])).mockResolvedValueOnce(streamedResponse([
      frame('accepted', 1, { turn_id: 7, generation_id: 8 }),
    ]))
    vi.stubGlobal('fetch', fetchMock)
    await expect(streamConsultRetry('R1', 1001, SESSION, 7, 8)).rejects.toMatchObject({ kind: 'invalid_stream' })
    await expect(streamConsultRetry('R1', 1001, SESSION, 7, 8)).rejects.toMatchObject({ kind: 'invalid_stream' })
    await expect(streamConsultRetry('R1', 1001, SESSION, 7, 0)).rejects.toMatchObject({ kind: 'invalid_retry' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
