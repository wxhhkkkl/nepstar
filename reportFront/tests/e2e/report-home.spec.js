import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })

test('home preserves score, systems, recommendation order and complete products', async ({ page }) => {
  await page.goto('/#/')
  await expect(page.getByTestId('report-home')).toBeVisible()
  await expect(page.locator('.status-bar')).toHaveCount(0)
  await expect(page.locator('#scoreValue')).toHaveText('68')
  await expect(page.locator('#scorePanel')).toHaveClass(/is-warning-score/)
  await expect(page.locator('[data-system-id]')).toHaveCount(7)

  const flow = await page.locator('[data-vue-flow] > [data-system-group], [data-vue-flow] > [data-system-id], [data-vue-flow] > [data-recommendation-for]').evaluateAll((nodes) => nodes.map((node) => node.dataset.systemGroup ? `system-group:${node.dataset.systemGroup}` : node.dataset.systemId ? `system:${node.dataset.systemId}` : `recommendation:${node.dataset.recommendationFor}`))
  expect(flow).toEqual([
    'system-group:endocrine,lung', 'recommendation:endocrine', 'system:bone',
    'recommendation:bone', 'system:cardio', 'system:digest', 'system:female', 'system:immune',
  ])

  for (const image of await page.locator('.issue-plan-visual img').all()) {
    const state = await image.evaluate((element) => ({ complete: element.complete, naturalWidth: element.naturalWidth, fit: getComputedStyle(element).objectFit }))
    expect(state.complete).toBe(true)
    expect(state.naturalWidth).toBeGreaterThan(0)
    expect(state.fit).toBe('contain')
  }
})
