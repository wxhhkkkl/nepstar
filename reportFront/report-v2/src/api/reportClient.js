/**
 * 报告展示接口的取数层（原生 fetch，不引入 Axios —— 既有架构约束）。
 *
 * 后端约定：业务失败也是 HTTP 200，靠响应体里的 code 区分；
 * 这里把 code/message 翻译成页面能用的错误种类，供 ReportErrorState 呈现（FR-019、SC-007）。
 */

const BASE = import.meta.env?.VITE_API_BASE_URL || '/api/v1'
const DEFAULT_TIMEOUT_MS = 8000

export const ERROR_KINDS = {
  NOT_FOUND: 'not_found',
  NOT_READY: 'not_ready',
  SYSTEM_NOT_FOUND: 'system_not_found',
  UNAVAILABLE: 'unavailable',
  NETWORK: 'network',
}

const MESSAGE_TO_KIND = {
  'report.not_found': ERROR_KINDS.NOT_FOUND,
  'report.not_ready': ERROR_KINDS.NOT_READY,
  'report.system_not_found': ERROR_KINDS.SYSTEM_NOT_FOUND,
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

/**
 * 从地址栏取报告参数。沿用既有报告链接的参数名（reportId / customerId），
 * 这样旧链接不需要改造就能打开新页面。
 */
export function reportParamsFromLocation(search = globalThis.location?.search || '') {
  const params = new URLSearchParams(search)
  const reportCode = params.get('reportId') || params.get('reportCode') || ''
  const raw = params.get('customerId')
  const customerId = raw === null || raw === '' ? null : Number(raw)
  return {
    reportCode,
    customerId: Number.isFinite(customerId) ? customerId : null,
  }
}
