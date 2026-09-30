import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchReportHome } from '@/api/reportClient.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('report API base URL', () => {
  it('uses the production API domain by default', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 200, data: {} }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await fetchReportHome('R1', 13790451)

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://nepstar.kangjia.online/api/v1/report-view/R1/home?customer_id=13790451',
    )
  })
})
