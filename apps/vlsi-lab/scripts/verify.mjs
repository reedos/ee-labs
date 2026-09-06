import { createServer } from 'node:http'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { chromium, firefox } from 'playwright'

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..')
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
const evidence = { browser: browserName, navigation: process.env.APP_URL ? 'Assembled sibling paths' : 'App-only preview', views: [], errors: [] }
try {
  browser = await ({ chromium, firefox }[browserName]).launch()
  evidence.browserVersion = browser.version()
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 })
    page.on('pageerror', (e) => evidence.errors.push(e.message))
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
      await page.getByLabel('Experiment', { exact: true }).selectOption(String(i))
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
      await page.screenshot({ path: resolve(shots, `a${i + 1}-${viewport.width}.png`), fullPage: true })
      evidence.views.push({ lesson: `a${i + 1}`, width: viewport.width, coloredPixels: nonblank })
      await page.getByRole('button', { name: 'The math', exact: false }).click()
      assert.ok(await page.locator('.math-body').count() > 0)
      assert.equal(await page.locator('.katex-error').count(), 0)
      await page.getByRole('button', { name: 'The math', exact: false }).click()
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
        for (const name of ['Timing', 'Fanout', 'Scope']) {
          await page.getByRole('button', { name, exact: true }).click()
          assert.equal(await page.locator('canvas').count(), 1)
        }
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
      }
    }
    await page.close()
  }
  assert.deepEqual(evidence.errors, [])
  await writeFile(resolve(shots, 'verification.json'), JSON.stringify(evidence, null, 2))
  console.log(JSON.stringify(evidence, null, 2))
} finally {
  await browser?.close()
  await new Promise((done) => server.close(done))
}
