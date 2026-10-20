import { expect, test } from '@playwright/test'
import { bootstrapPayload, welcomeDesignPayload } from '../fixtures/aiConsult.js'

const sessionId = '11111111-1111-4111-8111-111111111111'
const reportCode = 'AI-CONSULT-DESIGN-DEMO'
const evidence = [
  { label: '呼吸睡眠', code: 'SYS_LUNG_SLEEP_BREATHING' },
  { label: '肺活量 VC', code: 'SYS_LUNG_VC' },
  { label: '气道阻力', code: 'SYS_LUNG_RAM' },
].map((item, index) => ({ id: `ev${index + 1}`, kind: 'report', label: item.label, report_date: '2022-07-21',
  route: `#/system/SYS_LUNG/indicator/${item.code}?reportId=${reportCode}&customerId=1001`,
  ...(index === 0 ? { follow_up_questions: ['可以再说说肺活量吗？'] } : {}),
}))
const answer = '先看具体指标，不只看总分\n综合活力值是报告中的参考分数，不能直接用于判断疾病。建议结合各项指标和身体感受一起了解。\n'
  + evidence.map((item, i) => `报告日期 2022-07-21：${item.label}活力值 ${[90, 60, 95][i]} 分。`).join('\n')
  + '\n# 日常可以从这两点开始\n1. 保持规律作息，留意睡眠与呼吸感受。\n2. 如有持续咳嗽、气短等不适，请及时就医。'
const payload = {
  ...bootstrapPayload, service_status: 'available', report_date: '2022-07-21', max_question_chars: 300,
  focus_systems: [{ name: '消化系统', score: 75 }, { name: '肺功能', score: 80 }],
  management_plans: [{ ...welcomeDesignPayload.management_plans[0], plan_name: '松果体睡眠健康管理方案', indicator_name: '性腺分泌', indicator_score: 95, trigger_score_below: 99,
    description: '针对松果体分泌与睡眠节律的日常健康管理参考，帮助建立稳定作息并支持夜间恢复。' }],
  suggested_questions: ['我的报告里，哪些指标值得关注？', '肺功能 80 分代表什么？', '为什么推荐这个健康管理方案？', '日常作息可以怎样调整？'],
}

async function mockDesign(page, { empty = false } = {}) {
  const unexpected = []
  await page.route(url => url.pathname.startsWith('/api/v1/'), route => {
    const url = new URL(route.request().url())
    let data
    if (url.pathname.endsWith('/guest-contexts')) data = { guest_token: 'a'.repeat(43), report_code: reportCode, customer_id: 1001 }
    else if (url.pathname.endsWith('/bootstrap')) data = empty ? { ...payload, report_score: null, management_plans: [], focus_systems: [] } : payload
    else if (url.pathname.endsWith('/sessions')) data = { id: sessionId, report_code: reportCode, source: 'home' }
    else if (url.pathname.endsWith('/end')) data = { id: sessionId, status: 'ended' }
    else if (url.pathname.endsWith('/feedback')) data = { turn_id: 7, feedback_value: 'helpful', feedback_reason: null }
    else { unexpected.push(url.pathname); return route.fulfill({ status: 404, json: { code: 404 } }) }
    return route.fulfill({ json: { code: 200, message: 'ok', data } })
  })
  await page.addInitScript(({ id }) => {
    const realFetch = window.fetch.bind(window)
    const encoder = new TextEncoder()
    window.__designSeq = 0
    window.__designFrame = (event, extra = {}) => {
      window.__designSeq++
      window.__designController.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify({ session_id: id, turn_id: 7, generation_id: 8, seq: window.__designSeq, ...extra })}\n\n`))
    }
    window.fetch = (input, options = {}) => {
      const url = String(input)
      if (url.includes(`/sessions/${id}/turns?`) && options.method === 'POST') {
        const stream = new ReadableStream({ start(controller) {
          window.__designController = controller
          window.__designSeq = 0
          window.__designFrame('accepted')
          options.signal?.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')), { once: true })
        } })
        return Promise.resolve(new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }))
      }
      return realFetch(input, options)
    }
  }, { id: sessionId })
  return unexpected
}

for (const width of [320, 375, 414, 480]) {
  test(`approved AI consultation design fits ${width}px and preserves streaming/feedback`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 414 ? 896 : 844 })
    const unexpected = await mockDesign(page)
    await page.goto(`/#/ai-consult?reportId=${reportCode}&userId=1001`)
    await expect(page.locator('.ai-hero h1')).toHaveText('你好，一起读懂你的长寿报告')
    await expect(page.getByTestId('ai-question')).toHaveCount(4)
    await expect(page.getByTestId('ai-report-score')).toHaveText('82分')
    await expect(page.getByTestId('ai-plan-description')).toBeVisible()
    await expect(page.getByTestId('ai-plan-reason')).toHaveCount(0)
    const description = await page.getByTestId('ai-plan-description').evaluate(element => ({
      height: element.getBoundingClientRect().height,
      lineHeight: parseFloat(getComputedStyle(element).lineHeight),
    }))
    expect(description.height).toBeLessThanOrEqual(description.lineHeight * 2 + 1)
    const avatar = page.locator('.ai-avatar img')
    await avatar.evaluate(img => img.decode())
    await expect(avatar).toHaveAttribute('src', /ai-longevity-doctor-avatar\.png/)
    await page.locator('.ai-score-ring').evaluate(async element => {
      await Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {})))
    })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    if (width === 414) {
      await page.screenshot({ path: '/private/tmp/nepstar-ai-design-welcome-414.png' })
      await page.locator('.ai-management-plans').screenshot({ path: '/private/tmp/nepstar-ai-plan-details-414.png' })
    }

    await page.getByLabel('问问我的长寿报告', { exact: true }).fill('肺功能 80 分，日常该注意什么？')
    const conversationUrl = page.url()
    const reportCard = await page.locator('.ai-report-strip').elementHandle()
    await page.getByRole('button', { name: '发送问题' }).click()
    await expect(page.getByTestId('ai-stop')).toBeVisible()
    expect(page.url()).toBe(conversationUrl)
    expect(await reportCard.evaluate(element => element.isConnected)).toBe(true)
    await expect(page.locator('.ai-report-compact')).toHaveCount(0)
    await expect(page.locator('.ai-hero')).toHaveCount(1)
    await expect(page.getByTestId('ai-management-plan')).toHaveCount(1)
    await expect(page.getByTestId('ai-question')).toHaveCount(4)
    const layout = await page.locator('.ai-consult-page').evaluate(root => ({
      questionsBottom: root.querySelector('.ai-question-panel').getBoundingClientRect().bottom,
      conversationTop: root.querySelector('.ai-conversation').getBoundingClientRect().top,
    }))
    expect(layout.conversationTop).toBeGreaterThan(layout.questionsBottom)
    await page.evaluate(() => window.__designFrame('delta', { text: '先看具体指标，不只看总分' }))
    await expect(page.locator('.ai-answer-text--streaming')).toHaveText('先看具体指标，不只看总分')
    if (width === 414) await page.screenshot({ path: '/private/tmp/nepstar-ai-design-streaming-414.png' })
    await page.evaluate(({ text, sources }) => {
      window.__designFrame('evidence', { items: sources })
      window.__designFrame('completed', { answer: text })
    }, { text: answer, sources: evidence })
    await expect(page.locator('.ai-answer-metric')).toHaveCount(3)
    await expect(page.locator('.ai-answer-list li')).toHaveCount(2)
    await expect(page.getByTestId('ai-feedback')).toBeVisible()
    await expect(page.getByTestId('ai-followup-prompt')).toHaveText('可以再说说肺活量吗？')
    await expect(page.getByTestId('ai-stop')).toHaveCount(0)
    await page.getByTestId('ai-feedback').getByRole('button', { name: '有帮助', exact: true }).click()
    await expect(page.getByTestId('ai-feedback').getByRole('button', { name: '有帮助', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await page.getByTestId('ai-evidence').locator('summary').click()
    await expect(page.getByTestId('ai-evidence').getByText('查看详情')).toHaveCount(3)
    await page.getByTestId('ai-evidence').locator('summary').click()
    await page.locator('.ai-user-source').scrollIntoViewIfNeeded()
    if (width === 414) {
      await page.screenshot({ path: '/private/tmp/nepstar-ai-inline-chat-414.png' })
      await page.screenshot({ path: '/private/tmp/nepstar-ai-inline-full-page-414.png', fullPage: true })
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    expect(unexpected).toEqual([])
    await expect(page.getByTestId('ai-composer')).toBeInViewport()
    await page.getByLabel('问问我的长寿报告', { exact: true }).focus()
    await page.setViewportSize({ width, height: 470 })
    await expect(page.getByTestId('ai-composer')).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  })
}

test('empty report fields and reduced motion do not create fake scores or plans', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const unexpected = await mockDesign(page, { empty: true })
  await page.goto(`/#/ai-consult?reportId=${reportCode}&userId=1001`)
  await expect(page.getByText('分数未提供')).toBeVisible()
  await expect(page.getByTestId('ai-report-score')).toHaveCount(0)
  await expect(page.getByTestId('ai-management-plan')).toHaveCount(0)
  await expect(page.getByTestId('ai-composer')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  expect(unexpected).toEqual([])
})

for (const width of [375, 414]) {
  test(`metric scores align at the card bottom with wrapped labels at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 736 })
    const unexpected = await mockDesign(page)
    await page.goto(`/#/ai-consult?reportId=${reportCode}&userId=1001`)
    await page.getByTestId('ai-question').first().click()
    await expect(page.getByTestId('ai-stop')).toBeVisible()
    const metrics = [
      { label: '肺活量 VC', score: 60, system: 'SYS_LUNG', code: 'SYS_LUNG_VC' },
      { label: '肝内脂肪含量', score: 75, system: 'SYS_DIGEST', code: 'SYS_DIGEST_LIVER_FAT' },
      { label: '黄体酮', score: 77, system: 'SYS_FEMALE', code: 'SYS_FEMALE_PROGESTERONE' },
    ]
    await page.evaluate(({ metrics, report }) => {
      const sources = metrics.map((metric, index) => ({ id: `ev${index}`, kind: 'report', label: metric.label, report_date: '2022-07-21',
        route: `#/system/${metric.system}/indicator/${metric.code}?reportId=${report}&customerId=1001` }))
      window.__designFrame('evidence', { items: sources })
      window.__designFrame('completed', { answer: metrics.map(metric => `报告日期 2022-07-21：${metric.label}活力值 ${metric.score} 分。`).join('\n') })
    }, { metrics, report: reportCode })
    await expect(page.locator('.ai-answer-metric')).toHaveCount(3)
    const bounds = await page.locator('.ai-answer-metric').evaluateAll(cards => cards.map(card => ({
      top: card.getBoundingClientRect().top,
      bottom: card.getBoundingClientRect().bottom,
      labelTop: card.querySelector('span').getBoundingClientRect().top,
      scoreBottom: card.querySelector('strong').getBoundingClientRect().bottom,
      labelHeight: card.querySelector('span').getBoundingClientRect().height,
    })))
    expect(Math.max(...bounds.map(item => item.labelHeight))).toBeGreaterThan(Math.min(...bounds.map(item => item.labelHeight)))
    expect(Math.max(...bounds.map(item => item.scoreBottom)) - Math.min(...bounds.map(item => item.scoreBottom))).toBeLessThan(1)
    for (const item of bounds) {
      expect(item.labelTop - item.top).toBeCloseTo(14)
      expect(item.bottom - item.scoreBottom).toBeCloseTo(14)
    }
    expect(unexpected).toEqual([])
    if (width === 414) await page.getByTestId('ai-answer-metrics').screenshot({ path: '/private/tmp/nepstar-ai-metric-scores-aligned-414.png' })
  })
}

for (const width of [320, 414]) {
  test(`question input grows, caps and resets at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 736 })
    const unexpected = await mockDesign(page)
    await page.goto(`/#/ai-consult?reportId=${reportCode}&userId=1001`)
    const input = page.getByLabel('问问我的长寿报告', { exact: true })
    await expect(input).toHaveCSS('height', '46px')
    const initialPadding = await page.locator('.ai-welcome-content').evaluate(element => parseFloat(getComputedStyle(element).paddingBottom))
    await input.fill('第一行问题\n第二行补充\n第三行情况')
    await expect(input).toHaveCSS('height', '86px')
    await expect(input).toHaveCSS('overflow-y', 'hidden')
    expect(await page.locator('.ai-welcome-content').evaluate(element => parseFloat(getComputedStyle(element).paddingBottom))).toBe(initialPadding + 40)

    const longQuestion = '我想详细了解这份报告。\n'.repeat(15)
    await input.fill(longQuestion)
    await expect(input).toHaveCSS('height', '126px')
    await expect(input).toHaveCSS('overflow-y', 'auto')
    expect(await input.evaluate(element => element.scrollHeight)).toBeGreaterThan(126)
    expect(await input.evaluate(element => { element.scrollTop = element.scrollHeight; return element.scrollTop })).toBeGreaterThan(0)
    expect(await page.locator('.ai-welcome-content').evaluate(element => parseFloat(getComputedStyle(element).paddingBottom))).toBe(initialPadding + 80)
    const sendBounds = await page.getByRole('button', { name: '发送问题' }).boundingBox()
    const fieldBounds = await page.locator('.ai-composer-field').boundingBox()
    expect(sendBounds.y + sendBounds.height).toBeCloseTo(fieldBounds.y + fieldBounds.height)
    if (width === 414) await page.locator('.ai-composer-dock').screenshot({ path: '/private/tmp/nepstar-ai-autogrow-composer-414.png' })

    await page.setViewportSize({ width, height: 470 })
    await expect(page.getByTestId('ai-composer')).toBeInViewport()
    await expect(input).toHaveCSS('height', '126px')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await input.fill('我想了解这份报告')
    await expect(input).toHaveCSS('height', '46px')
    await expect(input).toHaveCSS('overflow-y', 'hidden')
    await input.fill('规律作息和日常管理方面，可以先从哪些事情开始？'.repeat(5))
    await expect(input).toHaveCSS('height', '126px')
    await page.getByRole('button', { name: '发送问题' }).click()
    await expect(page.getByTestId('ai-stop')).toBeVisible()
    await expect(input).toHaveValue('')
    await expect(input).toHaveCSS('height', '46px')
    expect(unexpected).toEqual([])
  })
}
