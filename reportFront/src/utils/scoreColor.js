// Report vitality scores: higher is better. These bands describe display scores,
// never ages, measurements, score changes, weights or clinical abnormal levels.
export const SCORE_BANDS = Object.freeze([
  { key: 'excellent', min: 95, label: '优秀', range: '95–100', color: '#18785d', accent: '#5ab99b', soft: '#e8f5ee', border: '#b9dccc' },
  { key: 'good', min: 85, label: '良好', range: '85–94', color: '#2475b5', accent: '#78afdc', soft: '#eaf2fc', border: '#c3d8ef' },
  { key: 'improve', min: 75, label: '建议改善', range: '75–84', color: '#946316', accent: '#d9b164', soft: '#fff5e4', border: '#ead3aa' },
  { key: 'attention', min: 0, label: '重点关注', range: '0–74', color: '#b34d43', accent: '#df978b', soft: '#fbeeea', border: '#eac4bd' },
])
const UNKNOWN = Object.freeze({ key: 'unknown', label: '暂无评分', color: '#778497', accent: '#b1bdca', soft: '#eff2f5', border: '#d8dfe7' })

export function scoreAppearance(value) {
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '') return UNKNOWN
  const score = Number(value)
  if (!Number.isFinite(score) || score < 0 || score > 100) return UNKNOWN
  return SCORE_BANDS.find(band => score >= band.min)
}

export function scoreColor(value) {
  return scoreAppearance(value).color
}

export function scoreStyle(value) {
  const band = scoreAppearance(value)
  return {
    '--score-color': band.color,
    '--score-accent': band.accent,
    '--score-soft': band.soft,
    '--score-border': band.border,
  }
}
