import { expect, test } from '@playwright/test'

test('report flows do not call remote business endpoints', async ({ page }) => {
  const forbidden = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.origin !== 'http://127.0.0.1:5173' || url.pathname.startsWith('/api/')) forbidden.push(request.url())
  })
  await page.goto('/#/')
  for (const id of ['cardio', 'lung', 'endocrine', 'bone', 'digest', 'female', 'immune']) await page.goto(`/#/system/${id}`)
  expect(forbidden).toEqual([])
})
