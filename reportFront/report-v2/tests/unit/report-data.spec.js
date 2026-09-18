import { describe, expect, it } from 'vitest'
import { reportSnapshot } from '@/data/report.js'

describe('report snapshot contract', () => {
  it('keeps the approved report summary', () => {
    expect(reportSnapshot.score).toBe(68)
    expect(reportSnapshot.warningThreshold).toBe(70)
    expect(reportSnapshot.profileGender).toBe('female')
  })

  it('contains unique system ids and seven female systems', () => {
    const ids = reportSnapshot.systems.map(({ id }) => id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(reportSnapshot.systems.filter((system) => system.applicableGenders.includes('female'))).toHaveLength(7)
  })

  it('associates recommendations only with endocrine and bone', () => {
    const recommended = reportSnapshot.systems.filter(({ recommendation }) => recommendation)
    expect(recommended.map(({ id }) => id)).toEqual(['endocrine', 'bone'])
    expect(recommended[0].recommendation.title).toContain('睡眠健康')
    expect(recommended[1].recommendation.title).toContain('钙流失健康')
  })

  it('provides a supported visualization for every visible system', () => {
    const supported = ['line', 'radial-gauge', 'horizontal-bars', 'matrix', 'radial-orbit', 'network', 'vertical-bars']
    reportSnapshot.systems
      .filter((system) => system.applicableGenders.includes('female'))
      .forEach((system) => expect(supported).toContain(system.visualization.type))
  })
})
