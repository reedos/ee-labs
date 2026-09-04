// One hand-over: the buck's averaged small-signal plant, to Control Lab.
//
// CORE_SCOPE.md's own worked-examples table admits exactly this object:
// "Averaged small-signal buck model | Yes, but it approximates the switched
// converter | Admit as a plant with an fs guard: warn or refuse as crossover
// approaches fs/5." The plant itself is exact algebra, not a fit — state-space
// averaging linearised about the operating point (POWER_LAB_PLAN.md §1.5):
//
//   G_vd(s) = V_in / (1 + s/(Q·ω0) + s²/ω0²),   ω0 = 1/√(LC),   Q = R√(C/L)
//
// What is NOT exact is the averaging itself: it assumes the LC corner sits
// well below the switching frequency (f ≪ f_s/2). The guard states that
// rather than hiding it — CORE_SCOPE Rule 3, no approximation ships without
// its own applicability check.

import { buildLink } from '@ee-labs/ui'

/**
 * The buck's small-signal plant at its current operating point. `p` is
 * `buckParams(params)` (analysis.js) — always fully resolved, so this reads
 * L, C, R, fs and V_in the same way for every buck experiment regardless of
 * which knobs that experiment exposes.
 */
export function buckPlant(p) {
  const w0 = 1 / Math.sqrt(p.L * p.C)
  const f0 = w0 / (2 * Math.PI)
  const Q = p.R * Math.sqrt(p.C / p.L)
  const fsGuard = p.fs / 5
  // The averaging this model rests on has nothing left to be slow compared
  // to once its own corner reaches the guard: refused rather than handed
  // over as though it were still exact (CORE_SCOPE Rule 2).
  const refused = f0 >= fsGuard
  return {
    w0,
    f0,
    Q,
    fsGuard,
    refused,
    // b(s) = b0 (a duty perturbation moves V_out, not its derivative).
    // a(s) = a2 s² + a1 s + a0 — the same `custom`-plant convention Circuit
    // Lab's RLC arrives through (control-lab/src/systems.test.js: a2 = LC,
    // a1 = RC, a0 = 1 for a series RLC low-pass — the same second-order shape).
    coeffs: { b2: 0, b1: 0, b0: p.Vin, a2: 1 / (w0 * w0), a1: 1 / (Q * w0), a0: 1 },
  }
}

/**
 * A local stand-in for packages/ui's siblingUrl (deeplink.js) and labUrl
 * (circuitLink.js). Both hard-code which app names they recognise as the
 * SOURCE of the link — `signal-lab`/`circuit-lab`/`control-lab` for one,
 * those plus `circuit-elements-lab` for the other — so a call made from
 * power-lab's own pathname returns null unconditionally, in dev and on the
 * deployed site alike. That is a gap in packages/ui (recorded in NEEDS.md,
 * which names the one-line fix: add 'power-lab' to both lists), not a
 * routing rule to route around, so this copies their exact algorithm rather
 * than inventing a new one — the deployed site still lays every lab's folder
 * out side by side, and the same swap-the-folder-name logic applies once
 * 'power-lab' is in the recognised set.
 */
export function powerSiblingUrl(app, fragment, loc = typeof window === 'undefined' ? null : window.location) {
  if (!loc) return null
  const apps = ['signal-lab', 'circuit-lab', 'control-lab', 'circuit-elements-lab', 'power-lab']
  if (!apps.includes(app)) return null
  const m = loc.pathname.match(new RegExp(`^(.*/)(${apps.join('|')})(/[^/]*)?$`))
  if (!m || m[2] === app) return null
  return `${loc.origin}${m[1]}${app}/${fragment ? '#' + fragment : ''}`
}

/**
 * The Control Lab link for a buck's current operating point: `{ plant, url }`.
 * `url` is null when the plant is declined (CORE_SCOPE Rule 2 — the guard
 * failed, so there is nothing honest to link to) or when the sibling app has
 * no resolvable URL (a bare dev port; `powerSiblingUrl` returns null there,
 * same as the shared helpers it stands in for).
 */
export function buckHandOverLink(p, loc) {
  const plant = buckPlant(p)
  if (plant.refused) return { plant, url: null }
  const { b2, b1, b0, a2, a1, a0 } = plant.coeffs
  const link = buildLink({
    plant: { type: 'custom', params: [b2, b1, b0, a2, a1, a0] },
    ctrl: { type: 'p', params: [1] },
    // Control Lab's fromAppName only names circuit/signal/control, so an
    // unrecognised 'power' app falls back to "another tool" in the arrival
    // banner — honest (Control Lab genuinely has no Power Lab entry), not
    // wrong. fromDisplayName prefers the label regardless, so the plant
    // itself still arrives named.
    from: { app: 'power', id: 'buck', label: 'The buck converter, averaged' },
  })
  return { plant, url: powerSiblingUrl('control-lab', link, loc) }
}
