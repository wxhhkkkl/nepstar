import { expect, test } from '@playwright/test'
import { reportDto } from '../fixtures/reportDto.js'

test.use({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' })

async function openReport(page, score) {
  const dto = structuredClone(reportDto)
  dto.report.total_score = score
  await page.route('**/api/v1/report-view/R1/home**', route =>
    route.fulfill({ json: { code: 200, data: dto } }),
  )
  await page.goto('/#/?reportId=R1&userId=1001')
  await expect(page.getByTestId('report-home')).toBeVisible()
}

async function finishScoreAnimation(page) {
  await page.locator('.score-stage').evaluate(stage =>
    Promise.all(stage.getAnimations({ subtree: true }).map(animation => animation.finished)),
  )
}

async function dashStyle(page) {
  return page.locator('.ring-dash').evaluate(dash => {
    const style = getComputedStyle(dash)
    return { transform: style.transform, offset: style.strokeDashoffset }
  })
}

for (const score of [68, 82]) {
  test(`replaying the ${score}-point score moves the dashed arc and restarts the rings`, async ({ page }) => {
    await openReport(page, score)
    await finishScoreAnimation(page)
    const settledDash = await dashStyle(page)
    const replay = page.getByRole('button', { name: '重播长寿指数动效' })

    for (let repeat = 0; repeat < 2; repeat++) {
      await replay.click()
      await expect(replay).toBeFocused()
      await expect.poll(() => page.locator('.ring-progress, .ring-dash, .orbit-a, .orbit-b').evaluateAll(elements =>
        elements.every(element => element.getAnimations().some(animation => animation.playState === 'running')),
      )).toBe(true)
      const movingDash = await dashStyle(page)
      expect(movingDash).not.toEqual(settledDash)
      await expect.poll(() => dashStyle(page)).not.toEqual(movingDash)

      await finishScoreAnimation(page)
      expect(await dashStyle(page)).toEqual(settledDash)
      await expect(page.locator('#scoreValue')).toHaveText(String(score))
    }
  })
}

test('replay respects reduced motion and keeps the final score after repeated clicks', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openReport(page, 82)
  const replay = page.getByRole('button', { name: '重播长寿指数动效' })
  for (let repeat = 0; repeat < 3; repeat++) await replay.click()

  await expect(page.locator('#scoreValue')).toHaveText('82')
  expect(await page.locator('.score-stage').evaluate(stage => stage.getAnimations({ subtree: true }).length)).toBe(0)
})
