import { describe, expect, it } from 'vitest'
import { reportSnapshot } from '@/data/report.js'
import { buildHomeFlow, getSystemById, getVisibleSystems, isWarningScore } from '@/utils/report.js'

describe('report data selectors', () => {
  it('filters systems for the current profile', () => {
    expect(getVisibleSystems(reportSnapshot).map(({ id }) => id)).toEqual([
      'endocrine', 'lung', 'bone', 'cardio', 'digest', 'female', 'immune',
    ])
  })

  it('returns the same shared object and null for unknown ids', () => {
    expect(getSystemById(reportSnapshot, 'bone')).toBe(reportSnapshot.systems.find(({ id }) => id === 'bone'))
    expect(getSystemById(reportSnapshot, 'unknown')).toBeNull()
  })

  it('builds recommendation entries directly after their issue', () => {
    expect(buildHomeFlow(reportSnapshot).map((entry) => `${entry.type}:${entry.systemId ?? entry.systemIds.join(',')}`)).toEqual([
      'system-group:endocrine,lung',
      'recommendation:endocrine',
      'system:bone',
      'recommendation:bone',
      'system:cardio',
      'system:digest',
      'system:female',
      'system:immune',
    ])
  })

  it('derives score warning from the configured threshold', () => {
    expect(isWarningScore(reportSnapshot)).toBe(true)
    expect(isWarningScore({ score: 70, warningThreshold: 70 })).toBe(false)
  })
})
