// Every number the brief and the lessons quote, computed from the engine.
//
//   node apps/photonics-lab/scripts/pins.mjs
//
// PROGRAM.md §3 requires that every quoted number is computed by a script
// before it is written. This is that script. It prints one labelled line per
// figure, grouped by the experiment that quotes it, so a figure in a lesson can
// be found here and re-run.
//
// Nothing below is typed in except the knob settings, and those are read from
// the experiments themselves rather than repeated. A line that reads "at the
// defaults" took its settings from `defaultsOf`, and a line that names a
// setting applied it over those defaults with the same `analyse` the app calls.

import { EXPERIMENTS, byId, defaultsOf } from '../src/experiments.js'
import { analyse } from '../src/math.js'

const pad = (s, n) => String(s).padEnd(n)
const sig = (x, n = 5) => (Number.isFinite(x) ? Number(x).toPrecision(n) : String(x))
const head = (t) => console.log(`\n--- ${t} ---`)
const line = (label, value, unit = '') => console.log(`  ${pad(label, 44)} ${value}${unit ? ' ' + unit : ''}`)

/** The analysis of one experiment at its defaults, with some knobs moved. */
const at = (id, over = {}) => analyse(byId[id], { ...defaultsOf(id), ...over })

// ------------------------------------------------------------------- Group A

head('A1 · A photon carries hc over its wavelength')
line('hc over q', sig(at('a1').hc, 9), 'eV micrometre')
for (const nm of [1550, 1310, 850]) {
  const x = at('a1', { lambda: nm * 1e-9 })
  line(`${nm} nm: photon energy`, sig(x.photon.eV), 'eV')
  line(`${nm} nm: optical frequency`, sig(x.photon.frequency / 1e12), 'THz')
  line(`${nm} nm: flux in 1 mW`, x.photon.flux.toExponential(4), 'per second')
}

head('A2 · The photodiode is a circuit element')
{
  const d = at('a2')
  line('photocurrent at the defaults', sig(d.pd.iph * 1e6), 'uA')
  line('load current at the defaults', sig(d.pd.current * 1e6), 'uA')
  line('reverse bias left on the junction', sig(d.pd.reverse), 'V')
  for (const bias of [2, 5, 10, 20]) line(`load current at ${bias} V`, sig(at('a2', { bias }).pd.current * 1e6), 'uA')
  const starved = at('a2', { power: 1e-3, load: 100000 })
  line('1 mW into 100 kOhm: current', sig(starved.pd.current * 1e6), 'uA')
  line('1 mW into 100 kOhm: reverse bias', sig(starved.pd.reverse), 'V')
}

head('A3 · Responsivity, and where it stops')
for (const nm of [1550, 1310, 850]) line(`${nm} nm at eta 0.8`, sig(at('a3', { lambda: nm * 1e-9 }).R), 'A/W')
line('cut-off at 0.75 eV', sig(at('a3').cutoff * 1e9), 'nm')
line('cut-off at 1.12 eV', sig(at('a3', { eg: 1.12 }).cutoff * 1e9), 'nm')
line('responsivity at 1550 nm, eg 1.12 eV', sig(at('a3', { eg: 1.12 }).R), 'A/W')
line('responsivity at 1000 nm, eg 1.12 eV', sig(at('a3', { eg: 1.12, lambda: 1000e-9 }).R), 'A/W')

head('A4 · Dark current, and the diode underneath')
for (const w of [0, 1e-9, 1e-6]) {
  const x = at('a4', { power: w })
  line(`${w === 0 ? 'no light' : `${w * 1e9} nW`}: total current`, sig(x.pd.current * 1e9), 'nA')
}
line('level where the two are equal', sig(at('a4').level * 1e9), 'nW')
line('photocurrent at 1 nW', sig(at('a4', { power: 1e-9 }).pd.iph * 1e9), 'nA')

head('A5 · Speed costs area')
for (const um of [50, 100, 200]) {
  const x = at('a5', { d: um * 1e-6 })
  line(`${um} um: area`, x.speed.area.toExponential(4), 'm2')
  line(`${um} um: junction capacitance`, sig(x.speed.cj * 1e12), 'pF')
  line(`${um} um: corner frequency`, sig(x.speed.corner / 1e6), 'MHz')
  line(`${um} um: collected power`, sig(x.speed.collected * 1e9), 'nW')
  line(`${um} um: area bandwidth product`, sig(x.speed.areaBandwidth), 'm2/s')
}
line('zero-bias capacitance at 100 um', sig(at('a5').speed.cj0 * 1e12), 'pF')

// ------------------------------------------------------------------- Group E

head('E1 · Attenuation, and the three windows')
for (const [alphaDb, nm] of [[0.2, 1550], [0.35, 1310], [2.0, 850]]) {
  const x = at('e1', { alphaDb, lambda: nm * 1e-9 })
  line(`${alphaDb} dB/km at ${nm} nm over 80 km`, sig(x.att.db), 'dB')
  line('  power ratio', sig(x.att.ratio), '')
  line('  power out from 1 mW', sig(x.att.outDbm), 'dBm')
}
for (const km of [20, 40, 80]) line(`0.20 dB/km over ${km} km`, sig(at('e1', { length: km * 1e3 }).att.db), 'dB')

head('E2 · Dispersion spreads a pulse')
for (const nm of [1, 0.1, 0.01]) {
  const x = at('e2', { dLambda: nm * 1e-9 })
  line(`${nm} nm source over 80 km`, sig(x.disp.spread * 1e12), 'ps')
}
for (const km of [40, 80]) line(`1 nm source over ${km} km`, sig(at('e2', { length: km * 1e3 }).disp.spread * 1e12), 'ps')
line('beta_2 at 1550 nm, D = 17', sig(at('e2').disp.beta2 * 1e27), 'ps2/km')
line('beta_2 at 1310 nm, D = 17', sig(at('e2', { lambda: 1310e-9 }).disp.beta2 * 1e27), 'ps2/km')
line('beta_2 at 1550 nm, D = -2', sig(at('e2', { D: -2 }).disp.beta2 * 1e27), 'ps2/km')

head('E3 · The bandwidth-distance product')
line('1 nm over 80 km, criterion 0.25', sig(at('e3').limit.rate / 1e9), 'Gbit/s')
line('0.1 nm over 80 km', sig(at('e3', { dLambda: 0.1e-9 }).limit.rate / 1e9), 'Gbit/s')
line('1 nm over 8 km', sig(at('e3', { length: 8e3 }).limit.rate / 1e9), 'Gbit/s')
line('1 nm over 80 km, criterion 0.5', sig(at('e3', { criterion: 0.5 }).limit.rate / 1e9), 'Gbit/s')
line('product, 1 nm source', sig(at('e3').limit.product / 1e9 / 1e3), 'Gbit/s km per nm')

head('E4 · The core, the cladding, and one mode')
{
  const x = at('e4')
  line('numerical aperture', sig(x.geo.na), '')
  line('acceptance angle', sig(x.geo.angle), 'degrees')
  line('index difference', sig(x.geo.delta * 100), 'per cent')
  line('single-mode core diameter at 1550 nm', sig(x.geo.single * 1e6), 'um')
  line('V at a 4.5 um core, 1550 nm', sig(x.geo.v), '')
  line('modes there', x.geo.modes, '')
  const wide = at('e4', { a: 25e-6, lambda: 850e-9 })
  line('V at a 25 um core, 850 nm', sig(wide.geo.v), '')
  line('modes there', wide.geo.modes, '')
  const open = at('e4', { n2: 1.44 })
  line('cladding 1.44: numerical aperture', sig(open.geo.na), '')
  line('cladding 1.44: acceptance angle', sig(open.geo.angle), 'degrees')
  line('cladding 1.44: V at 4.5 um', sig(open.geo.v), '')
}

head('E5 · The link budget, and which limit binds')
{
  const x = at('e5')
  for (const it of x.budget.items) line(`  ${it.name}`, sig(it.db), 'dB')
  line('total loss', sig(x.budget.total), 'dB')
  line('power at the receiver', sig(x.budget.received), 'dBm')
  line('margin over sensitivity', sig(x.budget.margin), 'dB')
  line('loss-limited reach, 3 dB reserved', sig(x.reach.length / 1e3), 'km')
  line('dispersion-limited reach at 10 Gbit/s', sig(x.reach.dispersion / 1e3), 'km')
  line('which limit binds', x.reach.binds, '')
  const far = at('e5', { length: 120e3 })
  line('at 120 km: total loss', sig(far.budget.total), 'dB')
  line('at 120 km: margin', sig(far.budget.margin), 'dB')
  const slow = at('e5', { rate: 1e8 })
  line('dispersion reach at 100 Mbit/s', sig(slow.reach.dispersion / 1e3), 'km')
  line('  which limit binds there', slow.reach.binds, '')
}

// ------------------------------------------------------------------- Group F

head('F1 · The cavity, and why it has no transfer function')
{
  const x = at('f1')
  line('facet reflectance of an index 3.5 chip', sig(x.facet), '')
  line('free spectral range', sig(x.fsr / 1e9), 'GHz')
  line('  the same in wavelength at 1550 nm', sig(x.fsrWavelength * 1e9), 'nm')
  line('finesse', sig(x.finesse), '')
  line('linewidth', sig(x.linewidth / 1e9), 'GHz')
  line('peak to valley contrast', sig(x.contrast.db), 'dB')
  line('mirror loss', sig(x.mirrorLoss / 100), 'per cm')
  for (const r of [0.3, 0.9, 0.99]) {
    const y = at('f1', { r })
    line(`R = ${r}: finesse`, sig(y.finesse), '')
    line(`R = ${r}: linewidth`, sig(y.linewidth / 1e9), 'GHz')
    line(`R = ${r}: contrast`, sig(y.contrast.db), 'dB')
  }
  line('free spectral range at L = 1 mm', sig(at('f1', { L: 1e-3 }).fsr / 1e9), 'GHz')
  line('the refusal', `"${x.refusal.slice(0, 68)}..."`)
}

head('F2 · Many colours down one fibre')
for (const ghz of [50, 100, 200]) {
  const x = at('f2', { spacing: ghz * 1e9 })
  line(`${ghz} GHz grid at 1550 nm`, sig(x.grid.width * 1e9), 'nm')
  line(`  channels in the C band`, x.band.channels, '')
}
line('C band width', sig(at('f2').band.width / 1e12), 'THz')
line('source width over grid width', sig(at('f2').widthRatio), '')

// ---------------------------------------------------------------- the totals

head('The set')
line('experiments', EXPERIMENTS.length, '')
for (const g of [...new Set(EXPERIMENTS.map((e) => e.group))]) {
  line(`  ${g}`, EXPERIMENTS.filter((e) => e.group === g).length, '')
}
