// The theorems, drawn.
//
// Six experiments are about a theorem rather than a circuit, and a theorem
// stated in a note is not the same as one seen. Each entry here says what to
// draw — a KVL loop row, mesh equations, one schematic per source, the
// equivalent circuit, the two rows that contradict, a power triangle — and the
// helpers below read every number for those drawings off the solution the
// engine already has. Nothing here computes physics; experiments.test.js
// checks each drawing against the theorem it illustrates.

import { complex as cx } from '@ee-labs/network'

export const THEOREMS = {
  // B2: around the loop, the source's rise equals the two drops. Each entry is
  // an element and the sign its voltage takes going clockwise from ground.
  b2: { kind: 'kvl', views: ['reading', 'equations'], loop: [['V1', 1], ['R1', -1], ['R2', -1]] },
  // D3: one KVL row per mesh, clockwise; i₁ is R₁'s current, i₂ is R₃'s.
  d3: { kind: 'mesh', views: ['reading', 'equations'] },
  // D4: the circuit once per source, the other source killed.
  d4: { kind: 'parts', views: ['superposition'] },
  // E3: with an ideal op-amp and no feedback, two rows fix the same node.
  e3: { kind: 'contradiction', views: ['reading', 'equations'], rows: ['V1', 'U1'] },
  // H5: P, Q and |S| as the sides of a triangle, and p(t) over one cycle.
  h5: { kind: 'triangle', views: ['acpower'] },
}

/** Whether an experiment's theorem drawing belongs in this view. */
export const theoremShows = (exp, view) => !!exp.theorem && exp.theorem.views.includes(view)

/** B2: the loop's terms and their sum, which KVL says is zero. */
export function kvlLoop(theorem, sol) {
  const terms = theorem.loop.map(([id, sign]) => ({ id, sign, v: sol.volt[id], value: sign * sol.volt[id] }))
  return { terms, sum: terms.reduce((a, t) => a + t.value, 0) }
}

/**
 * D3: the two mesh equations with their live sides.
 *   mesh 1:  R₁·i₁ + R₂·(i₁ − i₂) = V₁
 *   mesh 2: −R₂·i₁ + (R₂ + R₃)·i₂ = −V₂
 */
export function meshRows(p, sol) {
  const i1 = sol.i.R1
  const i2 = sol.i.R3
  return {
    i1,
    i2,
    rows: [
      { latex: 'R_1 i_1 + R_2 (i_1 - i_2) = V_1', lhs: p.R1 * i1 + p.R2 * (i1 - i2), rhs: p.E1 },
      { latex: '-R_2 i_1 + (R_2 + R_3)\\, i_2 = -V_2', lhs: -p.R2 * i1 + (p.R2 + p.R3) * i2, rhs: -p.E2 },
    ],
  }
}

/**
 * D4: one figure per source alone, then the full circuit. A killed voltage
 * source is drawn as a closed switch (0 V: a wire), a killed current source as
 * an open one (0 A: a gap); the meters are that partial solve's.
 */
export function partsFigures(exp, x, elements) {
  const sp = x.superposition
  const kill = (e, alive) =>
    e.id === alive || !(e.type === 'V' || e.type === 'I')
      ? e
      : { ...e, type: 'SW', closed: e.type === 'V', label: e.type === 'V' ? `${e.id} → 0 V` : `${e.id} → 0 A` }
  const figures = sp.parts.map((q) => ({ caption: `${q.id} alone`, elements: elements.map((e) => kill(e, q.id)), meters: q.sol }))
  figures.push({ caption: 'both together', elements, meters: sp.full })
  return figures
}

/**
 * D5: the Thévenin equivalent as a circuit of its own — V_th behind R_th,
 * the port A open — and the load line v = V_oc − R_th·i that both it and the
 * original obey. The meters are the open-port readings.
 */
export function equivalentOf(x, port) {
  const th = x.thevenin
  const [a] = port
  const TOP = 40
  const MID = 90
  const BOT = 140
  const elements = [
    { id: 'Vth', type: 'V', value: th.voc },
    { id: 'Rth', type: 'R', value: th.rth.test },
  ]
  const layout = {
    w: 240,
    h: 180,
    items: [
      { el: 'Vth', x: 50, y: MID, dir: 'v' },
      { wire: [50, TOP, 50, MID - 20] },
      { wire: [50, MID + 20, 50, BOT] },
      { wire: [50, TOP, 100, TOP] },
      { el: 'Rth', x: 120, y: TOP, dir: 'h' },
      { wire: [140, TOP, 190, TOP] },
      { wire: [50, BOT, 190, BOT] },
      { gnd: [115, BOT] },
      { node: a, x: 190, y: TOP, side: 't' },
      { text: 'port', x: 208, y: MID + 4, className: 'sch-callout' },
    ],
  }
  const meters = { v: { [a]: th.voc, gnd: 0 }, volt: { Vth: th.voc, Rth: 0 }, i: { Vth: 0, Rth: 0 }, p: { Vth: 0, Rth: 0 } }
  // The line and the five loaded points the fit went through.
  const line = Number.isFinite(th.isc) ? { voc: th.voc, isc: th.isc, rth: th.rth.test, points: th.points } : null
  return { elements, layout, meters, line }
}

/**
 * H5: the source's complex power and p(t) over one cycle. The triangle's
 * sides are P and Q, its hypotenuse |S|; the mean of p(t) over the period,
 * taken by the midpoint rule (exact for a product of two sines), is P.
 */
export function powerCycle(x, id = 'V1', n = 200) {
  // S = ½·V·I* with I taken as delivered, so the source's P reads positive.
  const Sc = cx.cscale(cx.cmul(x.ac.volt[id], cx.conj(cx.cscale(x.ac.i[id], -1))), 0.5)
  const P = Sc[0]
  const Q = Sc[1]
  const S = Math.hypot(P, Q)
  const T = (2 * Math.PI) / x.omega
  const samples = []
  let sum = 0
  for (let k = 0; k < n; k++) {
    const t = ((k + 0.5) / n) * T
    const p = -x.ac.at(t).p[id]
    samples.push({ t, p })
    sum += p
  }
  return { P, Q, S, pf: S > 0 ? P / S : 1, phi: Math.atan2(Q, P), T, samples, mean: sum / n, peak: Math.max(...samples.map((s) => Math.abs(s.p))) }
}
