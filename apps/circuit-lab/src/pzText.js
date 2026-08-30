import { fmt } from '@ee-labs/ui'

// The pole and zero VALUES, printed where the marks are — Reed's ask: the
// plot shows positions, but a position is not a number you can write down.
// Conjugate pairs print once as re ± j·im, reals print plainly, a root on
// the jω axis drops its zero real part (±j·ω reads as the axis-zero it is),
// and the origin is just 0. Everything in the same engineering notation the
// rest of the app speaks, units (s⁻¹) left to the caller so they appear once.

/** "−23.5k ± j21.2k" / "−10.0k" / "±j100k" / "0" / "none". */
export function describeRoots(roots) {
  if (!roots || !roots.length) return 'none'
  const parts = []
  const used = new Array(roots.length).fill(false)
  for (let i = 0; i < roots.length; i++) {
    if (used[i]) continue
    const [re, im] = roots[i]
    const mag = Math.max(Math.abs(re), Math.abs(im))
    if (mag < 1e-12 || Math.abs(im) <= 1e-9 * Math.max(mag, 1)) {
      parts.push(fmt(re, '', 3))
      continue
    }
    // Find and consume the conjugate partner so the pair prints once.
    for (let j = i + 1; j < roots.length; j++) {
      if (used[j]) continue
      const [re2, im2] = roots[j]
      if (Math.abs(re2 - re) <= 1e-9 * Math.max(mag, 1) && Math.abs(im2 + im) <= 1e-9 * mag) {
        used[j] = true
        break
      }
    }
    const imTxt = `j${fmt(Math.abs(im), '', 3)}`
    parts.push(Math.abs(re) <= 1e-9 * mag ? `±${imTxt}` : `${fmt(re, '', 3)} ± ${imTxt}`)
  }
  return parts.join(', ')
}
