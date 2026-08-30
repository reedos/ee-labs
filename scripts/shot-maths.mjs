// Screenshot the sidebar with the maths panel opened, for a named preset.
import { chromium } from 'playwright'
const URL = process.env.APP_URL || 'http://localhost:4173'
const name = process.argv[2] || 'Resonance is Q'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1500, height: 2400 }, deviceScaleFactor: 1 })
const problems = []
page.on('pageerror', (e) => problems.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()) })
await page.goto(URL, { waitUntil: 'load' })
await page.waitForSelector('.views canvas')
await page.getByRole('button', { name, exact: true }).click()
await page.waitForTimeout(300)
await page.locator('.maths-toggle').click()
await page.waitForTimeout(400)
const n = await page.locator('.katex').count()
console.log(`katex nodes rendered: ${n}`)
await page.locator('.controls').screenshot({ path: 'shots/_maths.png' })
console.log(problems.length ? problems.join('\n') : 'no page errors')
await browser.close()
