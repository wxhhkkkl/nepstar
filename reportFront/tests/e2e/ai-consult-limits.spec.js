import { expect, test } from '@playwright/test'
import { bootstrapPayload } from '../fixtures/aiConsult.js'

const sessionId = '11111111-1111-4111-8111-111111111111'
const evidence = [{ id: 'ev1', kind: 'report', label: '本次报告', report_date: '2026-07-29' }]

async function mockLimits(page, kind, remaining = 1) {
  const state = { sessions: 0, attempts: [], turnStatus: 'incomplete', turnQueries: 0 }
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const reply = (data, status = 200, message = 'ok', headers = {}) => route.fulfill({
      status, contentType: 'application/json', headers,
      body: JSON.stringify({ code: status, message, data }),
    })
    if (path.endsWith('/guest-contexts')) {
      const body = request.postDataJSON()
      return reply({ guest_token: 'a'.repeat(43), report_code: body.report_code, customer_id: body.customer_id })
    }
    if (path.endsWith('/bootstrap')) {
      return reply({ ...bootstrapPayload, service_status: 'available', remaining_today: remaining })
    }
    if (path.endsWith('/sessions') && request.method() === 'POST') {
      state.sessions += 1
      return reply({ id: sessionId, report_code: 'R1', source: 'home' })
    }
    if (path.endsWith('/turns/7') && request.method() === 'GET') {
      state.turnQueries += 1
      return reply({ id: 7, generation_id: 8, question: '原问题', status: state.turnStatus,
        can_retry: kind === 'server-timeout' && state.turnStatus === 'incomplete',
        evidence: state.turnStatus === 'completed' ? evidence : [],
        answer: state.turnStatus === 'completed' ? '超时后核对到的完整回答。' : null })
    }
    if (path.endsWith('/turns') || path.endsWith('/turns/7/retry')) {
      state.attempts.push({ path, key: request.headers()['idempotency-key'], body: request.postDataJSON() })
      const first = state.attempts.length === 1
      if (kind === 'disabled') return reply(null, 503, 'consult.disabled')
      if (first && kind === 'network') return route.abort('failed')
      if (first && !['retry', 'server-timeout'].includes(kind)) {
        return reply(
          kind === 'maintenance' ? { maintenance_text: '模型服务维护中，请稍后再试。' }
            : { retry_after_seconds: 2 },
          kind === 'maintenance' ? 503 : 429, `consult.${kind}`, { 'Retry-After': '2' },
        )
      }
      const generation = first ? 8 : 9
      const frame = (event, seq, extras = {}) => `event: ${event}\ndata: ${JSON.stringify({
        session_id: sessionId, turn_id: 7, generation_id: generation, seq, ...extras,
      })}\n\n`
      const body = first && ['retry', 'server-timeout'].includes(kind)
        ? frame('accepted', 1) + frame('error', 2, {
          code: kind === 'server-timeout' ? 'consult.timeout' : 'consult.failed', retryable: true,
        })
        : frame('accepted', 1) + frame('delta', 2, { text: '已完成本次回答。' })
          + frame('evidence', 3, { items: evidence })
          + frame('completed', 4, { answer: '已完成本次回答。', remaining_today: 0 })
      return route.fulfill({ status: 200, contentType: 'text/event-stream', body })
    }
    // Unknown requests never reach a real backend, including history endpoints.
    return reply(null, 404, 'mock.unexpected_request')
  })
  return state
}

async function openConsult(page) {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('/#/ai-consult?reportId=R1&userId=1001')
  await expect(page.getByTestId('ai-composer')).toBeVisible()
}

async function expectFits(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
}

test('zero bootstrap allowance does not create a session or send a question', async ({ page }) => {
  const state = await mockLimits(page, 'daily_limit', 0)
  await openConsult(page)
  await page.locator('#aiQuestionInput').fill('保留我的输入')
  await expect(page.getByRole('button', { name: '发送问题' })).toBeDisabled()
  await expect(page.getByTestId('ai-question').first()).toBeDisabled()
  await expect(page.getByTestId('ai-admission-status')).toContainText('今天的咨询次数已用完')
  expect(state.sessions).toBe(0)
  expect(state.attempts).toHaveLength(0)
  await expectFits(page)
})

test('emergency pause disables sending and retry while keeping the current conversation and draft', async ({ page }) => {
  const state = await mockLimits(page, 'disabled', 5)
  await openConsult(page)
  await page.getByTestId('ai-question').first().click()
  await expect(page.getByTestId('ai-admission-status')).toContainText('AI 咨询服务已暂停')
  await page.locator('#aiQuestionInput').fill('保留稍后再问的问题')
  await expect(page.getByRole('button', { name: '发送问题' })).toBeDisabled()
  const retry = page.getByTestId('ai-resend-question')
  if (await retry.count()) await expect(retry).toBeDisabled()
  await expect(page.locator('.ai-user-question')).toHaveCount(1)
  await expect(page.locator('#aiQuestionInput')).toHaveValue('保留稍后再问的问题')
  expect(state.attempts).toHaveLength(1)
  await expectFits(page)
})

for (const kind of ['daily_limit', 'global_budget_exhausted']) {
  test(`${kind} disables repeated sends and preserves the conversation and draft`, async ({ page }) => {
    const state = await mockLimits(page, kind)
    await openConsult(page)
    await page.getByTestId('ai-question').first().click()
    await expect(page.getByTestId('ai-admission-status')).toContainText('已用完')
    await page.locator('#aiQuestionInput').fill('下次想问的问题')
    await expect(page.getByRole('button', { name: '发送问题' })).toBeDisabled()
    await expect(page.locator('.ai-user-question')).toHaveCount(1)
    expect(state.attempts).toHaveLength(1)
    await expect(page.locator('#aiQuestionInput')).toHaveValue('下次想问的问题')
    await expectFits(page)
  })
}

for (const kind of ['rate_limited', 'capacity_busy', 'network']) {
  test(`${kind} retries the original question/key once without a second bubble`, async ({ page }) => {
    const state = await mockLimits(page, kind)
    await openConsult(page)
    await page.getByTestId('ai-question').first().click()
    const retry = page.getByTestId('ai-resend-question')
    await expect(retry).toBeVisible()
    if (kind !== 'network') {
      await expect(retry).toBeDisabled()
      await expect(page.getByTestId('ai-admission-status')).toContainText('秒后重试')
      expect(state.attempts).toHaveLength(1)
    }
    await expect(retry).toBeEnabled()
    await retry.click()
    await expect(page.getByText('已完成本次回答。', { exact: true })).toBeVisible()
    await expect(page.locator('.ai-user-question')).toHaveCount(1)
    expect(state.attempts).toHaveLength(2)
    expect(state.attempts[1].key).toBe(state.attempts[0].key)
    expect(state.attempts[1].body).toEqual(state.attempts[0].body)
    expect(state.sessions).toBe(1)
    await expectFits(page)
  })
}

test('successful generation retry refreshes the remaining allowance to zero', async ({ page }) => {
  const state = await mockLimits(page, 'retry')
  await openConsult(page)
  await page.getByTestId('ai-question').first().click()
  await page.getByTestId('ai-retry').click()
  await expect(page.getByText('已完成本次回答。', { exact: true })).toBeVisible()
  await expect(page.getByTestId('ai-quota-note')).toContainText('0')
  await expect(page.getByTestId('ai-admission-status')).toContainText('今天的咨询次数已用完')
  await expect(page.locator('.ai-user-question')).toHaveCount(1)
  expect(state.attempts[1].body).toEqual({ generation_id: 8 })
  await expectFits(page)
})

test('maintenance hides sending but keeps the current question visible', async ({ page }) => {
  const state = await mockLimits(page, 'maintenance')
  await openConsult(page)
  await page.getByTestId('ai-question').first().click()
  await expect(page.getByText('咨询服务维护中', { exact: true })).toBeVisible()
  await expect(page.getByTestId('ai-composer')).toHaveCount(0)
  await expect(page.locator('.ai-user-question')).toHaveCount(1)
  expect(state.attempts).toHaveLength(1)
  await expectFits(page)
})

test('server timeout queries the same turn before offering a single generation retry', async ({ page }) => {
  const state = await mockLimits(page, 'server-timeout')
  await openConsult(page)
  await page.getByTestId('ai-question').first().click()
  await expect(page.getByTestId('ai-retry')).toBeEnabled()
  expect(state.turnQueries).toBe(1)
  expect(state.attempts).toHaveLength(1)
  await page.locator('#aiQuestionInput').fill('保留下一条问题')
  await page.getByTestId('ai-retry').click()
  await expect(page.getByText('已完成本次回答。', { exact: true })).toBeVisible()
  expect(state.attempts).toHaveLength(2)
  expect(state.attempts[1].path).toContain('/turns/7/retry')
  expect(state.attempts[1].body).toEqual({ generation_id: 8 })
  expect(state.sessions).toBe(1)
  await expect(page.locator('.ai-user-question')).toHaveCount(1)
  await expect(page.locator('#aiQuestionInput')).toHaveValue('保留下一条问题')
  await expectFits(page)
})

test('a timed-out generation remains queryable and does not create a duplicate question', async ({ page }) => {
  const state = await mockLimits(page, 'timeout')
  await page.clock.install()
  await page.addInitScript((id) => {
    const original = window.fetch.bind(window)
    window.__generationCalls = 0
    window.fetch = (input, options = {}) => {
      const url = typeof input === 'string' ? input : input.url
      if (!url.includes(`/sessions/${id}/turns?`) || options.method !== 'POST') return original(input, options)
      window.__generationCalls += 1
      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(`event: accepted\ndata: ${JSON.stringify({
            session_id: id, turn_id: 7, generation_id: 8, seq: 1,
          })}\n\n`))
          options.signal.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')), { once: true })
        },
      })
      return Promise.resolve(new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }))
    }
  }, sessionId)
  await openConsult(page)
  await page.getByTestId('ai-question').first().click()
  await expect(page.getByTestId('ai-stop')).toBeVisible()
  await page.clock.runFor(65001)
  await expect(page.getByTestId('ai-check-status')).toBeVisible()
  await page.locator('#aiQuestionInput').fill('稍后要问的问题')
  await expect(page.getByRole('button', { name: '发送问题' })).toBeDisabled()
  await expect(page.getByTestId('ai-retry')).toHaveCount(0)
  await expect(page.locator('.ai-user-question')).toHaveCount(1)
  state.turnStatus = 'completed'
  await page.getByTestId('ai-check-status').click()
  await expect(page.getByText('超时后核对到的完整回答。', { exact: true })).toBeVisible()
  await expect(page.locator('#aiQuestionInput')).toHaveValue('稍后要问的问题')
  await expect(page.getByRole('button', { name: '发送问题' })).toBeEnabled()
  expect(await page.evaluate(() => window.__generationCalls)).toBe(1)
  expect(state.sessions).toBe(1)
  await expectFits(page)
})
