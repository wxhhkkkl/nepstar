/** 匿名咨询候选接口；凭证只留在当前标签页，绝不进 URL。 */

const DEFAULT_API_BASE = 'https://nepstar.kangjia.online/api/v1'
const BASE = (import.meta.env?.VITE_API_BASE_URL || DEFAULT_API_BASE).replace(/\/+$/, '')
const TIMEOUT_MS = 8000
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

export class AiConsultApiError extends Error {
  constructor(kind, status = 0, detail = '', retryAfterSeconds = null) {
    super(kind)
    this.name = 'AiConsultApiError'
    this.kind = kind
    this.status = status
    this.detail = detail
    this.retryAfterSeconds = Number.isSafeInteger(retryAfterSeconds)
      && retryAfterSeconds >= 1 && retryAfterSeconds <= 86400 ? retryAfterSeconds : null
  }
}

export function guestTokenStorageKey(reportCode, customerId) {
  return `aiConsultGuest:${encodeURIComponent(reportCode)}:${customerId}`
}

function storedToken(key) {
  try {
    const token = sessionStorage.getItem(key)
    return TOKEN_PATTERN.test(token || '') ? token : null
  } catch {
    return null
  }
}

function saveToken(key, token) {
  try { sessionStorage.setItem(key, token) } catch { /* 当前页仍可使用；刷新后重新建立 guest。 */ }
}

function clearToken(key) {
  try {
    sessionStorage.removeItem(key)
    sessionStorage.removeItem(`${key}:session`)
  } catch { /* 存储不可用时没有可恢复的凭证。 */ }
}

function errorKind(status, message) {
  if (message === 'consult.timeout') return 'timeout'
  if (message === 'consult.disabled') return 'disabled'
  if (message === 'consult.maintenance') return 'maintenance'
  if (message === 'consult.processing_withdrawn') return 'processing_withdrawn'
  if (status === 403 && message === 'consult.guest_token_expired') return 'guest_invalid'
  if (message === 'consult.session_not_found') return 'session_not_found'
  if (message === 'consult.in_progress') return 'in_progress'
  if (message === 'consult.generation_changed') return 'generation_changed'
  if (message === 'consult.daily_limit') return 'daily_limit'
  if (message === 'consult.global_budget_exhausted') return 'global_budget_exhausted'
  if (message === 'consult.capacity_busy') return 'capacity_busy'
  if (message === 'consult.question_too_long') return 'question_too_long'
  if (message === 'consult.report_unavailable') return 'report_unavailable'
  if (message === 'consult.entry_unavailable') return 'entry_unavailable'
  if (status === 429) return 'rate_limited'
  return 'unavailable'
}

function retryAfter(response, payload) {
  const value = payload?.data?.retry_after_seconds
  if (Number.isSafeInteger(value) && value >= 1 && value <= 86400) return value
  const header = response.headers?.get('retry-after')
  if (!/^\d{1,5}$/.test(header || '')) return null
  const seconds = Number(header)
  return seconds >= 1 && seconds <= 86400 ? seconds : null
}

async function request(path, { method = 'GET', body, token, keepalive = false } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let response
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'omit',
      cache: 'no-store',
      keepalive,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
  } catch {
    throw new AiConsultApiError(controller.signal.aborted ? 'timeout' : 'network')
  } finally {
    clearTimeout(timer)
  }

  if (response.ok && response.status === 204) return null

  let payload
  try {
    payload = await response.json()
  } catch {
    throw new AiConsultApiError('unavailable', response.status)
  }
  if (!response.ok || payload?.code !== 200) {
    const kind = errorKind(response.status, payload?.message)
    throw new AiConsultApiError(
      kind, response.status,
      kind === 'maintenance' && typeof payload?.data?.maintenance_text === 'string'
        ? payload.data.maintenance_text.slice(0, 500) : '',
      retryAfter(response, payload),
    )
  }
  return payload.data
}

async function createGuestContext(reportCode, customerId) {
  const created = await request('/ai-consult/guest-contexts', {
    method: 'POST',
    body: { report_code: reportCode, customer_id: customerId },
  })
  if (
    !TOKEN_PATTERN.test(created?.guest_token || '') ||
    created.report_code !== reportCode ||
    created.customer_id !== customerId
  ) throw new AiConsultApiError('unavailable')
  clearToken(guestTokenStorageKey(reportCode, customerId))
  return created.guest_token
}

async function fetchBootstrap(reportCode, token, entry = {}) {
  const params = new URLSearchParams({ report_code: reportCode })
  if (Number.isSafeInteger(entry.planId) && entry.planId > 0) params.set('plan_id', String(entry.planId))
  if (typeof entry.indicatorCode === 'string' && /^[A-Z][A-Z0-9_]{1,63}$/.test(entry.indicatorCode)) {
    params.set('indicator_code', entry.indicatorCode)
  }
  return request(`/ai-consult/bootstrap?${params}`, { token })
}

export async function loadConsultBootstrap(reportCode, customerId, entry = {}) {
  if (!reportCode || !Number.isSafeInteger(customerId) || customerId <= 0) {
    throw new AiConsultApiError('report_unavailable')
  }
  const key = guestTokenStorageKey(reportCode, customerId)
  try { sessionStorage.removeItem(`${key}:session`) } catch { /* 每次打开均从新会话开始。 */ }
  let token = storedToken(key)
  if (token) {
    try {
      return await fetchBootstrap(reportCode, token, entry)
    } catch (error) {
      if (!(error instanceof AiConsultApiError) || error.kind !== 'guest_invalid') throw error
      clearToken(key)
    }
  }
  token = await createGuestContext(reportCode, customerId)
  saveToken(key, token)
  try {
    return await fetchBootstrap(reportCode, token, entry)
  } catch (error) {
    if (error instanceof AiConsultApiError && error.kind === 'guest_invalid') clearToken(key)
    throw error
  }
}

function requireStoredToken(reportCode, customerId) {
  const token = storedToken(guestTokenStorageKey(reportCode, customerId))
  if (!token) throw new AiConsultApiError('guest_invalid')
  return token
}

const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export async function endConsultSession(reportCode, customerId, sessionId, { keepalive = false } = {}) {
  if (!SESSION_ID_PATTERN.test(sessionId)) throw new AiConsultApiError('session_not_found')
  const result = await request(
    `/ai-consult/sessions/${sessionId}/end?${new URLSearchParams({ report_code: reportCode })}`,
    { method: 'POST', token: requireStoredToken(reportCode, customerId), keepalive },
  )
  if (result?.id !== sessionId || result.status !== 'ended') throw new AiConsultApiError('unavailable')
  return result
}

export async function loadConsultTurn(reportCode, customerId, sessionId, turnId) {
  if (!SESSION_ID_PATTERN.test(sessionId) || !Number.isSafeInteger(turnId) || turnId <= 0) {
    throw new AiConsultApiError('session_not_found')
  }
  const turn = await request(
    `/ai-consult/sessions/${sessionId}/turns/${turnId}?${new URLSearchParams({ report_code: reportCode })}`,
    { token: requireStoredToken(reportCode, customerId) },
  )
  if (turn?.id !== turnId || !['completed', 'incomplete', 'stopped'].includes(turn.status)
    || typeof turn.question !== 'string' || !Array.isArray(turn.evidence)) {
    throw new AiConsultApiError('unavailable')
  }
  return turn
}

function sessionRequestContext(entry) {
  if (!entry || !['plan', 'indicator'].includes(entry.type)
    || !/^[A-Z][A-Z0-9_]{1,63}$/.test(entry.indicator_code || '')) {
    return { source: 'home' }
  }
  if (entry.type === 'plan' && Number.isSafeInteger(entry.plan_id) && entry.plan_id > 0) {
    return { source: 'plan', plan_id: entry.plan_id, indicator_code: entry.indicator_code }
  }
  if (entry.type === 'indicator') {
    return { source: 'indicator', indicator_code: entry.indicator_code }
  }
  return { source: 'home' }
}

export async function createConsultSession(reportCode, customerId, entry = null) {
  const token = requireStoredToken(reportCode, customerId)
  const context = sessionRequestContext(entry)
  const created = await request('/ai-consult/sessions', {
    method: 'POST', token, body: { report_code: reportCode, ...context },
  })
  if (!SESSION_ID_PATTERN.test(created?.id || '') || created.report_code !== reportCode
    || created.source !== context.source
    || (context.source === 'plan' && (created.source_plan_id !== context.plan_id
      || created.source_indicator_code !== context.indicator_code))
    || (context.source === 'indicator' && created.source_indicator_code !== context.indicator_code)) {
    throw new AiConsultApiError('unavailable')
  }
  return created.id
}

export async function submitConsultFeedback(reportCode, customerId, sessionId, turnId, helpful, reason = null) {
  if (!SESSION_ID_PATTERN.test(sessionId) || !Number.isSafeInteger(turnId) || turnId <= 0) {
    throw new AiConsultApiError('session_not_found')
  }
  if (typeof helpful !== 'boolean' || (reason !== null && !['inaccurate', 'unclear', 'unresolved'].includes(reason)) || (helpful && reason)) {
    throw new AiConsultApiError('invalid_feedback')
  }
  const result = await request(
    `/ai-consult/sessions/${sessionId}/turns/${turnId}/feedback?${new URLSearchParams({ report_code: reportCode })}`,
    {
      method: 'PUT', token: requireStoredToken(reportCode, customerId),
      body: { helpful, reason },
    },
  )
  if (result?.turn_id !== turnId || result.feedback_value !== (helpful ? 'helpful' : 'unhelpful')) {
    throw new AiConsultApiError('unavailable')
  }
  return result
}

export async function stopConsultGeneration(reportCode, customerId, sessionId, turnId, generationId) {
  if (!SESSION_ID_PATTERN.test(sessionId) || !Number.isSafeInteger(turnId) || turnId <= 0
    || !Number.isSafeInteger(generationId) || generationId <= 0) {
    throw new AiConsultApiError('invalid_stop')
  }
  const result = await request(
    `/ai-consult/sessions/${sessionId}/turns/${turnId}/stop?${new URLSearchParams({ report_code: reportCode })}`,
    {
      method: 'POST', token: requireStoredToken(reportCode, customerId),
      body: { generation_id: generationId },
    },
  )
  if (result?.turn_id !== turnId || result?.generation_id !== generationId || result?.status !== 'stopped') {
    throw new AiConsultApiError('unavailable')
  }
  return result
}

function parseEventFrame(frame) {
  const lines = frame.split('\n')
  const event = lines.find((line) => line.startsWith('event: '))?.slice(7)
  const dataLine = lines.find((line) => line.startsWith('data: '))
  if (!event || !dataLine || !['accepted', 'status', 'delta', 'evidence', 'completed', 'error'].includes(event)) {
    throw new AiConsultApiError('invalid_stream')
  }
  let data
  try { data = JSON.parse(dataLine.slice(6)) } catch { throw new AiConsultApiError('invalid_stream') }
  if (!data || typeof data !== 'object') throw new AiConsultApiError('invalid_stream')
  return { event, data }
}

async function streamConsultGeneration(reportCode, customerId, sessionId, path, body, {
  onEvent,
  signal,
  requestId,
  expectedTurnId,
  previousGenerationId,
} = {}) {
  const token = requireStoredToken(reportCode, customerId)
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  if (signal?.aborted) abort()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    abort()
  }, 65000)
  let response
  try {
    response = await fetch(
      `${BASE}${path}?${new URLSearchParams({ report_code: reportCode })}`,
      {
        method: 'POST', credentials: 'omit', cache: 'no-store', signal: controller.signal,
        headers: {
          Accept: 'text/event-stream', 'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(requestId ? { 'Idempotency-Key': requestId } : {}),
        },
        body: JSON.stringify(body),
      },
    )
    if (!response.ok) {
      let body
      try { body = await response.json() } catch { /* 服务端可能不是 JSON。 */ }
      const kind = errorKind(response.status, body?.message)
      throw new AiConsultApiError(
        kind, response.status,
        kind === 'maintenance' && typeof body?.data?.maintenance_text === 'string'
          ? body.data.maintenance_text.slice(0, 500) : '',
        retryAfter(response, body),
      )
    }
    if (!response.headers.get('content-type')?.includes('text/event-stream') || !response.body) {
      throw new AiConsultApiError('invalid_stream', response.status)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let accepted = null
    let lastSeq = 0
    try {
      while (true) {
        const { value, done } = await reader.read()
        buffer = (buffer + decoder.decode(value || new Uint8Array(), { stream: !done }))
          .replace(/\r\n/g, '\n')
        if (buffer.length > 65536) throw new AiConsultApiError('invalid_stream')
        let boundary
        while ((boundary = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, boundary)
          buffer = buffer.slice(boundary + 2)
          if (!frame.trim()) continue
          const { event, data } = parseEventFrame(frame)
          if (data.session_id !== sessionId) throw new AiConsultApiError('invalid_stream')
          if (event === 'accepted') {
            if (accepted || !Number.isSafeInteger(data.turn_id) || data.turn_id <= 0
              || !Number.isSafeInteger(data.generation_id) || data.generation_id <= 0
              || (expectedTurnId && data.turn_id !== expectedTurnId)
              || (previousGenerationId && data.generation_id <= previousGenerationId)) {
              throw new AiConsultApiError('invalid_stream')
            }
            accepted = { turnId: data.turn_id, generationId: data.generation_id }
          } else if (!accepted) {
            throw new AiConsultApiError('invalid_stream')
          } else if (data.turn_id !== accepted.turnId) {
            throw new AiConsultApiError('invalid_stream')
          } else if (data.generation_id !== accepted.generationId) {
            continue // 只丢弃同一轮次中不属于当前 generation 的迟到片段。
          }
          if (!Number.isSafeInteger(data.seq) || data.seq <= lastSeq) {
            throw new AiConsultApiError('invalid_stream')
          }
          lastSeq = data.seq
          if (event === 'error') {
            throw new AiConsultApiError(
              data.code === 'consult.timeout' ? 'timeout' : data.code || 'unavailable', response.status,
              typeof data.message === 'string' ? data.message.slice(0, 600) : '',
            )
          }
          await onEvent?.(event, data)
          if (event === 'completed') return data
        }
        if (done) break
      }
      throw new AiConsultApiError('incomplete')
    } finally {
      await reader.cancel().catch(() => {})
    }
  } catch (error) {
    if (error instanceof AiConsultApiError) throw error
    throw new AiConsultApiError(timedOut ? 'timeout' : controller.signal.aborted ? 'incomplete' : 'network')
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}

export async function streamConsultQuestion(reportCode, customerId, sessionId, question, options = {}) {
  if (!SESSION_ID_PATTERN.test(sessionId) || !question?.trim() || question.length > 500) {
    throw new AiConsultApiError('invalid_question')
  }
  return streamConsultGeneration(
    reportCode, customerId, sessionId, `/ai-consult/sessions/${sessionId}/turns`,
    { question: question.trim() }, { ...options, requestId: options.requestId || crypto.randomUUID() },
  )
}

export async function streamConsultRetry(reportCode, customerId, sessionId, turnId, generationId, options = {}) {
  if (!SESSION_ID_PATTERN.test(sessionId) || !Number.isSafeInteger(turnId) || turnId <= 0
    || !Number.isSafeInteger(generationId) || generationId <= 0) {
    throw new AiConsultApiError('invalid_retry')
  }
  return streamConsultGeneration(
    reportCode, customerId, sessionId,
    `/ai-consult/sessions/${sessionId}/turns/${turnId}/retry`,
    { generation_id: generationId },
    { ...options, expectedTurnId: turnId, previousGenerationId: generationId },
  )
}
