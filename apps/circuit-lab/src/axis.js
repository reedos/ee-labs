// Where the frequency axis sits, and — more importantly — when it moves.
//
// The axis used to re-centre on the circuit's own f₀ at every change. That is
// right when you SWITCH circuits (the interesting part should be on screen
// without reaching for a control) and exactly wrong when you TUNE one: the
// curve holds still while the axis labels slide underneath it, so the one
// thing a component sweep should show — the response moving — is the one
// thing you cannot see.
//
// So the centre is sticky. It re-centres when the circuit or the measured
// output changes, or when the corner has wandered within one decade of the
// view's edge; while the feature stays comfortably on screen, the axis holds
// and the curve does the moving. The span is ±3 decades, so tuning has ±2
// decades of visible travel before a re-centre — a 100× change of RC in
// either direction.

export const SPAN_DECADES = 3 // each side of the centre
export const EDGE_DECADES = 1 // re-centre when the feature gets this close

/**
 * The next axis centre, given the previous one and the circuit's natural one.
 *
 * `force` snaps immediately — pass it when the circuit or output changed, so a
 * new circuit is always framed. Otherwise the previous centre is kept until
 * the natural one drifts within EDGE_DECADES of either end of the span.
 */
export function stickyCentre(prev, natural, force = false) {
  const nat = Number.isFinite(natural) && natural > 0 ? natural : 1000
  if (force || !(Number.isFinite(prev) && prev > 0)) return nat
  const drift = Math.abs(Math.log10(nat / prev))
  return drift > SPAN_DECADES - EDGE_DECADES ? nat : prev
}

/** The log-spaced grid for a given centre. */
export function axisFreqs(centre, points) {
  const lo = Math.log10(centre) - SPAN_DECADES
  const hi = Math.log10(centre) + SPAN_DECADES
  return Float64Array.from({ length: points }, (_, i) =>
    Math.pow(10, lo + ((hi - lo) * i) / (points - 1)),
  )
}

/**
 * The grid with one frequency guaranteed to be IN it.
 *
 * A resonant tip must be sampled, not hoped for: at Q = 100 the peak is
 * narrower than a 600-point grid's spacing, and the drawn curve stops several
 * dB short of the height the topbar claims — on exactly the lesson whose
 * point is the height of the peak. Splicing f into sorted position costs one
 * sample and makes the drawn maximum the true maximum.
 *
 * The caller decides WHETHER: a twin-T's notch frequency must NOT be spliced
 * in, because |H| there is zero and one −240 dB sample would stretch the axis
 * until the rest of the curve is unreadable. (Its dip is grid-limited either
 * way — no finite sample can draw "no bottom" — and its panel says so.)
 */
export function ensureSampled(freqs, f) {
  if (!(f > 0) || f <= freqs[0] || f >= freqs[freqs.length - 1]) return freqs
  const out = Array.from(freqs)
  let i = 0
  while (out[i] < f) i++
  if (out[i] !== f) out.splice(i, 0, f)
  return out
}
