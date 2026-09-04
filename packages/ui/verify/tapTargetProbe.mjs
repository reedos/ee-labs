// The touch-target probe: every visible button, link, summary, role="button"
// and checkbox on a phone must offer a tap box that clears the accessibility
// floor below — or be on the short, commented allow-list that clears the
// lower one instead.
//
// Two student testers on phones found this first ("it constantly asks the
// student to pinpoint instead of tap"), and a walk of all three released
// labs at 390x844 measured it: every interactive element in the suite ran
// under 44x44 CSS px, most under 24x24.
//
// FLOOR = 44, the Apple HIG / Material "48dp" touch-target guideline — the
// suite's real target, not just the legal minimum, because these are dense,
// number-heavy pages a student is meant to poke quickly and often.
// HARD_FLOOR = 24, WCAG 2.2 SC 2.5.8 (Target Size, Minimum) — the AA floor
// every visible control must clear regardless, used only for the small,
// explicitly-named exceptions where the phone layout budget (the fold
// probes elsewhere in each verify.mjs, which hold the lesson's note and try
// line inside the sidebar's own clipped box) genuinely cannot afford 44.
//
// A tap box is not always the element's own border box:
//  - A control that must stay visually small gets an invisible ::before or
//    ::after hit area instead (position:relative on the element, the pseudo
//    absolutely positioned with a negative inset) — credited here by reading
//    the pseudo's computed inset, since no DOM API returns a pseudo's own
//    rendered rect.
//  - A checkbox's real tap target, by native browser behaviour, is whatever
//    <label> wraps it (clicking anywhere in the label activates the input) —
//    credited here by measuring that label instead of the tiny native box,
//    the same as a screen reader or a thumb experiences it.

export const FLOOR = 44
export const HARD_FLOOR = 24

const SELECTOR = 'button, a, summary, [role="button"], input[type="checkbox"]'

/**
 * @param {import('playwright').Page} page  already on the page, at 390x844
 * @param {object} [opts]
 * @param {number} [opts.floor]      the primary floor (default 44)
 * @param {number} [opts.hardFloor]  the exception floor (default 24)
 * @param {(el: {selector:string, className:string, text:string, inSidebar:boolean, inViews:boolean, inLabNav:boolean}) => number|null} [opts.exceptionFloor]
 *   Given a small descriptor of an element, return the floor it should be
 *   held to instead of `floor` (typically `hardFloor`), or null/undefined to
 *   use `floor`. Callers pass this to name their documented exceptions —
 *   `inSidebar`/`inViews`/`inLabNav` say which region of the app the control
 *   lives in, for exceptions that are about location (a tight plot pane, the
 *   suite nav row) rather than a particular class name.
 * @returns {Promise<{ok:boolean, failures:string[], checked:number, sizes:object[]}>}
 */
export async function tapTargetProbe(page, { floor = FLOOR, hardFloor = HARD_FLOOR, exceptionFloor } = {}) {
  const raw = await page.evaluate((selector) => {
    const parsePx = (v) => (!v || v === 'auto' ? 0 : parseFloat(v) || 0)

    // An invisible hit area, read off a pseudo-element's OWN computed style
    // (there is no getBoundingClientRect for a pseudo). Only trusted when the
    // pseudo actually generates a box (content !== 'none') and is taken out
    // of flow (position absolute/fixed) with a non-zero inset declared —
    // an author's decorative ::before (a bullet, a flag glyph) never sets
    // position, so it is correctly ignored.
    const pseudoExpand = (el, pseudo) => {
      const cs = getComputedStyle(el, pseudo)
      // computed `content: none` is the ONLY value that generates no box —
      // `content: ''` (our own hit-area trick) computes to the literal
      // two-character string '""', which DOES generate a box.
      if (!cs || cs.content === 'none') return null
      if (cs.position !== 'absolute' && cs.position !== 'fixed') return null
      // A negative inset pushes the pseudo's edge OUTSIDE the element's own
      // box by that many px — the expansion this technique relies on. A
      // positive (or auto) inset does not expand anything we should credit.
      const expand = (v) => Math.max(0, -parsePx(v))
      const top = expand(cs.top)
      const right = expand(cs.right)
      const bottom = expand(cs.bottom)
      const left = expand(cs.left)
      if (!top && !right && !bottom && !left) return null
      return { top, right, bottom, left }
    }

    const isVisible = (el, cs) => {
      if (cs.display === 'none' || cs.visibility === 'hidden') return false
      if (parseFloat(cs.opacity) === 0) return false
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    }

    const out = []
    for (const el of document.querySelectorAll(selector)) {
      const cs = getComputedStyle(el)
      if (!isVisible(el, cs)) continue

      // A checkbox's real target is the label a person actually taps.
      let measured = el
      let note = ''
      if (el.matches('input[type="checkbox"]')) {
        const label =
          el.closest('label') || (el.id && document.querySelector(`label[for="${el.id}"]`))
        if (label) {
          measured = label
          note = ' (via wrapping label)'
        }
      }

      let r = measured.getBoundingClientRect()
      let w = r.width
      let h = r.height

      for (const pseudo of ['::before', '::after']) {
        const exp = pseudoExpand(measured, pseudo)
        if (exp) {
          w = Math.max(w, r.width + exp.left + exp.right)
          h = Math.max(h, r.height + exp.top + exp.bottom)
          note += ` (+${pseudo} hit area)`
        }
      }

      out.push({
        selector: el.tagName.toLowerCase() + (el.className ? `.${String(el.className).trim().split(/\s+/).join('.')}` : ''),
        className: String(el.className || ''),
        text: (el.textContent || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim().slice(0, 40),
        width: Math.round(w * 10) / 10,
        height: Math.round(h * 10) / 10,
        note,
        // Which chrome the control lives in — the sidebar (.controls) has
        // its own capped, internally-scrolling box; a plot pane (.views)
        // shares a tight, fixed budget with the canvas the phone fold
        // probes hold on screen. exceptionFloor callbacks use this to name
        // a documented exception by LOCATION rather than by guessing every
        // class name a lab might reuse the control under.
        inSidebar: !!el.closest('.controls'),
        inViews: !!el.closest('.views'),
        // The suite nav row (home + the two sibling labs): several links a
        // handful of px apart, with no text label to hang extra padding off
        // of without widening the whole row. Named the same way as
        // inSidebar/inViews, for the same reason.
        inLabNav: !!el.closest('.labnav'),
      })
    }
    return out
  }, SELECTOR)

  const failures = []
  for (const el of raw) {
    const exception = exceptionFloor && exceptionFloor(el)
    // An exception is never licensed to sit below the absolute legal floor —
    // whichever of the two is higher is the one actually enforced.
    const useFloor = Math.max(exception || floor, hardFloor)
    if (el.width < useFloor || el.height < useFloor) {
      failures.push(
        `${el.selector} "${el.text}"${el.note}: ${el.width}x${el.height}px, under the ${useFloor}px floor`,
      )
    }
  }

  return { ok: failures.length === 0, failures, checked: raw.length, sizes: raw }
}
