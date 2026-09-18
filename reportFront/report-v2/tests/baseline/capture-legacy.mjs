import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from '/Users/leelee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'

const baselineDir = path.dirname(fileURLToPath(import.meta.url))
const projectDir = path.resolve(baselineDir, '../../code_v1')
const outputDir = path.join(baselineDir, 'legacy')
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const systems = ['cardio', 'lung', 'endocrine', 'bone', 'digest', 'female', 'immune']

const browser = await chromium.launch({ headless: true, executablePath: chrome })

async function capture(file, suffix, output, viewport) {
  const context = await browser.newContext({ viewport, locale: 'zh-CN', reducedMotion: 'reduce' })
  const page = await context.newPage()
  await page.goto(`${pathToFileURL(path.join(projectDir, file)).href}${suffix}`, { waitUntil: 'load' })
  await page.evaluate(() => {
    document.querySelectorAll('.systems-section .data-card').forEach((card) => card.classList.add('is-visible'))
    window.scrollTo(0, 0)
  })
  await page.waitForTimeout(150)
  await page.screenshot({ path: path.join(outputDir, output), fullPage: true })
  await context.close()
}

await capture('index.html', '', 'home-390.png', { width: 390, height: 844 })
await capture('index.html', '', 'home-1440.png', { width: 1440, height: 1000 })

for (const id of systems) {
  await capture('detail.html', `?id=${id}`, `detail-${id}-390.png`, { width: 390, height: 844 })
}

await browser.close()
