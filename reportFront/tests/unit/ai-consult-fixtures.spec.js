import { describe, expect, it } from 'vitest'
import { aiConsultIsolationCases } from '../fixtures/aiConsult.js'

describe('AI consultation isolation fixtures', () => {
  it('uses distinct synthetic visitors for separate tabs on one report', () => {
    const [first, second] = aiConsultIsolationCases.visitors
    expect(first.reportId).toBe(second.reportId)
    expect(first.userId).toBe(second.userId)
    expect(first.tab).not.toBe(second.tab)
    expect(first.guestToken).not.toBe(second.guestToken)
    expect(first.guestToken).toMatch(/^[a-zA-Z0-9_-]{43}$/)
    expect(second.guestToken).toMatch(/^[a-zA-Z0-9_-]{43}$/)
  })

  it('keeps report identities and consent, expiration and generation outcomes explicit', () => {
    const [firstReport, secondReport] = aiConsultIsolationCases.reports
    expect(firstReport.reportId).not.toBe(secondReport.reportId)
    expect(firstReport.userId).not.toBe(secondReport.userId)
    expect(aiConsultIsolationCases.outcomes).toMatchObject({
      consentGranted: { consent_status: 'granted' },
      consentRequired: { consent_status: 'required' },
      expiredGuest: { code: 403 },
      generationFailed: { code: 503 },
    })
  })
})
