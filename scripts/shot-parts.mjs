// Open a preset, then expand the source and block math panels, and shoot.
import { chromium } from 'playwright'
const URL = process.env.APP_URL || 'http://localhost:4173'
const preset = process.argv[2] || 'Resonance is Q'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1500, height: 3400 }, deviceScaleFactor: 1 })
const problems = []
page.on('pageerror', (e) => problems.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()) })
await page.goto(URL, { waitUntil: 'load' })
await page.waitForSelector('.views canvas')
await page.getByRole('button', { name: preset, exact: true }).click()
await page.waitForTimeout(300)
for (const name of ['The math for this source', 'The math for this block']) {
  const b = page.getByRole('button', { name }).first()
  if (await b.count()) { await b.click(); await page.waitForTimeout(300) }
}
console.log('katex nodes:', await page.locator('.katex').count())
await page.locator('.controls').screenshot({ path: 'shots/_parts.png' })
console.log(problems.length ? problems.join('\n') : 'no page errors')
await browser.close()
