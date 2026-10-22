import { afterEach, describe, expect, it, vi } from 'vitest'
import { createUuid } from '@/utils/uuid.js'

afterEach(() => vi.unstubAllGlobals())

describe('UUID compatibility', () => {
  it('uses the native UUID API when available', () => {
    const randomUUID = vi.fn().mockReturnValue('11111111-1111-4111-8111-111111111111')
    vi.stubGlobal('crypto', { randomUUID })
    expect(createUuid()).toBe('11111111-1111-4111-8111-111111111111')
    expect(randomUUID).toHaveBeenCalledOnce()
  })

  it('generates valid UUID v4 IDs on HTTP without randomUUID', () => {
    const getRandomValues = globalThis.crypto.getRandomValues.bind(globalThis.crypto)
    vi.stubGlobal('crypto', { getRandomValues })
    const ids = Array.from({ length: 100 }, () => createUuid())
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    }
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('reports unavailable secure randomness instead of using weak request IDs', () => {
    vi.stubGlobal('crypto', undefined)
    expect(() => createUuid()).toThrow('Secure random generation is unavailable')
  })
})
