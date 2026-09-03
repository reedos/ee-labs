// The fold probe: the knob a note names must be on screen at laptop sizes.
//
// Every lab's verify.mjs runs at 1920×1080, where everything fits. Students
// open these on 1366×768 and 1440×900 laptops, where the sidebar is a
// scroller and "drag R" can point at a slider 500 px below the bottom edge.
// This is the shared check: for each lesson, load it fresh, leave the sidebar
// at the top the way a student finds it, and require every named control's
// box to sit inside the viewport.
//
// Plain Node ESM (no React, no JSX) so the Playwright scripts can import it
// straight from the package directory.

export const LAPTOP_VIEWPORTS = [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
]

export const PHONE_VIEWPORT = { width: 390, height: 844 }

/**
 * @param {import('playwright').Page} page
 * @param {object} opts
 * @param {{name:string, load:(page)=>Promise<void>, must:Array<string|((page)=>import('playwright').Locator)>}[]} opts.cases
 *   One entry per lesson: `load` puts the lab in that lesson from a fresh
 *   navigation (the probe navigates to `url` first); `must` lists the
 *   controls the note names — CSS selectors or locator factories.
 * @param {string} opts.url  page to navigate to before each case
 * @param {{width:number,height:number}[]} [opts.viewports]
 * @param {string} [opts.scroller]  selector of the sidebar scroller to pin at top
 * @returns {Promise<{ok:boolean, failures:string[], measured:object[]}>}
 */
export async function foldProbe(page, { cases, url, viewports = LAPTOP_VIEWPORTS, scroller = '.controls' }) {
  const failures = []
  const measured = []
  for (const vp of viewports) {
    await page.setViewportSize(vp)
    for (const c of cases) {
      await page.goto(url, { waitUntil: 'networkidle' })
      await c.load(page)
      // A student arrives with the sidebar at the top. Pin it there so a
      // previous case's scroll cannot flatter this one.
      await page.evaluate((sel) => {
        const el = document.querySelector(sel)
        if (el) el.scrollTop = 0
        window.scrollTo(0, 0)
      }, scroller)
      await page.waitForTimeout(60)
      for (const m of c.must) {
        const loc = typeof m === 'string' ? page.locator(m).first() : m(page).first()
        const label = typeof m === 'string' ? m : (m.label || 'locator')
        const box = await loc.boundingBox().catch(() => null)
        measured.push({ viewport: `${vp.width}x${vp.height}`, lesson: c.name, control: label, box })
        if (!box) {
          failures.push(`${vp.width}x${vp.height} · ${c.name} · ${label}: not rendered`)
          continue
        }
        const bottom = box.y + box.height
        if (box.y < 0 || bottom > vp.height) {
          failures.push(
            `${vp.width}x${vp.height} · ${c.name} · ${label}: bottom ${bottom.toFixed(0)} px > fold ${vp.height}`,
          )
        }
        if (box.x < 0 || box.x + box.width > vp.width) {
          failures.push(`${vp.width}x${vp.height} · ${c.name} · ${label}: clipped horizontally`)
        }
      }
    }
  }
  return { ok: failures.length === 0, failures, measured }
}

/**
 * Phone: the lesson's named view (the plot the note is about) must be in the
 * first viewport, not a scroll away — or the lab must not claim the size.
 * Same contract as foldProbe with a single viewport and a page scroller.
 */
export function phoneProbe(page, opts) {
  return foldProbe(page, { viewports: [PHONE_VIEWPORT], scroller: '#root', ...opts })
}
