// Every number the brief, the plan and the lessons quote, computed from the
// engine before it is written.
//
//   node apps/rf-lab/scripts/pins.mjs
//
// `PROGRAM.md` §3 requires that a quoted number is computed by a script before
// it reaches a document. This is that script. One labelled line per figure, in
// the order the groups use them, so a figure in a note can be found here and
// re-run. Nothing below is typed in except the knob settings, which are the
// defaults the experiments carry.

import * as R from '@ee-labs/rf'

const line = (label, value, unit = '') => console.log(`${label.padEnd(52)} ${value}${unit ? ' ' + unit : ''}`)
const sig = (x, n = 6) => (Number.isFinite(x) ? Number(x).toPrecision(n) : String(x))
const head = (t) => console.log(`\n--- ${t} ---`)
const rect = (z) => (z === Infinity ? 'open' : `${sig(z[0], 6)} ${z[1] < 0 ? '-' : '+'} j${sig(Math.abs(z[1]), 6)}`)

const Z0 = 50
const EPSR = 2.1
const F0 = 1e9
const VP = R.phaseVelocity(EPSR)
const QUARTER = VP / (4 * F0)

head('The reference, and the line the lab turns knobs on')
line('reference impedance Z0', sig(Z0), 'ohm')
line('PTFE dielectric constant', sig(EPSR, 2))
line('phase velocity vp', sig(VP), 'm/s')
line('  as a fraction of c', sig((100 * VP) / R.C0, 6), '%')
line('wavelength at 1.000 GHz', sig(VP / F0), 'm')
line('  a quarter of it', sig(QUARTER), 'm')
line('wavelength at 2.400 GHz', sig(VP / 2.4e9), 'm')

head('A1: the reflection coefficient')
for (const ZL of [100, 25, 50, [30, -40], [30, 40]]) {
  const m = R.mismatch(ZL, Z0)
  line(`  load ${Array.isArray(ZL) ? rect(ZL) : ZL} ohm, gamma`, `${rect(m.gamma)}  |G| ${sig(m.mag)}  ang ${sig(m.deg)} deg`)
}

head('A2: VSWR, return loss, mismatch loss')
for (const ZL of [100, 25, [30, -40], 200]) {
  const m = R.mismatch(ZL, Z0)
  line(`  load ${Array.isArray(ZL) ? rect(ZL) : ZL} ohm`, `VSWR ${sig(m.vswr)}  RL ${sig(m.returnLossDb)} dB  ML ${sig(m.mismatchLossDb)} dB  accepted ${sig(100 * m.powerAccepted, 5)} %`)
}

head('A3: the line transforms impedance')
const lossless = R.uniformLine({ Z0, epsr: EPSR, len: QUARTER, alpha: 0 })
for (const f of [0.5e9, 1e9, 1.5e9, 2e9, 3e9]) {
  const zin = R.inputImpedance(lossless, 100, f)
  const g = R.reflection(zin.Z, Z0)
  const el = R.electricalLength(lossless, f)
  line(`  at ${sig(f / 1e9, 4)} GHz`, `Zin ${rect(zin.Z)} ohm   ${sig(el.degrees, 5)} deg   |G| ${sig(R.vswr(g) === Infinity ? 1 : Math.hypot(g[0], g[1]))}`)
}
line('quarter-wave transformer 50 to 100 ohm', sig(R.quarterWaveZ0(50, 100)), 'ohm')

head('A4: loss on the line')
const ALPHA = 0.05
line('alpha in nepers per metre', sig(ALPHA, 3), 'Np/m')
line('  as decibels per metre', sig(R.dbPerMetre(ALPHA), 4), 'dB/m')
const lossy = R.uniformLine({ Z0, epsr: EPSR, len: QUARTER, alpha: ALPHA })
const zinLossy = R.inputImpedance(lossy, 100, F0)
line('Zin of the lossy quarter wave at 1.000 GHz', rect(zinLossy.Z), 'ohm')
const gLoad = R.reflection(100, Z0)
const gIn = R.reflection(zinLossy.Z, Z0)
line('|gamma| at the load', sig(Math.hypot(gLoad[0], gLoad[1])))
line('|gamma| seen at the source', sig(Math.hypot(gIn[0], gIn[1])))
line('  the round trip is 2 alpha l nepers', sig(2 * ALPHA * QUARTER, 4), 'Np')
line('  which is', sig(R.dbPerMetre(2 * ALPHA * QUARTER), 4), 'dB')
line('one-way loss of the section', sig(R.dbPerMetre(ALPHA * QUARTER), 4), 'dB')

head('A5: why the line has no transfer function')
line('the response repeats every', sig(R.repeatFrequency(lossless, F0) / 1e9, 5), 'GHz')
line('  which is vp over twice the length', sig(VP / (2 * QUARTER) / 1e9, 5), 'GHz')
const sweep = R.sweepLine(lossless, 100, { from: 0.1e9, to: 4.1e9, points: 241, z0: Z0 })
line('exact points in the sweep', sweep.length)
line('  spacing between them', sig((4e9 / 240) / 1e6, 5), 'MHz')
// The periodicity, measured: the value at f and at f + repeat agree exactly.
let worst = 0
for (const f of [0.3e9, 0.7e9, 1.3e9, 1.9e9]) {
  const a = R.inputImpedance(lossless, 100, f).Z
  const b = R.inputImpedance(lossless, 100, f + R.repeatFrequency(lossless, F0)).Z
  worst = Math.max(worst, Math.hypot(a[0] - b[0], a[1] - b[1]) / Math.hypot(a[0], a[1]))
}
line('largest disagreement one repeat apart', worst.toExponential(3))
const lossyRepeat = R.repeatFrequency(lossy, F0)
line('the lossy line repeats every', sig(lossyRepeat / 1e9, 5), 'GHz')
line('the refusal, lossless', R.rationalAvailable(lossless, F0).ok ? 'ALLOWED' : 'declined')
line('the refusal, lossy', R.rationalAvailable(lossy, F0).ok ? 'ALLOWED' : 'declined')
line('the delay of the section', sig((QUARTER / VP) * 1e12, 5), 'ps')

head('B1: the chart is one map')
for (const [name, ZL] of [['open', Infinity], ['short', 0], ['match', 50], ['100 ohm', 100], ['25 ohm', 25], ['j50', [0, 50]], ['-j50', [0, -50]], ['30 - j40', [30, -40]], ['150 + j100', [150, 100]], ['12.5 ohm', 12.5]]) {
  const p = R.place(ZL, Z0)
  line(`  ${name}`, `z ${p.z === Infinity ? 'open' : rect(p.z)}   G ${rect(p.gamma)}   |G| ${sig(p.mag)}  ang ${sig(p.deg, 5)} deg`)
}

head('B2: circles from the map')
for (const r of [0, 0.5, 1, 2]) {
  const c = R.resistanceCircle(r)
  line(`  constant r = ${r}`, `centre (${sig(c.cx)}, ${sig(c.cy)})  radius ${sig(c.radius)}`)
}
for (const x of [0.5, 1, 2]) {
  const c = R.reactanceCircle(x)
  line(`  constant x = ${x}`, `centre (${sig(c.cx)}, ${sig(c.cy)})  radius ${sig(c.radius)}`)
}
for (const g of [1, 2]) {
  const c = R.conductanceCircle(g)
  line(`  constant g = ${g}`, `centre (${sig(c.cx)}, ${sig(c.cy)})  radius ${sig(c.radius)}`)
}

head('B3: motion along the line')
const gLoad3 = R.reflection(100, Z0)
const at1 = R.lineAt(lossless, F0)
line('VSWR circle radius for a 100 ohm load', sig(Math.hypot(gLoad3[0], gLoad3[1])))
line('beta at 1.000 GHz', sig(at1.beta, 6), 'rad/m')
line('the angle a quarter wave turns', sig((2 * at1.beta * QUARTER * 180) / Math.PI, 5), 'deg')
line('  per centimetre of line', sig((2 * at1.beta * 0.01 * 180) / Math.PI, 5), 'deg')
line('a half wave turns', sig((2 * at1.beta * 2 * QUARTER * 180) / Math.PI, 5), 'deg')
const spiralEnd = R.lineLocus(gLoad3, { beta: at1.beta, alpha: ALPHA, length: QUARTER, steps: 4 }).at(-1)
line('with alpha 0.05, |G| after a quarter wave', sig(Math.hypot(spiralEnd[0], spiralEnd[1])))

head('B4: the admittance chart')
const p4 = R.place(100, Z0)
line('z of a 100 ohm load', rect(p4.z))
line('  its y', rect(R.gammaToZ([-p4.gamma[0], -p4.gamma[1]])))
line('  gamma on the impedance chart', rect(p4.gamma))
line('  gamma on the admittance chart', rect([-p4.gamma[0], -p4.gamma[1]]))
const gc = R.conductanceCircle(0.5)
line('the g = 0.5 circle', `centre (${sig(gc.cx)}, ${sig(gc.cy)})  radius ${sig(gc.radius)}`)
for (const b of [0, 0.5, 1]) {
  const y = [0.5, b]
  // The admittance chart is the impedance chart turned half a turn, so the
  // point on the impedance chart is minus the point the admittance makes.
  const gammaY = R.zToGamma(y)
  const gammaZ = [-gammaY[0], -gammaY[1]]
  line(`  shunt b = ${b}`, `y ${rect(y)}   G ${rect(gammaZ)}   off the circle by ${R.circleError(gc, gammaZ).toExponential(2)}`)
}

head('The two-port pins the brief carries forward')
const K = Math.pow(10, 3 / 20)
const RSER = (Z0 * (K * K - 1)) / (2 * K)
const RSH = (Z0 * (K + 1)) / (K - 1)
line('3.000 dB pi pad, series resistor', sig(RSER), 'ohm')
line('  its two shunt resistors', sig(RSH), 'ohm')
const pad = {
  elements: [
    { type: 'R', id: 'Rsh1', nodes: ['p1', 'gnd'], value: RSH },
    { type: 'R', id: 'Rser', nodes: ['p1', 'p2'], value: RSER },
    { type: 'R', id: 'Rsh2', nodes: ['p2', 'gnd'], value: RSH },
  ],
}
const sp = R.sFromNetlist(pad, ['p1', 'p2'], F0, { z0: Z0 })
line('  S11', `${R.entryOf(sp, 0, 0).mag.toExponential(3)}`)
line('  S21', `${sig(R.entryOf(sp, 1, 0).mag)}  which is ${sig(R.entryOf(sp, 1, 0).db, 5)} dB`)
const two = R.cascadeS(sp, sp)
line('  two of them in cascade, S21', `${sig(R.entryOf(two, 1, 0).db, 5)} dB, S11 ${R.entryOf(two, 0, 0).mag.toExponential(3)}`)
const qw = R.uniformLine({ Z0: R.quarterWaveZ0(50, 100), epsr: EPSR, len: R.phaseVelocity(EPSR) / (4 * F0) })
const qwS = R.lineSparam(qw, F0, { z0: Z0 })
line('quarter-wave 70.711 ohm line, |S11|', sig(R.entryOf(qwS, 0, 0).mag))
line('  |S21|', sig(R.entryOf(qwS, 1, 0).mag))
line('  |S11| squared plus |S21| squared', sig(R.entryOf(qwS, 0, 0).mag ** 2 + R.entryOf(qwS, 1, 0).mag ** 2, 13))
