import { chromium } from 'playwright'
import { tapTargetProbe } from '@ee-labs/ui/verify/tapTargetProbe.mjs'

const URL = process.env.APP_URL
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true })
await page.goto(URL, { waitUntil: 'load' })
await page.waitForSelector('.views canvas')
await page.waitForTimeout(300)

const names = await page.evaluate(() => [...document.querySelectorAll('#lessons .preset, .lesson-list .preset')].map((b) => b.textContent.trim()))
console.log(`${names.length} lessons`)

let totalFail = 0
for (const name of names) {
  await page.evaluate((n) => {
    const btns = [...document.querySelectorAll('#lessons .preset, .lesson-list .preset')]
    const b = btns.find((x) => x.textContent.trim() === n)
    if (!b) return
    let d = b.closest('details')
    if (d && !d.open) d.querySelector(':scope > summary').click()
  }, name)
  await page.waitForTimeout(30)
  await page.locator('#lessons .preset, .lesson-list .preset', { hasText: name }).first().click({ force: true })
  await page.waitForTimeout(150)
  const res = await tapTargetProbe(page, { exceptionFloor: (el) => (el.inViews ? 24 : null) })
  if (res.failures.length) {
    totalFail += res.failures.length
    console.log(`\n[${name}] ${res.failures.length} failures`)
    for (const f of res.failures) console.log('  FAIL', f)
  }
}
console.log(`\nTOTAL across ${names.length} lessons: ${totalFail} failures`)
await browser.close()
