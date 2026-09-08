import { createServer } from 'node:http'
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { chromium, firefox } from 'playwright'
import { PLOT_NOTES } from '../src/plot-notes.js'

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..')
async function sourceHashes() {
  const paths = ['package.json', 'vite.config.js']
  for (const dir of ['src', 'scripts']) for (const name of await readdir(resolve(app, dir))) paths.push(`${dir}/${name}`)
  const hashes = {}
  for (const path of paths.sort()) hashes[path] = createHash('sha256').update(await readFile(resolve(app, path))).digest('hex')
  return hashes
}
const frozenSources = await sourceHashes()
const dist = resolve(app, 'dist')
const browserName = process.env.BROWSER || 'chromium'
if (!['chromium', 'firefox'].includes(browserName)) throw new Error(`Unsupported browser: ${browserName}`)
const shots = resolve(app, 'shots', browserName)
await mkdir(shots, { recursive: true })
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' }
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost')
    if (!url.pathname.startsWith('/vlsi-lab/')) { res.writeHead(404).end(); return }
    const file = resolve(dist, decodeURIComponent(url.pathname.slice('/vlsi-lab/'.length)) || 'index.html')
    if (!file.startsWith(dist + sep)) { res.writeHead(403).end(); return }
    const data = await readFile(file)
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' }).end(data)
  } catch { res.writeHead(404).end() }
})
await new Promise((done) => server.listen(0, '127.0.0.1', done))
let browser
const target = process.env.APP_URL || `http://127.0.0.1:${server.address().port}/vlsi-lab/`
const evidence = { browser: browserName, navigation: process.env.APP_URL ? 'Assembled sibling paths' : 'App-only preview', completed: false,
  sourceDigest: createHash('sha256').update(JSON.stringify(frozenSources)).digest('hex'), sourceHashes: frozenSources, views: [], errors: [] }
const axisState = (page) => page.locator('[data-x-max]').evaluate((node) => ({ x: node.dataset.xMax, y: node.dataset.yMax || null }))
const cursor = (page) => page.locator('[data-cursor]').evaluate((node) => Number(node.dataset.cursor))
const pixels = (page) => page.locator('canvas').evaluate((canvas) => canvas.toDataURL())
const axisPixels = (page) => page.locator('canvas').evaluate((canvas) => {
  const ctx = canvas.getContext('2d')
  return Array.from(ctx.getImageData(0, canvas.height - 24, canvas.width, 24).data).join(',')
})
async function labelsCheck(page) {
  const legend = page.getByLabel('Plot legend', { exact: true })
  const labels = await legend.locator('.legend-item > span').allTextContents()
  assert.ok(labels.length >= 2 && labels.every((label) => label.trim().length > 0), 'Every drawn item needs a visible legend label')
  const compared = await page.getByLabel('Default comparison', { exact: true }).isChecked()
  assert.equal(labels.some((label) => /default/i.test(label)), compared, 'Reference labels must follow comparison visibility')
  const title = await page.locator('.analysis-view h2').textContent()
  const text = labels.join(' ')
  assert.match(text, /Vertical white line/)
  if (title === 'Transfer characteristic') {
    assert.match(text, /VIL.*VIH.*VOL.*VOH/)
    assert.match(text, /undefined input logic level/)
    assert.match(text, /NML = VIL - VOL: 0\.675 V/)
    assert.match(text, /NMH = VOH - VIH: 0\.675 V/)
    assert.match(text, /gaps at 0\.450 V and 1\.350 V/)
    const definitions = page.locator('[data-role="input-limits"]')
    assert.equal(await definitions.textContent(), PLOT_NOTES.inputLimits)
    assert.match(await definitions.textContent(), /lowest guaranteed high input voltage is VIH.*highest guaranteed low input voltage is VIL/)
    assert.ok(await definitions.evaluate((node) => Boolean(node.compareDocumentPosition(document.querySelector('.legend')) & Node.DOCUMENT_POSITION_FOLLOWING)))
  } else if (title === 'Timing') {
    assert.match(text, /in: chain input; q1 through q\d: outputs of stages/)
    assert.doesNotMatch(text, /White dot/)
  } else {
    assert.match(text, /White dot/)
    if (title === 'Fanout') assert.match(text, /falling output delay.*rising output delay.*selected fanout/)
    else assert.match(text, /propagation delay.*half-supply 0\.900 V/)
  }
  const note = { 'Transfer characteristic': 'transfer', Timing: 'timing', Fanout: 'fanout' }[title]
  if (note) assert.equal(await page.locator('[data-role="plot-note"]').textContent(), PLOT_NOTES[note])
  const layout = await legend.evaluate((node) => {
    const bounds = node.getBoundingClientRect()
    const boxes = [...node.querySelectorAll('.legend-item')].map((item) => {
      const b = item.getBoundingClientRect()
      return { left: b.left, right: b.right, top: b.top, bottom: b.bottom }
    })
    return { left: bounds.left, right: bounds.right, boxes }
  })
  for (const [i, a] of layout.boxes.entries()) {
    assert.ok(a.left >= layout.left - 1 && a.right <= layout.right + 1, 'Legend text must fit its plot column')
    for (const b of layout.boxes.slice(i + 1)) assert.ok(a.right <= b.left + 1 || b.right <= a.left + 1 || a.bottom <= b.top + 1 || b.bottom <= a.top + 1, 'Legend entries must not overlap')
  }
  const direct = await page.locator('canvas').evaluate((canvas) => Object.values(canvas.getContext('2d').plotLabels || {}))
  for (const [i, a] of direct.entries()) for (const b of direct.slice(i + 1)) {
    assert.ok(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top, 'Direct plot labels must not overlap')
  }
}
async function playbackCheck(page, label) {
  await page.getByRole('button', { name: 'Rewind', exact: true }).click()
  assert.equal(await cursor(page), 0)
  const before = await pixels(page)
  const reading = await page.locator('[data-role="live-readings"]').textContent()
  await page.getByLabel('Playback speed', { exact: true }).selectOption('1')
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.clock.runFor(600)
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).waitFor()
  const moved = await cursor(page)
  assert.ok(moved > 0, `${label}: cursor must move`)
  assert.notEqual(await pixels(page), before, `${label}: the rendered cursor must move`)
  assert.notEqual(await page.locator('[data-role="live-readings"]').textContent(), reading, `${label}: live readings must change`)
  await page.clock.runFor(300)
  assert.equal(await cursor(page), moved, `${label}: pause must hold`)
  await page.getByRole('button', { name: 'Rewind', exact: true }).click()
  await page.getByLabel('Playback speed', { exact: true }).selectOption('4')
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.clock.runFor(600)
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).waitFor()
  const fast = await cursor(page)
  assert.ok(fast > moved * 3.5 && fast < moved * 4.5, `${label}: speed must affect cursor playback`)
  const slider = page.getByRole('slider', { name: label, exact: true })
  await slider.fill('1000')
  const end = await cursor(page)
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.clock.runFor(100)
  assert.ok(await cursor(page) < end / 2, `${label}: play at end must replay`)
  await slider.fill('999')
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.clock.runFor(100)
  assert.equal(await cursor(page), end, `${label}: playback must stop at the end`)
  assert.equal(await page.getByRole('button', { name: 'Play', exact: true }).count(), 1)
  await page.getByRole('button', { name: 'Rewind', exact: true }).click()
  await page.getByLabel('Playback speed', { exact: true }).selectOption('1')
}
try {
  browser = await ({ chromium, firefox }[browserName]).launch()
  evidence.browserVersion = browser.version()
  for (const viewport of [{ width: 320, height: 740 }, { width: 390, height: 844 }, { width: 1366, height: 768 }, { width: 1440, height: 1000 }, { width: 1920, height: 1080 }, { width: 2560, height: 1440 }]) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 })
    await page.addInitScript(() => {
      const original = CanvasRenderingContext2D.prototype.fillText
      CanvasRenderingContext2D.prototype.fillText = function (text, x, y, ...rest) {
        if (['VIL', 'VIH', 'VOL', 'VOH', 'NML', 'NMH', '50%'].includes(text)) {
          const width = this.measureText(text).width
          const left = x - (this.textAlign === 'center' ? width / 2 : this.textAlign === 'right' ? width : 0)
          this.plotLabels ||= {}
          this.plotLabels[text] = { left, right: left + width, top: y - 11, bottom: y + 2 }
        }
        return original.call(this, text, x, y, ...rest)
      }
    })
    page.on('pageerror', (e) => evidence.errors.push(e.message))
    page.on('console', (e) => { if (e.type() === 'error') evidence.errors.push(e.text()) })
    const clockStart = new Date()
    await page.clock.install({ time: clockStart })
    await page.clock.pauseAt(new Date(clockStart.getTime() + 1000))
    await page.goto(target)
    await page.locator('canvas').waitFor()
    evidence.labNavCount = await page.locator('.labnav').count()
    if (process.env.APP_URL) {
      assert.equal(evidence.labNavCount, 1, 'The deployed suite navigation must render')
      assert.equal(await page.locator('.labnav [aria-current="page"]').textContent(), 'VLSI')
      const links = await page.locator('.labnav a').evaluateAll((nodes) => nodes.map((node) => node.href))
      assert.equal(links.length, 5)
      for (const url of links) assert.equal((await page.request.get(url)).status(), 200, url)
    }
    for (let i = 0; i < 5; i++) {
      await page.getByLabel('Experiment', { exact: true }).selectOption(`a${i + 1}`)
      await page.evaluate(() => { window.scrollTo(0, 0); document.querySelector('.controls').scrollTop = 0 })
      const overview = page.locator('#lesson-overview')
      assert.match(await overview.textContent(), /An inverter is a logic gate/)
      assert.match(await overview.textContent(), /Inverters form complementary logic and control signals/)
      assert.match(await overview.textContent(), /Two inverter stages preserve the original polarity/)
      assert.match(await overview.textContent(), /CMOS means complementary metal-oxide-semiconductor/)
      assert.deepEqual(await overview.locator(':scope > dl > dt').allTextContents(), ['Purpose', 'Input', 'Expected output', 'Predict the change', 'Design tradeoffs', 'Model limits'])
      assert.equal(await overview.locator(':scope > details, :scope > dl details').count(), 0)
      assert.equal(await overview.locator('[data-role="chip-context"]').count(), 1)
      assert.ok(await overview.evaluate((node) => Boolean(node.querySelector('[data-role="chip-context"]').compareDocumentPosition(node.querySelector(':scope > p')) & Node.DOCUMENT_POSITION_FOLLOWING)))
      assert.match(await page.locator('[data-role="playback-meaning"]').textContent(), /Playback speed/)
      assert.ok((await page.locator('[data-role="parameter-roles"]').textContent()).length > 40)
      if (viewport.width <= 900) for (const name of ['Lesson', 'Settings', 'Circuit', 'Plots', 'Math']) {
        const button = page.getByRole('button', { name, exact: true })
        const targetId = await button.getAttribute('data-target')
        const beforeUrl = page.url()
        await button.click()
        const destination = await page.locator(`#${targetId}`).boundingBox()
        const nav = await page.getByRole('navigation', { name: 'Lesson sections' }).boundingBox()
        assert.ok(Math.abs(nav.y) <= 1, `${name}: sticky navigation must remain at the top of the viewport`)
        assert.ok(destination.y >= nav.y + nav.height && destination.y < viewport.height, `${name}: section must enter viewport below sticky navigation`)
        assert.equal(page.url(), beforeUrl, 'Section navigation must not alter the URL')
        assert.equal(await page.evaluate(() => document.activeElement.id), targetId, `${name}: section button must move keyboard focus`)
      }
      await page.locator('#lesson-controls').evaluate((node) => node.scrollIntoView({ block: 'start' }))
      const firstControl = await page.getByRole('spinbutton').first().boundingBox()
      assert.ok(firstControl.y >= 0 && firstControl.y + firstControl.height <= viewport.height, `A${i + 1}: first control below viewport`)
      if (viewport.width > 900 && (i === 2 || i === 3)) {
        const featured = await page.getByRole('spinbutton', { name: i === 2 ? 'Stages' : 'Pull-up width', exact: true }).boundingBox()
        assert.ok(featured.y >= 0 && featured.y + featured.height <= viewport.height, `A${i + 1}: lesson's featured knob must be discoverable`)
      }
      await page.evaluate(() => document.fonts.ready)
      assert.match(await page.locator('[data-role="headline"]').textContent(), /\d/)
      assert.equal(await page.locator('.schematic [data-el]').count(), 5)
      assert.doesNotMatch(await page.locator('.schematic').textContent(), /\u2014/)
      assert.equal(await page.locator('canvas').count(), 1)
      const width = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: innerWidth }))
      assert.ok(width.page <= width.viewport + 1, `horizontal overflow A${i + 1} ${viewport.width}`)
      const nonblank = await page.locator('canvas').evaluate((canvas) => {
        const ctx = canvas.getContext('2d')
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
        let colored = 0
        for (let k = 0; k < data.length; k += 4) if (Math.max(data[k], data[k + 1], data[k + 2]) > 90) colored++
        return colored
      })
      assert.ok(nonblank > 100, `blank plot A${i + 1}`)
      await labelsCheck(page)
      const plotBox = await page.locator('canvas').boundingBox()
      // Firefox's page-relative rectangle subtraction can lose a fraction of a CSS pixel after scrolling.
      if (i !== 2) assert.ok(plotBox.height >= 350 - 0.01, `Analog plot A${i + 1} at ${viewport.width}px needs 350px height, measured ${plotBox.height}px`)
      const mathBox = await page.locator('.worked-math').boundingBox()
      if (viewport.width >= 1190) {
        assert.ok(mathBox.x >= plotBox.x + plotBox.width, 'Worked explanation must sit beside the plot')
        assert.ok((await overview.boundingBox()).y < mathBox.y, 'Foundations must precede derivation')
      } else {
        const analysis = await page.locator('.analysis-view').boundingBox()
        const explanation = await page.locator('.schematic-view').boundingBox()
        if (viewport.width <= 900) {
          const intro = await overview.boundingBox()
          assert.ok(intro.y + intro.height <= analysis.y + 2, 'Phone reading starts with foundations before the plot')
          assert.ok(explanation.y - analysis.y - analysis.height <= 2, 'Schematic follows plot without an empty grid row')
        }
      }
      const inherited = await page.locator('.controls').evaluate((node) => {
        const title = getComputedStyle(node.querySelector('h1'))
        const section = getComputedStyle(node.querySelector('section'))
        return { title: title.fontSize, border: section.borderTopWidth, background: section.backgroundColor }
      })
      assert.equal(inherited.title, viewport.width >= 2400 ? '20px' : '15px')
      if (viewport.width >= 2400) assert.equal((await page.locator('.controls').boundingBox()).width, viewport.width * 0.15)
      assert.equal(inherited.border, '1px')
      assert.equal(inherited.background, 'rgb(11, 15, 20)')
      await overview.evaluate((node) => node.scrollIntoView({ block: 'start' }))
      await page.screenshot({ path: resolve(shots, `a${i + 1}-${viewport.width}.png`), fullPage: true })
      await page.locator('canvas').screenshot({ path: resolve(shots, `a${i + 1}-${viewport.width}-canvas.png`) })
      if (viewport.width > 900) {
        const canvasVisible = await page.locator('canvas').evaluate((node) => {
          const plot = node.getBoundingClientRect()
          const pane = document.querySelector('.views').getBoundingClientRect()
          return plot.top >= pane.top - 1 && plot.bottom <= pane.bottom + 1
        })
        assert.ok(canvasVisible, 'The entire canvas must scroll into view without clipping its axes')
      }
      evidence.views.push({ lesson: `a${i + 1}`, width: viewport.width, coloredPixels: nonblank })
      assert.equal(await page.locator('.math-body').count(), 1)
      assert.ok(await page.locator('.math-formula').count() >= 4)
      assert.equal(await page.locator('.katex-error').count(), 0)
      assert.equal(await page.locator('.math-check .disagree').count(), 0)
      const field = (name) => page.getByRole('spinbutton', { name, exact: true })
      if (i === 2 || i === 3) {
        await field('Fanout').fill('4')
        await field('Fanout').press('Enter')
      }
      if (i === 3 || i === 4) await page.getByRole('button', { name: 'Rising', exact: true }).click()
      const walks = [
        [{ Fanout: 4, edge: 'Falling' }, { Fanout: 4, edge: 'Rising' }],
        [{ 'Input voltage': 0 }, { 'Input voltage': 1.8 }],
        [{ Fanout: 4, Stages: 5 }],
        [{ Fanout: 4, 'Pull-up width': 1, edge: 'Rising' }, { Fanout: 4, 'Pull-up width': 4, edge: 'Rising' }],
        [{ Fanout: 4, edge: 'Rising' }, { Fanout: 8, edge: 'Rising' }],
      ]
      const steps = await page.locator('.try-chips button').all()
      assert.equal(steps.length, walks[i].length)
      for (const [k, step] of steps.entries()) {
        await step.click()
        for (const [name, value] of Object.entries(walks[i][k])) {
          if (name === 'edge') assert.equal(await page.getByRole('button', { name: value, exact: true }).getAttribute('aria-pressed'), 'true')
          else assert.equal(Number(await field(name).inputValue()), value, `A${i + 1} step ${k + 1} must preserve ${name}`)
        }
        assert.doesNotMatch(await page.locator('.see').textContent(), /NaN|undefined/)
      }
      await page.getByRole('button', { name: "Reset to this experiment's defaults", exact: true }).click()
      if (i === 1) assert.equal(Number(await field('Input voltage').inputValue()), 0.9)
      else {
        assert.equal(Number(await field('Fanout').inputValue()), 1)
        assert.equal(await page.getByRole('button', { name: 'Falling', exact: true }).getAttribute('aria-pressed'), 'true')
        if (i === 2) assert.equal(Number(await field('Stages').inputValue()), 3)
        if (i === 3) assert.equal(Number(await field('Pull-up width').inputValue()), 2)
      }
      if (i !== 1) {
        const held = await axisState(page)
        const ticks = await axisPixels(page)
        const waveform = await pixels(page)
        await field('Fanout').fill('8')
        await field('Fanout').press('Enter')
        assert.deepEqual(await axisState(page), held, 'Fanout must not autoscale the axes')
        assert.equal(await axisPixels(page), ticks, 'Rendered axis labels must remain stable')
        assert.notEqual(await pixels(page), waveform, 'Changing load must change the rendered curve or cursor')
        if (i === 3) {
          await field('Pull-up width').fill('1')
          await field('Pull-up width').press('Enter')
          assert.deepEqual(await axisState(page), held, 'Width must not autoscale the axes')
        }
        await page.getByRole('button', { name: 'Fit axes', exact: true }).click()
        const fitted = await axisState(page)
        assert.notDeepEqual(fitted, held, 'Fit must explicitly reframe the data')
        await field('Fanout').fill('4')
        await field('Fanout').press('Enter')
        assert.deepEqual(await axisState(page), fitted, 'Fitted axes must also hold on knob changes')
        await page.getByRole('button', { name: 'Reset axes', exact: true }).click()
        assert.deepEqual(await axisState(page), held, 'Axis reset must restore the original physical range')
        await page.screenshot({ path: resolve(shots, `a${i + 1}-${viewport.width}-changed.png`), fullPage: true })
        const tabPositions = () => page.getByRole('group', { name: 'View', exact: true }).locator('button').evaluateAll(nodes => {
          const parent = nodes[0].closest('.analysis-view').getBoundingClientRect()
          return nodes.map(node => { const r = node.getBoundingClientRect(); return [r.x - parent.x, r.y - parent.y, r.width, r.height] })
        })
        const initialTabs = await tabPositions()
        for (const name of ['Timing', 'Fanout', 'Scope']) {
          await page.getByRole('button', { name, exact: true }).click()
          assert.equal(await page.locator('canvas').count(), 1)
          await labelsCheck(page)
          await page.screenshot({ path: resolve(shots, `a${i + 1}-${viewport.width}-${name.toLowerCase()}.png`), fullPage: true })
          const afterTabs = await tabPositions()
          assert.ok(afterTabs.every((r, j) => r.every((v, k) => Math.abs(v - initialTabs[j][k]) < 1)), 'Analysis tabs stay anchored across views')
          if (name === 'Timing') {
            assert.match(await page.locator('[data-role="analog-comparison"]').textContent(), /half supply after.*model error/)
            assert.match(await page.locator('.worked-math').textContent(), /Analog stage 1 crossing/)
          }
          if (name !== 'Fanout') await playbackCheck(page, 'Time cursor')
          else {
            const selected = await field('Fanout').inputValue()
            const schematic = await page.locator('.schematic-view .readings').textContent()
            const held = await axisState(page)
            await playbackCheck(page, 'Fanout sweep')
            assert.equal(await field('Fanout').inputValue(), selected, 'Fanout probe must preserve the selected load')
            assert.equal(await page.locator('.schematic-view .readings').textContent(), schematic, 'A load probe must not advance schematic time')
            assert.deepEqual(await axisState(page), held, 'Fanout sweep must preserve both axes')
          }
        }
        await page.getByRole('button', { name: 'Rising', exact: true }).click()
        assert.match(await page.locator('[data-role="signal-edge"]').textContent(), /Input falls.*output rises/)
        assert.match(await page.locator('.legend').textContent(), /Default: fanout 1, width 2, rising/)
        assert.match(await page.locator('[data-role="live-readings"]').textContent(), /Default 0\.000 V/)
        await page.screenshot({ path: resolve(shots, `a${i + 1}-${viewport.width}-rising.png`), fullPage: true })
        const before = await page.locator('.schematic-view .readings').textContent()
        const canvas = page.locator('canvas')
        const box = await canvas.boundingBox()
        await canvas.click({ position: { x: box.width * 0.65, y: box.height / 2 } })
        assert.notEqual(await page.locator('.schematic-view .readings').textContent(), before)
      } else {
        const field = page.getByRole('spinbutton', { name: 'Input voltage', exact: true })
        await field.fill('0.45')
        await field.press('Enter')
        assert.match(await page.locator('.schematic-view .readings').textContent(), /ambiguous at threshold/)
        const held = await axisState(page)
        await playbackCheck(page, 'Input sweep')
        assert.deepEqual(await axisState(page), held, 'Input sweep must preserve the voltage axes')
      }
      await page.getByLabel('Default comparison', { exact: true }).uncheck()
      assert.ok(!await page.getByLabel('Default comparison', { exact: true }).isChecked())
      await labelsCheck(page)
      await page.getByLabel('Default comparison', { exact: true }).check()
      await labelsCheck(page)
    }
    await page.close()
  }
  assert.deepEqual(evidence.errors, [])
  assert.deepEqual(await sourceHashes(), frozenSources, 'App source must remain frozen throughout browser verification')
  evidence.completed = true
  await writeFile(resolve(shots, 'verification.json'), JSON.stringify(evidence, null, 2))
  console.log(JSON.stringify(evidence, null, 2))
} finally {
  await writeFile(resolve(shots, 'verification.json'), JSON.stringify(evidence, null, 2))
  await browser?.close()
  await new Promise((done) => server.close(done))
}
