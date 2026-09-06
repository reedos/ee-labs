import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { extname, resolve, sep } from 'node:path'
import { chromium } from 'playwright'

const app = fileURLToPath(new URL('../', import.meta.url))
const dist = resolve(app, 'dist')
const evidence = resolve(app, 'verification')
await mkdir(evidence, { recursive: true })
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' }
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost')
    assert(url.pathname.startsWith('/interfaces-lab/'))
    const path = resolve(dist, decodeURIComponent(url.pathname.slice('/interfaces-lab/'.length)) || 'index.html')
    assert(path.startsWith(dist + sep))
    res.setHeader('Content-Type', mime[extname(path)] || 'application/octet-stream')
    res.end(await readFile(path))
  } catch { res.writeHead(404).end() }
})
await new Promise((done) => server.listen(0, '127.0.0.1', done))
const url = `http://127.0.0.1:${server.address().port}/interfaces-lab/`
let browser
const results = []
try {
  browser = await chromium.launch({ headless: true })
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport })
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    for (const id of ['a1', 'a2', 'a3', 'a4', 'a5']) {
      await page.goto(`${url}#${id}`)
      await page.locator('[data-role="see"]').waitFor()
      await page.waitForFunction((active) => document.querySelector('.preset[aria-current="step"] b')?.textContent === active.toUpperCase(), id)
      assert.equal(await page.locator('.preset[aria-current="step"] b').innerText(), id.toUpperCase())
      assert.equal(await page.locator('.preset').count(), 5)
      assert.equal(await page.locator('.schematic').count(), 1)
      assert.equal(await page.locator('[role="alert"]').count(), 0)
      assert(await page.locator('[data-role="see"]').innerText())
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      await page.locator('.workspace').scrollIntoViewIfNeeded()
      const overlaps = await page.evaluate(() => {
        const controls = document.querySelector('.controls').getBoundingClientRect()
        const workspace = document.querySelector('.workspace').getBoundingClientRect()
        return controls.right > workspace.left + 1 && controls.bottom > workspace.top + 1
      })
      assert(!overlaps, `${id}: sidebar overlaps instrument`)
      await page.screenshot({ path: resolve(evidence, `${id}-${viewport.width}.png`), fullPage: true })
      await page.getByRole('tab', { name: 'Waveform', exact: true }).click()
      const canvas = page.locator('canvas')
      assert.equal(await canvas.count(), 1)
      const colors = await canvas.evaluate((el) => {
        const { data } = el.getContext('2d').getImageData(0, 0, el.width, el.height)
        let trace = 0
        for (let i = 0; i < data.length; i += 4) if (data[i] > 90 && data[i + 2] > 120) trace++
        return trace
      })
      assert(colors > 50, `${id}: analog trace pixels`)
      await page.getByRole('slider', { name: 'Time cursor', exact: true }).fill('1000')
      assert((await page.locator('[data-reading="voltage"]').innerText()).startsWith('3.299'))
      await page.getByRole('button', { name: 'Falling', exact: true }).click()
      assert((await page.locator('[data-reading="voltage"]').innerText()).startsWith('3.300'))
      await page.getByRole('slider', { name: 'Time cursor', exact: true }).fill('1000')
      assert(!(await page.locator('[data-reading="voltage"]').innerText()).startsWith('3.300'))
      await page.screenshot({ path: resolve(evidence, `${id}-fall-${viewport.width}.png`), fullPage: true })
      await page.getByRole('button', { name: 'Rising', exact: true }).click()
      await page.getByRole('checkbox', { name: 'Analog voltage' }).uncheck()
      await page.getByRole('checkbox', { name: 'Analog voltage' }).check()
      await page.getByRole('tab', { name: 'Equations', exact: true }).click()
      assert((await page.locator('[role="tabpanel"] .katex').count()) >= 2)
      assert.equal(await page.locator('.katex-error').count(), 0)
      await page.screenshot({ path: resolve(evidence, `${id}-equations-${viewport.width}.png`), fullPage: true })
      const before = await page.locator('[data-role="see"]').innerText()
      const untouched = id === 'a1' ? ['Supply VDD', '4', 4]
        : id === 'a3' ? ['Load capacitance', '200p', 200e-12] : ['On resistance', '40', 40]
      const knob = page.getByRole('spinbutton', { name: untouched[0], exact: true })
      await knob.fill(untouched[1])
      await knob.press('Enter')
      const steps = page.locator('.try-line button')
      assert((await steps.count()) >= 1)
      for (let i = 0; i < await steps.count(); i++) {
        await steps.nth(i).click()
        assert.equal(Number(await knob.getAttribute('aria-valuenow')), untouched[2], `${id}: Try reset an unrelated knob`)
      }
      if (id === 'a5') {
        assert.equal(Number(await page.getByRole('spinbutton', { name: 'Current ramp time', exact: true }).getAttribute('aria-valuenow')), 20e-9)
        assert.equal(Number(await page.getByRole('spinbutton', { name: 'Switching pins', exact: true }).getAttribute('aria-valuenow')), 3)
      }
      assert.notEqual(await page.locator('[data-role="see"]').innerText(), before)
      await page.getByRole('button', { name: "Reset to this experiment's defaults" }).click()
      assert.equal(await page.locator('[data-role="see"]').innerText(), before)
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      results.push({ id, width: viewport.width, analogPixels: colors, controls: 'pass', screenshot: `${id}-${viewport.width}.png` })
    }
    await page.getByRole('combobox', { name: 'Pin model' }).selectOption('pin.od')
    assert.equal(await page.locator('.preset[aria-current="step"] b').innerText(), 'A3')
    await page.getByRole('button', { name: 'Next experiment' }).click()
    assert.equal(await page.locator('.preset[aria-current="step"] b').innerText(), 'A4')
    await page.getByRole('button', { name: 'Previous experiment' }).click()
    assert.equal(await page.locator('.preset[aria-current="step"] b').innerText(), 'A3')
    await page.getByRole('combobox', { name: 'Pin model' }).selectOption('pin.in')
    const supply = page.getByRole('spinbutton', { name: 'Supply VDD', exact: true })
    await supply.fill('1.8')
    await supply.press('Enter')
    const threshold = page.getByRole('spinbutton', { name: 'Device threshold Vt', exact: true })
    await threshold.fill('900m')
    await threshold.press('Enter')
    await page.getByRole('alert').waitFor()
    assert((await page.getByRole('alert').innerText()).includes('greater than twice'))
    assert.equal(await page.locator('canvas').count(), 0)
    await page.getByRole('button', { name: 'Reset experiment', exact: true }).click()
    assert.equal(await page.getByRole('alert').count(), 0)
    assert.deepEqual(errors, [])
    await page.close()
  }
  const report = { results, navigation: 'Pending director deployed-path registry and integration review.', url }
  await writeFile(resolve(evidence, 'report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
} finally {
  await browser?.close()
  await new Promise((done) => server.close(done))
}
