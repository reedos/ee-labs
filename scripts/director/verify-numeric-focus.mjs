import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const base = process.env.SITE_URL || 'http://127.0.0.1:47630/'
const browser = await chromium.launch()
const results = []
try {
  for (const width of [1366, 390]) {
    for (const app of ['circuit-lab', 'signal-lab', 'control-lab', 'circuit-elements-lab']) {
      const page = await browser.newPage({ viewport: { width, height: 844 } })
      const errors = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.goto(new URL(`${app}/`, base).href)
      const fields = page.getByRole('spinbutton')
      await fields.first().waitFor()
      assert(await fields.count() >= 2, `${app}: two real numeric fields are required`)
      await fields.first().focus()
      await page.evaluate(() => {
        window.savedRaf = window.requestAnimationFrame
        window.deferredSelections = []
        window.requestAnimationFrame = (callback) => { window.deferredSelections.push(callback); return 0 }
      })
      await fields.first().press('Enter')
      await fields.nth(1).focus()
      const keptFocus = await fields.nth(1).evaluate((field) => {
        window.requestAnimationFrame = window.savedRaf
        const callbacks = window.deferredSelections
        delete window.savedRaf
        delete window.deferredSelections
        callbacks.forEach((callback) => callback(performance.now()))
        return callbacks.length > 0 && document.activeElement === field
      })
      assert(keptFocus, `${app} at ${width}: deferred selection moved focus backwards`)
      assert.deepEqual(errors, [], `${app}: runtime errors`)
      results.push({ app, width, fields: await fields.count(), focus: 'pass' })
      await page.close()
    }
  }
  console.log(JSON.stringify({ browser: browser.version(), results }, null, 2))
} finally {
  await browser.close()
}
