// Noise, as sources on a linear netlist.
//
// A noise source is not a signal. It has no phase and no waveform, and adding
// two of them adds their powers rather than their amplitudes. What it has is a
// spectral density, in volts squared or amps squared per hertz, and a linear
// circuit carries each one to the output through the same transfer function it
// carries a signal through. So the arithmetic is:
//
//   S_out(f) = Σ_k |H_k(j2πf)|² S_k(f)
//
// one solve per source per frequency, summed as powers. That sum is exact at
// every frequency. The rms over a band is a numerical integral, and the band
// is stated with the number, because the integral of a density has no meaning
// without one.
//
// Two sources are physics and one is a datasheet fact:
//
//   thermal   4kTR on every resistor, from the thermodynamics of the carriers
//             in it. Nyquist's result, and it depends on nothing but T and R.
//   shot      2qI through every junction, from the current being a countable
//             number of carriers crossing a barrier.
//   flicker   K_f/f, off by default and labelled where it is on. Its constant
//             is a property of one process on one day, not a law, so this
//             package will state it but will not put it in a default.
//
// The generator that makes a random SIGNAL in time, and its averaged
// periodogram, belong to `@ee-labs/random` and are not repeated here.

import { NetworkError, normalize } from './netlist.js'
import { solveAC } from './phasor.js'
import { cabs } from './complex.js'
import { K_B, Q_E, T_ROOM } from './diode.js'

/** Thermal noise: the current density 4kT/R a resistor's own carriers make, in A²/Hz. */
export const thermalCurrent = (r, T = T_ROOM) => (4 * K_B * T) / r

/** The same source seen as a voltage in series, 4kTR, in V²/Hz. */
export const thermalVoltageDensity = (r, T = T_ROOM) => 4 * K_B * T * r

/** Shot noise: 2qI, in A²/Hz, of a current crossing a barrier. */
export const shotCurrent = (i) => 2 * Q_E * Math.abs(i)

/** Flicker noise: K_f I^a/f, in A²/Hz. Zero unless a constant is given. */
export const flickerCurrent = (kf, i, f, af = 1) => (kf > 0 && f > 0 ? (kf * Math.abs(i) ** af) / f : 0)

/** A density in V²/Hz as the volts per root hertz a datasheet quotes. */
export const perRootHz = (psd) => Math.sqrt(Math.max(psd, 0))

/**
 * The noise bandwidth of a first-order stage: the width of the brick wall that
 * would pass the same power. It is π/2 times the −3 dB corner, and that factor
 * is why `kT/C` does not depend on R.
 */
export const noiseBandwidth = (fc) => (Math.PI / 2) * fc

/**
 * The sources a netlist carries, one per noisy element.
 *
 * Each is a current source across the element's own two nodes, because both
 * laws are naturally currents: 4kT/R in parallel with the resistor is Norton's
 * form of 4kTR in series with it, and shot noise is a current to begin with.
 * `psd(f)` is in A²/Hz.
 *
 * A resistor that came out of a tangent is not a resistor. `r_π` is the slope
 * of a junction's curve, and the noise of that junction is the shot noise of
 * the current crossing it. Counting 4kT/r_π as well would be counting the same
 * physics twice, so an element carrying `from` is skipped and the junction it
 * stands for is given its shot source through `currents`.
 *
 * @param net   a linear netlist, usually the one `smallSignal` returned
 * @param opts  { T, kf, af, currents, exclude } — `currents` gives the DC
 *              current in each junction, which shot noise is proportional to,
 *              keyed by the element the source sits across. `exclude` drops an
 *              element from the count, for a figure quoted of the amplifier
 *              rather than of the amplifier and its load.
 */
export function noiseSources(net, { T = T_ROOM, kf = 0, af = 1, currents = {}, exclude = [] } = {}) {
  const norm = net.nodeNames ? net : normalize(net)
  const skip = new Set(exclude)
  const out = []
  for (const e of norm.elements) {
    if (skip.has(e.id)) continue
    if (e.type === 'R' && e.value > 0 && !e.from) {
      out.push({ id: e.id, kind: 'thermal', nodes: e.nodes, psd: () => thermalCurrent(e.value, T), of: e.of || e.id })
      continue
    }
    // A junction's shot noise rides on the current through it. The tangent has
    // already turned that junction into a conductance, so the current cannot
    // be read off the linear netlist: it is passed in.
    const i = currents[e.id]
    if (Number.isFinite(i) && i !== 0) {
      out.push({
        id: e.id,
        kind: 'shot',
        nodes: e.nodes,
        psd: (f) => shotCurrent(i) + flickerCurrent(kf, i, f, af),
        of: e.of || e.id,
        current: i,
      })
    }
  }
  return out
}

/**
 * The output noise density at one frequency, source by source.
 *
 * Every independent source in the circuit is killed, one unit of current is
 * driven across the noisy element's own nodes, and the output that comes back
 * is |H_k|. The density it carries is |H_k|² S_k, and the total is their sum,
 * because noise sources are uncorrelated and powers add.
 *
 * @returns {{ total, byId, at }} total in V²/Hz (or A²/Hz for a current output)
 */
export function noiseDensity(net, { output, sources, T = T_ROOM, kf = 0, af = 1, currents = {}, exclude = [] }, f) {
  if (!(f >= 0)) throw new NetworkError('value', 'A noise density is quoted at a frequency, and the frequency must not be negative')
  const norm = net.nodeNames ? net : normalize(net)
  const list = sources || noiseSources(norm, { T, kf, af, currents, exclude })
  if (!list.length) throw new NetworkError('noise-no-sources', 'This circuit carries no resistor and no junction, so it has no noise to state.')
  const omega = 2 * Math.PI * f
  const byId = {}
  let total = 0
  for (const s of list) {
    const probe = { type: 'I', id: '__noise__', nodes: s.nodes, value: 1 }
    const killed = norm.elements.map((e) => (e.type === 'V' || e.type === 'I' ? { ...e, value: 0, wave: undefined } : e))
    const sol = solveAC({ elements: [...killed, probe] }, omega, { sources: { __noise__: 1 } })
    const h = readOut(sol, output)
    const psd = h * h * s.psd(f)
    byId[s.id] = psd
    total += psd
  }
  return { total, byId, at: f }
}

/** The output the noise is measured at: a node, a difference, or a branch current. */
function readOut(sol, output) {
  if (typeof output === 'string') return cabs(sol.v[output])
  if (output && output.across) {
    const [a, b] = output.across
    return cabs([sol.v[a][0] - sol.v[b][0], sol.v[a][1] - sol.v[b][1]])
  }
  if (output && output.through) return cabs(sol.i[output.through])
  throw new NetworkError('value', 'A noise measurement needs an output: a node name, { across } or { through }')
}

/**
 * The rms over a band, and the band it was integrated over.
 *
 * The density is exact at each frequency and this is a numerical integral, so
 * the band is part of the answer and the pane prints it. The integration runs
 * on a logarithmic grid, because a first-order density is flat over decades
 * and then falls as 1/f², and a linear grid spends all its points where
 * nothing happens.
 */
export function noiseRms(net, opts, { from = 1, to = 1e6, perDecade = 40 } = {}) {
  if (!(from > 0) || !(to > from)) throw new NetworkError('value', 'A noise band runs from one positive frequency to a higher one')
  const decades = Math.log10(to / from)
  const n = Math.max(8, Math.round(decades * perDecade))
  const sources = opts.sources || noiseSources(net.nodeNames ? net : normalize(net), opts)
  // Simpson's rule in ln f: the integrand is S(f)·f, which is what df = f·d(ln f)
  // makes of it, and it is smooth on that axis wherever the density is.
  const steps = n % 2 === 0 ? n : n + 1
  const h = Math.log(to / from) / steps
  let sum = 0
  const byId = {}
  for (let k = 0; k <= steps; k++) {
    const f = from * Math.exp(k * h)
    const d = noiseDensity(net, { ...opts, sources }, f)
    const weight = k === 0 || k === steps ? 1 : k % 2 ? 4 : 2
    sum += weight * d.total * f
    for (const [id, psd] of Object.entries(d.byId)) byId[id] = (byId[id] || 0) + weight * psd * f
  }
  const scale = h / 3
  const power = sum * scale
  return {
    rms: Math.sqrt(Math.max(power, 0)),
    power,
    band: [from, to],
    byId: Object.fromEntries(Object.entries(byId).map(([id, v]) => [id, v * scale])),
  }
}

/**
 * The one case with a closed form: one resistor into one capacitor integrates
 * to kT/C whatever R is, because R sets both the density and the bandwidth and
 * the two cancel. This is the number every sampled circuit is measured against.
 */
export const ktOverC = (c, T = T_ROOM) => Math.sqrt((K_B * T) / c)

/**
 * How much of a first-order stage's noise power sits below a frequency. The
 * tail beyond the band is 1 − this, and the pane prints it rather than
 * rounding it away.
 */
export const firstOrderFraction = (f, fc) => (2 / Math.PI) * Math.atan(f / fc)
