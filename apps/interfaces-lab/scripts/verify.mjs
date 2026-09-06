import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { extname, resolve, sep } from 'node:path'
import { chromium, firefox } from 'playwright'

const app = fileURLToPath(new URL('../', import.meta.url))
const dist = resolve(app, 'dist')
const browserName = process.env.BROWSER || 'chromium'
if (!['chromium', 'firefox'].includes(browserName)) throw new Error(`Unsupported browser: ${browserName}`)
const evidence = resolve(app, 'verification', browserName)
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
const url = process.env.APP_URL || `http://127.0.0.1:${server.address().port}/interfaces-lab/`
let browser
let activePage
const results = []
const report = { results, browser: browserName, completed: false, url }
try {
  browser = await ({ chromium, firefox }[browserName]).launch({ headless: true })
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1440, height: 1000 }, { width: 2560, height: 1440 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
    const page = await browser.newPage({ viewport })
    await page.addInitScript(() => {
      const fillText = CanvasRenderingContext2D.prototype.fillText
      CanvasRenderingContext2D.prototype.fillText = function (label, ...args) {
        this.canvas.plotLabels ??= new Set()
        this.canvas.plotLabels.add(String(label))
        return fillText.call(this, label, ...args)
      }
    })
    activePage = page
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    for (const id of ['a1', 'a2', 'a3', 'a4', 'a5']) {
      await page.goto(`${url}#${id}`)
      await page.locator('[data-role="see"]').waitFor()
      if (process.env.APP_URL) {
        assert.equal(await page.locator('.labnav').count(), 1)
        assert.equal(await page.locator('.labnav [aria-current="page"]').textContent(), 'Interfaces')
        const links = await page.locator('.labnav a').evaluateAll((nodes) => nodes.map((node) => node.href))
        assert.equal(links.length, 5)
        for (const link of links) assert.equal((await page.request.get(link)).status(), 200, link)
      }
      await page.waitForFunction((active) => document.querySelector('select[aria-label="Experiment"]')?.value === active, id)
      assert.equal(await page.getByLabel('Experiment', { exact: true }).inputValue(), id)
      assert.equal(await page.locator('select[aria-label="Experiment"] option').count(), 5)
      await page.evaluate(() => { window.scrollTo(0, 0); document.querySelector('.controls').scrollTop = 0 })
      if (viewport.width <= 900) {
        await page.getByRole('navigation', { name: 'Experiment sections' }).getByRole('button', { name: 'Settings', exact: true }).click()
      }
      const firstControl = await page.getByRole('spinbutton').first().boundingBox()
      const sidebar = await page.locator('.controls').boundingBox()
      assert.ok(firstControl.y >= 0 && firstControl.y + firstControl.height <= (viewport.width <= 900 ? viewport.height : Math.min(viewport.height, sidebar.y + sidebar.height)), `${id}: first control is clipped`)
      assert.equal(await page.locator('[data-role="foundation"]').count(), 1)
      for (const title of ['Purpose', 'Input', 'Expected output', 'Predict the change', 'Design tradeoffs', 'Model limits']) {
        assert.equal(await page.locator('.foundation').getByRole('heading', { name: title, exact: true }).count(), 1)
      }
      const chip = page.locator('[data-role="chip-context"]')
      assert.match(await chip.textContent(), /integrated circuit \(IC\)/)
      await chip.locator('summary').click()
      for (const material of ['Silicon', 'Silicon-germanium', 'Indium phosphide', 'Silicon carbide / gallium nitride']) {
        assert.ok((await chip.textContent()).includes(material))
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Expanded material context must fit')
      await chip.locator('summary').click()
      if (viewport.width <= 900) {
        assert.equal(await page.locator('.controls').evaluate((el) => getComputedStyle(el).display), 'contents')
        for (const [label, target] of [['Lesson', 'pin-lesson'], ['Circuit', 'pin-circuit'], ['Plots', 'pin-plots'], ['Math', 'pin-math']]) {
          await page.getByRole('navigation', { name: 'Experiment sections' }).getByRole('button', { name: label, exact: true }).click()
          const box = await page.locator(`#${target}`).boundingBox()
          assert.ok(box.y >= 44 && box.y < viewport.height, `${id}: ${label} target hidden`)
          const nav = await page.getByRole('navigation', { name: 'Experiment sections' }).boundingBox()
          assert.ok(Math.abs(nav.y) <= 1 && nav.height >= 44, `${id}: section navigation did not stay visible`)
        }
        await page.evaluate(() => window.scrollTo(0, 0))
      }
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
      assert.equal(await page.locator('.plot-key li').count(), 6)
      assert.match(await page.locator('.plot-key').textContent(), /Shaded band: undefined input logic/)
      for (const label of await page.locator('.plot-key li').all()) {
        assert.ok(await label.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), 'Plot key text must fit')
      }
      const canvas = page.locator('canvas')
      assert.equal(await canvas.count(), 1)
      assert((await canvas.boundingBox()).height >= 300, `${id}: waveform is compressed`)
      assert.equal(await page.locator('.analysis-notes .math-check').count(), 1)
      assert.equal(await page.locator('.analysis-notes .disagree').count(), 0)
      const titleSize = await page.locator('.controls h1').evaluate((el) => getComputedStyle(el).fontSize)
      assert.equal(titleSize, viewport.width >= 2400 ? '20px' : '15px', 'Shared lab title size')
      const colors = await canvas.evaluate((el) => {
        const { data } = el.getContext('2d').getImageData(0, 0, el.width, el.height)
        let trace = 0
        for (let i = 0; i < data.length; i += 4) if (data[i] < 100 && data[i + 1] > 160 && data[i + 2] > 100) trace++
        return trace
      })
      assert(colors > 50, `${id}: analog trace pixels`)
      for (const label of ['VIL', 'VIH', 'Time cursor']) {
        assert.ok(await canvas.evaluate((el, text) => el.plotLabels.has(text), label), `${id}: missing canvas label ${label}`)
      }
      const slider = page.getByRole('slider', { name: 'Time cursor', exact: true })
      await page.getByRole('button', { name: 'Play', exact: true }).click()
      await page.waitForTimeout(180)
      await page.getByRole('button', { name: 'Pause', exact: true }).click()
      const paused = await slider.inputValue()
      assert(Number(paused) > 0, `${id}: playback cursor did not advance`)
      assert.notEqual(await page.locator('[data-reading="voltage"]').innerText(), '0.000 V')
      await page.waitForTimeout(100)
      assert.equal(await slider.inputValue(), paused, `${id}: pause keeps moving`)
      await page.getByRole('button', { name: 'Rewind', exact: true }).click()
      assert.equal(await slider.inputValue(), '0')
      if (id === 'a1') {
        const end = await canvas.getAttribute('data-time-end')
        const baseline = Number(await canvas.getAttribute('data-voltage-at-quarter'))
        const cap = page.getByRole('spinbutton', { name: 'Load capacitance', exact: true })
        await cap.fill('200p')
        await cap.press('Enter')
        assert.equal(await canvas.getAttribute('data-time-end'), end, 'Capacitance edit moved the time axis')
        assert(baseline - Number(await canvas.getAttribute('data-voltage-at-quarter')) > 1, 'Capacitance edit did not move the curve')
        assert(await page.getByRole('status').filter({ hasText: 'beyond this time window' }).count())
        await page.screenshot({ path: resolve(evidence, `a1-load-comparison-${viewport.width}.png`), fullPage: true })
        await page.getByRole('button', { name: 'Fit time', exact: true }).click()
        assert(Number(await canvas.getAttribute('data-time-end')) > Number(end))
        await page.getByRole('button', { name: "Reset to this experiment's defaults" }).click()
        assert.equal(await canvas.getAttribute('data-time-end'), end)
        await page.getByRole('combobox', { name: 'Playback speed', exact: true }).selectOption('2')
        await page.getByRole('button', { name: 'Play', exact: true }).click()
        await slider.fill('300')
        await page.waitForTimeout(100)
        assert.equal(await slider.inputValue(), '300', 'Scrubbing did not stop playback')
        assert.equal(await page.getByRole('button', { name: 'Play', exact: true }).count(), 1)
        await page.getByRole('combobox', { name: 'Playback speed', exact: true }).selectOption('1')
      }
      await page.getByRole('slider', { name: 'Time cursor', exact: true }).fill('1000')
      assert((await page.locator('[data-reading="voltage"]').innerText()).startsWith('3.299'))
      await page.getByRole('button', { name: 'Play', exact: true }).click()
      await page.waitForTimeout(100)
      await page.getByRole('button', { name: 'Pause', exact: true }).click()
      assert(Number(await slider.inputValue()) < 1000, 'Play at end did not restart')
      await page.getByRole('button', { name: 'Falling', exact: true }).click()
      assert((await page.locator('[data-reading="voltage"]').innerText()).startsWith('3.300'))
      await page.getByRole('slider', { name: 'Time cursor', exact: true }).fill('1000')
      assert(!(await page.locator('[data-reading="voltage"]').innerText()).startsWith('3.300'))
      await page.screenshot({ path: resolve(evidence, `${id}-fall-${viewport.width}.png`), fullPage: true })
      await page.getByRole('button', { name: 'Rising', exact: true }).click()
      await page.getByRole('checkbox', { name: 'Analog voltage' }).uncheck()
      assert.equal(await page.locator('.plot-key li').count(), 4)
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
      if (id === 'a4' || id === 'a5') {
        await page.getByRole('tab', { name: id === 'a4' ? 'Load sweep' : 'Noise budget', exact: true }).click()
        assert.equal(await page.locator('.plot-key li').count(), 4)
        const beforeSweep = await page.locator('[data-reading="sweep"]').innerText()
        await page.getByRole('button', { name: 'Play', exact: true }).click()
        await page.waitForTimeout(500)
        await page.getByRole('button', { name: 'Pause', exact: true }).click()
        assert.notEqual(await page.locator('[data-reading="sweep"]').innerText(), beforeSweep, 'Sweep playback did not move the probe')
        const plot = page.locator('canvas')
        const originalRange = await plot.getAttribute('data-y-max')
        await page.getByRole('button', { name: id === 'a4' ? 'Fit rise range' : 'Fit voltage range', exact: true }).click()
        assert.notEqual(await plot.getAttribute('data-y-max'), originalRange)
        await page.getByRole('button', { name: "Reset to this experiment's defaults" }).click()
        assert.equal(await plot.getAttribute('data-y-max'), originalRange, 'Reset did not restore the sweep axis')
      }
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      results.push({ id, width: viewport.width, analogPixels: colors, controls: 'pass', screenshot: `${id}-${viewport.width}.png` })
    }
    await page.getByRole('combobox', { name: 'Circuit study' }).selectOption('pin.od')
    assert.equal(await page.getByLabel('Experiment', { exact: true }).inputValue(), 'a3')
    await page.getByRole('button', { name: 'Next experiment' }).click()
    assert.equal(await page.getByLabel('Experiment', { exact: true }).inputValue(), 'a4')
    await page.getByRole('button', { name: 'Previous experiment' }).click()
    assert.equal(await page.getByLabel('Experiment', { exact: true }).inputValue(), 'a3')
    await page.getByRole('combobox', { name: 'Circuit study' }).selectOption('pin.in')
    const supply = page.getByRole('spinbutton', { name: 'Supply VDD', exact: true })
    const threshold = page.getByRole('spinbutton', { name: 'Device threshold Vt', exact: true })
    await supply.focus()
    await page.evaluate(() => {
      window.savedRaf = window.requestAnimationFrame
      window.deferredSelections = []
      window.requestAnimationFrame = (callback) => { window.deferredSelections.push(callback); return 0 }
    })
    await supply.press('Enter')
    await threshold.focus()
    const keptFocus = await threshold.evaluate((field) => {
      window.requestAnimationFrame = window.savedRaf
      const callbacks = window.deferredSelections
      delete window.savedRaf
      delete window.deferredSelections
      callbacks.forEach((callback) => callback(performance.now()))
      return callbacks.length > 0 && document.activeElement === field
    })
    assert(keptFocus, 'Deferred Enter selection stole focus from the next numeric field')
    await supply.fill('1.8')
    await supply.press('Enter')
    assert.equal(Number(await supply.getAttribute('aria-valuenow')), 1.8)
    await threshold.fill('900m')
    await threshold.press('Enter')
    assert.equal(Number(await threshold.getAttribute('aria-valuenow')), 0.9)
    await page.getByRole('alert').waitFor()
    assert((await page.getByRole('alert').innerText()).includes('greater than twice'))
    assert.equal(await page.locator('canvas').count(), 0)
    await page.getByRole('button', { name: 'Reset experiment', exact: true }).click()
    assert.equal(await page.getByRole('alert').count(), 0)
    assert.deepEqual(errors, [])
    await page.close()
  }
  Object.assign(report, { browserVersion: browser.version(), completed: true,
    navigation: process.env.APP_URL ? 'Assembled sibling paths' : 'App-only preview' })
  console.log(JSON.stringify(report, null, 2))
} catch (error) {
  report.error = error.message
  if (activePage && !activePage.isClosed()) {
    await activePage.screenshot({ path: resolve(evidence, 'failure.png'), fullPage: true })
    report.failureState = await activePage.locator('.app').innerText()
  }
  throw error
} finally {
  await writeFile(resolve(evidence, 'report.json'), JSON.stringify(report, null, 2))
  await browser?.close()
  await new Promise((done) => server.close(done))
}
