import { expect, test } from '@playwright/test'
import { bootstrapPayload } from '../fixtures/aiConsult.js'

for (const width of [320, 360, 390, 430]) {
  test(`AI welcome uses the full ${width}px viewport without overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.route('**/api/v1/ai-consult/**', async (route) => {
      const isGuest = route.request().url().endsWith('/guest-contexts')
      const data = isGuest
        ? { guest_token: 'a'.repeat(43), report_code: 'R1', customer_id: 1001 }
        : bootstrapPayload
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 200, message: 'ok', data }) })
    })
    await page.goto('/#/ai-consult?reportId=R1&userId=1001')
    await expect(page.getByTestId('ai-consult-welcome')).toBeVisible()
    await expect(page.getByText('咨询服务暂未开放')).toBeVisible()
    await expect(page.getByTestId('ai-question')).toHaveCount(3)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await expect(page.getByTestId('ai-notice-open')).toHaveCount(0)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  })
}
