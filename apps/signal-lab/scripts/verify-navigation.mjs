import {chromium, firefox} from 'playwright'
import assert from 'node:assert/strict'

const base = process.env.APP_URL || 'http://127.0.0.1:4192/signal-lab/'
const name = process.env.BROWSER || 'chromium'
const browser = await ({chromium, firefox})[name].launch()
const page = await browser.newPage()
const errors = []
page.on('pageerror', e => errors.push(e.message))
try {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({width, height: width === 320 ? 740 : 900})
    await page.goto(base)
    await page.locator('.views canvas').first().waitFor()
    await page.evaluate(() => document.fonts.ready)
    const nav = page.locator('nav.labnav')
    assert.equal(await nav.isVisible(), true)
    assert.equal(await nav.locator('[aria-current="page"]').innerText(), 'Signal')
    assert.equal(await page.locator('.suite-nav-open').count(), 0)
    const links = nav.locator('a')
    assert.deepEqual(await links.allTextContents(), ['REED’s Engineering Labs', 'Elements', 'Circuit', 'Control'])
    for (let i = 0; i < await links.count(); i++) {
      const link = links.nth(i)
      const box = await link.boundingBox()
      assert.ok(box.x >= 0 && box.x + box.width <= width, 'Navigation must fit without horizontal scrolling')
      await link.click({trial: true})
    }
    const count = await page.locator('.preset').count()
    for (let i = 0; i < count; i++) {
      await page.locator('.preset').nth(i).evaluate(e => e.click())
      await page.evaluate(() => new Promise(requestAnimationFrame))
      assert.equal(await nav.isVisible(), true)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
      assert.equal(await page.locator('.views canvas').evaluateAll(es => es.some(e => e.getBoundingClientRect().height < 1)), false)
    }
    console.log(`${name}: navigation and plots checked across ${count} lessons at ${width}px`)
  }
  // Exercise each destination through the assembled/deployed site.
  for (const [label, path] of [['Elements', '/circuit-elements-lab/'], ['Circuit', '/circuit-lab/'], ['Control', '/control-lab/'], ['REED’s Engineering Labs', '/']]) {
    await page.goto(base)
    await page.locator('nav.labnav').getByRole('link', {name: label, exact: true}).click()
    assert.equal(new URL(page.url()).pathname, new URL(`..${path === '/' ? '/' : path}`, base).pathname)
    assert.ok(await page.title())
  }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
