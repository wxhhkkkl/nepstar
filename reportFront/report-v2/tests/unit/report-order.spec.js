import { describe, expect, it } from 'vitest'
import { toReportViewModel } from '@/data/reportAdapter.js'
import { buildHomeFlow, getSystemById, getVisibleSystems, isWarningScore } from '@/utils/report.js'
import { reportDto } from '../fixtures/reportDto.js'

const report = toReportViewModel(reportDto)

describe('report data selectors', () => {
  it('filters systems for the current profile', () => {
    expect(getVisibleSystems(report).map(({ id }) => id)).toEqual([
      'SYS_ENDOCRINE', 'SYS_LUNG', 'SYS_BONE', 'SYS_CARDIO', 'SYS_DIGEST', 'SYS_FEMALE', 'SYS_IMMUNE',
    ])
  })

  it('returns the same shared object and null for unknown ids', () => {
    expect(getSystemById(report, 'SYS_BONE')).toBe(report.systems.find(({ id }) => id === 'SYS_BONE'))
    expect(getSystemById(report, 'unknown')).toBeNull()
  })

  it('follows the order the interface returned, not a hardcoded one', () => {
    // 把接口顺序倒过来，渲染顺序必须跟着变——前端不自行推断业务顺序（FR-013）
    const reversed = { ...report, systemOrder: [...report.systemOrder].reverse() }
    const ids = buildHomeFlow(reversed)
      .filter((e) => e.type === 'system-group' || e.type === 'system')
      .flatMap((e) => e.systemIds ?? [e.systemId])
    expect(ids).toEqual([
      'SYS_IMMUNE', 'SYS_FEMALE', 'SYS_DIGEST', 'SYS_CARDIO', 'SYS_BONE', 'SYS_LUNG', 'SYS_ENDOCRINE',
    ])
  })

  it('groups the first two systems and puts each recommendation right after its issue', () => {
    expect(
      buildHomeFlow(report).map((e) => `${e.type}:${e.systemId ?? e.systemIds.join(',')}`),
    ).toEqual([
      'system-group:SYS_ENDOCRINE,SYS_LUNG',
      'recommendation:SYS_ENDOCRINE',
      'system:SYS_BONE',
      'recommendation:SYS_BONE',
      'system:SYS_CARDIO',
      'system:SYS_DIGEST',
      'system:SYS_FEMALE',
      'system:SYS_IMMUNE',
    ])
  })

  it('omits recommendation entries for systems without one', () => {
    const types = buildHomeFlow(report).filter((e) => e.type === 'recommendation')
    expect(types.map((e) => e.systemId)).toEqual(['SYS_ENDOCRINE', 'SYS_BONE'])
  })

  it('derives score warning from the configured threshold', () => {
    expect(isWarningScore(report)).toBe(true)
    expect(isWarningScore({ score: 70, warningThreshold: 70 })).toBe(false)
  })
})
