import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import { QUESTION, loopbackOrigin, percentiles, streamingGateway, validEvidenceRoutes, validateInput } from '../../scripts/ai-consult-browser-trial.mjs'

const fixture = { report_code: 'AI-CONSULT-TEST-LOAD-01', customer_id: 900001 }
const input = { backend_url: 'http://127.0.0.1:12345', frontend_url: 'http://127.0.0.1:12346',
  fixtures: [fixture], question: QUESTION, indicator: 'SYS_LUNG_SLEEP_BREATHING' }

test('accept only explicit loopback origins', () => {
  assert.equal(loopbackOrigin(input.backend_url), input.backend_url)
  for (const value of ['https://remote.example', 'http://127.0.0.1',
    'http://secret:secret@127.0.0.1:12345', 'http://127.0.0.1:12345/api',
    'http://127.0.0.1:12345/?token=secret']) assert.throws(() => loopbackOrigin(value))
})

test('reject real scopes, duplicate reports, arbitrary questions or more than twenty', () => {
  assert.equal(validateInput(input), input)
  for (const change of [
    { fixtures: [] }, { fixtures: Array(21).fill(fixture) }, { fixtures: [fixture, fixture] },
    { fixtures: [{ ...fixture, report_code: 'REAL-REPORT' }] },
    { fixtures: [{ ...fixture, customer_id: 1 }] },
    { fixtures: [{ report_code: 'AI-CONSULT-TEST-LOAD-99', customer_id: 900099 }] },
    { question: '虚构但这是任意问题' }, { indicator: 'UNAPPROVED' },
  ]) assert.throws(() => validateInput({ ...input, ...change }))
})

test('nearest rank percentiles do not mutate samples', () => {
  const values = [30, 10, 20]
  assert.deepEqual(percentiles(values), { p50_ms: 20, p95_ms: 30, p99_ms: 30 })
  assert.deepEqual(values, [30, 10, 20])
})

test('Vue evidence routes preserve userId and reject cross-report or leaked credentials', () => {
  const route = `#/system/SYS_LUNG/indicator/SYS_LUNG_SLEEP_BREATHING?reportId=${fixture.report_code}&userId=${fixture.customer_id}`
  assert.equal(validEvidenceRoutes([route], fixture), true)
  for (const links of [[], [route.replace('900001', '900002')], [`${route}&guest_token=secret`],
    [route.replace(fixture.report_code, 'REAL-REPORT')], [`${route}&customerId=1`]]) {
    assert.equal(validEvidenceRoutes(links, fixture), false)
  }
})

test('gateway forwards first SSE frame before completion, caps questions and rejects other APIs', { timeout: 10000 }, async () => {
  let finish
  const upstream = createServer((request, response) => {
    request.resume()
    response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' })
    response.write('event: accepted\ndata: {}\n\n')
    finish = () => response.end('event: completed\ndata: {}\n\n')
  })
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${upstream.address().port}`
  const proxy = await streamingGateway(origin, origin, 1)
  try {
    const turnPath = '/api/v1/ai-consult/sessions/11111111-1111-4111-8111-111111111111/turns'
    const response = await fetch(`${proxy.origin}${turnPath}`, { method: 'POST', body: '{}' })
    const reader = response.body.getReader()
    const first = await reader.read()
    assert.equal(new TextDecoder().decode(first.value), 'event: accepted\ndata: {}\n\n')
    assert.equal(first.done, false)
    assert.equal((await fetch(`${proxy.origin}${turnPath}`, { method: 'POST', body: '{}' })).status, 403)
    assert.equal((await fetch(`${proxy.origin}/api/v1/other-private-api`)).status, 403)
    finish()
    const final = await reader.read()
    assert.match(new TextDecoder().decode(final.value), /completed/)
    await reader.cancel()
    assert.equal(proxy.state.question_requests, 1)
    assert.equal(proxy.state.question_in_flight_peak, 1)
    assert.equal(proxy.state.blocked_requests, 2)
  } finally {
    await proxy.close()
    upstream.closeAllConnections()
    await new Promise(resolve => upstream.close(resolve))
  }
})
