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

head('C1 and C2: the L network in closed form')
for (const [RS, ZL] of [[50, 100], [5, 50], [50, 5], [50, [30, -40]]]) {
  const m = R.lMatch({ RS, ZL, f: F0 })
  line(`  ${RS} ohm to ${Array.isArray(ZL) ? rect(ZL) : ZL} ohm, Q`, sig(m.Q))
  for (const sol of m.solutions) {
    if (!sol.ok) {
      line(`    ${sol.id.padEnd(18)}`, 'no solution in this orientation')
      continue
    }
    const parts = sol.elements.map((el) => `${el.place} ${el.kind} ${sig(el.value)} ${el.kind === 'L' ? 'H' : 'F'} (X ${sig(el.X, 5)})`).join(', ')
    line(`    ${sol.id.padEnd(18)}`, `${parts}   |G| ${R.matchMag(sol, ZL, RS, F0).toExponential(2)}   at 2f0 ${sig(R.matchMag(sol, ZL, RS, 2 * F0), 5)}`)
  }
}

head('C3: bandwidth is the price')
for (const [RS, ZL, target] of [[50, 100, 1.5], [5, 50, 1.5], [50, 100, 2], [50, 100, 1.2222]]) {
  const sol = R.lMatch({ RS, ZL, f: F0 }).chosen
  const bw = R.matchBandwidth(sol, ZL, RS, F0, { vswr: target })
  line(`  ${RS} to ${ZL} ohm, to VSWR ${target}`, bw.bounded ? `${sig(bw.lower / 1e9, 5)} to ${sig(bw.upper / 1e9, 5)} GHz, ${sig(100 * bw.fractional, 5)} %` : 'no lower edge')
}
for (const f of [0.9e9, 1.5e9, 2e9]) {
  const sol = R.lMatch({ RS: 50, ZL: 100, f: F0 }).chosen
  line(`  50 to 100 ohm, VSWR at ${sig(f / 1e9, 4)} GHz`, sig(R.matchAt(sol, 100, 50, f).vswr, 5))
}
line('one over Q, for Q = 1', sig(R.loadedQBandwidth(1), 5))
line('one over Q, for Q = 3', sig(R.loadedQBandwidth(3), 5))

head('C4: the quarter-wave transformer')
const qwc = R.quarterWaveMatch({ RS: 50, RL: 100, f0: F0, epsr: EPSR })
line('its impedance', sig(qwc.Z0), 'ohm')
line('its length', sig(qwc.len), 'm')
for (const target of [1.2222, 1.5, 2]) {
  const bw = R.bandwidthOf(qwc.read, F0, { vswr: target, span: 1.99 })
  const lump = R.matchBandwidth(R.lMatch({ RS: 50, ZL: 100, f: F0 }).chosen, 100, 50, F0, { vswr: target })
  line(`  to VSWR ${target}, the section`, `${sig(100 * bw.fractional, 5)} %   the L network ${lump.bounded ? sig(100 * lump.fractional, 5) + ' %' : 'no lower edge'}`)
}
line('it matches again at', R.quarterWaveRepeats(F0, 5.5e9).map((f) => `${sig(f / 1e9, 3)} GHz`).join(', '))
line('the response repeats every', sig(R.repeatFrequency(qwc.line, F0) / 1e9, 5), 'GHz')
for (const f of [0.5e9, 2e9, 3e9]) line(`  VSWR at ${sig(f / 1e9, 4)} GHz`, sig(qwc.at(f).vswr, 5))

head('C5: a complex load, cancelled then transformed')
const c5 = R.lMatch({ RS: 50, ZL: [30, -40], f: F0 })
line('the load reactance', sig(c5.X, 5), 'ohm')
line('  cancelled by', `${sig(c5.cancel.X, 5)} ohm in series, which is ${sig(c5.cancel.value)} H`)
line('the residue', `${sig(c5.R, 5)} ohm against ${sig(c5.RS, 5)} ohm, Q ${sig(c5.Q)}`)
line('the series element after folding', `${sig(c5.chosen.elements.find((e) => e.place === 'series').X, 5)} ohm`)
line('elements in the network', c5.chosen.elements.length)
line('|gamma| after both moves', c5.at.mag.toExponential(2))

head('D1: what a wave is')
for (const ZL of [100, 25, [30, -40]]) {
  const closed = R.reflection(ZL, Z0)
  const net = Array.isArray(ZL)
    ? { elements: [{ type: 'R', id: 'RL', nodes: ['p1', 'nx'], value: ZL[0] }, { type: 'C', id: 'XL', nodes: ['nx', 'gnd'], value: 1 / (2 * Math.PI * F0 * -ZL[1]) }] }
    : { elements: [{ type: 'R', id: 'RL', nodes: ['p1', 'gnd'], value: ZL }] }
  const solved = R.s11FromNetlist(net, 'p1', F0, { z0: Z0 })
  line(`  ${Array.isArray(ZL) ? rect(ZL) : ZL} ohm`, `closed ${rect(closed)}   solved ${rect(solved)}   apart by ${(Math.hypot(solved[0] - closed[0], solved[1] - closed[1]) / Math.hypot(closed[0], closed[1])).toExponential(2)}`)
}
line('the incident wave with 1 V through 50 ohm', sig(1 / (2 * Math.sqrt(Z0))))

head('D2 and D4: the pi attenuator, and chains of it')
for (const db of [1, 3, 6, 10, 20]) {
  const K = Math.pow(10, db / 20)
  const ser = (Z0 * (K * K - 1)) / (2 * K)
  const sh = (Z0 * (K + 1)) / (K - 1)
  const net = {
    elements: [
      { type: 'R', id: 'Rsh1', nodes: ['p1', 'gnd'], value: sh },
      { type: 'R', id: 'Rser', nodes: ['p1', 'p2'], value: ser },
      { type: 'R', id: 'Rsh2', nodes: ['p2', 'gnd'], value: sh },
    ],
  }
  const sp = R.sFromNetlist(net, ['p1', 'p2'], F0, { z0: Z0 })
  line(`  ${db} dB pad`, `series ${sig(ser)} ohm  shunt ${sig(sh)} ohm  S11 ${R.entryOf(sp, 0, 0).mag.toExponential(2)}  S21 ${sig(R.entryOf(sp, 1, 0).mag)} = ${sig(R.entryOf(sp, 1, 0).db, 5)} dB`)
  if (db === 3) {
    for (const n of [2, 3, 4]) {
      const chain = R.chainS(Array.from({ length: n }, () => sp))
      line(`    ${n} of them`, `S21 ${sig(R.entryOf(chain, 1, 0).db, 5)} dB  S11 ${R.entryOf(chain, 0, 0).mag.toExponential(2)}`)
    }
  }
}

head('D3: the descriptions a two-port has')
const padSp = (() => {
  const K = Math.pow(10, 3 / 20)
  const ser = (Z0 * (K * K - 1)) / (2 * K)
  const sh = (Z0 * (K + 1)) / (K - 1)
  return R.sFromNetlist(
    { elements: [{ type: 'R', id: 'a', nodes: ['p1', 'gnd'], value: sh }, { type: 'R', id: 'b', nodes: ['p1', 'p2'], value: ser }, { type: 'R', id: 'c', nodes: ['p2', 'gnd'], value: sh }] },
    ['p1', 'p2'],
    F0,
    { z0: Z0 },
  )
})()
const trafo = R.abcdToSparam(R.transformerAbcd(2), { f: F0, z0: Z0 })
const blocked = R.sFromNetlist({ elements: [{ type: 'R', id: 'a', nodes: ['p1', 'gnd'], value: Z0 }, { type: 'R', id: 'b', nodes: ['p2', 'gnd'], value: Z0 }] }, ['p1', 'p2'], F0, { z0: Z0 })
for (const [name, sp] of [['the pi pad', padSp], ['an ideal transformer, ratio 2', trafo], ['two resistors, no path', blocked]]) {
  const have = []
  for (const [what, fn] of [['Z', () => R.sToZ(sp.s, Z0)], ['Y', () => R.sToY(sp.s, Z0)], ['ABCD', () => R.sToAbcd(sp.s, Z0)]]) {
    try {
      fn()
      have.push(what)
    } catch {
      /* the description does not exist, which is the reading */
    }
  }
  line(`  ${name}`, `S11 ${sig(R.entryOf(sp, 0, 0).mag, 5)}  S21 ${sig(R.entryOf(sp, 1, 0).mag, 5)}  has S, ${have.join(', ') || 'and nothing else'}`)
}
const back = R.abcdToS(R.sToAbcd(R.zToS(R.sToZ(padSp.s, Z0), Z0), Z0), Z0)
line('  the pad round-tripped S to Z to ABCD to S', R.mdiff(back, padSp.s).toExponential(2))

head('D4: the quarter-wave section as a two-port')
const sect = R.uniformLine({ Z0: R.quarterWaveZ0(Z0, 100), epsr: EPSR, len: R.phaseVelocity(EPSR) / (4 * F0) })
const sectS = R.lineSparam(sect, F0, { z0: Z0 })
const halves = [0, 1].map(() => R.lineSparam(sect, F0, { z0: Z0, atLength: sect.len / 2 }))
const joined = R.chainS(halves)
line('  |S11|', sig(R.entryOf(sectS, 0, 0).mag))
line('  |S21|', sig(R.entryOf(sectS, 1, 0).mag))
line('  the two squares', sig(R.entryOf(sectS, 0, 0).mag ** 2 + R.entryOf(sectS, 1, 0).mag ** 2, 13))
line('  two halves cascaded, against the whole', R.sDiff(joined, sectS).toExponential(2))

head('D5: reciprocity and loss')
const Lh = 8e-9
const Cf = 1.6e-12
for (const Rs of [0, 1, 5, 25]) {
  const els = [
    ...(Rs > 0 ? [{ type: 'R', id: 'Rs', nodes: ['p1', 'nm'], value: Rs }] : []),
    { type: 'L', id: 'L1', nodes: [Rs > 0 ? 'nm' : 'p1', 'p2'], value: Lh },
    { type: 'C', id: 'C1', nodes: ['p2', 'gnd'], value: Cf },
  ]
  const sp = R.sFromNetlist({ elements: els }, ['p1', 'p2'], F0, { z0: Z0 })
  line(
    `  R_s ${Rs} ohm`,
    `|S11| ${sig(R.entryOf(sp, 0, 0).mag)}  |S21| ${sig(R.entryOf(sp, 1, 0).mag)}  sum ${sig(R.entryOf(sp, 0, 0).mag ** 2 + R.entryOf(sp, 1, 0).mag ** 2, 12)}  dissipated ${sig(R.dissipated(sp), 5)}  S12−S21 ${R.reciprocityError(sp).toExponential(2)}  S†S−I ${R.unitarityError(sp).toExponential(2)}`,
  )
}
