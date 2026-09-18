import { describe, expect, it } from 'vitest'
import { toReportViewModel } from '@/data/reportAdapter.js'
import { assets, reportDto } from '../fixtures/reportDto.js'

const report = toReportViewModel(reportDto, { assets })

describe('report view model contract', () => {
  it('keeps the warning threshold semantics', () => {
    expect(report.score).toBe(68)
    expect(report.warningThreshold).toBe(70)
    expect(report.profileGender).toBe('female')
  })

  it('contains unique system ids and seven systems for the current profile', () => {
    const ids = report.systems.map(({ id }) => id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(report.systems).toHaveLength(7)
  })

  it('associates recommendations only with the systems that returned one', () => {
    const recommended = report.systems.filter(({ recommendation }) => recommendation)
    expect(recommended.map(({ id }) => id)).toEqual(['SYS_ENDOCRINE', 'SYS_BONE'])
    expect(recommended[0].recommendation.title).toContain('睡眠健康')
    expect(recommended[1].recommendation.title).toContain('钙流失健康')
  })

  it('provides a supported visualization for every system', () => {
    const supported = ['line', 'radial-gauge', 'horizontal-bars', 'matrix', 'radial-orbit', 'network', 'vertical-bars']
    report.systems.forEach((system) => expect(supported).toContain(system.visualization.type))
  })
})
