import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('report API base URL', () => {
  it('uses the production API domain by default', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 200, data: {} }),
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('VITE_API_BASE_URL', '')
    const { fetchReportHome } = await import('@/api/reportClient.js')

    await fetchReportHome('R1', 13790451)

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://nepstar.kangjia.online/api/v1/report-view/R1/home?customer_id=13790451',
    )
  })

  it('keeps an explicit local API prefix for isolated development', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '/api/v1/')
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ code: 200, data: {} }) })
    vi.stubGlobal('fetch', fetchMock)
    const { fetchReportHome } = await import('@/api/reportClient.js')
    await fetchReportHome('R1', 1001)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/report-view/R1/home?customer_id=1001')
  })
})
