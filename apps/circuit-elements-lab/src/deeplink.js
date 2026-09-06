// Deep links for the Circuit Elements Lab: an experiment id in the URL hash,
// plus any knob that differs from its default, so a reload or a shared link
// lands back on the same picture the reader was looking at.
//
// packages/ui already exports a link grammar (buildLink/parseLink), but it
// was built for the three labs whose state is a signal chain or a control
// loop: rate=, src=, b=, plant=, ctrl=. This lab's state is one experiment id
// plus a flat params object keyed by each knob's own name (R1, E, ideal,
// model…), which that grammar has no slot for — a knob key is not a source, a
// block, a plant or a controller. So this is a small grammar of its own, kept
// to the same spirit: readable, one rule, nothing hidden.
//
//   #<id>[&key=value]*
//
// `id` is the experiment (a1, h4, i6…). Each further key is either a knob's
// own key, read against that experiment's own params, or one of three display
// keys: `show` (which meters), `view` (which lower pane) and `t` (the cursor,
// dynamic experiments only). Only values that differ from the experiment's
// defaults are written, so a bare `#a1` is exactly "A1 at its defaults" and a
// link stays short.

import { byId, defaultsOf, isDynamic } from './experiments.js'

const NUM = /^-?\d*\.?\d+(?:e[-+]?\d+)?$/i
const DISPLAY_KEYS = new Set(['show', 'view', 't'])
/** Six significant figures — enough for the knob to land at the same reading, short enough to stay a link. */
const trim = (v) => String(Number(Number(v).toPrecision(6)))

/**
 * A live state → a hash fragment (no leading `#`), or `''` for an id the lab
 * does not have. `cursor` is ignored for a DC experiment and omitted when it
 * is still at the experiment's own opening instant.
 */
export function buildHash({ id, params, show, view, cursor }) {
  const exp = byId[id]
  if (!exp) return ''
  const d = defaultsOf(id)
  const parts = [id]
  for (const p of exp.params) {
    const v = (params || {})[p.key]
    if (v === undefined || v === d[p.key]) continue
    parts.push(`${p.key}=${encodeURIComponent(typeof v === 'number' ? trim(v) : String(v))}`)
  }
  if (show && show !== exp.show) parts.push(`show=${encodeURIComponent(show)}`)
  if (view && view !== exp.view) parts.push(`view=${encodeURIComponent(view)}`)
  if (isDynamic(exp) && Number.isFinite(cursor)) {
    const at = exp.cursor * exp.window(params || d)
    if (Math.abs(cursor - at) > Math.max(1e-12, 1e-6 * Math.max(Math.abs(at), 1))) parts.push(`t=${trim(cursor)}`)
  }
  return parts.join('&')
}

/**
 * A hash fragment (with or without its leading `#`) → `{ id, params, show,
 * view, cursor, warnings }`, or `null` when it names no experiment this lab
 * has. `params` always starts from that experiment's defaults, so the result
 * is a complete params object even when the link sets only one knob.
 * Anything unrecognised is dropped and named in `warnings` rather than
 * guessed at, the same rule packages/ui's parseLink follows.
 */
export function parseHash(fragment) {
  const warnings = []
  const text = String(fragment || '').replace(/^#/, '')
  if (!text) return null
  const [idPart, ...rest] = text.split('&')
  const id = (idPart || '').toLowerCase()
  const exp = byId[id]
  if (!exp) return null
  const params = defaultsOf(id)
  let show
  let view
  let cursor
  for (const pair of rest) {
    if (!pair) continue
    const eq = pair.indexOf('=')
    if (eq < 0) {
      warnings.push(`"${pair}" is not a key=value pair`)
      continue
    }
    const key = pair.slice(0, eq)
    const value = decodeURIComponent(pair.slice(eq + 1))
    if (DISPLAY_KEYS.has(key)) {
      if (key === 't') {
        if (!NUM.test(value)) {
          warnings.push(`t "${value}" is not a number`)
          continue
        }
        cursor = Number(value)
      } else if (key === 'show') show = value
      else view = value
      continue
    }
    const knob = exp.params.find((p) => p.key === key)
    if (!knob) {
      warnings.push(`${id}: "${key}" is not one of its knobs`)
      continue
    }
    if (knob.kind === 'toggle') {
      if (value !== 'true' && value !== 'false') {
        warnings.push(`${id}: ${key} "${value}" is not true or false`)
        continue
      }
      params[key] = value === 'true'
    } else if (knob.kind === 'choice') {
      const opt = knob.options.find((o) => String(o.value) === value)
      if (!opt) {
        warnings.push(`${id}: "${value}" is not a value ${key} takes`)
        continue
      }
      params[key] = opt.value
    } else {
      if (!NUM.test(value)) {
        warnings.push(`${id}: ${key} "${value}" is not a number`)
        continue
      }
      params[key] = Math.min(knob.max, Math.max(knob.min, Number(value)))
    }
  }
  return { id, params, show, view, cursor, warnings }
}

/** The page's own hash, read the same way. `null` off a server (SSR, tests without a DOM) and off an empty hash. */
export function readLocationHash() {
  if (typeof window === 'undefined') return null
  return parseHash(window.location.hash)
}

/** The full URL — origin, path and hash — for a live state, for a link a reader can open or paste. */
export function locationFor(state, loc = typeof window === 'undefined' ? null : window.location) {
  if (!loc) return null
  const h = buildHash(state)
  return `${loc.origin}${loc.pathname}${h ? `#${h}` : ''}`
}
