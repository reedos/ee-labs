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

// ------------------------------------------------------------------- Group C

head('C1 · Both are forward-biased junctions')
{
  const d = at('c1')
  line('supply at the defaults', sig(d.p.drive), 'V')
  line('junction current at the defaults', sig(d.j.current * 1e3), 'mA')
  line('forward voltage', sig(d.j.forward), 'V')
  line('volts the resistor took', sig(d.j.across), 'V')
  line('Newton iterations', d.j.iters, '')
  line('volts one photon costs at 1550 nm', sig(d.volts), 'V')
  line('as an LED, eta_int 0.2', sig(d.led.power * 1e3), 'mW')
  line('as a laser, eta_d 0.4', sig(d.laser.power * 1e3), 'mW')
  line('threshold current', sig(d.ith * 1e3), 'mA')
  line('wall plug as an LED', sig(100 * d.wall.led), 'per cent')
  line('wall plug as a laser', sig(100 * d.wall.laser), 'per cent')
  for (const drive of [1.8, 2.5, 3.3]) {
    const y = at('c1', { drive })
    line(`${drive} V: current`, sig(y.j.current * 1e3), 'mA')
    line(`${drive} V: forward voltage`, sig(y.j.forward), 'V')
    line(`${drive} V: as a laser`, sig(y.laser.power * 1e3), 'mW')
  }
  for (const series of [33, 150]) {
    const y = at('c1', { series })
    line(`${series} ohm: current`, sig(y.j.current * 1e3), 'mA')
    line(`${series} ohm: forward voltage`, sig(y.j.forward), 'V')
  }
}

head('C2 · The LED’s power is linear in current')
{
  const d = at('c2')
  line('slope at eta_int 0.2, 1550 nm', sig(d.led.slope), 'mW/mA')
  line('power at 20 mA', sig(d.led.power * 1e3), 'mW')
  line('forward voltage at 20 mA', sig(d.forward), 'V')
  for (const ma of [5, 10, 40]) line(`${ma} mA`, sig(at('c2', { current: ma * 1e-3 }).led.power * 1e3), 'mW')
  for (const etaInt of [0.1, 0.5]) {
    const y = at('c2', { etaInt })
    line(`eta_int ${etaInt}: slope`, sig(y.led.slope), 'mW/mA')
    line(`eta_int ${etaInt}: power at 20 mA`, sig(y.led.power * 1e3), 'mW')
  }
  for (const nm of [1310, 850]) line(`${nm} nm: slope`, sig(at('c2', { lambda: nm * 1e-9 }).led.slope), 'mW/mA')
}

head('C3 · The LED is slow')
for (const ns of [1, 2, 5, 20]) {
  const y = at('c3', { tauC: ns * 1e-9 })
  line(`tau_c ${ns} ns: bandwidth`, sig(y.band.f3db / 1e6), 'MHz')
}
{
  const d = at('c3')
  line('roll-off per decade', sig(d.band.perDecade), 'dB')
  line('roll-off per octave', sig(d.band.perOctave), 'dB')
  line('response at the corner', sig(20 * Math.log10(d.band.at(d.band.f3db))), 'dB')
}

head('C4 · The laser has a threshold')
{
  const d = at('c4')
  line('photon lifetime', sig(d.tauP * 1e12), 'ps')
  line('threshold density', d.nth.toExponential(4), 'per m3')
  line('threshold current', sig(d.ith * 1e3), 'mA')
  line('slope above threshold, eta_d 0.4', sig(d.laser.slope), 'mW/mA')
  line('slope below threshold, eta_sp 0.002', sig(d.laser.spontaneousSlope), 'mW/mA')
  line('ratio of the two slopes', sig(d.laser.slopeRatio), '')
  line('power at twice threshold', sig(d.laser.power * 1e3), 'mW')
  for (const ma of [5, 20, 40]) line(`${ma} mA: power`, sig(at('c4', { current: ma * 1e-3 }).laser.power * 1e3), 'mW')
  for (const etaD of [0.2, 0.6]) line(`eta_d ${etaD}: slope`, sig(at('c4', { etaD }).laser.slope), 'mW/mA')
  for (const nm of [1310, 850]) line(`${nm} nm: slope`, sig(at('c4', { lambda: nm * 1e-9 }).laser.slope), 'mW/mA')
}

head('C5 · Threshold moves with the mirrors')
{
  const d = at('c5')
  line('facet reflectance of an index 3.5 chip', sig(d.p.r, 8), '')
  line('mirror loss', sig(d.cavity.mirrorPerCm), 'per cm')
  line('photon lifetime', sig(d.cavity.tauP * 1e12), 'ps')
  line('threshold current', sig(d.ith * 1e3), 'mA')
  line('free spectral range of the same chip', sig(d.cavity.fsr / 1e9), 'GHz')
  for (const r of [0.1, 0.5, 0.9]) {
    const y = at('c5', { r })
    line(`R = ${r}: mirror loss`, sig(y.cavity.mirrorPerCm), 'per cm')
    line(`R = ${r}: photon lifetime`, sig(y.cavity.tauP * 1e12), 'ps')
    line(`R = ${r}: threshold current`, sig(y.ith * 1e3), 'mA')
  }
  for (const um of [300, 500]) {
    const y = at('c5', { cavityLength: um * 1e-6 })
    line(`L = ${um} um: photon lifetime`, sig(y.cavity.tauP * 1e12), 'ps')
    line(`L = ${um} um: threshold current`, sig(y.ith * 1e3), 'mA')
    line(`L = ${um} um: free spectral range`, sig(y.cavity.fsr / 1e9), 'GHz')
  }
}

// ------------------------------------------------------------------- Group D

head('D1 · Two equations, and what each term is')
{
  const d = at('d1')
  line('drive current', sig(d.current * 1e3), 'mA')
  line('threshold current', sig(d.ith * 1e3), 'mA')
  line('carrier density', d.n.toExponential(5), 'per m3')
  line('photon density', d.s.toExponential(5), 'per m3')
  for (const t of d.carriers) line(`  carriers: ${t.name}`, t.value.toExponential(5), 'per m3 s')
  line('  carriers: the sum', d.carrierSum.toExponential(3), `(floor ${d.carrierFloor.toExponential(3)})`)
  for (const t of d.photons) line(`  photons: ${t.name}`, t.value.toExponential(5), 'per m3 s')
  line('  photons: the sum', d.photonSum.toExponential(3), `(floor ${d.photonFloor.toExponential(3)})`)
  const half = at('d1', { current: 0.5 * d.ith })
  line('at half threshold: carrier density', half.n.toExponential(5), 'per m3')
  line('at half threshold: photon density', half.s.toExponential(5), 'per m3')
}

head('D2 · The steady state, exactly')
{
  const d = at('d2')
  line('threshold density', d.nth.toExponential(5), 'per m3')
  line('threshold current', sig(d.ith * 1e3), 'mA')
  line('photon density at twice threshold', d.s.toExponential(5), 'per m3')
  for (const k of [0.5, 1.5, 3]) {
    const y = at('d2', { current: k * d.ith })
    line(`${k} I_th: carrier density`, y.n.toExponential(5), 'per m3')
    line(`${k} I_th: photon density`, y.s.toExponential(5), 'per m3')
  }
  for (const gamma of [0.2, 0.5]) line(`Gamma ${gamma}: threshold current`, sig(at('d2', { gamma }).ith * 1e3), 'mA')
  for (const ntr of [5e23, 2e24]) line(`N_tr ${ntr.toExponential(1)}: threshold current`, sig(at('d2', { ntr }).ith * 1e3), 'mA')
  line('beta 1e-4 at half threshold: photon density', at('d2', { current: 0.5 * d.ith, beta: 1e-4 }).s.toExponential(5), 'per m3')
}

head('D3 · The relaxation oscillation')
{
  const d = at('d3')
  line('relaxation frequency at twice threshold', sig(d.sm.fr / 1e9), 'GHz')
  line('the textbook form there', sig(d.sm.frText / 1e9), 'GHz')
  line('exact over textbook', sig(d.textFactor), '')
  line('damping', sig(d.sm.gamma / 1e9), 'per ns')
  line('damping ratio', sig(d.sm.zeta), '')
  line('peak height', sig(d.sm.peakDb), 'dB')
  line('peak at', sig(d.sm.peakHz / 1e9), 'GHz')
  line('modulation bandwidth', sig(d.sm.f3db / 1e9), 'GHz')
  for (const k of [1.5, 3, 5]) {
    const y = at('d3', { current: k * d.ith })
    line(`${k} I_th: relaxation frequency`, sig(y.sm.fr / 1e9), 'GHz')
    line(`${k} I_th: damping ratio`, sig(y.sm.zeta), '')
    line(`${k} I_th: peak height`, sig(y.sm.peakDb), 'dB')
    line(`${k} I_th: modulation bandwidth`, sig(y.sm.f3db / 1e9), 'GHz')
  }
}

head('D4 · Where the linearisation stops')
{
  const d = at('d4')
  for (const depth of [0.01, 0.05, 0.1, 0.3, 0.6]) {
    const y = at('d4', { depth })
    line(`depth ${100 * depth} per cent: error`, sig(100 * y.guard.error), 'per cent')
    line(`  drawn`, y.guard.declined ? 'no' : y.guard.ok ? 'yes, unflagged' : 'yes, as an estimate', '')
  }
  line('warn threshold', sig(100 * d.guard.warn), 'per cent')
  line('decline threshold', sig(100 * d.guard.decline), 'per cent')
  line('overshoot predicted at 5 per cent', d.guard.predicted.toExponential(5), 'per m3')
  line('overshoot measured at 5 per cent', d.guard.measured.toExponential(5), 'per m3')
}

// ---------------------------------------------------------------- the totals

head('The set')
line('experiments', EXPERIMENTS.length, '')
for (const g of [...new Set(EXPERIMENTS.map((e) => e.group))]) {
  line(`  ${g}`, EXPERIMENTS.filter((e) => e.group === g).length, '')
}
