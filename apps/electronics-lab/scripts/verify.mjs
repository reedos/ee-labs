import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'

const browser = await chromium.launch()
const page = await browser.newPage()
const errors = []
page.on('pageerror', error => errors.push(error.message))
const base = process.env.APP_URL || 'http://127.0.0.1:4193/electronics-lab/'
try {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto(base)
    await page.locator('.picker-current').waitFor()
    assert.ok(await page.locator('.labnav').count(), 'Shared suite navigation is present')
    const enlarge = page.getByRole('button', { name: 'Enlarge drawing' })
    await enlarge.click()
    await page.getByRole('dialog').waitFor()
    assert.ok(await page.locator('.drawing-scroll .schematic').count())
    await page.keyboard.press('Escape')
    assert.equal(await page.locator('dialog').count(), 1)
    assert.equal(await page.locator('dialog').isVisible(), false)
    assert.equal(await enlarge.evaluate(node => document.activeElement === node), true)
    const ids = await page.locator('[data-exp]').evaluateAll(nodes => nodes.map(node => node.dataset.exp))
    assert.equal(ids.length, 75)
    for (const id of ids) {
      await page.locator('.picker-current').click()
      await page.locator(`[data-exp="${id}"]`).click()
      assert.equal(await page.locator('.picker-current').getAttribute('aria-expanded'), 'false')
      if (id === 'a1') {
        const practice = page.locator('.lesson-practice')
        await practice.getByRole('button', { name: 'Check answer', exact: true }).click()
        await assert.equal(await practice.locator('[role="status"]').innerText(), 'Enter a finite number, for example 1.2e-3.')
        await practice.getByRole('textbox').fill('-999')
        await practice.getByRole('button', { name: 'Check answer', exact: true }).click()
        assert.match(await practice.locator('[role="status"]').innerText(), /Not yet/)
        await practice.getByRole('button', { name: 'Show prediction' }).click()
        await practice.getByRole('textbox').fill('0.01099879')
        await practice.getByRole('button', { name: 'Check answer', exact: true }).click()
        assert.match(await practice.locator('[role="status"]').innerText(), /Correct/)
      }
      const tabs = page.locator('.analysis-head .segmented button')
      const positions = () => tabs.evaluateAll(nodes => {
        const parent = nodes[0].parentElement
        const r = nodes[0].closest('.analysis-view').getBoundingClientRect()
        return nodes.map(node => {
          const b = node.getBoundingClientRect()
          return [b.x - r.x + parent.scrollLeft, b.y - r.y, b.width, b.height]
        })
      })
      const initial = await positions()
      for (let i = 0; i < await tabs.count(); i++) {
        await tabs.nth(i).click()
        const after = await positions()
        assert.ok(after.every((r, j) => r.every((v, k) => Math.abs(v - initial[j][k]) < 1.1)), `${id}: tabs moved`)
        assert.equal(await page.locator('.katex-error').count(), 0, `${id}: invalid math`)
        if (await tabs.nth(i).innerText() === 'Worked math') {
          assert.ok(await page.locator('.math-body .katex').count() > 0, `${id}: missing rendered math`)
        }
        if (await tabs.nth(i).innerText() === 'Equations') {
          assert.ok(await page.locator('.worked-solution .worked-steps li').count() > 0, `${id}: no worked equation steps`)
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${id}: page overflow`)
      }
    }
    await mkdir('apps/electronics-lab/shots', { recursive: true })
    await page.screenshot({ path: `apps/electronics-lab/shots/release-${width}.png`, fullPage: true })
    console.log(`${width}px: all 75 experiments, all views, rendered math and stable navigation passed`)
  }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
