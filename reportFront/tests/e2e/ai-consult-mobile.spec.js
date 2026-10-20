import { expect, test } from '@playwright/test'
import { aiConsultIsolationCases, bootstrapPayload, welcomeDesignPayload } from '../fixtures/aiConsult.js'

const sessionId = '11111111-1111-4111-8111-111111111111'
const answer = '这项结果可以结合本次报告理解。'
const evidence = [{ id: 'ev1', kind: 'report', label: '本次报告', report_date: '2026-07-29' }]

function json(route, data, status = 200) {
  return route.fulfill({
    status, contentType: 'application/json',
    body: JSON.stringify({ code: status, message: status === 200 ? 'ok' : status === 410 ? 'consult.history_unavailable' : 'consult.session_not_found', data }),
  })
}

async function mockConsultApi(page, state) {
  await page.route('**/api/v1/ai-consult/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const report = url.searchParams.get('report_code') || 'R1'
    if (url.pathname.endsWith('/guest-contexts')) {
      const body = request.postDataJSON()
      return json(route, { guest_token: 'a'.repeat(43), report_code: body.report_code, customer_id: body.customer_id })
    }
    if (url.pathname.endsWith('/bootstrap')) {
      return json(route, { ...bootstrapPayload, service_status: 'available', consent_status: 'granted' })
    }
    if (url.pathname.endsWith('/sessions') && request.method() === 'POST') {
      return json(route, { id: sessionId, report_code: report, source: 'home' })
    }
    if (url.pathname.endsWith('/sessions') && request.method() === 'GET') {
      return json(route, null, 410)
    }
    if (/\/sessions\/[^/]+$/.test(url.pathname) && request.method() === 'GET') {
      return json(route, null, 410)
    }
    if (/\/sessions\/[^/]+$/.test(url.pathname) && request.method() === 'DELETE') {
      return json(route, null, 410)
    }
    if (url.pathname.endsWith(`/sessions/${sessionId}/turns/7`) && request.method() === 'GET' && report === 'R1') {
      return json(route, state.status === 'completed'
        ? { id: 7, generation_id: 9, can_retry: false, question: '我的肺功能活力值80分，应该如何理解？',
          status: 'completed', answer, evidence }
        : { id: 7, generation_id: 8, can_retry: true, question: '我的肺功能活力值80分，应该如何理解？',
          status: 'incomplete', answer: null, evidence: [] })
    }
    if (url.pathname.endsWith('/turns/7/stop')) {
      expect(request.postDataJSON()).toEqual({ generation_id: 8 })
      state.status = 'stopped'
      return json(route, { turn_id: 7, generation_id: 8, status: 'stopped' })
    }
    return json(route, null, 404)
  })
  await page.addInitScript(({ sessionId: id, answerText, citations }) => {
    const realFetch = window.fetch.bind(window)
    const frame = (event, seq, extras = {}) => `event: ${event}\ndata: ${JSON.stringify({
      session_id: id, turn_id: 7, generation_id: event === 'accepted' && extras.generation_id === 8 ? 8 : 9,
      seq, ...extras,
    })}\n\n`
    window.__retryBodies = []
    window.fetch = (input, options = {}) => {
      const url = typeof input === 'string' ? input : input.url
      if (url.includes(`/sessions/${id}/turns?`) && options.method === 'POST') {
        const stream = new ReadableStream({
          start(controller) {
            window.__activeSseController = controller
            controller.enqueue(new TextEncoder().encode(frame('accepted', 1, { generation_id: 8 })))
            options.signal?.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')), { once: true })
          },
        })
        return Promise.resolve(new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }))
      }
      if (url.includes(`/sessions/${id}/turns/7/retry?`) && options.method === 'POST') {
        window.__retryBodies.push(JSON.parse(options.body))
        const body = [
          frame('accepted', 1),
          frame('delta', 2, { text: answerText }),
          frame('evidence', 3, { items: citations }),
          frame('completed', 4, { answer: answerText }),
        ].join('')
        return Promise.resolve(new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }))
      }
      return realFetch(input, options)
    }
  }, { sessionId, answerText: answer, citations: evidence })
}

async function expectNoHorizontalOverflow(page, width) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
}

for (const width of [320, 375, 414]) {
  test(`redesigned welcome keeps real matched plans and fixed composer at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 896 })
    await page.route('**/api/v1/ai-consult/**', (route) => {
      if (route.request().url().includes('/guest-contexts')) {
        const body = route.request().postDataJSON()
        return json(route, { guest_token: 'a'.repeat(43), report_code: body.report_code, customer_id: body.customer_id })
      }
      return json(route, welcomeDesignPayload)
    })
    await page.goto('/#/ai-consult?reportId=R1&userId=1001')
    await expect(page.getByTestId('ai-management-plan')).toHaveCount(2)
    await expect(page.getByTestId('ai-report-score')).toHaveText('82分')
    await expect(page.locator('.ai-topbar-title')).toContainText('AI 长寿咨询')
    await expect(page.locator('.ai-topbar button')).toHaveCount(0)
    await expect(page.getByTestId('ai-management-plan').first().locator('a')).toHaveAttribute('href', /system\/SYS_ENDOCRINE.*reportId=R1.*userId=1001/)
    await expectNoHorizontalOverflow(page, width)
    for (const card of await page.locator('.ai-plan-card').all()) {
      const bounds = await card.boundingBox()
      expect(bounds.x).toBeGreaterThanOrEqual(0)
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
    }
    await expect(page.getByTestId('ai-composer')).toBeInViewport()
    const input = page.getByLabel('问问我的长寿报告', { exact: true })
    await expect(input).toBeVisible()
    await expect(input).toHaveCSS('padding-left', '12px')
    await expect(input).toHaveCSS('padding-right', '12px')
    await expect(input).toHaveCSS('font-size', '16px')
    await expect(input).toHaveCSS('color', 'rgb(46, 70, 103)')
    const placeholder = await input.evaluate(element => {
      const style = getComputedStyle(element, '::placeholder')
      return { fontSize: style.fontSize, fontWeight: style.fontWeight,
        color: style.color, opacity: style.opacity }
    })
    expect(placeholder).toEqual({ fontSize: '16px', fontWeight: '400',
      color: 'rgb(149, 163, 184)', opacity: '1' })
    await input.fill('想了解这次报告')
    await expect(input).toHaveValue('想了解这次报告')
    await expect(input).toHaveCSS('font-size', '16px')
    await input.fill('')
    await page.locator('.ai-plan-visual img').first().evaluate((img) => img.decode())
    for (const visual of await page.locator('.ai-plan-visual').all()) {
      const frame = await visual.boundingBox()
      const image = await visual.locator('img').boundingBox()
      expect(image.height).toBeLessThanOrEqual(frame.height)
      expect(image.width).toBeLessThanOrEqual(frame.width)
    }
    if (width === 414) {
      await input.focus()
      await page.getByTestId('ai-composer').screenshot({ path: '/private/tmp/nepstar-ai-composer-padding-414.png' })
      await page.screenshot({ path: '/private/tmp/nepstar-ai-welcome-414.png', fullPage: true })
    }
  })
}

for (const width of [320, 360, 375, 390, 414, 430]) {
  test(`AI stop, retry and fresh re-entry fit ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 740 })
    const state = { status: 'empty' }
    await mockConsultApi(page, state)
    await page.goto('/#/ai-consult?reportId=R1&userId=1001')
    await expect(page.getByTestId('ai-composer')).toBeVisible()
    await page.getByTestId('ai-question').first().click()
    await expect(page.getByTestId('ai-stop')).toBeVisible()
    await expectNoHorizontalOverflow(page, width)

    await page.getByTestId('ai-stop').click()
    await expect(page.getByText('已停止，本次回答未完成')).toBeVisible()
    await expect(page.getByTestId('ai-retry')).toBeVisible()
    await expectNoHorizontalOverflow(page, width)

    await page.getByTestId('ai-retry').click()
    await expect(page.getByText(answer)).toBeVisible()
    await expect(page.locator('.ai-user-question')).toHaveCount(1)
    expect(await page.evaluate(() => window.__retryBodies)).toEqual([{ generation_id: 8 }])
    await expectNoHorizontalOverflow(page, width)

    state.status = 'completed'
    await page.reload()
    await expect(page.getByTestId('ai-consult-welcome')).toBeVisible()
    await expect(page.getByTestId('ai-conversation')).toHaveCount(0)
    await expectNoHorizontalOverflow(page, width)
  })
}

test('an independent tab and another report do not inherit the conversation', async ({ page, context }) => {
  const [firstVisitor, secondVisitor] = aiConsultIsolationCases.visitors
  const otherReport = aiConsultIsolationCases.reports[1]
  const state = { status: 'empty' }
  await mockConsultApi(page, state)
  await page.goto(`/#/ai-consult?reportId=${firstVisitor.reportId}&userId=${firstVisitor.userId}`)
  await expect(page.getByTestId('ai-consult-welcome')).toBeVisible()
  await page.getByTestId('ai-question').first().click()
  await page.getByTestId('ai-stop').click()
  await expect(page.getByText('已停止，本次回答未完成')).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.getItem('aiConsultGuest:R1:1001:session'))).toBeNull()

  const independentTab = await context.newPage()
  await mockConsultApi(independentTab, state)
  await independentTab.goto(`/#/ai-consult?reportId=${secondVisitor.reportId}&userId=${secondVisitor.userId}`)
  await expect(independentTab.getByTestId('ai-consult-welcome')).toBeVisible()
  await expect(independentTab.getByTestId('ai-conversation')).toHaveCount(0)
  await independentTab.goto(`/#/ai-consult?reportId=${otherReport.reportId}&userId=${otherReport.userId}`)
  await expect(independentTab.getByTestId('ai-consult-welcome')).toBeVisible()
  await expect(independentTab.getByTestId('ai-conversation')).toHaveCount(0)
})

test('a narrow keyboard viewport and interrupted stream keep the current question retryable, then re-entry is blank', async ({ page }) => {
  const state = { status: 'empty' }
  await page.setViewportSize({ width: 390, height: 740 })
  await mockConsultApi(page, state)
  await page.goto('/#/ai-consult?reportId=R1&userId=1001')
  const input = page.getByLabel('问问我的长寿报告', { exact: true })
  await input.focus()
  await page.setViewportSize({ width: 390, height: 470 })
  await expect(input).toBeVisible()
  await expectNoHorizontalOverflow(page, 390)

  await page.getByTestId('ai-question').first().click()
  await expect(page.getByTestId('ai-stop')).toBeVisible()
  state.status = 'failed'
  await page.evaluate(() => window.__activeSseController.error(new TypeError('Network disconnected')))
  await expect(page.getByText('本次回答未完成', { exact: true })).toBeVisible()
  await expect(page.locator('.ai-user-question')).toHaveCount(1)
  await expect(page.getByTestId('ai-retry')).toBeVisible()
  await page.getByTestId('ai-retry').click()
  await expect(page.getByText(answer)).toBeVisible()
  await expect(page.locator('.ai-user-question')).toHaveCount(1)
  await expectNoHorizontalOverflow(page, 390)
  await page.reload()
  await expect(page.getByTestId('ai-consult-welcome')).toBeVisible()
  await expect(page.getByTestId('ai-conversation')).toHaveCount(0)
})

test('a dropped stream recovers a server-completed answer without duplicating the question', async ({ page }) => {
  const state = { status: 'empty' }
  await page.setViewportSize({ width: 375, height: 740 })
  await mockConsultApi(page, state)
  await page.goto('/#/ai-consult?reportId=R1&userId=1001')
  await page.getByTestId('ai-question').first().click()
  await expect(page.getByTestId('ai-stop')).toBeVisible()
  state.status = 'completed'
  await page.evaluate(() => window.__activeSseController.error(new TypeError('Network disconnected')))
  await expect(page.getByText(answer)).toBeVisible()
  await expect(page.locator('.ai-user-question')).toHaveCount(1)
  await expectNoHorizontalOverflow(page, 375)
})

test('an incoming reply preserves the reader position until the new-message button is tapped', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 })
  await mockConsultApi(page, { status: 'empty' })
  await page.goto('/#/ai-consult?reportId=R1&userId=1001')
  await page.addStyleTag({ content: '.ai-consult-page { min-height: 2400px !important; }' })
  await page.getByTestId('ai-question').first().click()
  await expect(page.getByTestId('ai-stop')).toBeVisible()
  await page.evaluate(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    window.dispatchEvent(new Event('scroll'))
  })
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
  await page.evaluate(({ id, answerText }) => {
    const frame = (event, seq, extra) => `event: ${event}\ndata: ${JSON.stringify({
      session_id: id, turn_id: 7, generation_id: 8, seq, ...extra,
    })}\n\n`
    window.__activeSseController.enqueue(new TextEncoder().encode([
      frame('delta', 2, { text: answerText }),
      frame('completed', 3, { answer: answerText }),
    ].join('')))
    window.__activeSseController.close()
  }, { id: sessionId, answerText: answer })
  await expect(page.getByTestId('ai-new-reply')).toBeVisible()
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  await page.getByTestId('ai-new-reply').click()
  await expect(page.getByTestId('ai-new-reply')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000)
  await expectNoHorizontalOverflow(page, 320)
})

test('every re-entry begins blank and no historical list or delete controls are present', async ({ page }) => {
  const historyRequests = []
  await page.setViewportSize({ width: 320, height: 700 })
  await page.route('**/api/v1/ai-consult/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname.endsWith('/guest-contexts')) {
      const body = request.postDataJSON()
      return json(route, { guest_token: 'a'.repeat(43), report_code: body.report_code, customer_id: body.customer_id })
    }
    if (url.pathname.endsWith('/bootstrap')) {
      return json(route, { ...bootstrapPayload, service_status: 'available', consent_status: 'granted' })
    }
    if (url.pathname.endsWith('/sessions') && request.method() === 'POST') {
      return json(route, { id: sessionId, report_code: 'R1', source: 'home' })
    }
    if (request.method() === 'GET' || request.method() === 'DELETE') {
      historyRequests.push({ path: url.pathname, method: request.method() })
      return json(route, null, 410)
    }
    return json(route, null, 404)
  })
  await page.goto('/#/ai-consult?reportId=R1&userId=1001')
  await expect(page.getByTestId('ai-consult-welcome')).toBeVisible()
  await expect(page.getByTestId('ai-sessions-toggle')).toHaveCount(0)
  await expect(page.getByTestId('ai-delete-open')).toHaveCount(0)
  await page.reload()
  await expect(page.getByTestId('ai-consult-welcome')).toBeVisible()
  await expect(page.getByTestId('ai-conversation')).toHaveCount(0)
  expect(await page.evaluate(() => sessionStorage.getItem('aiConsultGuest:R1:1001:session'))).toBeNull()
  expect(historyRequests).toEqual([])
  await expectNoHorizontalOverflow(page, 320)
})
