import { describe, expect, it } from 'vitest'
import { scoreAppearance } from '@/utils/scoreColor.js'

describe('report score colour semantics: higher is better', () => {
  it.each([
    [0, 'attention'], [74, 'attention'], [74.9, 'attention'],
    [75, 'improve'], [84, 'improve'], [84.9, 'improve'],
    [85, 'good'], [94, 'good'], [94.9, 'good'],
    [95, 'excellent'], [100, 'excellent'],
  ])('classifies score %s as %s at band boundaries', (score, key) => {
    expect(scoreAppearance(score).key).toBe(key)
  })

  it.each([null, undefined, '', ' ', false, true, [], {}, NaN, Infinity, -1, 101, '未提供'])('does not treat missing or invalid input %s as a low score', value => {
    expect(scoreAppearance(value)).toMatchObject({ key: 'unknown', label: '暂无评分', color: '#778497' })
  })

  it('uses the same colours for numeric strings and numbers, preserving a real zero', () => {
    expect(scoreAppearance('95')).toBe(scoreAppearance(95))
    expect(scoreAppearance('0')).toMatchObject({ key: 'attention', color: '#b34d43' })
  })
})
