import { expect, test } from '@playwright/test'
import { reportDto } from '../fixtures/reportDto.js'
import { bootstrapPayload } from '../fixtures/aiConsult.js'

test.use({ reducedMotion: 'reduce' })

async function expectConsistentFonts(page) {
  const mismatches = await page.evaluate(() => {
    const family = getComputedStyle(document.body).fontFamily
    const probe = document.createElement('span')
    probe.style.fontFamily = 'var(--font-report-number)'
    document.body.append(probe)
    const numberFamily = getComputedStyle(probe).fontFamily
    probe.remove()
    const unexpectedFonts = [...document.querySelectorAll('body *')]
      .filter(element => !['SCRIPT', 'STYLE'].includes(element.tagName)
        && (['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)
          || [...element.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim())))
      .filter(element => ![family, numberFamily].includes(getComputedStyle(element).fontFamily)
        || getComputedStyle(element).fontVariantNumeric !== 'tabular-nums')
      .map(element => ({ tag: element.tagName, className: element.getAttribute('class') }))
    const scoreFonts = [...document.querySelectorAll('.score-core strong, .card-mini-head strong, .lung-metric-value, .endo-metric-score, .digest-copy>strong, .bone-head>strong, .detail-score-block>strong, .detail-chart-values strong, .detail-line-chart text, .female-indicator-score strong')]
      .filter(element => getComputedStyle(element).fontFamily !== numberFamily)
      .map(element => ({ tag: element.tagName, className: element.getAttribute('class') }))
    return [...unexpectedFonts, ...scoreFonts]
  })
  expect(mismatches).toEqual([])
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/report-view/R1/**', route => {
    const path = new URL(route.request().url()).pathname
    const data = path.endsWith('/home')
      ? reportDto
      : { system: reportDto.systems.find(system => path.endsWith(`/systems/${system.system_code}`)) }
    return route.fulfill({ json: { code: 200, data } })
  })
})

for (const width of [320, 1440]) {
  test(`home uses consistent text and monospace scores at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 896 })
    await page.goto('/#/?reportId=R1&userId=1001')
    await expect(page.getByTestId('report-home')).toBeVisible()
    await expectConsistentFonts(page)
    // Exercise the fallback chain without relying on installed macOS fonts.
    await page.addStyleTag({ content: ':root { --font-report: Arial, sans-serif; }' })
    await expectConsistentFonts(page)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  })
}

test('system details retain numeric fonts in scores and SVG charts', async ({ page }) => {
  await page.setViewportSize({ width: 414, height: 896 })
  await page.goto('/#/system/SYS_CARDIO?reportId=R1&userId=1001')
  await expect(page.locator('.detail-v2')).toBeVisible()
  await expectConsistentFonts(page)
})

test('AI consultation uses the same family for content and form controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route('**/api/v1/ai-consult/**', route => route.fulfill({
    json: { code: 200, data: route.request().url().endsWith('/guest-contexts')
      ? { guest_token: 'a'.repeat(43), report_code: 'R1', customer_id: 1001 }
      : bootstrapPayload },
  }))
  await page.goto('/#/ai-consult?reportId=R1&userId=1001')
  await expect(page.getByTestId('ai-consult-welcome')).toBeVisible()
  await expectConsistentFonts(page)
})

test('error pages retain the same font family', async ({ page }) => {
  await page.goto('/#/')
  await expect(page.getByTestId('report-error')).toBeVisible()
  await expectConsistentFonts(page)
})
