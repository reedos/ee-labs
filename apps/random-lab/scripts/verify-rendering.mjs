// Bounded recovery check. The broader verify.mjs remains a separate gate.
import { chromium, firefox } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { EXPERIMENTS } from '../src/experiments.js'

const url = process.env.APP_URL || 'http://localhost:47614/random-lab/'
const engine = process.env.BROWSER || 'chromium'
const browserType = { chromium, firefox }[engine]
if (!browserType) throw new Error(`Unknown browser: ${engine}`)
const out = resolve(`apps/random-lab/shots/rendering/${engine}`)
await mkdir(out, { recursive: true })
const result = { engine, url, coldLoads: 0, experiments: [], renderFailures: [], layoutFailures: [] }
const browser = await browserType.launch()

try {
  for (const [name, viewport] of Object.entries({
    desktop: { width: 1280, height: 800 },
    phone: { width: 390, height: 844 },
  })) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 })
    const page = await context.newPage()
    page.setDefaultTimeout(15000)
    let label = `${name} cold load`
    page.on('pageerror', (error) => result.renderFailures.push(`${label}: ${error.message}`))
    page.on('console', (message) => {
      if (message.type() === 'error') result.renderFailures.push(`${label}: ${message.text()}`)
    })
    const resetScroll = () => page.evaluate(() => {
      window.scrollTo(0, 0)
      for (const selector of ['#root', '.controls', '.panes']) {
        document.querySelector(selector)?.scrollTo(0, 0)
      }
    })
    const settle = () => page.waitForTimeout(200)
    try {
      const response = await page.goto(url, { waitUntil: 'load' })
      if (response.status() !== 200) throw new Error(`HTTP ${response.status()}`)
      await page.waitForSelector('.panes canvas, .panes table')
      await settle()
      if (await page.locator('.picker button.on .id').textContent() !== 'A1') {
        throw new Error('Cold load did not select A1')
      }
      result.coldLoads++
      const links = await page.locator('.labnav a').evaluateAll((nodes) => nodes.map((n) => n.href))
      if (links.length !== 5) throw new Error(`Expected home and four sibling links, found ${links.length}`)
      for (const href of links) {
        const target = await context.request.get(href)
        if (target.status() !== 200) result.renderFailures.push(`${label}: ${href} HTTP ${target.status()}`)
      }
      if (await page.locator('.labnav [aria-current="page"]').count() !== 1) {
        throw new Error('Missing current-lab navigation label')
      }
      if (await page.locator('.picker button').count() !== 30) throw new Error('Picker count is not 30')

      for (let i = 0; i < EXPERIMENTS.length; i++) {
        const experiment = EXPERIMENTS[i]
        label = `${name} ${experiment.id}`
        try {
          await page.locator('.picker details').evaluateAll((nodes) => nodes.forEach((n) => { n.open = true }))
          await page.locator('.picker button').nth(i).click()
          await settle()
          await resetScroll()
          const id = await page.locator('.picker button.on .id').textContent()
          if (id !== experiment.id) throw new Error(`Selected ${id}, wanted ${experiment.id}`)
          const row = { viewport: name, id, views: [], readouts: 0 }
          result.experiments.push(row)
          const knob = await page.locator('.featured').boundingBox()
          if (!knob || knob.y < 0 || knob.y + knob.height > viewport.height) {
            result.layoutFailures.push(`${label}: first knob bottom ${knob ? Math.round(knob.y + knob.height) : 'missing'} / ${viewport.height}`)
          }
          const navOverflow = await page.locator('.labnav').evaluate((nav) => {
            const box = nav.getBoundingClientRect()
            return [...nav.children].some((child) => {
              const r = child.getBoundingClientRect()
              return r.left < box.left - 1 || r.right > box.right + 1
            })
          })
          if (navOverflow) result.layoutFailures.push(`${label}: navigation child outside row`)
          await page.screenshot({ path: `${out}/${name}-${id}-fold.png` })
          const count = await page.locator('.view-switch button').count()
          if (count !== experiment.views.length) throw new Error(`View count ${count} / ${experiment.views.length}`)
          for (let v = 0; v < count; v++) {
            await page.locator('.view-switch button').nth(v).click()
            await settle()
            const view = experiment.views[v]
            const pixels = await page.locator('.panes canvas').evaluateAll((canvases) => canvases.map((canvas) => {
              const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)
              let colored = 0
              const colors = new Set()
              for (let p = 0; p < data.length; p += 4) {
                if (!data[p + 3]) continue
                colors.add(`${data[p]},${data[p + 1]},${data[p + 2]}`)
                if (Math.max(data[p], data[p + 1], data[p + 2]) - Math.min(data[p], data[p + 1], data[p + 2]) > 40) colored++
              }
              return { width: canvas.width, height: canvas.height, colors: colors.size, colored }
            }))
            const tableRows = await page.locator('.panes table tbody tr').count()
            if (!pixels.length && !tableRows) throw new Error(`${view}: no canvas or table rows`)
            if (pixels.some((p) => !p.width || !p.height || p.colors < 10 || p.colored < 50)) {
              throw new Error(`${view}: blank canvas ${JSON.stringify(pixels)}`)
            }
            const readouts = await page.locator('.readout .value').allTextContents()
            row.readouts += readouts.length
            if (!readouts.length || readouts.some((s) => /NaN|Infinity|undefined/.test(s))) {
              throw new Error(`${view}: absent or non-finite readouts`)
            }
            const overflow = await page.evaluate(() => Math.max(...['#root', 'html', '.panes'].map((selector) => {
              const el = document.querySelector(selector)
              return el.scrollWidth - el.clientWidth
            })))
            if (overflow > 1) result.layoutFailures.push(`${label} ${view}: ${overflow}px horizontal overflow`)
            row.views.push({ view, pixels, tableRows })
            await page.locator('.panes').screenshot({ path: `${out}/${name}-${id}-${view}.png` })
          }
          console.log(`${label}: ${row.views.length}/${count} views rendered`)
        } catch (error) {
          result.renderFailures.push(`${label}: ${error.message}`)
        }
      }
    } catch (error) {
      result.renderFailures.push(`${label}: ${error.message}`)
    } finally {
      await context.close()
    }
  }
} finally {
  await browser.close()
}

const expectedViews = 2 * EXPERIMENTS.reduce((sum, e) => sum + e.views.length, 0)
const views = result.experiments.reduce((sum, e) => sum + e.views.length, 0)
if (result.coldLoads !== 2 || result.experiments.length !== 60 || views !== expectedViews) {
  result.renderFailures.push(`Coverage: ${result.coldLoads}/2 cold loads, ${result.experiments.length}/60 experiments, ${views}/${expectedViews} views`)
}
await writeFile(`${out}/results.json`, JSON.stringify(result, null, 2))
console.log(JSON.stringify({ ...result, experiments: result.experiments.length, views }, null, 2))
process.exitCode = result.renderFailures.length || result.layoutFailures.length ? 1 : 0
