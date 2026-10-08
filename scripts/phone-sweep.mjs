import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { tapTargetProbe, HARD_FLOOR } from '../packages/ui/verify/tapTargetProbe.mjs'
import { startPreview, root } from './preview-harness.mjs'
const labs = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(path.join(root, 'apps'))
const out = path.resolve(process.env.SHOTS_DIR || 'shots/astra-ee2')
fs.mkdirSync(out, { recursive: true })
const results = []
for (const lab of labs) {
 const server = await startPreview(lab)
 const browser = await chromium.launch()
 try {
  for (const width of [360, 390, 430]) {
   const page = await browser.newPage({ viewport: { width, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true })
   const errors = []
   page.on('pageerror', e => errors.push(e.message))
   page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
   await page.goto(server.url)
   try { await page.waitForSelector('.app,.shell', { timeout: 10000 }) } catch (e) { throw new Error(`${lab}: startup failed: ${errors.join('; ') || e.message}`) }
   await page.evaluate(() => document.fonts.ready)
   await page.waitForTimeout(250)
   const layout = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    // A sidebar that does not scroll must contain its children: a child whose box ends below the sidebar's own box is drawn over whatever follows.
    spilling: [...document.querySelectorAll('.controls,.sidebar')].filter(e=>{if(getComputedStyle(e).overflowY!=='visible')return false;const bottom=e.getBoundingClientRect().bottom;return [...e.querySelectorAll('*')].some(c=>{const r=c.getBoundingClientRect();return r.height>0&&r.bottom>bottom+1&&!(c.closest('details:not([open])')&&!c.closest('summary'))})}).map(e=>e.className),
    clipped: [...document.querySelectorAll('.app,.shell,.controls,.sidebar,.topbar,.views,.panes')].filter(e => {const r=e.getBoundingClientRect();return r.width && (r.left < -1 || r.right > innerWidth+1)}).map(e=>e.className),
    canvases: [...document.querySelectorAll('canvas')].map(c => {const r=c.getBoundingClientRect();const ctx=c.getContext('2d');let ink=0,colours=new Set();if(ctx){const d=ctx.getImageData(0,0,c.width,c.height).data;for(let i=0;i<d.length;i+=64){if(d[i+3])ink++;colours.add(`${d[i]>>4},${d[i+1]>>4},${d[i+2]>>4}`)}}return {width:r.width,height:r.height,ink,colours:colours.size}}),
   }))
   // circuit-lab and circuit-elements-lab declare data-tap-budget: their own verify.mjs holds a hand-tuned phone fold
   // with named 24 px exceptions, and 44 px there pushes the lesson view off the first screen, so these two labs are
   // held to the 24 px WCAG 2.5.8 floor (invisible hit areas where the glyph must stay small).
   const budget = await page.evaluate(() => document.body.hasAttribute('data-tap-budget'))
   const targets = await tapTargetProbe(page, { exceptionFloor: e => budget ? HARD_FLOOR : (e.inViews || e.inLabNav || e.selector.startsWith('dfn.term') ? HARD_FLOOR : null) })
   await page.screenshot({ path: path.join(out, `${lab}-${width}-top.png`) })
   const plot = page.locator('canvas').first()
   if (await plot.count()) { await plot.scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(out, `${lab}-${width}-plot.png`) }) }
   const failures = [...errors, ...layout.clipped.map(e=>`clipped ${e}`), ...layout.spilling.map(e=>`controls spill over plots: ${e}`), ...targets.failures]
   if(layout.overflow) failures.push('document overflows horizontally')
   for(const [i,c] of layout.canvases.entries()) if(c.width && (c.height<24 || !c.ink || c.colours<3)) failures.push(`canvas ${i} blank or collapsed: ${JSON.stringify(c)}`)
   const row={lab,width,port:server.port,layout,targets:targets.checked,failures}
   results.push(row)
   console.log(`${lab} ${width}: ${failures.length ? 'FAIL '+failures.length : 'PASS'}; ${layout.canvases.length} canvases, ${targets.checked} targets`)
   if(failures.length) console.log(failures.slice(0,8).join('\n'))
   await page.close()
  }
 } catch (e) { results.push({lab, failures:[e.message]}); console.error(e.message) } finally { await browser.close(); await server.close() }
 fs.writeFileSync(path.join(out,'phone-results.json'),JSON.stringify(results,null,2))
}
process.exitCode=results.some(r=>r.failures.length)?1:0
