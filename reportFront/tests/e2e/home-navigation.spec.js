import { expect, test } from '@playwright/test'
import { reportDto } from '../fixtures/reportDto.js'

test.use({ viewport: { width: 414, height: 896 }, reducedMotion: 'no-preference' })

for (const navigation of ['page-back', 'browser-back']) {
  test(`returning home with ${navigation} restores visible cards without replaying the reveal`, async ({ page }) => {
    await page.route('**/api/v1/report-view/R1/**', async (route) => {
      const path = new URL(route.request().url()).pathname
      const data = path.endsWith('/home')
        ? reportDto
        : { system: reportDto.systems.find((system) => path.endsWith(`/systems/${system.system_code}`)) }
      await route.fulfill({ json: { code: 200, data } })
    })

    await page.goto('/#/?reportId=R1&userId=1001')
    await expect(page.getByTestId('report-home')).toBeVisible()
    const card = page.locator('.systems-section [data-system-id="digest"]')

    for (let visit = 0; visit < 2; visit++) {
      await card.scrollIntoViewIfNeeded()
      await expect(card).toHaveCSS('opacity', '1')
      await card.click()
      const before = await page.evaluate(() => Number(sessionStorage.getItem('longevityReportV2ScrollY')))
      expect(before).toBeGreaterThan(0)
      await expect(page.locator('.detail-nav')).toBeVisible()

      if (navigation === 'browser-back') await page.goBack()
      else await page.getByRole('link', { name: '返回长寿指数报告', exact: true }).click()

      await expect(page.getByTestId('report-home')).toBeVisible()
      await expect.poll(() => page.evaluate(() => Math.abs(window.scrollY - Number(sessionStorage.getItem('longevityReportV2ScrollY'))))).toBeLessThanOrEqual(2)
      // 返回时所有卡片应立即可读，不依赖新一轮视口回调（包括视口外的卡片）。
      await expect.poll(() => page.locator('.systems-section .data-card').evaluateAll((cards) =>
        cards.every((element) => getComputedStyle(element).opacity === '1'),
      )).toBe(true)
      await expect(page.getByTestId('ai-consult-entry')).toBeVisible()
    }

    // 刷新仍从顶部开始，并恢复首次阅读时的按需入场效果。
    await page.reload()
    await expect(page.getByTestId('report-home')).toBeVisible()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
    await expect(card).toHaveCSS('opacity', '0')
  })
}
