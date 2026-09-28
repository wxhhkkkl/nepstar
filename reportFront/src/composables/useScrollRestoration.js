export const HOME_SCROLL_KEY = 'longevityReportV2ScrollY'
const HOME_SCROLL_RESTORE_KEY = 'longevityReportV2ShouldRestoreScroll'
const SYSTEM_SCROLL_KEY = 'longevityReportV2SystemReturnScroll'

export function saveHomeScroll() {
  const value = Number(window.scrollY)
  if (Number.isFinite(value) && value >= 0) {
    sessionStorage.setItem(HOME_SCROLL_KEY, String(value))
    // 仅在从首页进入二级页、随后返回时恢复位置；刷新首页应始终从顶部开始。
    sessionStorage.setItem(HOME_SCROLL_RESTORE_KEY, 'true')
  }
}

export function restoreHomeScroll() {
  const shouldRestore = sessionStorage.getItem(HOME_SCROLL_RESTORE_KEY) === 'true'
  sessionStorage.removeItem(HOME_SCROLL_RESTORE_KEY)
  if (!shouldRestore) return Promise.resolve()

  const saved = Number(sessionStorage.getItem(HOME_SCROLL_KEY))
  if (!Number.isFinite(saved) || saved <= 0) return Promise.resolve()

  // 必须等真实报告取代骨架屏后再滚动，否则内容高度变化会导致视觉位置偏移。
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: saved, left: 0, behavior: 'auto' })
        resolve()
      })
    })
  })
}

export function saveSystemDetailScroll(reportCode, systemCode) {
  const value = Number(window.scrollY)
  if (!reportCode || !systemCode || !Number.isFinite(value) || value < 0) return
  sessionStorage.setItem(SYSTEM_SCROLL_KEY, JSON.stringify({ reportCode, systemCode, scrollY: value }))
}

export function restoreSystemDetailScroll(reportCode, systemCode) {
  const raw = sessionStorage.getItem(SYSTEM_SCROLL_KEY)
  sessionStorage.removeItem(SYSTEM_SCROLL_KEY)
  if (!raw) return Promise.resolve()

  let saved
  try {
    saved = JSON.parse(raw)
  } catch {
    return Promise.resolve()
  }
  if (
    saved.reportCode !== reportCode ||
    saved.systemCode !== systemCode ||
    !Number.isFinite(saved.scrollY) ||
    saved.scrollY <= 0
  ) return Promise.resolve()

  // 等系统详情的真实数据取代骨架屏后，再恢复点击前的位置。
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: saved.scrollY, left: 0, behavior: 'auto' })
        resolve()
      })
    })
  })
}
