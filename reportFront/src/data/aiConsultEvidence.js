/** 把服务端依据路由转换为当前报告内的 Vue 跳转目标。 */

const CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,63}$/

export function citationToReportRoute(item, reportCode, customerId, reportQuery = {}) {
  if (!item || !['report', 'maintained', 'plan'].includes(item.kind) || typeof item.route !== 'string') return null
  if (!item.route.startsWith('#/')) return null
  const [path, rawQuery = ''] = item.route.slice(1).split('?')
  const params = new URLSearchParams(rawQuery)
  if (params.get('reportId') !== reportCode || params.get('customerId') !== String(customerId)) return null
  const cleanQuery = { ...reportQuery, reportId: reportCode, userId: String(customerId), fromAiConsult: '1' }
  delete cleanQuery.guest_token
  delete cleanQuery.customerId

  if (path === '/') return { name: 'home', query: cleanQuery }
  const match = path.match(/^\/system\/([^/]+)(?:\/indicator\/([^/]+))?$/)
  if (!match) return null
  let systemId, indicatorCode
  try {
    systemId = decodeURIComponent(match[1])
    indicatorCode = match[2] ? decodeURIComponent(match[2]) : null
  } catch {
    return null
  }
  if (!CODE_PATTERN.test(systemId) || (indicatorCode && !CODE_PATTERN.test(indicatorCode))) return null
  if (indicatorCode) {
    return { name: 'indicator-detail', params: { systemId, indicatorCode }, query: cleanQuery }
  }
  return { name: 'system-detail', params: { systemId }, query: cleanQuery }
}
