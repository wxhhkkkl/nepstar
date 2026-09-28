import { expect, test } from '@playwright/test'
import { reportDto } from '../fixtures/reportDto.js'

const detail = {
  report_code: 'R1',
  system: { system_code: 'SYS_IMMUNE', name: '免疫力' },
  indicator: {
    indicator_code: 'SYS_IMMUNE_LYMPH', name: '淋巴结', score: 92,
    last_score: 90, score_change: 2, abnormal_level: 1,
    status_text: '正常', description: '淋巴结参与免疫应答。',
    interpretation: '本次结果表现稳定。', actions: ['保持规律作息', '适量运动'],
    trend: [
      { report_code: 'OLD', date: '2026-07-01', score: 86 },
      { report_code: 'R1', date: '2026-09-01', score: 92 },
    ],
  },
}

for (const width of [390, 414]) {
  test(`single-indicator direct route renders at ${width}px without side overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.route('**/api/v1/report-view/R1/indicators/SYS_IMMUNE_LYMPH?customer_id=1001', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 200, message: 'success', data: detail }) }),
    )
    await page.goto('/#/system/SYS_IMMUNE/indicator/SYS_IMMUNE_LYMPH?reportId=R1&customerId=1001')
    await expect(page.locator('[data-indicator-code="SYS_IMMUNE_LYMPH"]')).toBeVisible()
    await expect(page.getByRole('heading', { name: '指标解读' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '历史趋势' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '行动建议' })).toBeVisible()
    await expect(page.locator('.indicator-trend-chart')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await page.reload()
    await expect(page.locator('[data-indicator-code="SYS_IMMUNE_LYMPH"]')).toBeVisible()
  })
}

test('returning from an indicator restores the system reading position', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 560 })
  const system = reportDto.systems.find((item) => item.system_code === 'SYS_IMMUNE')
  await page.route('**/api/v1/report-view/R1/systems/SYS_IMMUNE?customer_id=1001', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      code: 200, message: 'success', data: { report_code: 'R1', system },
    }) }),
  )
  await page.route('**/api/v1/report-view/R1/indicators/SYS_IMMUNE_A?customer_id=1001', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      code: 200, message: 'success', data: {
        ...detail,
        indicator: { ...detail.indicator, indicator_code: 'SYS_IMMUNE_A', name: '免疫力指标A' },
      },
    }) }),
  )

  await page.goto('/#/system/SYS_IMMUNE?reportId=R1&customerId=1001')
  const item = page.locator('[data-indicator-code="SYS_IMMUNE_A"]')
  await expect(item).toBeVisible()
  await item.scrollIntoViewIfNeeded()
  const before = await page.evaluate(() => window.scrollY)
  expect(before).toBeGreaterThan(0)
  await item.click()
  await expect(page.locator('[data-indicator-code="SYS_IMMUNE_A"].indicator-detail-page')).toBeVisible()
  await page.locator('.indicator-nav-back').click()
  await expect(item).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThanOrEqual(before - 1)
})
