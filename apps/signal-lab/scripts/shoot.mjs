// Screenshot the running app, optionally after clicking through presets.
//
// The point is to be able to LOOK at the thing. Every layout bug in this
// project so far — an off-centre eye, an axis reading "100000000.0k", a scope
// span that counted the wrong period — was invisible to the test suite and
// obvious in a picture.
//
//   node scripts/shoot.mjs                    one shot of the current state
//   node scripts/shoot.mjs "Clean PAM4" ...   one shot per named preset
//   node scripts/shoot.mjs --all              every preset
//
// Writes PNGs into shots/ and prints any console errors the page produced.

import { chromium } from 'playwright'
import { mkdirSync, rmSync } from 'node:fs'

const URL = process.env.APP_URL || 'http://localhost:1421'
const OUT = 'shots'
// Default to 4K, which is what this is actually viewed on. A layout that
// holds at 1080p can still be wrong at 3840 wide: fixed-pixel sidebars and
// fixed-pixel type both shrink to nothing relative to the plots.
const [VW, VH] = (process.env.APP_VIEWPORT || '3840x2160').split('x').map(Number)
const VIEWPORT = { width: VW, height: VH }

const args = process.argv.slice(2)
const all = args.includes('--all')
const names = args.filter((a) => !a.startsWith('--'))

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 })

const problems = []
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') problems.push(`${m.type()}: ${m.text()}`)
})
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))

// 'networkidle' never settles once a module worker is in the page, so wait for
// the app itself to be on screen instead.
await page.goto(URL, { waitUntil: 'load' })
await page.waitForSelector('.views canvas', { timeout: 15000 })
// Canvases draw on a resize observer, so give layout a beat to settle.
await page.waitForTimeout(600)

/** Does the page scroll? It must not — both plots have to fit at 16:9. */
async function scrollCheck() {
  return page.evaluate(() => ({
    scrolls:
      document.documentElement.scrollHeight > document.documentElement.clientHeight + 1,
    h: document.documentElement.scrollHeight,
    ch: document.documentElement.clientHeight,
  }))
}

async function shoot(name) {
  await page.waitForTimeout(400)
  const file = `${OUT}/${slug(name)}.png`
  await page.screenshot({ path: file })
  const s = await scrollCheck()
  console.log(`${file}  ${s.scrolls ? `SCROLLS (${s.h} > ${s.ch})` : 'fits'}`)
}

let targets = names
if (all) {
  targets = await page.$$eval('.preset', (els) => els.map((e) => e.textContent.trim()))
}

if (targets.length === 0) {
  await shoot('current')
} else {
  for (const name of targets) {
    const btn = page.locator('.preset', { hasText: name }).first()
    if ((await btn.count()) === 0) {
      console.log(`!! no preset named "${name}"`)
      continue
    }
    await btn.click()
    await shoot(name)
  }
}

await browser.close()

if (problems.length) {
  console.log('\nconsole output from the page:')
  for (const p of [...new Set(problems)].slice(0, 20)) console.log('  ' + p)
} else {
  console.log('\nno console errors or warnings')
}
