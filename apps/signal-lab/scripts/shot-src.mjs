import { chromium } from 'playwright'
const URL = process.env.APP_URL || 'http://localhost:4173'
const preset = process.argv[2]
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1500, height: 2600 } })
await page.goto(URL, { waitUntil: 'load' })
await page.waitForSelector('.views canvas')
await page.getByRole('button', { name: preset, exact: true }).click()
await page.waitForTimeout(300)
await page.getByRole('button', { name: 'The math for this source' }).first().click()
await page.waitForTimeout(400)
await page.locator('.controls').screenshot({ path: 'shots/_src.png' })
await browser.close()
