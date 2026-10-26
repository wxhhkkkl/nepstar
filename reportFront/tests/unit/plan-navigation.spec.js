import { describe, it, expect, vi } from 'vitest'
import { createPlanNavigation, readPlanNavigation, planDetailRoute, planReturnRoute, savePlanReading, consumePlanReading } from '@/utils/planNavigation.js'

const query = { reportId: 'R1', userId: '1001', guest_token: 'never-store' }
const origin = { name: 'ai-consult', query: { ...query, planId: '8' } }
const identity = { reportId: 'R1', userId: '1001', planId: '17', indicatorCode: 'SYS_BONE_OSTEO' }

describe('bounded plan reading navigation', () => {
  it('keeps the original AI context and excludes credentials', () => {
    const key = createPlanNavigation(identity, origin, { scrollY: 420, plansExpanded: true })
    expect(readPlanNavigation(key, identity).origin.query.planId).toBe('8')
    expect(JSON.stringify(sessionStorage)).not.toContain('never-store')
    expect(planDetailRoute(query, 17, identity.indicatorCode, key).query).toEqual({ ...identity, planId: undefined, planNavKey: key })
  })
  it('rejects cross-report, expired and damaged snapshots', () => {
    const key = createPlanNavigation(identity, origin)
    expect(readPlanNavigation(key, { ...identity, userId: '2' })).toBeNull()
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 31 * 60 * 1000)
    expect(readPlanNavigation(key, identity)).toBeNull()
    expect(readPlanNavigation('broken', identity)).toBeNull()
  })
  it('only restores reading state once and returns to a controlled route', () => {
    const key = createPlanNavigation(identity, origin)
    savePlanReading(key, identity, { scrollY: 260, expandedProductIds: [30] })
    expect(consumePlanReading(key, identity, 'plan').scrollY).toBe(260)
    expect(consumePlanReading(key, identity, 'plan')).toBeNull()
    expect(planReturnRoute({ ...query, fromPlan: '1', planId: '17', indicatorCode: identity.indicatorCode, planNavKey: key }).name).toBe('plan-detail')
    expect(createPlanNavigation(identity, { name: 'unknown', query })).toBe('')
  })
  it('bounds the store and tolerates disabled storage', () => {
    for (let i = 1; i <= 24; i++) createPlanNavigation({ ...identity, planId: String(i) }, origin)
    expect(sessionStorage.length).toBeLessThanOrEqual(20)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    expect(createPlanNavigation(identity, origin)).toBe('')
  })
})
