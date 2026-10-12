import { createServer, request as httpRequest } from 'node:http'
import { setTimeout as delay } from 'node:timers/promises'
import { expect, test as base } from '@playwright/test'
import { bootstrapPayload } from '../fixtures/aiConsult.js'

// Synthetic HTTP server: API requests never reach the application, a DB or a model.
// Only frontend assets are proxied to Vite. Browser fetch/ReadableStream stay real.
const report = 'SSE-DEMO'
const sessionId = '11111111-1111-4111-8111-111111111111'
const question = '请解释呼吸睡眠指标。'
const answer = '合成测试资料：呼吸睡眠活力值 98 分，仅用于验证页面显示。'
const evidence = [{
  id: 'ev1', kind: 'report', label: '呼吸睡眠', report_date: '2026-07-29',
  route: `#/system/SYS_LUNG/indicator/SYS_LUNG_SLEEP_BREATHING?reportId=${report}&customerId=1001`,
}]
const frame = (event, seq, extras = {}) => `event: ${event}\ndata: ${JSON.stringify({
  session_id: sessionId, turn_id: 7, generation_id: 9, seq, ...extras,
})}\n\n`
const json = (response, data, status = 200) => {
  response.writeHead(status, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify({ code: status, message: status === 200 ? 'ok' : 'not_found', data }))
}

const test = base.extend({
  transport: async ({ baseURL }, use) => {
    let streamResponse
    const state = { questions: 0, sessions: 0, reads: 0, saved: false, closed: false, unexpected: [] }
    const server = createServer((request, response) => {
      const url = new URL(request.url, 'http://127.0.0.1')
      if (!url.pathname.startsWith('/api/')) {
        const upstream = httpRequest(new URL(request.url, baseURL), {
          method: request.method, headers: { ...request.headers, host: new URL(baseURL).host },
        }, result => {
          response.writeHead(result.statusCode, result.headers)
          result.pipe(response)
        })
        upstream.on('error', () => { if (!response.headersSent) response.writeHead(502); response.end() })
        request.pipe(upstream)
        return
      }
      if (url.pathname.endsWith('/ai-consult/guest-contexts') && request.method === 'POST') {
        request.resume()
        return json(response, { guest_token: 'a'.repeat(43), report_code: report, customer_id: 1001 })
      }
      if (url.pathname.endsWith('/ai-consult/bootstrap') && request.method === 'GET') {
        return json(response, {
          ...bootstrapPayload, report_date: '2026-07-29', report_score: 98,
          report_summary: '合成 HTTP 流测试，不代表个人健康数据。',
          suggested_questions: [question], service_status: 'available', consent_status: 'granted',
          management_plans: [], remaining_today: state.saved ? 9 : 10,
        })
      }
      if (url.pathname.endsWith('/ai-consult/sessions') && request.method === 'POST') {
        request.resume()
        state.sessions++
        return json(response, { id: sessionId, report_code: report, source: 'home' })
      }
      if (url.pathname.endsWith(`/sessions/${sessionId}/turns`) && request.method === 'POST') {
        request.resume()
        state.questions++
        streamResponse = response
        response.on('close', () => { state.closed = true })
        response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' })
        response.write(frame('accepted', 1))
        response.write(frame('status', 2, { phase: 'answering' }))
        return
      }
      if (url.pathname.endsWith(`/sessions/${sessionId}/turns/7`) && request.method === 'GET' && state.saved) {
        state.reads++
        return json(response, { id: 7, generation_id: 9, status: 'completed', can_retry: false,
          question, answer, evidence })
      }
      if (url.pathname === `/api/v1/report-view/${report}/indicators/SYS_LUNG_SLEEP_BREATHING`) {
        return json(response, {
          report_code: report, system: { system_code: 'SYS_LUNG', name: '肺功能' },
          indicator: { indicator_code: 'SYS_LUNG_SLEEP_BREATHING', name: '呼吸睡眠',
            score: 98, description: '合成指标说明，仅供测试。', trend: [], actions: [] },
        })
      }
      state.unexpected.push(`${request.method} ${url.pathname}`)
      request.resume()
      json(response, null, 404)
    })
    server.on('upgrade', (_request, socket) => socket.destroy())
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    try {
      await use({
        url: `http://127.0.0.1:${server.address().port}/#/ai-consult?reportId=${report}&userId=1001`,
        state,
        async complete({ disconnect = false } = {}) {
          state.saved = true
          if (disconnect) { streamResponse.destroy(); return }
          const delta = Buffer.from(frame('delta', 3, { text: answer }))
          const split = delta.indexOf(Buffer.from('呼')) + 1
          streamResponse.write(delta.subarray(0, split))
          await delay(20)
          streamResponse.write(delta.subarray(split))
          streamResponse.write(frame('evidence', 4, { items: evidence }))
          streamResponse.write(frame('completed', 5, { answer, remaining_today: 9 }))
          // Deliberately leave the socket open. The real client cancels its reader
          // on completed; assertions use rendered UI, never Response.text().
        },
      })
    } finally {
      server.closeAllConnections()
      await new Promise(resolve => server.close(resolve))
    }
  },
})

for (const width of [320, 414]) {
  test(`real HTTP SSE handles split UTF-8 and completed cancellation at ${width}px`, async ({ page, transport }) => {
    await page.setViewportSize({ width, height: 740 })
    await page.goto(transport.url)
    await page.getByTestId('ai-question').first().click()
    await expect(page.getByTestId('ai-stop')).toBeVisible()
    await expect(page.locator('.ai-answer-text')).toHaveCount(0)
    await transport.complete()
    await expect(page.locator('.ai-answer-text')).toHaveText(answer)
    await expect(page.getByTestId('ai-stop')).toHaveCount(0)
    await expect(page.locator('.ai-user-question')).toHaveCount(1)
    await expect.poll(() => transport.state.closed).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await page.getByTestId('ai-evidence').locator('summary').click()
    await page.getByTestId('ai-evidence').getByRole('link', { name: '查看详情' }).click()
    await expect(page.getByRole('heading', { name: '呼吸睡眠', exact: true })).toBeVisible()
    await page.getByRole('link', { name: '返回 AI 咨询' }).click()
    await expect(page.getByTestId('ai-consult-welcome')).toBeVisible()
    await expect(page.getByTestId('ai-conversation')).toHaveCount(0)
    await page.reload()
    await expect(page.getByTestId('ai-consult-welcome')).toBeVisible()
    await expect(page.getByTestId('ai-conversation')).toHaveCount(0)
    expect(transport.state).toMatchObject({ questions: 1, sessions: 1, reads: 0, unexpected: [] })
  })

  test(`real HTTP disconnect recovers only the saved current turn at ${width}px`, async ({ page, transport }) => {
    await page.setViewportSize({ width, height: 740 })
    await page.goto(transport.url)
    await page.getByTestId('ai-question').first().click()
    await expect(page.getByTestId('ai-stop')).toBeVisible()
    await transport.complete({ disconnect: true })
    await expect(page.locator('.ai-answer-text')).toHaveText(answer)
    await expect(page.locator('.ai-user-question')).toHaveCount(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    expect(transport.state).toMatchObject({ questions: 1, sessions: 1, reads: 1, unexpected: [] })
  })
}
