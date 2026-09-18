export function clampScore(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  return Math.min(100, Math.max(0, numeric))
}

export function buildLinePoints(values, { left = 18, right = 302, top = 34, bottom = 126 } = {}) {
  if (!Array.isArray(values) || values.length === 0) return []
  const safe = values.map(clampScore)
  const min = Math.min(...safe)
  const max = Math.max(...safe)
  const spread = Math.max(max - min, 1)
  return safe.map((value, index) => ({
    x: left + index * ((right - left) / Math.max(safe.length - 1, 1)),
    y: bottom - ((value - min) / spread) * (bottom - top),
    value,
  }))
}

export function buildRadialOffset(value, circumference = 302) {
  return circumference * (1 - clampScore(value) / 100)
}

export function buildRadarPoints(values, { center = 100, radius = 72 } = {}) {
  if (!Array.isArray(values) || values.length === 0) return []
  return values.map((value, index) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / values.length
    const factor = clampScore(value) / 100
    return { x: center + Math.cos(angle) * radius * factor, y: center + Math.sin(angle) * radius * factor }
  })
}
