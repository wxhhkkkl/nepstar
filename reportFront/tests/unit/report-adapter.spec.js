import { describe, expect, it } from 'vitest'
import { toReportViewModel, toSystemViewModel } from '@/data/reportAdapter.js'
import { reportAssets } from '@/data/report.js'
import { assets, reportDto } from '../fixtures/reportDto.js'

describe('report adapter (DTO → ViewModel)', () => {
  it('maps report-level fields to the shape the components expect', () => {
    const vm = toReportViewModel(reportDto, { assets })
    expect(vm.score).toBe(68)
    expect(vm.warningThreshold).toBe(70)
    expect(vm.profileGender).toBe('female')
    expect(vm.peerPercent).toBe(38)
    expect(vm.actualAge).toBe(57)
    expect(vm.biologicalAge).toBe(57.7)
    expect(vm.healthyLifeExpectancy).toBe(86.1)
    expect(vm.reportDate).toBe('2026-08-03'.replaceAll('-', '.'))
    expect(vm.assets.aiConsultImage).toBe(assets.aiConsultImage)
  })

  it('derives systemOrder from the order the interface returned', () => {
    const vm = toReportViewModel(reportDto)
    expect(vm.systemOrder).toEqual([
      'endocrine', 'lung', 'bone', 'cardio', 'digest', 'female', 'immune',
    ])
  })

  it('supplies chart type and tone on the frontend side', () => {
    const cardio = toReportViewModel(reportDto).systems.find((s) => s.systemCode === 'SYS_CARDIO')
    expect(cardio.visualization.type).toBe('line')
    expect(cardio.tone).toBe('violet')
    expect(cardio.icon).toBe('heart')
  })

  it('uses the trend series for the cardiac chart and keeps it ascending', () => {
    const cardio = toReportViewModel(reportDto).systems.find((s) => s.systemCode === 'SYS_CARDIO')
    expect(cardio.visualization.series).toEqual([82, 85, 83, 86, 84, 88])
    expect(cardio.visualization.categories).toEqual([])
  })

  it('uses the per-report indicator series for systems without a trend', () => {
    const bone = toReportViewModel(reportDto).systems.find((s) => s.systemCode === 'SYS_BONE')
    expect(bone.visualization.series).toEqual([54])
    expect(bone.visualization.categories).toEqual(['骨骼指标A'])
  })

  it('builds tags from the first three indicators', () => {
    const endo = toReportViewModel(reportDto).systems.find((s) => s.systemCode === 'SYS_ENDOCRINE')
    expect(endo.tags).toEqual(['内分泌指标A 58'])
  })

  it('maps a recommendation and carries the product image', () => {
    const endo = toReportViewModel(reportDto).systems.find((s) => s.systemCode === 'SYS_ENDOCRINE')
    expect(endo.recommendation.title).toBe('睡眠健康管理方案')
    expect(endo.recommendation.tags).toEqual(['睡眠节律管理'])
    expect(endo.recommendation.image).toBe('./睡眠管理.png')
    expect(endo.recommendation.imageAlt).toBe('深蓝金色礼盒')
  })

  it('resolves backend plan image URLs to bundled assets, including legacy names', () => {
    const dto = structuredClone(reportDto)
    dto.systems[0].recommendation.products[0].image_url = 'http://reports.local/睡眠健康管理方案.png'
    dto.systems[2].recommendation.products[0].image_url = '/assets/calcium-loss-health-management-plan.png'
    const vm = toReportViewModel(dto)
    expect(vm.systems.find((s) => s.systemCode === 'SYS_ENDOCRINE').recommendation.image).toBe(reportAssets.sleepPlanImage)
    expect(vm.systems.find((s) => s.systemCode === 'SYS_BONE').recommendation.image).toBe(reportAssets.calciumPlanImage)
  })

  it('resolves the consultation entry URL to its bundled asset', () => {
    const dto = structuredClone(reportDto)
    dto.ai_consult.entry_url = '/assets/ai-longevity-consult-chat-design.png'
    const vm = toReportViewModel(dto)
    expect(vm.aiConsult.entry_url).toBe(reportAssets.aiConsultImage)
  })

  it('leaves recommendation null when the interface returned none', () => {
    const immune = toReportViewModel(reportDto).systems.find((s) => s.systemCode === 'SYS_IMMUNE')
    expect(immune.recommendation).toBeNull()
  })

  it('tolerates a missing trend block (older systems)', () => {
    const vm = toSystemViewModel({
      system_code: 'SYS_BONE',
      name: '骨骼',
      score: 54,
      visualization: { categories: ['a'], series: [1] },
    })
    expect(vm.visualization.series).toEqual([1])
  })

  it('falls back to empty structures for missing optional fields', () => {
    const vm = toSystemViewModel({ system_code: 'SYS_X', name: 'X', score: null })
    expect(vm.tags).toEqual([])
    expect(vm.indicators).toEqual([])
    expect(vm.direct).toEqual([])
    expect(vm.actions).toEqual([])
    expect(vm.recommendation).toBeNull()
  })
})
