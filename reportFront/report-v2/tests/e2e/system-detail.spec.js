import { expect, test } from '@playwright/test'

const systems = {
  cardio: '心血管', lung: '肺功能', endocrine: '内分泌', bone: '骨骼',
  digest: '消化系统', female: '女性功能', immune: '免疫力',
}

for (const [id, name] of Object.entries(systems)) {
  test(`direct route renders ${id} and survives refresh`, async ({ page }) => {
    await page.goto(`/#/system/${id}`)
    await expect(page.locator(`[data-system-id="${id}"]`)).toBeVisible()
    await expect(page.locator('.status-bar')).toHaveCount(0)
    await expect(page.locator('.detail-score-identity h1')).toHaveText(name)
    await expect(page.locator('.detail-chart')).toHaveAttribute('data-chart-type', /.+/)
    await page.reload()
    await expect(page.locator(`[data-system-id="${id}"]`)).toBeVisible()
  })
}

test('recommendations remain mapped to their own issue', async ({ page }) => {
  await page.goto('/#/system/endocrine')
  await expect(page.locator('[data-recommendation-for="endocrine"]')).toContainText('睡眠健康')
  await expect(page.getByText('钙流失健康管理方案')).toHaveCount(0)
  await page.goto('/#/system/bone')
  await expect(page.locator('[data-recommendation-for="bone"]')).toContainText('钙流失健康')
  await page.goto('/#/system/cardio')
  await expect(page.locator('.detail-product-recommendation')).toHaveCount(0)
})

test('unknown route has a safe recovery link', async ({ page }) => {
  await page.goto('/#/system/unknown')
  await expect(page.getByText('暂未找到该系统')).toBeVisible()
  await page.locator('.detail-back').click()
  await expect(page).toHaveURL(/#\/$/)
})

test('legacy detail URL redirects to the hash route', async ({ page }) => {
  await page.goto('/detail.html?id=endocrine')
  await expect(page).toHaveURL(/#\/system\/endocrine$/)
  await expect(page.locator('[data-system-id="endocrine"]')).toBeVisible()
})

test('returning from a card restores the home scroll position', async ({ page }) => {
  await page.goto('/#/')
  const card = page.locator('[data-system-id="cardio"]')
  await card.scrollIntoViewIfNeeded()
  const before = await page.evaluate(() => window.scrollY)
  await card.click()
  await page.locator('.detail-back').click()
  await page.waitForTimeout(100)
  const after = await page.evaluate(() => window.scrollY)
  expect(after).toBeGreaterThanOrEqual(before - 5)
})
