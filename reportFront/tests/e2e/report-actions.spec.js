import { expect, test } from '@playwright/test'
import { bootstrapPayload } from '../fixtures/aiConsult.js'
import { reportDto } from '../fixtures/reportDto.js'

test.use({ viewport: { width: 390, height: 844 } })

async function mockReportAndConsult(page) {
  const dto = structuredClone(reportDto)
  dto.report.report_code = 'R1'
  dto.report.serial_number = 'R1'
  dto.features.save_report_enabled = true
  await page.route(/\/api\/v1\/report-view\/R1\/home\?customer_id=1001(?:$|&)/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 200, message: 'success', data: dto }),
    }),
  )
  await page.route('**/api/v1/ai-consult/**', (route) => {
    const url = new URL(route.request().url())
    const data = url.pathname.endsWith('/guest-contexts')
      ? { guest_token: 'a'.repeat(43), report_code: 'R1', customer_id: 1001 }
      : bootstrapPayload
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 200, message: 'ok', data }),
    })
  })
}

test('AI entry remains fixed and routes to consultation with the current public report', async ({ page }) => {
  await mockReportAndConsult(page)
  await page.goto('/#/?reportId=R1&userId=1001')
  await expect(page.getByTestId('report-home')).toBeVisible()
  const entry = page.getByTestId('ai-consult-entry')
  const initial = await entry.evaluate((element) => ({ rect: element.getBoundingClientRect().toJSON(), position: getComputedStyle(element).position }))
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForFunction(() => window.scrollY > 1000)
  const after = await entry.evaluate((element) => element.getBoundingClientRect().toJSON())
  expect(initial.position).toBe('fixed')
  expect(initial.rect.width).toBeGreaterThanOrEqual(44)
  expect(initial.rect.height).toBeGreaterThanOrEqual(44)
  expect(Math.abs(initial.rect.bottom - after.bottom)).toBeLessThan(2)
  await expect(entry).toHaveAttribute('href', /#\/ai-consult\?reportId=R1&userId=1001/)
  await entry.click()
  await expect(page.getByTestId('ai-consult-welcome')).toBeVisible()
  await expect(page).toHaveURL(/#\/ai-consult\?reportId=R1&userId=1001/)
})

test('returning from consultation restores the report reading position', async ({ page }) => {
  await mockReportAndConsult(page)
  await page.goto('/#/?reportId=R1&userId=1001')
  await expect(page.getByTestId('report-home')).toBeVisible()
  await page.locator('[data-system-id="cardio"]').scrollIntoViewIfNeeded()
  const before = await page.evaluate(() => window.scrollY)
  expect(before).toBeGreaterThan(0)

  await page.getByTestId('ai-consult-entry').click()
  await expect(page.getByTestId('ai-consult-welcome')).toBeVisible()
  await page.getByRole('link', { name: '返回报告' }).click()
  await expect(page.getByTestId('report-home')).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThanOrEqual(before - 5)
})

test('save action downloads the existing long image and gives feedback', async ({ page }) => {
  await mockReportAndConsult(page)
  await page.goto('/#/?reportId=R1&userId=1001')
  await expect(page.getByTestId('report-home')).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page.locator('#saveReport').click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('longevity-report-v2-mobile.png')
  await expect(page.locator('#saveReport')).toContainText('已保存')
  await expect(page.locator('#saveToast')).toHaveClass(/is-showing/)
})
