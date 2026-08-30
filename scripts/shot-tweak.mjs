// Load a preset, change a source parameter, open the math panel, screenshot.
import { chromium } from 'playwright'
const URL = process.env.APP_URL || 'http://localhost:4173'
const [preset, freq] = [process.argv[2], process.argv[3]]
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1500, height: 2600 }, deviceScaleFactor: 1 })
const problems = []
page.on('pageerror', (e) => problems.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()) })
await page.goto(URL, { waitUntil: 'load' })
await page.waitForSelector('.views canvas')
await page.getByRole('button', { name: preset, exact: true }).click()
await page.waitForTimeout(250)
if (freq) {
  const box = page.getByRole('spinbutton', { name: 'Frequency' }).first()
  await box.fill(freq)
  await box.press('Enter')
  await page.waitForTimeout(400)
}
await page.locator('.math-toggle').click()
await page.waitForTimeout(400)
await page.locator('.controls').screenshot({ path: 'shots/_tweak.png' })
console.log(problems.length ? problems.join('\n') : 'no page errors')
await browser.close()
