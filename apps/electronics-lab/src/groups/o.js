// Group O: noise.
//
// Noise enters the suite twice, and the group is built on that split. It is
// first a signal: a random waveform with a spectral density rather than a
// spectrum, which is O1, and which imports `@ee-labs/random` rather than
// writing a second generator. Then it is a set of sources on a circuit:
// 4kTR on every resistor and 2qI through every junction, which
// `packages/network`'s `noise.js` carries to the output one source at a time
// and sums as powers. The two packages meet at the number, never at the code.
//
// Every circuit here past O2 is drawn as the tangent rather than as the
// device. That is not a shortcut. A noise density is a small-signal quantity,
// the sources sit on the small-signal netlist, and the stack the pane shows is
// a stack over the elements of that netlist. `r_π` is the slope of a junction
// and carries the shot noise of the current crossing it, not 4kT/r_π, which
// would count the same physics twice — `noiseSources` skips any element the
// tangent drew and asks for the junction currents instead.
//
// The plan's O2 pin is the one closed form in the group. One resistor into one
// capacitor integrates to √(kT/C) whatever the resistance is, 2.04 µV at a
// nanofarad, because R sets both the density and the bandwidth and the two
// cancel.

import {
  noiseDensity,
  noiseRms,
  noiseSources,
  perRootHz,
  smallSignal,
  solveAC,
  thermalVoltage,
  complex as cx,
} from '@ee-labs/network'
import { averagedPeriodogram, whiteNoise } from '@ee-labs/random'
import { Amp, Cap, Choice, Freq, Is, R, SatI, Temp, chips, gnd, node, wire } from '../knobs.js'

const GROUP = 'O · Noise'

/** Boltzmann's constant and the elementary charge, as `packages/network` has them. */
const K_B = 1.380649e-23
const Q_E = 1.602176634e-19

/** A count of frames or a seed: a whole number, chosen rather than dialled. */
const Count = (key, label, def, values, hint) => Choice(key, label, def, values.map((v) => ({ value: v, label: String(v) })), hint)

// ------------------------------------------------------------ the circuits

/** O1: the generator and the load it drives. The density is a property of the generator. */
const generatorNet = (p) => ({
  elements: [
    { type: 'V', id: 'Vn', nodes: ['n', 'gnd'], value: p.rms, small: true },
    { type: 'R', id: 'RL', nodes: ['n', 'gnd'], value: p.RL },
  ],
})

/** O2: one resistor into one capacitor, which is the kT/C circuit. */
const ktcNet = (p) => ({
  elements: [
    { type: 'R', id: 'R1', nodes: ['out', 'gnd'], value: p.R1 },
    { type: 'C', id: 'C1', nodes: ['out', 'gnd'], value: p.C1 },
  ],
})

/** O3: a junction held at a current, which is what a mirror does to it. */
const junctionNet = (p) => ({
  elements: [
    { type: 'I', id: 'I1', nodes: ['gnd', 'a'], value: p.i },
    { type: 'D', id: 'D1', nodes: ['a', 'gnd'], model: 'exp', is: p.is, vt: thermalVoltage(p.T) },
  ],
})

/** The transconductance and the base resistance a bias current and a β give. */
export const stageOf = (p) => {
  const gm = p.ic / thermalVoltage(p.T)
  return { gm, rpi: p.beta / gm, ib: p.ic / p.beta }
}

/** O4: the common-emitter stage as its own tangent, which is where the sources live. */
const ceNet = (p) => {
  const { gm, rpi } = stageOf(p)
  return {
    elements: [
      { type: 'V', id: 'Vs', nodes: ['s', 'gnd'], value: 0, wave: { kind: 'sine', amp: p.vsig, freq: p.f }, small: true },
      { type: 'R', id: 'Rs', nodes: ['s', 'b'], value: p.Rs },
      { type: 'R', id: 'rpi', nodes: ['b', 'gnd'], value: rpi, from: 'Q' },
      { type: 'VCCS', id: 'gm', nodes: ['c', 'gnd'], ctrl: ['b', 'gnd'], gain: gm },
      { type: 'R', id: 'RC', nodes: ['c', 'gnd'], value: p.RC },
    ],
  }
}

/** O5: the same stage twice, the second directly coupled to the first. */
const cascadeNet = (p) => {
  const { gm, rpi } = stageOf(p)
  return {
    elements: [
      { type: 'V', id: 'Vs', nodes: ['s', 'gnd'], value: 0, wave: { kind: 'sine', amp: p.vsig, freq: p.f }, small: true },
      { type: 'R', id: 'Rs', nodes: ['s', 'b'], value: p.Rs },
      { type: 'R', id: 'rpi1', nodes: ['b', 'gnd'], value: rpi, from: 'Q' },
      { type: 'VCCS', id: 'gm1', nodes: ['c', 'gnd'], ctrl: ['b', 'gnd'], gain: gm },
      { type: 'R', id: 'RC1', nodes: ['c', 'gnd'], value: p.RC },
      { type: 'R', id: 'rpi2', nodes: ['c', 'gnd'], value: rpi, from: 'Q' },
      { type: 'VCCS', id: 'gm2', nodes: ['d', 'gnd'], ctrl: ['c', 'gnd'], gain: gm },
      { type: 'R', id: 'RC2', nodes: ['d', 'gnd'], value: p.RC },
    ],
  }
}

// ------------------------------------------------------------ measurement

/** The one closed form: √(kT/C), the rms a capacitor holds whatever charges it. */
export const ktOverC = (c, T) => Math.sqrt((K_B * T) / c)

/** A resistor's thermal noise voltage density, √(4kTR), volts per root hertz. */
export const thermalDensity = (r, T) => Math.sqrt(4 * K_B * T * r)

/** A junction's shot noise current density, √(2qI), amps per root hertz. */
export const shotDensity = (i) => Math.sqrt(2 * Q_E * Math.abs(i))

/** The noise bandwidth of a first-order stage, (π/2)f_c. */
export const noiseBandwidth = (fc) => (Math.PI / 2) * fc

/** The corner of one resistor into one capacitor. */
export const cornerOf = (p) => 1 / (2 * Math.PI * p.R1 * p.C1)

/**
 * Everything the noise pane draws and every noise path a lesson quotes.
 *
 * Two kinds, because noise arrives twice. `signal` makes a record with
 * `@ee-labs/random`, takes its averaged periodogram, and reports what the
 * estimator says about itself as well as what it measured. `sources` puts the
 * thermal and shot sources of `packages/network` on the experiment's own
 * tangent and asks for the density at one frequency and the rms over a band.
 *
 * The band is part of the answer and travels with it, because the integral of
 * a density has no meaning without one.
 */
export function noiseOf(x) {
  if (x._noise) return x._noise
  const spec = x.exp.noise || {}
  const out = spec.kind === 'signal' ? fromSignal(x, spec) : fromSources(x, spec)
  x._noise = out
  return out
}

/** O1: a random signal, its averaged periodogram, and what the estimator claims. */
function fromSignal(x, spec) {
  const p = x.p
  const n = p.averages * p.segment
  const gen = whiteNoise({ n, sampleRate: p.fs, rms: p.rms, seed: p.seed })
  const est = averagedPeriodogram(gen.x, p.fs, { segment: p.segment, overlap: 0, window: 'hann' })
  const [lo, hi] = est.interior
  let sum = 0
  for (let k = lo; k <= hi; k++) sum += est.psd[k]
  const meanPsd = sum / (hi - lo + 1)
  return {
    kind: 'signal',
    // What the generator was given, and what the estimate found.
    density: gen.density,
    measured: Math.sqrt(meanPsd),
    rms: gen.rms,
    integral: Math.sqrt(Math.max(est.integral, 0)),
    flatness: est.flatness,
    relativeSe: est.relativeSe,
    dof: est.dof,
    segments: est.segments,
    band: est.band,
    curve: { f: est.freqs, asd: est.asd, ci: est.ci, flat: gen.density },
  }
}

/** O2 to O5: sources on the tangent, carried to the output one at a time. */
function fromSources(x, spec) {
  const p = x.p
  const T = p.T ?? 300
  const ss = smallSignal(x.norm, x.op, { caps: false })
  const net = { elements: ss.elements }
  const currents = spec.currents ? spec.currents(p, x) : {}
  const exclude = spec.exclude || []
  const output = spec.output || 'out'
  const at = spec.at ? spec.at(p) : 1
  const band = spec.band ? spec.band(p) : [1, 1e6]
  const opts = { output, T, currents, exclude }
  const sources = noiseSources(net, opts)
  const d = noiseDensity(net, { ...opts, sources }, at)
  const integ = noiseRms(net, { ...opts, sources }, { from: band[0], to: band[1], perDecade: spec.perDecade ?? 20 })
  const out = {
    kind: 'sources',
    at,
    band,
    density: perRootHz(d.total),
    rms: integ.rms,
    stack: Object.fromEntries(Object.entries(d.byId).map(([id, psd]) => [id, perRootHz(psd)])),
    powers: d.byId,
    total: d.total,
    ids: sources.map((s) => s.id),
    // The shot densities themselves, in amps per root hertz, which is what a
    // junction's own number is before any circuit turns it into a voltage.
    shotOf: Object.fromEntries(Object.entries(currents).map(([id, i]) => [id, shotDensity(i)])),
    shot: shotDensity(Object.values(currents)[0] ?? 0),
    curve: densityCurve(net, opts, sources, band),
  }
  // The figure is the total over what the source resistance alone would make.
  if (spec.ref && d.byId[spec.ref] > 0) {
    out.f = d.total / d.byId[spec.ref]
    out.nf = 10 * Math.log10(out.f)
  }
  // Signal-to-noise, at each node the experiment names, over the same band.
  // The signal is a sine, so what compares against an rms noise is its own
  // rms, the amplitude over root two.
  if (spec.snr) {
    out.snr = {}
    out.snrdb = {}
    out.gain = {}
    out.noiseAt = {}
    const sol = solveAC(net, 2 * Math.PI * at, { sources: { [spec.input || 'Vs']: [1, 0] } })
    for (const nd of spec.snr) {
      const h = cx.cabs(sol.v[nd])
      const rms = noiseRms(net, { ...opts, output: nd, sources }, { from: band[0], to: band[1], perDecade: spec.perDecade ?? 20 }).rms
      out.gain[nd] = h
      out.noiseAt[nd] = rms
      out.snr[nd] = (h * p.vsig) / Math.SQRT2 / rms
      out.snrdb[nd] = 20 * Math.log10(out.snr[nd])
    }
  }
  return out
}

/** The output density against frequency, for the pane. */
function densityCurve(net, opts, sources, band) {
  const points = 61
  const f = new Float64Array(points)
  const asd = new Float64Array(points)
  const parts = {}
  for (const s of sources) parts[s.id] = new Float64Array(points)
  for (let k = 0; k < points; k++) {
    const freq = band[0] * (band[1] / band[0]) ** (k / (points - 1))
    const d = noiseDensity(net, { ...opts, sources }, freq)
    f[k] = freq
    asd[k] = perRootHz(d.total)
    for (const [id, psd] of Object.entries(d.byId)) parts[id][k] = perRootHz(psd)
  }
  return { f, asd, parts }
}

// ------------------------------------------------------------ the drawings

const TOP = 70
const BOT = 110
const MID = 90

/** Two elements side by side between one pair of rails: the shape O1, O2 and O3 share. */
function pairLayout(left, right, name, dotAt = 200) {
  return {
    w: 420,
    h: 180,
    items: [
      { el: left.id, x: left.x, y: MID, dir: 'v' },
      { el: right.id, x: right.x, y: MID, dir: 'v' },
      wire(left.x, TOP, right.x, TOP),
      wire(left.x, BOT, right.x, BOT),
      node(name, dotAt, TOP, 't'),
      gnd(dotAt, BOT),
    ],
  }
}

/** O4: the hybrid-π on one pair of rails, the source and its resistance on the left. */
function ceLayout() {
  return {
    w: 420,
    h: 180,
    items: [
      { el: 'Vs', x: 40, y: MID, dir: 'v' },
      wire(40, TOP, 105, TOP),
      { el: 'Rs', x: 125, y: TOP, dir: 'h' },
      wire(145, TOP, 180, TOP),
      node('b', 175, TOP, 't'),
      { el: 'rpi', x: 180, y: MID, dir: 'v' },
      wire(260, TOP, 340, TOP),
      node('c', 300, TOP, 't'),
      { el: 'gm', x: 260, y: MID, dir: 'v' },
      { el: 'RC', x: 340, y: MID, dir: 'v' },
      wire(40, BOT, 340, BOT),
      gnd(220, BOT),
      node('s', 75, TOP, 't'),
    ],
  }
}

/** O5: the same stage twice, the second row read right to left. */
function cascadeLayout() {
  return {
    w: 420,
    h: 180,
    items: [
      { el: 'Vs', x: 40, y: 54, dir: 'v' },
      wire(40, 34, 105, 34),
      node('s', 75, 34, 't'),
      { el: 'Rs', x: 125, y: 34, dir: 'h' },
      wire(145, 34, 180, 34),
      node('b', 175, 34, 't'),
      { el: 'rpi1', x: 180, y: 54, dir: 'v' },
      { el: 'gm1', x: 260, y: 54, dir: 'v' },
      { el: 'RC1', x: 340, y: 54, dir: 'v' },
      wire(260, 34, 408, 34),
      node('c', 300, 34, 't'),
      wire(40, 74, 340, 74),
      gnd(220, 74),
      wire(408, 34, 408, 110),
      wire(408, 110, 330, 110),
      { el: 'rpi2', x: 330, y: 130, dir: 'v' },
      { el: 'gm2', x: 250, y: 130, dir: 'v' },
      { el: 'RC2', x: 170, y: 130, dir: 'v' },
      wire(250, 110, 170, 110),
      node('d', 210, 110, 't'),
      wire(170, 150, 330, 150),
      gnd(290, 150),
    ],
  }
}

// ------------------------------------------------------------ the experiments

const LABELS = {
  Vn: 'v_n',
  RL: 'R_L',
  R1: 'R₁',
  C1: 'C₁',
  I1: 'I₁',
  D1: 'D₁',
  Vs: 'v_s',
  Rs: 'R_s',
  rpi: 'r_π',
  gm: 'g_m',
  RC: 'R_C',
  rpi1: 'r_π1',
  gm1: 'g_m1',
  RC1: 'R_C1',
  rpi2: 'r_π2',
  gm2: 'g_m2',
  RC2: 'R_C2',
}

const TEMP = chips(Temp('T', 'Temperature T', 300), [250, 300, 350])

export const GROUP_O = [
  {
    id: 'o1',
    group: GROUP,
    name: 'A random signal has a density',
    terms: ['density', 'periodogram', 'averaging'],
    params: [
      chips(Amp('rms', 'Generator rms', 1e-3), [1e-4, 1e-3, 1e-2]),
      chips(Freq('fs', 'Sample rate f_s', 48000), [12000, 48000, 192000]),
      Count('averages', 'Frames averaged', 100, [1, 10, 100]),
      Count('segment', 'Samples per frame', 256, [256, 512, 1024]),
      Count('seed', 'Seed', 1, [1, 2, 3]),
      R('RL', 'Load R_L', 10000),
    ],
    net: generatorNet,
    labels: LABELS,
    layout: pairLayout({ id: 'Vn', x: 140 }, { id: 'RL', x: 260 }, 'n'),
    show: 'dc',
    view: 'noise',
    views: ['reading', 'noise', 'equations'],
    noise: { kind: 'signal' },
    headline: { path: 'noise.measured', label: 'density', unit: 'V/√Hz' },
  },
  {
    id: 'o2',
    group: GROUP,
    name: 'A resistor’s own noise, and kT/C',
    terms: ['thermal', 'noisebandwidth', 'ktoverc'],
    params: [chips(R('R1', 'Resistance R₁', 1000), [100, 1000, 100000]), chips(Cap('C1', 'Capacitance C₁', 1e-9), [100e-12, 1e-9, 10e-9]), TEMP],
    net: ktcNet,
    labels: LABELS,
    layout: pairLayout({ id: 'R1', x: 140 }, { id: 'C1', x: 260 }, 'out'),
    show: 'dc',
    view: 'noise',
    views: ['reading', 'noise', 'equations'],
    noise: {
      kind: 'sources',
      output: 'out',
      at: () => 1,
      // The band the plan's invariant 9 states: four decades below the corner
      // to three above it, which leaves 0.064 % of the power in each tail.
      band: (p) => [cornerOf(p) / 1e4, 1000 * cornerOf(p)],
      perDecade: 60,
    },
    headline: { path: 'noise.rms', label: 'v_n rms', unit: 'V' },
  },
  {
    id: 'o3',
    group: GROUP,
    name: 'Shot noise, and half a resistor’s',
    terms: ['shot', 'granularity'],
    params: [chips(Is('i', 'Bias current I', 1e-3), [10e-6, 1e-3, 10e-3]), TEMP, SatI('is', 'Saturation current I_S', 1e-14)],
    net: junctionNet,
    labels: LABELS,
    layout: pairLayout({ id: 'I1', x: 140 }, { id: 'D1', x: 260 }, 'a'),
    show: 'dc',
    view: 'noise',
    views: ['reading', 'noise', 'equations'],
    noise: {
      kind: 'sources',
      output: 'a',
      at: () => 1000,
      band: (p) => [1, 1e6],
      currents: (p) => ({ D1: p.i }),
    },
    headline: { path: 'noise.density', label: 'v_n', unit: 'V/√Hz' },
  },
  {
    id: 'o4',
    group: GROUP,
    name: 'The amplifier’s noise, referred back',
    terms: ['noisefigure', 'optimumsource'],
    params: [
      chips(R('Rs', 'Source R_s', 258.52), [25.852, 258.52, 2585.2]),
      chips(Is('ic', 'Collector current I_C', 1e-3), [1e-4, 1e-3, 1e-2]),
      chips({ key: 'beta', label: 'Current gain β', unit: '', min: 5, max: 1000, scale: 'log', default: 100 }, [25, 100, 400]),
      R('RC', 'Collector R_C', 5000),
      TEMP,
      Amp('vsig', 'Input amplitude', 1e-3),
      Freq('f', 'Signal frequency', 1000),
    ],
    net: ceNet,
    labels: LABELS,
    layout: ceLayout(),
    show: 'dc',
    view: 'noise',
    views: ['reading', 'noise', 'equations'],
    noise: {
      kind: 'sources',
      output: 'c',
      at: () => 1000,
      band: (p) => [1, 20000],
      currents: (p) => ({ rpi: p.ic / p.beta, gm: p.ic }),
      // The figure is quoted of the amplifier, so its own load is left out.
      exclude: ['RC'],
      ref: 'Rs',
    },
    headline: { path: 'noise.nf', label: 'noise figure', unit: 'dB' },
  },
  {
    id: 'o5',
    group: GROUP,
    name: 'The first stage sets the ratio',
    terms: ['snr', 'friis'],
    params: [
      chips(R('Rs', 'Source R_s', 1000), [258.52, 1000, 10000]),
      chips(Is('ic', 'Collector current I_C', 1e-3), [1e-4, 1e-3, 1e-2]),
      chips({ key: 'beta', label: 'Current gain β', unit: '', min: 5, max: 1000, scale: 'log', default: 100 }, [25, 100, 400]),
      R('RC', 'Collector R_C', 5000),
      chips(Amp('vsig', 'Input amplitude', 1e-3), [1e-5, 1e-3, 1e-1]),
      // The band runs from one hertz, so its top has to stay above that.
      chips({ key: 'bw', label: 'Band top', unit: 'Hz', min: 10, max: 1e9, scale: 'log', default: 20000 }, [2000, 20000, 200000]),
      TEMP,
      Freq('f', 'Signal frequency', 1000),
    ],
    net: cascadeNet,
    labels: LABELS,
    layout: cascadeLayout(),
    show: 'dc',
    view: 'noise',
    views: ['reading', 'noise', 'equations'],
    noise: {
      kind: 'sources',
      output: 'd',
      at: () => 1000,
      band: (p) => [1, p.bw],
      currents: (p) => ({ rpi1: p.ic / p.beta, gm1: p.ic, rpi2: p.ic / p.beta, gm2: p.ic }),
      input: 'Vs',
      snr: ['b', 'c', 'd'],
    },
    headline: { path: 'noise.snrdb.d', label: 'SNR at the output', unit: 'dB' },
  },
]
