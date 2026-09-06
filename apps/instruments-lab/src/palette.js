// One colour system for the whole lab (student review, Phase 7). A quantity
// has one hue wherever it appears — the meter on the schematic, the readout
// in the pane head, every trace on every chart — so a student who has learnt
// "blue is a voltage" on A1 is never asked to relearn it on H4. Within a
// family the second and third traces take lighter and darker shades AND a
// dash pattern, so two voltages on one scope are told apart by shape as well
// as by tint (colour-blind safe: the dash is the second channel).

import { COLORS } from '@ee-labs/ui'

/** The base hue of each quantity family. */
export const HUE = {
  voltage: '#5fa8ff',
  current: '#f0a23c',
  power: '#38e0b0',
  energy: '#e8c65a',
  angle: '#b98cf0',
}

/** The three shades a family may draw in: base, lighter, darker. */
export const SHADES = {
  voltage: ['#5fa8ff', '#b3d4ff', '#2f78e0'],
  current: ['#f0a23c', '#ffd28f', '#c9801f'],
  power: ['#38e0b0', '#9af0d6', '#1fa882'],
  energy: ['#e8c65a', '#f4dfa0', '#b5943a'],
  angle: ['#b98cf0', '#d9c3fa', '#8d5fd0'],
}

/** The word a caption uses for each hue: "the blue trace is v_C". */
export const WORD = { voltage: 'blue', current: 'orange', power: 'green', energy: 'gold', angle: 'purple' }

/** The CSS custom property each family is published as (styles.css defines them). */
export const CSS_VAR = { voltage: '--q-voltage', current: '--q-current', power: '--q-power', energy: '--q-energy', angle: '--q-angle' }

/** The family of a scope trace {q, key}: 'i' is a current, 'p' a power, 'v'/'volt' a voltage. */
export function familyOf(trace) {
  const q = typeof trace === 'string' ? trace : trace.q
  if (q === 'i') return 'current'
  if (q === 'p') return 'power'
  if (q === 'e' || q === 'energy') return 'energy'
  if (q === 'deg' || q === 'angle' || q === 'phase') return 'angle'
  return 'voltage'
}

/** The family a label names: "v_C" and "|H|" are voltages, "i_L" a current, "p_R" a power, "∠Z" an angle. */
export function familyOfLabel(label) {
  const s = String(label)
  if (/^∠|angle|phase|overshoot/i.test(s)) return 'angle'
  if (/^i\b|^i_|^i\(|current/i.test(s)) return 'current'
  if (/^p\b|^p_|power|settl/i.test(s)) return 'power'
  if (/^w\b|^w_|energy|stored|dissipated|supplied/i.test(s)) return 'energy'
  return 'voltage'
}

/** The dash pattern (in CSS px at k = 1) for the n-th bright trace of a family. */
export const DASH_OF = [null, [8, 3], [2, 3]]

/**
 * How each trace of a scope is drawn: its family's hue, the n-th shade and
 * dash of that family for the n-th bright trace, thin-and-dotted for a `dim`
 * drive, and the long dash a trace declares with `dash` (F6's switch voltage
 * repeats the current's shape on the other axis). Returns one style per trace,
 * in order: { family, color, width, alpha, dash }.
 */
export function styleTraces(traces) {
  const seen = {}
  return traces.map((q) => {
    const family = familyOf(q)
    if (q.dim) return { family, color: SHADES[family][0], width: 1.2, alpha: 0.55, dash: [3, 3] }
    const n = seen[family] || 0
    seen[family] = n + 1
    const shade = SHADES[family][Math.min(n, SHADES[family].length - 1)]
    const dash = q.dash ? [7, 4] : DASH_OF[Math.min(n, DASH_OF.length - 1)]
    return { family, color: shade, width: n === 0 ? 2 : 1.6, alpha: 1, dash }
  })
}

/** The n-th shade of a family, for series that are not scope traces (energy bands, phasor arrows). */
export const shade = (family, n) => SHADES[family][Math.min(n, SHADES[family].length - 1)]

// The shared plot palette (packages/ui) already used these four hexes for its
// response, spectrum, trace and phase colours; the families adopt them so the
// other labs' charts and this one agree where they overlap.
export const SHARED = { voltage: COLORS.response, current: COLORS.spectrum, power: COLORS.trace, angle: COLORS.phase }
