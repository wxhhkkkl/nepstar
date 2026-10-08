/** 匿名咨询候选接口；凭证只留在当前标签页，绝不进 URL。 */

const DEFAULT_API_BASE = 'https://nepstar.kangjia.online/api/v1'
const BASE = (import.meta.env?.VITE_API_BASE_URL || DEFAULT_API_BASE).replace(/\/+$/, '')
const TIMEOUT_MS = 8000
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

export class AiConsultApiError extends Error {
  constructor(kind, status = 0) {
    super(kind)
    this.name = 'AiConsultApiError'
    this.kind = kind
    this.status = status
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
  try { sessionStorage.removeItem(key) } catch { /* 存储不可用时没有可恢复的凭证。 */ }
}

function errorKind(status, message) {
  if (status === 403 && message === 'consult.guest_token_expired') return 'guest_invalid'
  if (message === 'consult.report_unavailable') return 'report_unavailable'
  if (status === 429) return 'rate_limited'
  return 'unavailable'
}

async function request(path, { method = 'GET', body, token } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let response
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'omit',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
  } catch {
    throw new AiConsultApiError('network')
  } finally {
    clearTimeout(timer)
  }

  let payload
  try {
    payload = await response.json()
  } catch {
    throw new AiConsultApiError('unavailable', response.status)
  }
  if (!response.ok || payload?.code !== 200) {
    throw new AiConsultApiError(errorKind(response.status, payload?.message), response.status)
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
  return created.guest_token
}

async function fetchBootstrap(reportCode, token) {
  return request(`/ai-consult/bootstrap?${new URLSearchParams({ report_code: reportCode })}`, { token })
}

export async function loadConsultBootstrap(reportCode, customerId) {
  if (!reportCode || !Number.isSafeInteger(customerId) || customerId <= 0) {
    throw new AiConsultApiError('report_unavailable')
  }
  const key = guestTokenStorageKey(reportCode, customerId)
  let token = storedToken(key)
  if (token) {
    try {
      return await fetchBootstrap(reportCode, token)
    } catch (error) {
      if (!(error instanceof AiConsultApiError) || error.kind !== 'guest_invalid') throw error
      clearToken(key)
    }
  }
  token = await createGuestContext(reportCode, customerId)
  saveToken(key, token)
  try {
    return await fetchBootstrap(reportCode, token)
  } catch (error) {
    if (error instanceof AiConsultApiError && error.kind === 'guest_invalid') clearToken(key)
    throw error
  }
}
