// Every number the brief, the plan and the lessons quote, computed from the
// engine.
//
//   node apps/rf-lab/scripts/pins.mjs
//
// `PROGRAM.md` §3 requires that every quoted number is computed by a script
// before it is written. This is that script for the RF Lab. It prints one
// labelled line per figure, in the order the curriculum uses them, so a figure
// in the brief can be found here and re-run.
//
// Nothing below is typed in except the settings, which are the same defaults
// the experiments carry: a 50 ohm reference, PTFE at a relative permittivity of
// 2.1, and the loads Group A turns. Every length, every angle and every decibel
// figure is derived from those.

import { C0 } from '@ee-labs/fields'
import {
  describeLine,
  inputImpedance,
  lineAt,
  lineTwoPort,
  markerAt,
  mismatch,
  pathTowardsGenerator,
  qArc,
  rationalAvailable,
  reactanceCircle,
  reflection,
  resistanceCircle,
  sweepLine,
  turnDegrees,
  vswrCircle,
  zToGamma,
  gammaToZ,
  gammaOfY,
} from '@ee-labs/rf'

const line = (label, value, unit = '') => console.log(`${label.padEnd(50)} ${value}${unit ? ' ' + unit : ''}`)
const sig = (x, n = 5) => (Number.isFinite(x) ? Number(x).toPrecision(n) : String(x))
const head = (t) => console.log(`\n--- ${t} ---`)

const Z0 = 50
const EPSR = 2.1
const VP = C0 / Math.sqrt(EPSR)
const F0 = 1e9
const QUARTER = VP / F0 / 4
const ptfe = (len, alpha = 0) => {
  const base = describeLine({ Z0, vp: VP, len })
  return alpha === 0 ? base : describeLine({ L: base.L, C: base.C, R: 2 * alpha * base.Z0, G: 0, len })
}

head('The reference, and the medium')
line('reference impedance', Z0, 'ohm')
line('relative permittivity of the dielectric', EPSR)
line('phase velocity', sig(VP, 5), 'm/s')
line('  as a fraction of c', sig((100 * VP) / C0, 5), 'per cent')
line('wavelength at 1.000 GHz', sig(100 * (VP / F0), 5), 'cm')
line('  a quarter of it', sig(100 * QUARTER, 5), 'cm')
line('wavelength at 2.400 GHz', sig(100 * (VP / 2.4e9), 5), 'cm')

head('A1: the reflection coefficient')
for (const R of [25, 50, 75, 100, 200]) {
  const g = reflection(R, Z0)
  line(`  ${R} ohm load, gamma`, sig(g[0], 5))
}
line('  a 100 ohm load and a 25 ohm load differ by', sig(reflection(100, Z0)[0] + reflection(25, Z0)[0], 2), '(the sum)')

head('A2: VSWR, return loss and mismatch loss')
for (const ZL of [[100, 0], [25, 0], [30, -40], [50, 50]]) {
  const m = mismatch(reflection(ZL, Z0))
  line(`  ${ZL[0]} ${ZL[1] < 0 ? '-' : '+'} j${Math.abs(ZL[1])} ohm: |gamma|`, sig(m.mag, 5))
  line('    VSWR', sig(m.vswr, 5))
  line('    return loss', sig(m.returnLossDb, 5), 'dB')
  line('    mismatch loss', sig(m.mismatchLossDb, 5), 'dB')
}

head('A3: the line transforms impedance')
for (const f of [0.5e9, 0.75e9, 1e9, 1.5e9, 2e9]) {
  const zin = inputImpedance(ptfe(QUARTER), [100, 0], f).Z
  line(`  a quarter wave at 1 GHz, read at ${(f / 1e9).toFixed(3)} GHz`, `${sig(zin[0], 5)} ${zin[1] < 0 ? '-' : '+'} j${sig(Math.abs(zin[1]), 5)}`, 'ohm')
  line('    |gamma| there', sig(mismatch(reflection(zin, Z0)).mag, 5))
}
line('electrical length at 1.000 GHz', sig(lineAt(ptfe(QUARTER), F0).electricalDeg, 5), 'degrees')

head('A4: loss on the line')
const ALPHA = 0.05
line('attenuation', ALPHA, 'Np/m')
line('  in decibels', sig(ALPHA * 8.685889638065035, 5), 'dB/m')
line('  over the quarter wave', sig(ALPHA * QUARTER * 8.685889638065035, 5), 'dB')
const lossy = inputImpedance(ptfe(QUARTER, ALPHA), [100, 0], F0).Z
line('  the quarter wave now reads', `${sig(lossy[0], 5)} ${lossy[1] < 0 ? '-' : '+'} j${sig(Math.abs(lossy[1]), 3)}`, 'ohm')
line('  |gamma| at the load', sig(mismatch(reflection(100, Z0)).mag, 5))
line('  |gamma| at the source', sig(mismatch(reflection(lossy, Z0)).mag, 5))
line('  the round trip costs', sig(2 * ALPHA * QUARTER * 8.685889638065035, 5), 'dB')

head('A5: the sweep is exact, and the hand-over is declined')
const sweep = sweepLine(ptfe(QUARTER), [100, 0], { from: 0.5e9, to: 2e9, points: 241 })
line('points in the sweep', sweep.points)
line('  |gamma| at the first point', sig(mismatch(sweep.gamma[0]).mag, 5))
line('  |gamma| at the last point', sig(mismatch(sweep.gamma[240]).mag, 5))
line('  the spread across all 241', sig(Math.max(...[...sweep.gamma].map((g) => mismatch(g).mag)) - Math.min(...[...sweep.gamma].map((g) => mismatch(g).mag)), 3))
const said = rationalAvailable(ptfe(QUARTER))
line('  the hand-over to systems', said.ok ? 'available' : 'declined')
line('  the message is', `${said.says.length} characters`)

head('B1: the chart is one map')
for (const z of [[0, 0], [1, 0], [2, 0], [0.5, 0], [1, 1], [0, 1], [0, -1], [0.6, -0.8]]) {
  const g = zToGamma(z)
  line(`  z = ${z[0]} ${z[1] < 0 ? '-' : '+'} j${Math.abs(z[1])}`, `gamma = ${sig(g[0], 5)} ${g[1] < 0 ? '-' : '+'} j${sig(Math.abs(g[1]), 5)}`)
}
line('  an open circuit', `gamma = ${zToGamma(Infinity)[0]}`)

head('B2: circles from the map')
for (const r of [0, 0.5, 1, 2]) {
  const c = resistanceCircle(r)
  line(`  r = ${r}`, `centre (${sig(c.cx, 5)}, ${sig(c.cy, 1)}) radius ${sig(c.radius, 5)}`)
}
for (const x of [0.5, 1, 2]) {
  const c = reactanceCircle(x)
  line(`  x = ${x}`, `centre (${sig(c.cx, 1)}, ${sig(c.cy, 5)}) radius ${sig(c.radius, 5)}`)
}
line('  the VSWR 2 circle radius', sig(vswrCircle(2).radius, 5))
line('  the VSWR 3 circle radius', sig(vswrCircle(3).radius, 5))
line('  the Q = 1 arc', `centre (0, ${sig(qArc(1).cy, 5)}) radius ${sig(qArc(1).radius, 5)}`)

head('B3: motion along the line')
const at1 = lineAt(ptfe(QUARTER), F0)
line('phase constant at 1.000 GHz', sig(at1.beta, 5), 'rad/m')
line('  the turn per metre', sig((2 * at1.beta * 180) / Math.PI, 5), 'degrees')
line('  a quarter wave turns', sig(turnDegrees(at1.beta, QUARTER), 5), 'degrees')
line('  a half wave turns', sig(turnDegrees(at1.beta, 2 * QUARTER), 5), 'degrees')
const gl = zToGamma([2, 0])
const path = pathTowardsGenerator(gl, { beta: at1.beta, length: QUARTER, points: 3 })
line('  the VSWR circle radius', sig(Math.hypot(gl[0], gl[1]), 5))
line('  100 ohms after a quarter wave', sig(gammaToZ(path[2])[0] * Z0, 5), 'ohm')
const spiral = pathTowardsGenerator(gl, { beta: at1.beta, length: QUARTER, alpha: ALPHA, points: 3 })
line('  with loss, the magnitude falls to', sig(Math.hypot(spiral[2][0], spiral[2][1]), 5))

head('B4: the admittance chart')
const m100 = markerAt([100, 0], Z0)
line('a 100 ohm load: z', sig(m100.z[0], 5))
line('  y', sig(m100.y[0], 5))
line('  gamma on the impedance chart', sig(m100.gamma[0], 5))
line('  gamma on the admittance chart', sig(m100.gammaY[0], 5))
const mC = markerAt([30, -40], Z0)
line('a 30 - j40 ohm load: y', `${sig(mC.y[0], 5)} + j${sig(mC.y[1], 5)}`)
line('  its Q', sig(mC.q, 5))
line('  the two charts are the same point turned round', sig(Math.hypot(...gammaOfY(mC.gamma)) - mC.mag, 2))

head('The two-port the chart is drawn beside')
const rec = lineTwoPort(ptfe(QUARTER), F0, { z0: Z0 })
line('a quarter wave of 50 ohm line in 50 ohms, |S21|', sig(Math.hypot(...rec.s[1][0]), 5))
line('  |S11|', sig(Math.hypot(...rec.s[0][0]), 2))
