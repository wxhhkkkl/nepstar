import { describe, expect, it } from 'vitest'
import { toReportViewModel } from '@/data/reportAdapter.js'
import { buildHomeFlow, getSystemById, getVisibleSystems, isWarningScore } from '@/utils/report.js'
import { reportDto } from '../fixtures/reportDto.js'

const report = toReportViewModel(reportDto)

describe('report data selectors', () => {
  it('filters systems for the current profile', () => {
    expect(getVisibleSystems(report).map(({ id }) => id)).toEqual([
      'endocrine', 'lung', 'bone', 'cardio', 'digest', 'female', 'immune',
    ])
  })

  it('returns the same shared object and null for unknown ids', () => {
    expect(getSystemById(report, 'bone')).toBe(report.systems.find(({ systemCode }) => systemCode === 'SYS_BONE'))
    expect(getSystemById(report, 'unknown')).toBeNull()
  })

  it('follows the order the interface returned, not a hardcoded one', () => {
    // 把接口顺序倒过来，渲染顺序必须跟着变——前端不自行推断业务顺序（FR-013）
    const reversed = { ...report, systemOrder: [...report.systemOrder].reverse() }
    const ids = buildHomeFlow(reversed)
      .filter((e) => e.type === 'system')
      .map((e) => e.systemId)
    expect(ids).toEqual([
      'immune', 'female', 'digest', 'cardio', 'bone', 'lung', 'endocrine',
    ])
  })

  it('puts each recommendation immediately after its own system, including the first system', () => {
    expect(
      buildHomeFlow(report).map((e) => `${e.type}:${e.systemId}`),
    ).toEqual([
      'system:endocrine',
      'recommendation:endocrine',
      'system:lung',
      'system:bone',
      'recommendation:bone',
      'system:cardio',
      'system:digest',
      'system:female',
      'system:immune',
    ])
  })

  it.each([
    ['endocrine', 'bone', 'lung', 'cardio', 'digest', 'female', 'immune'],
    ['bone', 'endocrine', 'lung', 'cardio', 'digest', 'female', 'immune'],
    ['immune', 'female', 'digest', 'cardio', 'lung', 'bone', 'endocrine'],
  ])('keeps plans adjacent when the server changes system order (%s first)', (...systemOrder) => {
    const flow = buildHomeFlow({ ...report, systemOrder })
    expect(flow.filter(entry => entry.type === 'system').map(entry => entry.systemId)).toEqual(systemOrder)
    flow.forEach((entry, index) => {
      if (entry.type !== 'recommendation') return
      expect(flow[index - 1]).toMatchObject({ type: 'system', systemId: entry.systemId, system: entry.system })
    })
  })

  it('omits recommendation entries for systems without one', () => {
    const types = buildHomeFlow(report).filter((e) => e.type === 'recommendation')
    expect(types.map((e) => e.systemId)).toEqual(['endocrine', 'bone'])
  })

  it('derives score warning from the configured threshold', () => {
    expect(isWarningScore(report)).toBe(true)
    expect(isWarningScore({ score: 70, warningThreshold: 70 })).toBe(false)
  })
})
