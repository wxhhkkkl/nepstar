import { it, expect, vi } from 'vitest'
import { fetchPlanDetail, ERROR_KINDS } from '@/api/reportClient.js'
import { adaptPlanDetail } from '@/data/reportAdapter.js'
import { planDetail } from '../fixtures/planDetail.js'

it('requests the fixed report plan and adapts only its real product assets', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ code: 200, data: planDetail }) }))
  const data = await fetchPlanDetail('R1', 17, 1001, 'SYS_ENDOCRINE_PINEAL')
  expect(fetch.mock.calls[0][0]).toContain('/report-view/R1/plans/17?customer_id=1001&indicator_code=SYS_ENDOCRINE_PINEAL')
  const adapted = adaptPlanDetail(data)
  expect(adapted.primary_indicator.indicator_score).toBe(98)
  expect(adapted.products[0].images[0].url).toContain('sleep-health-management-plan')
})
it('maps a stale plan to its own error state', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ code: 404, message: 'report.plan_not_found' }) }))
  await expect(fetchPlanDetail('R1', 17, 1001)).rejects.toMatchObject({ kind: ERROR_KINDS.PLAN_NOT_FOUND })
  vi.unstubAllGlobals()
})

it('uses the same real local asset mapping inside maintained product image blocks', () => {
  const dto = structuredClone(planDetail)
  dto.products[0].detail_blocks = [{ type: 'image', url: './assets/sleep-health-management-plan.png', alt: '真实图' }]
  expect(adaptPlanDetail(dto).products[0].detail_blocks[0].url).toContain('/src/assets/sleep-health-management-plan.png')
})
