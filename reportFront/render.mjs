import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const projectDir = path.dirname(fileURLToPath(import.meta.url))
const outputDir = path.join(projectDir, 'tests/baseline/vue')
const baseUrl = process.env.V2_REPORT_URL || 'http://127.0.0.1:5173'
await fs.mkdir(outputDir, { recursive: true })

const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'zh-CN', reducedMotion: 'reduce' })
const page = await context.newPage()
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
await page.goto(`${baseUrl}/#/`, { waitUntil: 'networkidle' })
await page.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0))

const audit = await page.evaluate(() => {
  const footer = document.querySelector('.report-v2 footer')
  return {
    score: document.querySelector('#scoreValue')?.textContent,
    systems: document.querySelectorAll('[data-system-id]').length,
    recommendations: document.querySelectorAll('[data-recommendation-for]').length,
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: innerWidth,
    trailingBlank: document.documentElement.scrollHeight - (footer.getBoundingClientRect().bottom + scrollY),
  }
})

if (errors.length || audit.score !== '68' || audit.systems !== 7 || audit.recommendations !== 2 || audit.scrollWidth > audit.viewportWidth || audit.trailingBlank > 140) {
  throw new Error(`V2 report render audit failed: ${JSON.stringify({ audit, errors })}`)
}

const output = path.join(outputDir, 'home-render.png')
await page.screenshot({ path: output, fullPage: true })
console.log(JSON.stringify({ output, audit, errors }))
await browser.close()
