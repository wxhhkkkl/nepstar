/** Opt-in loopback UI measurements. No API mocks, keys, real reports or logs. */
import { createServer, request as httpRequest } from 'node:http'
import { pathToFileURL } from 'node:url'
import { chromium } from '@playwright/test'

export const QUESTION = '这是一份虚构的验收报告，呼吸睡眠这项指标的展示含义是什么？请只解释演示资料，不给健康建议，不必追问。'

export function loopbackOrigin(value) {
  const url = new URL(value)
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port
    || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('invalid_loopback_origin')
  }
  return url.origin
}

export function validateInput(input) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.fixtures)
    || input.fixtures.length < 1 || input.fixtures.length > 20
    || input.question !== QUESTION || input.indicator !== 'SYS_LUNG_SLEEP_BREATHING') {
    throw new Error('invalid_synthetic_input')
  }
  loopbackOrigin(input.backend_url)
  loopbackOrigin(input.frontend_url)
  const reports = new Set()
  for (const item of input.fixtures) {
    const index = Number((item.report_code || '').split('-').at(-1))
    if (!/^AI-CONSULT-TEST-LOAD-\d{2}$/.test(item.report_code || '')
      || index < 1 || index > 20 || item.customer_id !== 900000 + index
      || reports.has(item.report_code)) throw new Error('invalid_synthetic_input')
    reports.add(item.report_code)
  }
  return input
}

const strippedHeaders = headers => Object.fromEntries(Object.entries(headers)
  .filter(([key]) => !['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
    'te', 'trailer', 'transfer-encoding', 'upgrade'].includes(key.toLowerCase())))

export async function streamingGateway(backend, frontend, cap) {
  const state = { question_requests: 0, question_in_flight_peak: 0, active: 0,
    blocked_requests: 0, current_turn_reads: 0 }
  backend = loopbackOrigin(backend)
  frontend = loopbackOrigin(frontend)
  if (!Number.isInteger(cap) || cap < 1 || cap > 20) throw new Error('invalid_cap')
  const server = createServer((request, response) => {
    const path = new URL(request.url, 'http://127.0.0.1').pathname
    const isApi = path.startsWith('/api/')
    const isTurn = /^\/api\/v1\/ai-consult\/sessions\/[a-f0-9-]+\/turns$/.test(path)
      && request.method === 'POST'
    const readTurn = /^\/api\/v1\/ai-consult\/sessions\/[a-f0-9-]+\/turns\/\d+$/.test(path)
      && request.method === 'GET'
    const allowedApi = isTurn || readTurn || (
      request.method === 'POST' && /^\/api\/v1\/ai-consult\/(guest-contexts|consents|sessions)$/.test(path)
    ) || (request.method === 'GET' && path === '/api/v1/ai-consult/bootstrap')
    if (!request.url.startsWith('/') || request.url.startsWith('//')
      || (!isApi && !['GET', 'HEAD'].includes(request.method))
      || request.method === 'CONNECT' || (isApi && !allowedApi) || (isTurn && state.question_requests >= cap)) {
      state.blocked_requests++
      request.resume()
      response.writeHead(403, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ code: 403, message: 'trial.request_rejected', data: null }))
      return
    }
    if (isTurn) {
      state.question_requests++
      state.active++
      state.question_in_flight_peak = Math.max(state.question_in_flight_peak, state.active)
    }
    if (readTurn) state.current_turn_reads++
    const target = new URL(request.url, isApi ? backend : frontend)
    const upstream = httpRequest(target, {
      method: request.method, headers: { ...strippedHeaders(request.headers), host: target.host },
    }, result => {
      response.writeHead(result.statusCode, strippedHeaders(result.headers))
      result.pipe(response) // Stream every upstream chunk; never aggregate SSE bodies.
    })
    upstream.on('error', () => {
      if (!response.headersSent) response.writeHead(502)
      response.end()
    })
    response.on('close', () => { if (isTurn) state.active--; upstream.destroy() })
    request.pipe(upstream)
  })
  server.on('upgrade', (_request, socket) => socket.destroy())
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  return {
    origin: `http://127.0.0.1:${server.address().port}`, state,
    async close() { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) },
  }
}

export function percentiles(values) {
  const sorted = [...values].sort((a, b) => a - b)
  return Object.fromEntries([50, 95, 99].map(p => [
    `p${p}_ms`, Math.round(sorted[Math.ceil(sorted.length * p / 100) - 1] * 100) / 100,
  ]))
}

export function validEvidenceRoutes(links, fixture) {
  return Array.isArray(links) && links.length > 0 && links.every(href => {
    if (typeof href !== 'string' || !href.startsWith('#/system/SYS_LUNG/indicator/SYS_LUNG_SLEEP_BREATHING?')) return false
    const params = new URLSearchParams(href.split('?')[1])
    // Vue canonicalizes public customerId to userId, unlike the server citation.
    return params.get('reportId') === fixture.report_code
      && params.get('userId') === String(fixture.customer_id) && !params.has('guest_token')
      && (!params.has('customerId') || params.get('customerId') === String(fixture.customer_id))
  })
}

async function installMeasurements(page) {
  await page.addInitScript(() => {
    window.__trial = { started: null, feedback_ms: null, accepted_ms: null, answer_ms: null, completed_ms: null }
    const pending = new Set()
    const visible = element => {
      if (!element) return false
      const style = getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0
        && rect.height > 0 && rect.top < innerHeight && rect.bottom > 0
    }
    const mark = (key, selector) => {
      if (window.__trial[key] !== null || pending.has(key) || !visible(document.querySelector(selector))) return
      pending.add(key)
      // Two rendering opportunities, not a hardware screen-paint assertion.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        pending.delete(key)
        if (visible(document.querySelector(selector)) && window.__trial[key] === null) {
          window.__trial[key] = performance.now() - window.__trial.started
        }
      }))
    }
    const observe = () => {
      if (window.__trial.started === null) return
      mark('feedback_ms', '.ai-answer[aria-busy="true"] .ai-answer-pending')
      mark('accepted_ms', '[data-testid="ai-stop"]')
      mark('answer_ms', '.ai-answer-text')
      mark('completed_ms', '.ai-answer[aria-busy="false"] .ai-answer-text')
    }
    document.addEventListener('click', event => {
      if (event.target.closest('button[aria-label="发送问题"]') && window.__trial.started === null) {
        window.__trial.started = performance.now()
      }
    }, true)
    new MutationObserver(observe).observe(document, { subtree: true, childList: true,
      attributes: true, characterData: true })
    document.addEventListener('scroll', observe, true)
  })
}

export async function browserTrial(input) {
  validateInput(input)
  const gateway = await streamingGateway(input.backend_url, input.frontend_url, input.fixtures.length)
  let browser
  let externalBlocked = 0
  let stage = 'browser_setup'
  try {
    // Use the same installed Chrome channel as this project's E2E configuration.
    browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-background-timer-throttling',
      '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] })
    const pages = await Promise.all(input.fixtures.map(async fixture => {
      const context = await browser.newContext({ viewport: { width: 414, height: 740 },
        isMobile: true, hasTouch: true, serviceWorkers: 'block' })
      await context.route('**/*', async route => {
        if (new URL(route.request().url()).origin !== gateway.origin) {
          externalBlocked++
          return route.abort()
        }
        return route.continue()
      })
      const page = await context.newPage()
      page.setDefaultTimeout(15000)
      await installMeasurements(page)
      const params = new URLSearchParams({ reportId: fixture.report_code, userId: String(fixture.customer_id),
        indicatorCode: input.indicator })
      await page.goto(`${gateway.origin}/#/ai-consult?${params}`, { waitUntil: 'domcontentloaded' })
      await page.getByTestId('ai-start-consult').click()
      await page.getByTestId('ai-notice-accept').click()
      await page.getByRole('textbox', { name: '问问我的长寿报告', exact: true }).fill(input.question)
      return { page, fixture }
    }))
    stage = 'browser_questions'
    await Promise.all(pages.map(({ page }) => page.getByRole('button', { name: '发送问题', exact: true }).click()))
    const outcomes = await Promise.all(pages.map(async ({ page, fixture }) => {
      await page.waitForFunction(() => window.__trial.completed_ms !== null, null, { timeout: 65000 })
      const measured = await page.evaluate(() => ({ ...window.__trial,
        answer: document.querySelector('.ai-answer-text')?.textContent || '',
        question_count: document.querySelectorAll('.ai-user-question').length,
        overflow: document.documentElement.scrollWidth > innerWidth,
        links: Array.from(document.querySelectorAll('[data-testid="ai-evidence"] a')).map(a => a.getAttribute('href')),
      }))
      const score = 70 + Number(fixture.report_code.split('-').at(-1))
      if (measured.question_count !== 1 || measured.overflow || !measured.answer.includes(String(score))
        || !measured.answer.includes('2026-10-10') || !validEvidenceRoutes(measured.links, fixture)
        || ['feedback_ms', 'accepted_ms', 'answer_ms', 'completed_ms']
          .some(key => !Number.isFinite(measured[key]) || measured[key] < 0)) {
        throw new Error('browser_validation_failed')
      }
      // Body and credential-bearing state never leave the browser automation process.
      return Object.fromEntries(['feedback_ms', 'accepted_ms', 'answer_ms', 'completed_ms']
        .map(key => [key, measured[key]]))
    }))
    const passed = gateway.state.question_requests === input.fixtures.length
      && gateway.state.blocked_requests === 0 && externalBlocked === 0
    return {
      status: passed ? 'passed' : 'failed', samples: input.fixtures.length,
      question_requests: gateway.state.question_requests,
      browser_completed_count: outcomes.length,
      proxy_question_in_flight_peak: gateway.state.question_in_flight_peak,
      browser_latency_ms: Object.fromEntries(['feedback_ms', 'accepted_ms', 'answer_ms', 'completed_ms']
        .map(key => [key, percentiles(outcomes.map(item => item[key]))])),
      browser_version: browser.version(), external_requests_blocked: externalBlocked,
      proxy_requests_blocked: gateway.state.blocked_requests,
      current_turn_reads: gateway.state.current_turn_reads,
      local_streaming_proxy_measured: true, mobile_emulation_measured: true,
      physical_device_measured: false, deployment_proxy_measured: false, release_accepted: false,
    }
  } catch (error) {
    return { status: 'failed', error_category: error?.message === 'browser_validation_failed' ? 'browser_validation' : stage,
      samples: input.fixtures.length,
      question_requests: gateway.state.question_requests, release_accepted: false }
  } finally {
    if (browser) await browser.close()
    await gateway.close()
  }
}

async function main() {
  let raw = ''
  for await (const chunk of process.stdin) {
    raw += chunk
    if (raw.length > 16384) throw new Error('input_too_large')
  }
  const result = await browserTrial(JSON.parse(raw))
  process.stdout.write(JSON.stringify(result))
  return result.status === 'passed' ? 0 : 2
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(code => { process.exitCode = code }).catch(() => {
    process.stdout.write(JSON.stringify({ status: 'failed', error_category: 'browser_input', release_accepted: false }))
    process.exitCode = 2
  })
}
