import { expect, test } from '@playwright/test'

for (const width of [320, 375, 390, 768, 1440]) {
  test(`home fits ${width}px without clipped products`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 700 ? 844 : 1000 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/#/')
    const layout = await page.evaluate(() => ({ viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth }))
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewport)
    await expect(page.locator('[data-system-id]')).toHaveCount(7)
    for (const image of await page.locator('.issue-plan-visual img').all()) {
      const visible = await image.evaluate((element) => {
        const imageRect = element.getBoundingClientRect()
        const parentRect = element.parentElement.getBoundingClientRect()
        return imageRect.left >= parentRect.left - 1 && imageRect.right <= parentRect.right + 1 && imageRect.top >= parentRect.top - 1 && imageRect.bottom <= parentRect.bottom + 1
      })
      expect(visible).toBe(true)
    }
    if (width === 390) {
      const trailingBlank = await page.evaluate(() => {
        const footerBottom = document.querySelector('.report-v2 footer').getBoundingClientRect().bottom + window.scrollY
        return document.documentElement.scrollHeight - footerBottom
      })
      expect(trailingBlank).toBeLessThanOrEqual(140)
    }
  })
}
