/**
 * Usage counting, through GoatCounter (reedos.goatcounter.com).
 *
 * The labs are static files on GitHub Pages, which keeps no logs, so the only
 * way to learn whether anyone uses a feature is for the page to say so. The
 * counter was chosen for what it does NOT do: no cookies, no fingerprinting,
 * no personal data — nothing a reader handed a lab would need to be asked
 * about. Each entry page carries the one script tag (`index.html`, marked
 * `data-goatcounter`), which counts a page view on load; this module is for
 * the handful of CLICKS worth counting on top of that — chiefly the hand-overs,
 * which are the suite's whole argument and the thing worth knowing is used.
 *
 * Events are named as paths, `handover/open/signal-lab/named/rlcSeries`, because
 * GoatCounter lists events by path and a slash-separated name reads as the
 * tree it is.
 *
 * Never a failure. The script is async, ad blockers stop it for a fair share of
 * this audience, and dev servers on localhost are skipped by the script itself;
 * in every one of those cases the click still does its job and the count is
 * simply absent. Nothing here may throw into a click handler.
 */

export const GOATCOUNTER_ENDPOINT = 'https://reedos.goatcounter.com/count'

// Loaded but not yet drained: events that arrived before count.js did. The
// arrival event fires on mount, which on a cold load is well before an async
// script tag has landed; without a queue the one event that tells us where a
// visitor came from would be the one that never counts.
let pending = []
let armed = false

const ready = (win) => typeof win?.goatcounter?.count === 'function'

function drain(win) {
  const queued = pending
  pending = []
  for (const ev of queued) send(win, ev)
}

function send(win, ev) {
  try {
    win.goatcounter.count({ path: ev.path, title: ev.title || ev.path, event: true })
  } catch {
    // A counter that broke is not the page's problem.
  }
}

/**
 * Count one event now, or as soon as the counter loads.
 *
 * Returns what happened, for tests and for nothing else: 'sent', 'queued', or
 * 'off' (no window, or no counter tag on the page — a bare dev port, a blocked
 * script that will never fire `load`, or a page that chose not to count).
 */
export function track(path, title, win = typeof window === 'undefined' ? null : window) {
  if (!win) return 'off'
  if (ready(win)) {
    send(win, { path, title })
    return 'sent'
  }
  const tag = win.document?.querySelector?.('script[data-goatcounter]')
  if (!tag) return 'off'
  pending.push({ path, title })
  if (!armed) {
    armed = true
    tag.addEventListener('load', () => drain(win), { once: true })
  }
  return 'queued'
}

/**
 * The hand-over event name. One place, so the two labs that read the counter
 * and the one that writes it agree on the words:
 *
 *   handover/<open|copy>/<signal-lab|control-lab>/<tier>/<circuit id>
 *
 * `tier` is what the bridge chose — a named shape, a named plant, or the raw
 * coefficients — which is the number that says whether the named tiers earn
 * their keep. Anything missing is written as `-` rather than dropped, so the
 * path always has the same number of segments and the report columns line up.
 */
export function handOverEvent({ action, app, tier, circuit }) {
  const seg = (v) => (v == null || v === '' ? '-' : String(v).replace(/[\s/]+/g, '_'))
  return `handover/${seg(action)}/${seg(app)}/${seg(tier)}/${seg(circuit)}`
}

/**
 * The arrival event name, counted by a lab that was opened from a link:
 *
 *   arrive/<this lab>/<from app or 'link'>/<id>
 *
 * Read against the hand-over count it tells the other half of the story: how
 * many of the links opened actually loaded.
 */
export function arrivalEvent(lab, from) {
  const seg = (v) => (v == null || v === '' ? '-' : String(v).replace(/[\s/]+/g, '_'))
  return `arrive/${seg(lab)}/${from?.app ? seg(from.app) : 'link'}/${seg(from?.id)}`
}

/** Test seam: forget anything queued. */
export function _resetForTests() {
  pending = []
  armed = false
}
