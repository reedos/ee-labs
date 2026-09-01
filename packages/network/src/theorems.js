// Network theorems, each computed the way a textbook says to — and, where the
// textbook offers more than one way, all of them, so the reader can watch
// them agree.

import { GROUND, NetworkError, normalize } from './netlist.js'
import { solveDC } from './mna.js'

const isIndependent = (e) => e.type === 'V' || e.type === 'I'

/** A copy of the netlist with every independent source set to zero (V → short, I → open). */
export function killed(net, except = null) {
  // Work on normalised elements so every source has the id the caller sees.
  const elements = net.nodeNames ? net.elements : normalize(net).elements
  return { elements: elements.map((e) => (isIndependent(e) && e.id !== except ? { ...e, value: 0 } : e)) }
}

/** Add elements to a netlist without mutating it. */
export function withElements(net, extra) {
  return { elements: [...net.elements, ...extra] }
}

/**
 * Thévenin equivalent seen at the port (a, b), a being the + terminal, found
 * three independent ways:
 *   ratio — V_oc / I_sc, two solves of the live circuit;
 *   test  — kill the sources, push 1 A into a, read the volts;
 *   fit   — hang a few loads across the port and fit the straight line.
 * Returns each R_th separately so the agreement can be shown rather than
 * claimed. Throws NetworkError 'no-thevenin' when the port is an ideal
 * current source (I_sc finite, V_oc infinite: R_th does not exist).
 */
export function thevenin(net, a, b = GROUND, opts = {}) {
  const norm = normalize(net)
  const ids = new Set(norm.elements.map((e) => e.id))
  const fresh = (base) => {
    let k = 0
    let id = base
    while (ids.has(id)) id = `${base}${++k}`
    return id
  }

  let open
  try {
    open = solveDC(net, opts)
  } catch (err) {
    if (err instanceof NetworkError && (err.code === 'floating' || err.code === 'current-cutset'))
      throw new NetworkError(
        'no-thevenin',
        `The port ${a}–${b} looks like an ideal current source from outside: open-circuit voltage is unbounded, so there is no Thévenin equivalent (a Norton one exists).`,
        { cause: err },
      )
    throw err
  }
  const voc = open.v[a] - open.v[b]

  const shortId = fresh('Vshort')
  const shorted = solveDC(withElements(net, [{ type: 'V', id: shortId, nodes: [a, b], value: 0 }]), opts)
  const isc = shorted.i[shortId]

  const testId = fresh('Itest')
  let test
  try {
    const dead = solveDC(withElements(killed(net), [{ type: 'I', id: testId, nodes: [b, a], value: 1 }]), opts)
    test = dead.v[a] - dead.v[b]
  } catch (err) {
    if (err instanceof NetworkError) test = Infinity
    else throw err
  }

  // 0/0 is not infinity: with no source reaching the port, the ratio method
  // has nothing to say, and NaN says so.
  const ratio = Math.abs(isc) < 1e-15 ? (Math.abs(voc) < 1e-12 ? NaN : Infinity) : voc / isc

  // Load sweep: v = V_oc − R_th·i for any linear network. Least squares over
  // loads spread around |R_th| so the line is well conditioned.
  const scale = Number.isFinite(test) && test > 0 ? test : Number.isFinite(ratio) && ratio > 0 ? ratio : 1e3
  const loads = [0.25, 0.5, 1, 2, 4].map((f) => f * scale)
  const loadId = fresh('Rload')
  const pts = loads.map((R) => {
    const s = solveDC(withElements(net, [{ type: 'R', id: loadId, nodes: [a, b], value: R }]), opts)
    return { R, v: s.v[a] - s.v[b], i: s.i[loadId] }
  })
  const fit = lineFit(pts.map((q) => q.i), pts.map((q) => q.v))

  return {
    voc,
    isc,
    rth: { ratio, test, fit: -fit.slope },
    fitVoc: fit.intercept,
    fitResidual: fit.residual,
    points: pts,
    norton: { in: isc, rn: test },
  }
}

/** Least-squares line y = intercept + slope·x, with max |residual|. */
export function lineFit(xs, ys) {
  const n = xs.length
  const mx = xs.reduce((s, x) => s + x, 0) / n
  const my = ys.reduce((s, y) => s + y, 0) / n
  let sxx = 0
  let sxy = 0
  for (let k = 0; k < n; k++) {
    sxx += (xs[k] - mx) ** 2
    sxy += (xs[k] - mx) * (ys[k] - my)
  }
  const slope = sxx === 0 ? 0 : sxy / sxx
  const intercept = my - slope * mx
  const residual = Math.max(...xs.map((x, k) => Math.abs(ys[k] - (intercept + slope * x))))
  return { slope, intercept, residual }
}

/**
 * Superposition: one solve per independent source with the others killed, and
 * the sum. The `full` solve is returned alongside so the caller can show the
 * sum matching it — and the powers not.
 */
export function superposition(net, opts = {}) {
  const norm = normalize(net)
  const sources = norm.elements.filter(isIndependent)
  const full = solveDC(net, opts)
  const parts = sources.map((s) => ({ id: s.id, sol: solveDC(killed(net, s.id), opts) }))
  const sumV = {}
  for (const node of Object.keys(full.v)) sumV[node] = parts.reduce((acc, p) => acc + p.sol.v[node], 0)
  const sumI = {}
  for (const id of Object.keys(full.i)) sumI[id] = parts.reduce((acc, p) => acc + p.sol.i[id], 0)
  const sumP = {}
  for (const id of Object.keys(full.p)) sumP[id] = parts.reduce((acc, p) => acc + p.sol.p[id], 0)
  return { full, parts, sumV, sumI, sumP }
}

/**
 * Power delivered to a load resistor across (a, b) as its value sweeps — the
 * maximum-power-transfer curve. Returns points and the analytic optimum from
 * the Thévenin equivalent.
 */
export function loadSweep(net, a, b = GROUND, loads, opts = {}) {
  const th = thevenin(net, a, b, opts)
  const rth = th.rth.test
  const loadId = 'Rsweep'
  const points = loads.map((R) => {
    const s = solveDC(withElements(net, [{ type: 'R', id: loadId, nodes: [a, b], value: R }]), opts)
    return { R, p: s.p[loadId], v: s.v[a] - s.v[b], i: s.i[loadId], efficiency: s.p[loadId] / -sourcePower(s) }
  })
  return { points, rth, pMax: (th.voc * th.voc) / (4 * rth), rOpt: rth }
}

/** Total power delivered by sources (negative under the passive convention). */
export function sourcePower(sol) {
  return sol.sys.effs.filter((e) => e.type === 'V' || e.type === 'I').reduce((s, e) => s + sol.p[e.id], 0)
}
