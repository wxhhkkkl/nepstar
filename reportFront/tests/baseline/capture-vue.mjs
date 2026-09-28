import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '/Users/leelee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'

const baselineDir = path.dirname(fileURLToPath(import.meta.url))
const outputDir = path.join(baselineDir, 'vue')
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })

async function capture(route, output, viewport) {
  const context = await browser.newContext({ viewport, locale: 'zh-CN', reducedMotion: 'reduce' })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(`http://127.0.0.1:5173/${route}`, { waitUntil: 'networkidle' })
  await page.screenshot({ path: path.join(outputDir, output), fullPage: true })
  const size = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }))
  console.log(JSON.stringify({ output, size, errors }))
  await context.close()
}

await capture('#/', 'home-390.png', { width: 390, height: 844 })
await capture('#/', 'home-1440.png', { width: 1440, height: 1000 })
await capture('#/system/endocrine', 'detail-endocrine-390.png', { width: 390, height: 844 })
await capture('#/system/bone', 'detail-bone-390.png', { width: 390, height: 844 })
await browser.close()
