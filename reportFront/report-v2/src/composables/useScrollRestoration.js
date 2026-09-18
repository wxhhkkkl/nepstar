import { nextTick, onMounted } from 'vue'

export const HOME_SCROLL_KEY = 'longevityReportV2ScrollY'

export function saveHomeScroll() {
  const value = Number(window.scrollY)
  if (Number.isFinite(value) && value >= 0) sessionStorage.setItem(HOME_SCROLL_KEY, String(value))
}

export function useHomeScrollRestoration() {
  onMounted(async () => {
    const saved = Number(sessionStorage.getItem(HOME_SCROLL_KEY))
    if (!Number.isFinite(saved) || saved <= 0) return
    await nextTick()
    requestAnimationFrame(() => window.scrollTo(0, saved))
  })
}
