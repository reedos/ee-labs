import {chromium, firefox} from 'playwright'
import {readFile} from 'node:fs/promises'
import assert from 'node:assert/strict'

const base = process.env.APP_URL || 'http://127.0.0.1:4192/circuit-elements-lab/'
const name = process.env.BROWSER || 'chromium'
const source = await readFile(new URL('../src/experiments.js', import.meta.url), 'utf8')
const ids = [...new Set([...source.matchAll(/id: '([a-i]\d+)'/g)].map(m => m[1]))]
assert.equal(ids.length, 59, 'Cover the complete experiment catalog')
const browser = await ({chromium, firefox})[name].launch()
const page = await browser.newPage()
const errors = [], failures = []
page.on('pageerror', e => errors.push(e.message))
let transitions = 0
try {
  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({width, height: 1000})
    for (const id of ids) {
      await page.goto(`${base}#${id}`)
      await page.locator(`.app[data-experiment="${id}"] .view-switch`).waitFor()
      const tabs = page.locator('.view-switch button')
      // Measure in pane coordinates: narrow layouts scroll the entire page.
      const positions = () => tabs.evaluateAll(buttons => {
        const pane = buttons[0].closest('.view').getBoundingClientRect()
        return buttons.map(button => {
          const r = button.getBoundingClientRect()
          return {label: button.textContent, x: r.x - pane.x, y: r.y - pane.y, width: r.width, height: r.height}
        })
      })
      const initial = await positions()
      for (let i = 0; i < initial.length; i++) {
        await tabs.nth(i).click()
        await page.waitForFunction(index => document.querySelectorAll('.view-switch button')[index].getAttribute('aria-pressed') === 'true', i)
        const after = await positions()
        for (let j = 0; j < initial.length; j++) {
          if (['x', 'y', 'width', 'height'].some(key => Math.abs(initial[j][key] - after[j][key]) > 1)) {
            failures.push(`${width}px ${id}: selecting ${initial[i].label} moves ${initial[j].label}: ${JSON.stringify(initial[j])} -> ${JSON.stringify(after[j])}`)
            break
          }
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${id}: page overflow`)
        transitions++
      }
    }
    console.log(`${name}: checked all ${ids.length} experiments at ${width}px`)
  }
  assert.deepEqual(errors, [])
  assert.equal(failures.length, 0, `${failures.length} unstable transitions:\n${failures.slice(0, 12).join('\n')}`)
  console.log(`${name}: ${transitions} view selections preserve every tab's position and size`)
} finally {
  await browser.close()
}
