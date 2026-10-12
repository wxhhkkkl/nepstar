import { describe, expect, it } from 'vitest'
import { router } from '@/router/index.js'

describe('unknown report routes', () => {
  it('shows the missing-page state instead of redirecting to the report home', () => {
    expect(router.resolve('/an-unknown-page?reportId=R1&customerId=1').name).toBe('route-not-found')
  })

  it('recognizes the candidate AI consultation route without replacing the current entry', () => {
    expect(router.resolve('/ai-consult?reportId=R1&userId=1').name).toBe('ai-consult')
  })
})
