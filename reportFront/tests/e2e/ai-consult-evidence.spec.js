import { expect, test } from '@playwright/test'
import { bootstrapPayload } from '../fixtures/aiConsult.js'

const sessionId = '11111111-1111-4111-8111-111111111111'
const citation = {
  id: 'ev1', kind: 'report', label: '呼吸睡眠', report_date: '2026-07-29',
  route: '#/system/SYS_LUNG/indicator/SYS_LUNG_SLEEP_BREATHING?reportId=R1&customerId=1001',
}

function event(name, seq, extras = {}) {
  return `event: ${name}\ndata: ${JSON.stringify({
    session_id: sessionId, turn_id: 1, generation_id: 1, seq, ...extras,
  })}\n\n`
}

for (const width of [320, 390, 430]) {
  test(`AI answer evidence and fresh return fit ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 })
    await page.route('**/api/v1/ai-consult/**', async (route) => {
      const url = route.request().url()
      if (url.endsWith('/guest-contexts')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
          code: 200, message: 'ok', data: { guest_token: 'a'.repeat(43), report_code: 'R1', customer_id: 1001 },
        }) })
      } else if (url.includes('/bootstrap?')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
          code: 200, message: 'ok', data: {
            ...bootstrapPayload, report_date: '2026-07-29', service_status: 'available', consent_status: 'granted',
          },
        }) })
      } else if (url.endsWith('/sessions') && route.request().method() === 'POST') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
          code: 200, message: 'ok', data: { id: sessionId, report_code: 'R1', source: 'home' },
        }) })
      } else if (url.endsWith('/end')) {
        await route.fulfill({ json: { code: 200, data: { id: sessionId, status: 'ended' } } })
      } else if (url.includes('/turns?')) {
        const body = [
          event('accepted', 1), event('status', 2, { phase: 'answering' }),
          event('delta', 3, { text: '呼吸睡眠活力值 98 分。' }),
          event('evidence', 4, { items: [citation] }),
          event('completed', 5, { answer: '呼吸睡眠活力值 98 分。' }),
        ].join('')
        await route.fulfill({ status: 200, contentType: 'text/event-stream', body })
      } else {
        await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 404, message: 'consult.session_not_found' }) })
      }
    })
    await page.route('**/api/v1/report-view/R1/indicators/SYS_LUNG_SLEEP_BREATHING?**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        code: 200, message: 'ok', data: {
          report_code: 'R1', system: { system_code: 'SYS_LUNG', name: '肺功能' },
          indicator: {
            indicator_code: 'SYS_LUNG_SLEEP_BREATHING', name: '呼吸睡眠', score: 98,
            description: '关注睡眠期间的呼吸质量。', trend: [], actions: [],
          },
        },
      }) })
    })

    await page.goto('/#/ai-consult?reportId=R1&userId=1001')
    await page.getByTestId('ai-question').first().click()
    await expect(page.getByText('呼吸睡眠活力值 98 分。')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await page.getByTestId('ai-evidence').locator('summary').click()
    await expect(page.getByTestId('ai-evidence').locator('summary')).toHaveCSS('font-size', '14px')
    await expect(page.getByTestId('ai-evidence').locator('small')).toHaveCSS('font-size', '14px')
    await page.getByTestId('ai-evidence').getByText('查看详情').click()
    await expect(page.getByRole('dialog', { name: '结束本次咨询？' })).toBeVisible()
    await page.getByTestId('ai-leave-confirm').click()
    await expect(page.getByRole('heading', { name: '呼吸睡眠' })).toBeVisible()
    await page.getByRole('link', { name: '返回 AI 咨询' }).click()
    await expect(page.getByTestId('ai-consult-welcome')).toBeVisible()
    await expect(page.getByTestId('ai-conversation')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  })
}
