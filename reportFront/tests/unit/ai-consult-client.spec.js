import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { loadConsultBootstrap, guestTokenStorageKey, streamConsultQuestion } = await import('@/api/aiConsultClient.js')
const PRIVATE_TOKEN = 'a'.repeat(43)
const NEW_TOKEN = 'b'.repeat(43)
const OLD_TOKEN = 'c'.repeat(43)

function reply(code, data = null, status = 200, message = 'ok') {
  return { ok: status >= 200 && status < 300, status, json: async () => ({ code, data, message }) }
}

describe('anonymous consultation client', () => {
  beforeEach(() => sessionStorage.clear())
  afterEach(() => vi.unstubAllGlobals())

  it('keeps the private token only in this tab, then refresh reuses it', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(reply(200, { guest_token: PRIVATE_TOKEN, report_code: 'R1', customer_id: 1001 }))
      .mockResolvedValueOnce(reply(200, { report_date: '2026-10-08' }))
      .mockResolvedValueOnce(reply(200, { report_date: '2026-10-08' }))
    vi.stubGlobal('fetch', fetchMock)

    await loadConsultBootstrap('R1', 1001)
    await loadConsultBootstrap('R1', 1001)

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[0][0]).toContain('/ai-consult/guest-contexts')
    expect(fetchMock.mock.calls[1][0]).toContain('/ai-consult/bootstrap?report_code=R1')
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe(`Bearer ${PRIVATE_TOKEN}`)
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe(`Bearer ${PRIVATE_TOKEN}`)
    expect(fetchMock.mock.calls.every(([url]) => !url.includes(PRIVATE_TOKEN))).toBe(true)
    expect(sessionStorage.getItem(guestTokenStorageKey('R1', 1001))).toBe(PRIVATE_TOKEN)
  })

  it('does not reuse a token for a different report or customer', async () => {
    sessionStorage.setItem(guestTokenStorageKey('R1', 1001), OLD_TOKEN)
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(reply(200, { guest_token: NEW_TOKEN, report_code: 'R2', customer_id: 1001 }))
      .mockResolvedValueOnce(reply(200, { report_date: '2026-10-08' }))
    vi.stubGlobal('fetch', fetchMock)
    await loadConsultBootstrap('R2', 1001)
    expect(fetchMock.mock.calls[0][1].method).toBe('POST')
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe(`Bearer ${NEW_TOKEN}`)
    expect(sessionStorage.getItem(guestTokenStorageKey('R1', 1001))).toBe(OLD_TOKEN)
  })

  it('discards an expired token and creates one replacement, never looping forever', async () => {
    sessionStorage.setItem(guestTokenStorageKey('R1', 1001), OLD_TOKEN)
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(reply(403, null, 403, 'consult.guest_token_expired'))
      .mockResolvedValueOnce(reply(200, { guest_token: NEW_TOKEN, report_code: 'R1', customer_id: 1001 }))
      .mockResolvedValueOnce(reply(200, { report_date: '2026-10-08' }))
    vi.stubGlobal('fetch', fetchMock)
    await loadConsultBootstrap('R1', 1001)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(sessionStorage.getItem(guestTokenStorageKey('R1', 1001))).toBe(NEW_TOKEN)
  })

  it('does not store an unverified or disabled guest response', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(reply(200, { guest_token: 'wrong', report_code: 'R2', customer_id: 1001 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(loadConsultBootstrap('R1', 1001)).rejects.toMatchObject({ kind: 'unavailable' })
    expect(sessionStorage.length).toBe(0)
  })

  it('sends long questions to the server instead of imposing the old fixed length cap', async () => {
    sessionStorage.setItem(guestTokenStorageKey('R1', 1001), PRIVATE_TOKEN)
    const question = '问'.repeat(600)
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('offline'))
    vi.stubGlobal('fetch', fetchMock)
    await expect(streamConsultQuestion('R1', 1001, '00000000-0000-4000-8000-000000000001', question))
      .rejects.toMatchObject({ kind: 'network' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ question })
  })
})
