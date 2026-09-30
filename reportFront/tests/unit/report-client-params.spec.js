import { describe, expect, it } from 'vitest'
import { reportParamsFromLocation, reportRouteQueryFromLocation } from '@/api/reportClient.js'

describe('report URL parameters', () => {
  it('accepts the platform userId from a hash-route URL', () => {
    expect(reportParamsFromLocation('', '#/?reportId=R1&userId=13790451&reportType=124')).toEqual({
      reportCode: 'R1',
      customerId: 13790451,
    })
  })

  it('continues to accept customerId from existing report links', () => {
    expect(reportParamsFromLocation('', '#/?reportId=R1&customerId=11922495')).toEqual({
      reportCode: 'R1',
      customerId: 11922495,
    })
  })

  it('prefers the active hash route values over outer query values', () => {
    expect(reportParamsFromLocation(
      '?reportId=OLD&customerId=1&source=outer',
      '#/system/SYS_CARDIO?reportId=R1&userId=13790451&source=kjwx',
    )).toEqual({
      reportCode: 'R1',
      customerId: 13790451,
    })
  })

  it('keeps launch context and writes platform-compatible identity on internal links', () => {
    expect(reportRouteQueryFromLocation(
      '',
      '#/?reportId=R1&userId=13790451&openId=&reportType=124&source=kjwx&language=zh',
    )).toEqual({
      openId: '',
      reportType: '124',
      source: 'kjwx',
      language: 'zh',
      reportId: 'R1',
      userId: '13790451',
    })
  })

  it('falls back to userId if customerId is empty or invalid', () => {
    expect(reportParamsFromLocation('', '#/?reportId=R1&customerId=&userId=13790451').customerId)
      .toBe(13790451)
    expect(reportParamsFromLocation('', '#/?reportId=R1&customerId=bad&userId=13790451').customerId)
      .toBe(13790451)
  })
})
