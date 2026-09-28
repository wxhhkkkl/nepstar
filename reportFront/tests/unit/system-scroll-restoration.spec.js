// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { saveSystemDetailScroll, restoreSystemDetailScroll } from '@/composables/useScrollRestoration.js'

describe('system-detail scroll restoration', () => {
  beforeEach(() => {
    sessionStorage.clear()
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 468 })
    vi.stubGlobal('requestAnimationFrame', (callback) => callback())
    window.scrollTo = vi.fn()
  })

  it('restores the exact reading position only for the matching report and system', async () => {
    saveSystemDetailScroll('R1', 'SYS_BONE')
    await restoreSystemDetailScroll('R1', 'SYS_BONE')
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 468, left: 0, behavior: 'auto' })
    await restoreSystemDetailScroll('R1', 'SYS_BONE')
    expect(window.scrollTo).toHaveBeenCalledTimes(1)
  })

  it('does not carry a scroll position into a different report or system', async () => {
    saveSystemDetailScroll('R1', 'SYS_BONE')
    await restoreSystemDetailScroll('R2', 'SYS_BONE')
    expect(window.scrollTo).not.toHaveBeenCalled()
  })
})
