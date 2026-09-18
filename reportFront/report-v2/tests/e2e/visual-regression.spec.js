import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const root = path.resolve(import.meta.dirname, '..')

function pngSize(buffer) {
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

for (const scenario of [
  { name: 'home', route: '/#/', legacy: 'home-390.png', removedTopBar: 28 },
  { name: 'endocrine detail', route: '/#/system/endocrine', legacy: 'detail-endocrine-390.png', removedTopBar: 28 },
  { name: 'bone detail', route: '/#/system/bone', legacy: 'detail-bone-390.png', removedTopBar: 28 },
]) {
  test(`${scenario.name} keeps its geometry after removing the status bar`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(scenario.route)
    const current = pngSize(await page.screenshot({ fullPage: true }))
    const legacy = pngSize(fs.readFileSync(path.join(root, 'baseline/legacy', scenario.legacy)))
    expect(current.width).toBe(legacy.width)
    expect(Math.abs(current.height - (legacy.height - scenario.removedTopBar))).toBeLessThanOrEqual(2)
  })
}
