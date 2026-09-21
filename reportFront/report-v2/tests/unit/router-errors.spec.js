import { describe, expect, it } from 'vitest'
import { router } from '@/router/index.js'

describe('unknown report routes', () => {
  it('shows the missing-page state instead of redirecting to the report home', () => {
    expect(router.resolve('/an-unknown-page?reportId=R1&customerId=1').name).toBe('route-not-found')
  })
})
