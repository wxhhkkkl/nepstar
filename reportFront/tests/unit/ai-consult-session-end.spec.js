import { afterEach, expect, it, vi } from 'vitest'
import { endConsultSession, guestTokenStorageKey } from '@/api/aiConsultClient.js'

const ID = '11111111-1111-4111-8111-111111111111'
afterEach(() => { vi.unstubAllGlobals(); sessionStorage.clear() })

it('keeps the guest credential in the header when ending during browser unload', async () => {
  const token = 'a'.repeat(43)
  sessionStorage.setItem(guestTokenStorageKey('R1', 1001), token)
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 200, data: { id: ID, status: 'ended' } }), {
    headers: { 'Content-Type': 'application/json' },
  }))
  vi.stubGlobal('fetch', fetchMock)
  await endConsultSession('R1', 1001, ID, { keepalive: true })
  const [url, options] = fetchMock.mock.calls[0]
  expect(url).toContain(`/sessions/${ID}/end?report_code=R1`)
  expect(url).not.toContain(token)
  expect(options).toMatchObject({ method: 'POST', keepalive: true, headers: { Authorization: `Bearer ${token}` } })
})

it('does not send an ending request without a valid session ID', async () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  await expect(endConsultSession('R1', 1001, 'invalid')).rejects.toMatchObject({ kind: 'session_not_found' })
  expect(fetchMock).not.toHaveBeenCalled()
})
