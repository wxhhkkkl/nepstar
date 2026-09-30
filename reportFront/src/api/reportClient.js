/**
 * 报告展示接口的取数层（原生 fetch，不引入 Axios —— 既有架构约束）。
 *
 * 后端约定：业务失败也是 HTTP 200，靠响应体里的 code 区分；
 * 这里把 code/message 翻译成页面能用的错误种类，供 ReportErrorState 呈现（FR-019、SC-007）。
 */

const DEFAULT_API_BASE = 'https://nepstar.kangjia.online/api/v1'
const BASE = (import.meta.env?.VITE_API_BASE_URL || DEFAULT_API_BASE).replace(/\/+$/, '')
const DEFAULT_TIMEOUT_MS = 8000

export const ERROR_KINDS = {
  NOT_FOUND: 'not_found',
  NOT_READY: 'not_ready',
  SYSTEM_NOT_FOUND: 'system_not_found',
  INDICATOR_NOT_FOUND: 'indicator_not_found',
  ROUTE_NOT_FOUND: 'route_not_found',
  UNAVAILABLE: 'unavailable',
  NETWORK: 'network',
}

const MESSAGE_TO_KIND = {
  'report.not_found': ERROR_KINDS.NOT_FOUND,
  'report.not_ready': ERROR_KINDS.NOT_READY,
  'report.system_not_found': ERROR_KINDS.SYSTEM_NOT_FOUND,
  'report.indicator_not_found': ERROR_KINDS.INDICATOR_NOT_FOUND,
  'report.unavailable': ERROR_KINDS.UNAVAILABLE,
}

export class ReportApiError extends Error {
  constructor(kind, detail = '') {
    super(kind)
    this.name = 'ReportApiError'
    this.kind = kind
    this.detail = detail
  }
}

async function request(path, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let response
  try {
    response = await fetch(`${BASE}${path}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
  } catch (error) {
    throw new ReportApiError(ERROR_KINDS.NETWORK, String(error?.message || error))
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    throw new ReportApiError(ERROR_KINDS.UNAVAILABLE, `HTTP ${response.status}`)
  }
  const body = await response.json()
  if (body?.code !== 200) {
    const kind = MESSAGE_TO_KIND[body?.message] || ERROR_KINDS.UNAVAILABLE
    throw new ReportApiError(kind, body?.message || '')
  }
  return body.data
}

export function fetchReportHome(reportCode, customerId, options) {
  const query = new URLSearchParams({ customer_id: String(customerId) })
  return request(`/report-view/${encodeURIComponent(reportCode)}/home?${query}`, options)
}

export function fetchSystemDetail(reportCode, systemCode, customerId, options) {
  const query = new URLSearchParams({ customer_id: String(customerId) })
  return request(
    `/report-view/${encodeURIComponent(reportCode)}/systems/${encodeURIComponent(systemCode)}?${query}`,
    options,
  )
}

export function fetchIndicatorDetail(reportCode, indicatorCode, customerId, options) {
  const query = new URLSearchParams({ customer_id: String(customerId) })
  return request(
    `/report-view/${encodeURIComponent(reportCode)}/indicators/${encodeURIComponent(indicatorCode)}?${query}`,
    options,
  )
}

function locationHashParams(hash) {
  // Hash history links commonly put business parameters after `#/`.
  const queryStart = hash.indexOf('?')
  return new URLSearchParams(queryStart >= 0 ? hash.slice(queryStart + 1) : '')
}

function locationQueryParams(search, hash) {
  const params = new URLSearchParams(search)
  // Read both `?params#/` and `#/?params` forms. The active hash-route query
  // takes precedence when the same parameter appears in both places.
  locationHashParams(hash).forEach((value, key) => params.set(key, value))
  return params
}

/**
 * Read both the app's legacy `customerId` and the live platform's `userId`.
 * Both identify the report owner; API requests continue to use `customer_id`.
 */
export function reportParamsFromLocation(
  search = globalThis.location?.search || '',
  hash = globalThis.location?.hash || '',
) {
  const params = locationQueryParams(search, hash)
  const searchParams = new URLSearchParams(search)
  const hashParams = locationHashParams(hash)
  const getParam = (name) => {
    const value = params.get(name)?.trim()
    return value ? value : null
  }
  const reportCode = getParam('reportId') || getParam('reportCode') || ''
  // Prefer identity values on the active hash route before either alias in
  // the outer URL, so a stale outer customerId cannot override a hash userId.
  const customerId = [
    hashParams.get('customerId'), hashParams.get('userId'),
    searchParams.get('customerId'), searchParams.get('userId'),
  ]
    .map((value) => value?.trim())
    .filter((value) => value !== null)
    .filter(Boolean)
    .map(Number)
    .find(Number.isFinite) ?? null
  return {
    reportCode,
    customerId,
  }
}

/** Keep report identity and launch context when navigating between pages. */
export function reportRouteQueryFromLocation(
  search = globalThis.location?.search || '',
  hash = globalThis.location?.hash || '',
) {
  const { reportCode, customerId } = reportParamsFromLocation(search, hash)
  if (!reportCode || customerId === null) return {}

  const passthrough = Object.fromEntries(locationQueryParams(search, hash))
  delete passthrough.reportId
  delete passthrough.reportCode
  delete passthrough.customerId
  delete passthrough.userId

  // Use the platform's live parameter name in generated links. The parser
  // still accepts customerId for existing bookmarks and manually shared URLs.
  return { ...passthrough, reportId: reportCode, userId: String(customerId) }
}
