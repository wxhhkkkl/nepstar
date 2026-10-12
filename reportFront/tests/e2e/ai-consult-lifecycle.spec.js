import { expect, test } from '@playwright/test'
import { bootstrapPayload } from '../fixtures/aiConsult.js'

const ID = '11111111-1111-4111-8111-111111111111'
for (const width of [320, 414]) {
  test(`return confirmation cancels or ends the session at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 740 })
    let ended = 0
    await page.route('**/api/v1/**', async route => {
      const request = route.request(), path = new URL(request.url()).pathname
      let data
      if (path.endsWith('/guest-contexts')) data = { guest_token: 'a'.repeat(43), ...request.postDataJSON() }
      else if (path.endsWith('/bootstrap')) data = { ...bootstrapPayload, service_status: 'available' }
      else if (path.endsWith('/sessions')) data = { id: ID, report_code: 'R1', source: 'home' }
      else if (path.endsWith('/turns')) {
        const frame = (event, seq, extra) => `event: ${event}\ndata: ${JSON.stringify({ session_id: ID, turn_id: 1, generation_id: 1, seq, ...extra })}\n\n`
        return route.fulfill({ contentType: 'text/event-stream', body: [
          frame('accepted', 1, {}), frame('completed', 2, { answer: 'Synthetic reviewed answer', remaining_today: 10 }),
        ].join('') })
      } else if (path.endsWith('/end')) {
        expect(request.headers().authorization).toBe(`Bearer ${'a'.repeat(43)}`)
        ended += 1
        data = { id: ID, status: 'ended' }
      } else {
        return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 404, message: 'report.not_found', data: null }) })
      }
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 200, data }) })
    })
    await page.goto('/#/ai-consult?reportId=R1&userId=1001')
    await page.getByTestId('ai-question').first().click()
    await expect(page.getByText('Synthetic reviewed answer')).toBeVisible()
    await page.getByRole('link', { name: '返回报告', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('.ai-leave-icon')).toHaveCount(0)
    await expect(dialog.getByRole('heading', { name: '结束本次咨询？' })).toHaveCSS('text-align', 'center')
    expect(await dialog.evaluate(el => el.getBoundingClientRect().width)).toBeLessThanOrEqual(width - 48)
    if (width === 414) await page.screenshot({ path: '/private/tmp/nepstar-ai-leave-confirm-414.png' })
    await page.getByTestId('ai-leave-cancel').click()
    await expect(dialog).not.toBeVisible()
    expect(ended).toBe(0)
    await page.getByRole('link', { name: '返回报告', exact: true }).click()
    await page.getByTestId('ai-leave-confirm').click()
    await expect(page).toHaveURL(/#\/\?reportId=R1&userId=1001/)
    expect(ended).toBe(1)
  })
}
