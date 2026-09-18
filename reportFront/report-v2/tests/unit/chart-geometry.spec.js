import { describe, expect, it } from 'vitest'
import { buildLinePoints, buildRadialOffset, buildRadarPoints, clampScore } from '@/utils/chartGeometry.js'

describe('chart geometry', () => {
  it('clamps scores to the visible range', () => {
    expect(clampScore(-8)).toBe(0)
    expect(clampScore(54)).toBe(54)
    expect(clampScore(108)).toBe(100)
    expect(clampScore('bad')).toBe(0)
  })

  it('creates stable line points for empty and repeated values', () => {
    expect(buildLinePoints([])).toEqual([])
    const points = buildLinePoints([80, 80])
    expect(points).toHaveLength(2)
    expect(points.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y))).toBe(true)
  })

  it('calculates radial progress and radar polygons', () => {
    expect(buildRadialOffset(100, 302)).toBe(0)
    expect(buildRadialOffset(0, 302)).toBe(302)
    expect(buildRadarPoints([100, 50, 75])).toHaveLength(3)
  })
})
