import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 } })

test('AI entry remains fixed and points to the local design', async ({ page }) => {
  await page.goto('/#/')
  const entry = page.getByTestId('ai-consult-entry')
  const initial = await entry.evaluate((element) => ({ rect: element.getBoundingClientRect().toJSON(), position: getComputedStyle(element).position }))
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForFunction(() => window.scrollY > 1000)
  const after = await entry.evaluate((element) => element.getBoundingClientRect().toJSON())
  expect(initial.position).toBe('fixed')
  expect(initial.rect.width).toBeGreaterThanOrEqual(44)
  expect(initial.rect.height).toBeGreaterThanOrEqual(44)
  expect(Math.abs(initial.rect.bottom - after.bottom)).toBeLessThan(2)
  await expect(entry).toHaveAttribute('href', /AI长寿咨询聊天页设计稿\.png$/)
})

test('save action downloads the existing long image and gives feedback', async ({ page }) => {
  await page.goto('/#/')
  const downloadPromise = page.waitForEvent('download')
  await page.locator('#saveReport').click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('长寿指数报告V2_手机长图.png')
  await expect(page.locator('#saveReport')).toContainText('已保存')
  await expect(page.locator('#saveToast')).toHaveClass(/is-showing/)
})
