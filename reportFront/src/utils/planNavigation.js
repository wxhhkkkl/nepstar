import { createUuid } from '@/utils/uuid.js'

const PREFIX = 'reportPlanReading:'
const TTL = 30 * 60 * 1000
const origins = new Set(['home', 'system-detail', 'ai-consult'])
const codePattern = /^[A-Z][A-Z0-9_]{1,63}$/
const positive = value => /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0

function cleanQuery(query = {}) {
  return Object.fromEntries(Object.entries(query).filter(([key, value]) =>
    typeof value === 'string' && !/token|credential|secret|authorization/i.test(key)))
}
export function planBaseQuery(query = {}) {
  const result = cleanQuery(query)
  const reportId = result.reportId || result.reportCode
  const userId = result.userId || result.customerId
  for (const key of ['reportCode', 'customerId', 'fromPlan', 'fromAiConsult', 'planId', 'indicatorCode', 'planNavKey', 'planSourceKey', 'returnSystem']) delete result[key]
  if (reportId) result.reportId = reportId
  if (positive(userId)) result.userId = String(userId)
  return result
}
function normalized(identity) {
  const base = planBaseQuery(identity)
  return { reportId: base.reportId, userId: base.userId, planId: String(identity.planId || ''), indicatorCode: identity.indicatorCode || '' }
}
function validIdentity(i) {
  return typeof i.reportId === 'string' && i.reportId.length > 0 && positive(i.userId) && positive(i.planId) && codePattern.test(i.indicatorCode)
}
function store(key, record) {
  try { sessionStorage.setItem(PREFIX + key, JSON.stringify(record)); return true } catch { return false }
}
export function discardPlanNavigation(key) {
  try { sessionStorage.removeItem(PREFIX + key) } catch { /* Reading remains available. */ }
}
export function readPlanNavigation(key, identity) {
  if (typeof key !== 'string' || !/^[a-f0-9-]{36}$/i.test(key)) return null
  try {
    const record = JSON.parse(sessionStorage.getItem(PREFIX + key))
    const i = normalized(identity)
    if (!record || record.version !== 1 || !Number.isFinite(record.updatedAt) || Date.now() - record.updatedAt >= TTL || record.updatedAt > Date.now() + 60000 || !validIdentity(record.identity) ||
      !origins.has(record.origin?.name) || Object.keys(i).some(k => i[k] && i[k] !== record.identity[k])) return null
    const oq = record.origin.query
    if (oq?.reportId !== i.reportId || oq?.userId !== i.userId || oq.planNavKey === key) return null
    const visited = new Set([key])
    let next = oq.planNavKey
    while (next) {
      if (visited.has(next) || visited.size >= 20) return null
      visited.add(next)
      const parent = JSON.parse(sessionStorage.getItem(PREFIX + next))
      if (!parent || parent.identity.reportId !== i.reportId || parent.identity.userId !== i.userId || Date.now() - parent.updatedAt >= TTL) return null
      next = parent.origin?.query?.planNavKey
    }
    return record
  } catch { return null }
}
export function createPlanNavigation(identity, origin, reading = {}) {
  const i = normalized(identity)
  if (!validIdentity(i) || !origins.has(origin?.name)) return ''
  try {
    const keys = Object.keys(sessionStorage).filter(k => k.startsWith(PREFIX)).sort((a, b) => {
      try { return JSON.parse(sessionStorage.getItem(a)).updatedAt - JSON.parse(sessionStorage.getItem(b)).updatedAt } catch { return 0 }
    })
    while (keys.length >= 20) sessionStorage.removeItem(keys.shift())
    const key = createUuid()
    const query = { ...cleanQuery(origin.query), reportId: i.reportId, userId: i.userId }
    const params = origin.name === 'system-detail' && codePattern.test(origin.params?.systemId) ? { systemId: origin.params.systemId } : {}
    if (origin.name === 'system-detail' && !params.systemId) return ''
    return store(key, { version: 1, identity: i, origin: { name: origin.name, params, query },
      originReading: { scrollY: Math.max(0, Number(reading.scrollY) || 0), plansExpanded: reading.plansExpanded === true },
      planReading: {}, pendingRestore: null, createdAt: Date.now(), updatedAt: Date.now() }) ? key : ''
  } catch { return '' }
}
export function planDetailRoute(query, planId, indicatorCode, key = '') {
  return { name: 'plan-detail', params: { planId: String(planId) }, query: {
    ...planBaseQuery(query), ...(codePattern.test(indicatorCode) ? { indicatorCode } : {}), ...(key ? { planNavKey: key } : {}),
  } }
}
export function planReturnRoute(query = {}) {
  if (query.fromPlan !== '1' || !positive(query.planId) || !codePattern.test(query.indicatorCode)) return null
  return planDetailRoute(query, query.planId, query.indicatorCode, query.planNavKey)
}
export function savePlanReading(key, identity, reading) {
  const record = readPlanNavigation(key, identity)
  if (!record) return
  record.planReading = { scrollY: Math.max(0, Number(reading.scrollY) || 0),
    expandedProductIds: (reading.expandedProductIds || []).filter(positive).map(Number), imageIndexByProduct: reading.imageIndexByProduct || {} }
  record.pendingRestore = 'plan'
  record.updatedAt = Date.now()
  store(key, record)
}
export function markSourceRestore(key, identity) {
  const record = readPlanNavigation(key, identity)
  if (!record) return null
  record.pendingRestore = 'source'
  record.updatedAt = Date.now()
  store(key, record)
  return { ...record.origin, query: { ...record.origin.query, planSourceKey: key } }
}
export function consumePlanReading(key, identity, target) {
  const record = readPlanNavigation(key, identity)
  if (!record || record.pendingRestore !== target) return null
  record.pendingRestore = null
  record.updatedAt = Date.now()
  store(key, record)
  return target === 'source' ? record.originReading : record.planReading
}
export function consumeSourceReading(query, name, systemId) {
  const identity = { reportId: query.reportId, userId: query.userId }
  try {
    const direct = query.planSourceKey || query.planNavKey
    const keys = [...new Set([direct, ...Object.keys(sessionStorage).filter(k => k.startsWith(PREFIX)).map(k => k.slice(PREFIX.length))])]
    for (const key of keys) {
      const record = readPlanNavigation(key, identity)
      if (record?.origin.name === name && (!systemId || record.origin.params.systemId === systemId) && record.pendingRestore === 'source') {
        return consumePlanReading(key, identity, 'source')
      }
    }
  } catch { /* Storage is optional for reading. */ }
  return null
}
export function restoreScroll(scrollY, stillCurrent = () => true) {
  return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => {
    if (stillCurrent()) window.scrollTo({ top: Math.max(0, Number(scrollY) || 0), left: 0, behavior: 'auto' })
    resolve()
  })))
}
