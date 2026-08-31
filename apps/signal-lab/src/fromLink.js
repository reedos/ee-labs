import { BLOCK_TYPES, makeBlockRecord } from './dsp/blocks.js'
import { WAVEFORMS } from '@ee-labs/dsp'

// Turning a link into a setup this app can actually run.
//
// The link format is deliberately loose about meaning — it carries positional
// numbers and leaves interpretation to whoever receives them. So this is where
// meaning is checked, and the rule is the same one the whole suite runs on: a
// setup that silently loads as something ELSE is worse than one that refuses.
// Anything that cannot be honoured is dropped and named.

/**
 * Positional parameters, in the order a block declares them.
 *
 * Positional rather than named because the link should stay short and readable,
 * and a block's parameter order is already the order it renders them in.
 */
function blockFrom(spec, warnings, ctx) {
  const def = BLOCK_TYPES[spec.type]
  if (!def) {
    warnings.push(`no block called "${spec.type}"`)
    return null
  }
  const rec = makeBlockRecord(spec.type, 0)
  // Positional slots: the numeric params, then any select whose options are
  // all numbers (the filter-order control). Circuit Lab's first-order tier
  // needs to say "order 1" in a link — b=lowpass:2456:0.70711:1 — and a
  // select that only ever holds numbers has an obvious positional meaning.
  const numeric = def.params.filter((p) => p.kind !== 'select' && p.kind !== 'check')
  const numericSelects = def.params.filter(
    (p) => p.kind === 'select' && (p.options || []).every((o) => Number.isFinite(Number(o))),
  )
  const slots = numeric.length + numericSelects.length
  if (spec.params.length > slots) {
    warnings.push(
      `${def.label} takes ${slots} value${slots === 1 ? '' : 's'}, got ${spec.params.length}`,
    )
  }
  numeric.forEach((p, i) => {
    if (i >= spec.params.length) return
    const v = spec.params[i]
    const lo = typeof p.min === 'function' ? p.min(ctx) : p.min
    const hi = typeof p.max === 'function' ? p.max(ctx) : p.max
    if (Number.isFinite(lo) && Number.isFinite(hi) && (v < lo || v > hi)) {
      warnings.push(`${def.label} ${p.label} ${v} is outside ${lo}…${hi}; clamped`)
      rec.params[p.key] = Math.min(hi, Math.max(lo, v))
    } else {
      rec.params[p.key] = v
    }
  })
  numericSelects.forEach((p, i) => {
    const at = numeric.length + i
    if (at >= spec.params.length) return
    const v = String(spec.params[at])
    if ((p.options || []).includes(v)) {
      rec.params[p.key] = v
    } else {
      warnings.push(
        `${def.label} ${p.label} ${v} is not one of ${(p.options || []).join('/')}; kept ${rec.params[p.key]}`,
      )
    }
  })
  return rec
}

/**
 * Apply a parsed link to a state object.
 *
 * Returns `{ state, warnings }` with state null when there was nothing usable,
 * so the caller can leave its defaults alone rather than loading a half-patch.
 */
export function stateFromLink(patch, base) {
  const warnings = []
  if (!patch) return { state: null, warnings }

  // Provenance, when the link carries it: the banner can then say WHOSE
  // setup this is ("your RC low-pass from Circuit Lab") instead of the
  // anonymous "a link".
  const next = { ...base, presetName: 'from a link', linkFrom: patch.from || null }
  // The zoom the sender asked for: a circuit's corner must arrive on screen,
  // not at 1.7% of a 96 kHz axis. Refusals are named, per the header rule —
  // this one used to be the single silent drop in the file.
  if (patch.zoom) {
    if (patch.zoom >= 50) next.specMax = patch.zoom
    else warnings.push(`zoom ${patch.zoom} is below 50 Hz; ignored`)
  }

  if (patch.rate != null) {
    if (patch.rate >= 1000 && patch.rate <= 192000) next.sampleRate = patch.rate
    else warnings.push(`sample rate ${patch.rate} is outside 1000…192000; ignored`)
  }

  // Parameter ranges are checked against the rate THIS LINK runs at, decided
  // just above — not a hardcoded 48 kHz. The hardcoded context clamped a
  // legitimate 40 kHz corner arriving at 192 kHz down to 24 kHz with a bogus
  // warning, and waved a 20 kHz cutoff into an 8 kHz patch with no warning at
  // all while the filter silently ran at 3992 Hz.
  const ctx = { sampleRate: next.sampleRate, nyquist: next.sampleRate / 2 }

  const sources = []
  let id = 1
  for (const s of patch.sources || []) {
    if (!WAVEFORMS.includes(s.type)) {
      warnings.push(`no waveform called "${s.type}"`)
      continue
    }
    sources.push({
      id: id++,
      type: s.type,
      freq: Number.isFinite(s.freq) ? s.freq : 250,
      amp: Number.isFinite(s.amp) ? s.amp : 1,
      phase: 0,
      enabled: true,
    })
  }
  if (sources.length) next.sources = sources

  const blocks = []
  let bid = 1
  for (const b of patch.blocks || []) {
    const rec = blockFrom(b, warnings, ctx)
    if (rec) blocks.push({ ...rec, id: bid++ })
  }
  next.blocks = blocks

  // Nothing survived validation, so there is no patch to apply.
  if (!blocks.length && !sources.length && patch.rate == null) return { state: null, warnings }
  return { state: next, warnings }
}
