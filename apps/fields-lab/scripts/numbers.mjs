// Every number the plan and the lessons quote, computed from the engine.
//
//   node apps/fields-lab/scripts/numbers.mjs
//
// PROGRAM.md §3 requires that every quoted number in a plan is computed by a
// script before it is written. This is that script. It prints one labelled line
// per figure, in the order the plan uses them, so a figure in the plan can be
// found here and re-run. Nothing below is typed in except the geometry and the
// settings, which are the same defaults the experiments carry.

import * as F from '@ee-labs/fields'

const line = (label, value, unit = '') => console.log(`${label.padEnd(46)} ${value}${unit ? ' ' + unit : ''}`)
const sig = (x, n = 4) => (Number.isFinite(x) ? Number(x).toPrecision(n) : String(x))
const head = (t) => console.log(`\n--- ${t} ---`)

head('Group A: charges, fields, potential')
line('Coulomb, 1 nC and 1 nC at 10 mm', sig(F.coulombForce(1e-9, 1e-9, 0.01)), 'N')
line('field of 1 nC at 10 mm', sig(F.pointChargeField([{ q: 1e-9, at: [0, 0, 0] }], [0.01, 0, 0])[0]), 'V/m')
line('potential of 1 nC at 10 mm', sig(F.pointChargePotential([{ q: 1e-9, at: [0, 0, 0] }], [0.01, 0, 0])), 'V')
const dipoleCharges = [{ q: 1e-9, at: [-0.005, 0, 0] }, { q: -1e-9, at: [0.005, 0, 0] }]
line('two opposite 1 nC, 10 mm apart, midpoint E', sig(F.pointChargeField(dipoleCharges, [0, 0.001, 0])[0]), 'V/m')
const gauss = F.gaussFlux((p) => F.pointChargeField([{ q: 2e-9, at: [0.002, 0.001, 0] }], p), { r: 0.05, charges: [{ q: 2e-9, at: [0.002, 0.001, 0] }] })
line('Gauss flux of an off-centre 2 nC, r = 50 mm', sig(gauss.impliedCharge / 1e-9), 'nC implied')
line('  its relative error against the charge', gauss.error.toExponential(2))
const ring = F.ringCharges(0.02, 5e-9, 720)
line('ring 20 mm, 5 nC, E on axis at 30 mm', sig(F.pointChargeField(ring, [0, 0, 0.03])[2]), 'V/m')
line('  the same by closed form', sig(F.ringOnAxis(0.02, 5e-9, 0.03)), 'V/m')
line('line charge 1 nC/m at 10 mm', sig(F.lineChargeField(1e-9, 0.01)), 'V/m')
line('sheet charge 1 nC/m2', sig(F.sheetChargeField(1e-9)), 'V/m')

head('Group B: capacitance in closed form')
const plate = { kind: 'parallelPlate', area: 1e-4, gap: 1e-3, epsr: 1 }
line('parallel plate 100 mm2, 1 mm, air', sig(F.capacitance(plate).value * 1e12), 'pF')
line('  the same with epsr 3.9', sig(F.capacitance({ ...plate, epsr: 3.9 }).value * 1e12), 'pF')
line('  field at 10 V', sig(F.peakField(plate, 10)), 'V/m')
const coax = { kind: 'coax', a: 0.45e-3, b: 1.475e-3, epsr: 2.25 }
line('RG-58 coax a 0.45 mm b 1.475 mm epsr 2.25', sig(F.capacitance(coax).perMetre * 1e12), 'pF/m')
line('  its inductance', sig(F.inductance(coax).perMetre * 1e9), 'nH/m')
line('  Z0 = sqrt(L/C)', sig(Math.sqrt(F.inductance(coax).perMetre / F.capacitance(coax).perMetre)), 'ohm')
line('  vp as a fraction of c', sig(1 / Math.sqrt(F.inductance(coax).perMetre * F.capacitance(coax).perMetre) / F.C0))
line('  peak field at 100 V', sig(F.peakField(coax, 100) / 1e6), 'MV/m')
const sph = { kind: 'spherical', a: 0.05, b: 0.06 }
line('spherical a 50 mm b 60 mm', sig(F.capacitance(sph).value * 1e12), 'pF')
line('  an isolated 50 mm sphere (b at 1 km)', sig(F.capacitance({ kind: 'spherical', a: 0.05, b: 1000 }).value * 1e12), 'pF')
const tw = { kind: 'twoWire', a: 0.4e-3, d: 6e-3, epsr: 1 }
line('two-wire a 0.4 mm d 6 mm', sig(F.capacitance(tw).perMetre * 1e12), 'pF/m')
line('  its inductance', sig(F.inductance(tw).perMetre * 1e9), 'nH/m')
line('  Z0', sig(Math.sqrt(F.inductance(tw).perMetre / F.capacitance(tw).perMetre)), 'ohm')
line('  the wide-spacing ln(d/a) form would give', sig(((Math.PI * F.EPS0) / Math.log(tw.d / tw.a)) * 1e12), 'pF/m')
const en = F.fieldEnergy(coax, 100)
line('energy in 1 m of that coax at 100 V', sig(en.W * 1e6), 'microjoule')
line('  its peak energy density', sig(en.density), 'J/m3')

head('Group C: Laplace on a grid')
const w = 0.1
const V0 = 100
const trough = (n) => ({ width: w, height: w, n, potential: (x, y) => (y >= w - 1e-12 ? V0 : null), outer: 0, tol: 1e-13, maxIter: 800000 })
const exactTrough = (x, y) => {
  let s = 0
  for (let k = 1; k < 400; k += 2) {
    const a = (k * Math.PI) / w
    s += (1 / k) * Math.sin(a * x) * Math.exp(a * (y - w)) * ((1 - Math.exp(-2 * a * y)) / (1 - Math.exp(-2 * a * w)))
  }
  return ((4 * V0) / Math.PI) * s
}
const tr = F.converge(trough, { n: 20, threshold: 1e-3, read: (s) => F.valueAt(s, 0.025, 0.075) })
line('trough at (25, 75) mm, series', sig(exactTrough(0.025, 0.075), 6), 'V')
line('  grid at 20, 40, 80 cells', tr.levels.map((l) => sig(l.value, 6)).join('  '))
line('  change on the last halving', `${sig(100 * tr.change, 3)} per cent`)
line('  observed order', sig(tr.order, 4))
line('  error band', `${sig(100 * tr.band, 3)} per cent`)
line('  true error against the series', `${sig((100 * Math.abs(tr.value - exactTrough(0.025, 0.075))) / exactTrough(0.025, 0.075), 3)} per cent`)
line('  centre of the trough, by symmetry', sig(F.valueAt(tr.solution, 0.05, 0.05), 8), 'V')

const B = 7e-3
const A = 2e-3
const sq = (n) => ({
  width: B / 2,
  height: B / 2,
  n,
  potential: (x, y) => (x <= A / 2 + 1e-15 && y <= A / 2 + 1e-15 ? 1 : null),
  neumann: { left: true, bottom: true },
  outer: 0,
  tol: 1e-13,
  maxIter: 800000,
})
const sqr = F.converge(sq, { n: 28, threshold: 1e-3, read: (s) => F.capacitancePerMetre(s, 1, { symmetry: 4 }) })
line('square coax 2 mm in 7 mm, C', `${sig(sqr.value * 1e12, 4)} pF/m`)
line('  change on the last halving', `${sig(100 * sqr.change, 3)} per cent`)
line('  guard verdict', sqr.ok ? 'inside the threshold' : 'past the threshold')
line('  staircase fraction', sig(sqr.staircase, 3))

const a2 = 1e-3
const b2 = 3.5e-3
const rc = (n) => ({
  width: b2,
  height: b2,
  n,
  potential: (x, y) => {
    const r = Math.hypot(x, y)
    return r <= a2 ? 1 : r >= b2 ? 0 : null
  },
  neumann: { left: true, bottom: true, right: true, top: true },
  tol: 1e-12,
  maxIter: 900000,
})
const rcr = F.converge(rc, { n: 60, threshold: 1e-2, read: (s) => F.capacitancePerMetre(s, 1, { symmetry: 4 }) })
const closedCoax = F.capacitance({ kind: 'coax', a: a2, b: b2 }).perMetre
line('round coax on a square mesh, C', `${sig(rcr.value * 1e12, 4)} pF/m`)
line('  the closed form', `${sig(closedCoax * 1e12, 4)} pF/m`)
line('  the error', `${sig((100 * Math.abs(rcr.value - closedCoax)) / closedCoax, 3)} per cent`)
line('  the band the guard defends', `${sig(100 * rcr.band, 3)} per cent`)
line('  boundary', rcr.boundary)
const solRc = rcr.solution
const nq = solRc.nx
const box = { i0: 0, j0: 0, i1: Math.round(nq * 0.45), j1: Math.round(nq * 0.45) }
line('Gauss on the grid: flux out of a box', sig(4 * F.fluxThrough(solRc, box) * 1e12, 4) + ' pC/m')
line('  the charge the closed form puts there', sig(closedCoax * 1 * 1e12, 4) + ' pC/m')

head('Group D: current, resistance, the four-point probe')
line('copper bar 1 m, 1 mm2', sig(F.barResistance({ rho: 1 / F.SIGMA_CU, length: 1, area: 1e-6 }) * 1000, 4), 'milliohm')
line('coax leakage at sigma 1e-12 S/m, 1 m', sig(F.resistance({ kind: 'coax', a: 0.45e-3, b: 1.475e-3 }, 1e-12).value / 1e9, 4), 'gigaohm')
line('RC product of that coax', sig(F.rcProduct(coax, 1e-12), 4), 's')
line('  C times R directly', sig(F.capacitance(coax).value * F.resistance(coax, 1e-12).value, 4), 's')
const probe = F.fourPointProbe({ spacing: 1e-3, voltage: 5e-3, current: 1e-3, thickness: 5e-3 })
line('four-point probe, block, 1 mm spacing', sig(probe.resistivity * 100, 4), 'ohm-cm')
const film = F.fourPointProbe({ spacing: 1e-3, voltage: 5e-3, current: 1e-3, thickness: 1e-6 })
line('the same reading on a 1 um film', sig(film.sheetResistance, 4), 'ohm per square')
line('  the ratio of the two answers', sig(probe.bulkResistivity / film.resistivity, 4))
line('  the sheet coefficient pi / ln 2', sig(Math.PI / Math.LN2, 6))

head('Group E: magnetostatics')
line('loop 50 mm, 3 A, B at the centre', sig(F.loopOnAxis(0.05, 3, 0) * 1e6, 4), 'microtesla')
const poly = F.biotSavart(F.circlePath(0.05, { sides: 720 }), 3, [0, 0, 0])
line('  the same by Biot-Savart on 720 sides', sig(poly[2] * 1e6, 6), 'microtesla')
line('  the polygon error', `${sig((100 * Math.abs(poly[2] - F.loopOnAxis(0.05, 3, 0))) / F.loopOnAxis(0.05, 3, 0), 3)} per cent`)
line('long wire, 10 A at 20 mm', sig(F.wireField(10, 0.02) * 1e6, 4), 'microtesla')
const sol = F.solenoidOnAxis(0.01, 0.2, 400, 2)
line('solenoid 400 turns, 200 mm, 10 mm, 2 A', sig(sol.B * 1000, 4), 'millitesla')
line('  as a fraction of the infinite value', sig(sol.fraction, 5))
line('coax inductance, internal on', sig(F.inductance(coax, { internal: true }).perMetre * 1e9, 4), 'nH/m')
line('  the internal part alone', sig((F.MU0 / (8 * Math.PI)) * 1e9, 4), 'nH/m')
const solL = F.inductance({ kind: 'solenoid', area: Math.PI * 0.01 ** 2, len: 0.2, turns: 400, mur: 1 })
line('that solenoid inductance', sig(solL.value * 1e6, 4), 'microhenry')
const mc = F.magneticCircuit({ meanLength: 0.2, area: 4e-4, mur: 2000, gap: 1e-3, turns: 200, current: 1 })
line('magnetic circuit, 1 mm gap, L', sig(mc.inductance * 1000, 4), 'mH')
line('  the gap takes this share of the mmf', `${sig(100 * mc.gapShare, 4)} per cent`)
line('  core flux density', sig(mc.Bcore, 4), 'T')
const mc0 = F.magneticCircuit({ meanLength: 0.2, area: 4e-4, mur: 2000, gap: 0, turns: 200, current: 1 })
line('  the same core with no gap, L', sig(mc0.inductance * 1000, 4), 'mH')
line('  the gap divides the inductance by', sig(mc0.inductance / mc.inductance, 4))
const tf = F.transformer({ meanLength: 0.2, area: 4e-4, mur: 2000, gap: 0, n1: 200, n2: 50, leakage: 0.02 })
line('transformer 200:50, 2 per cent leakage, L1', sig(tf.L1 * 1000, 4), 'mH')
line('  L2', sig(tf.L2 * 1000, 4), 'mH')
line('  M', sig(tf.M * 1000, 4), 'mH')
line('  k', sig(tf.k, 4))
line('  L1 L2 over M squared', sig((tf.L1 * tf.L2) / (tf.M * tf.M), 6))

head('Group F: induction')
const fe = F.faradayEmf({ turns: 200, area: 4e-4, Bpeak: 1.2, f: 50 })
line('200 turns, 400 mm2, 1.2 T, 50 Hz, emf', sig(fe.rms, 4), 'V rms')
line('  the 4.44 coefficient, exactly', sig(fe.coefficient, 6))
line('bar 250 mm at 3 m/s across 0.4 T', sig(F.motionalEmf({ B: 0.4, length: 0.25, speed: 3 }).emf, 4), 'V')
line('copper skin depth at 50 Hz', sig(F.skinDepth(50, { sigma: F.SIGMA_CU }) * 1000, 4), 'mm')
line('  at 1 kHz', sig(F.skinDepth(1e3, { sigma: F.SIGMA_CU }) * 1e6, 4), 'micrometre')
line('  at 1 MHz', sig(F.skinDepth(1e6, { sigma: F.SIGMA_CU }) * 1e6, 4), 'micrometre')
line('  at 1 GHz', sig(F.skinDepth(1e9, { sigma: F.SIGMA_CU }) * 1e9, 4), 'nm')
const wz = F.wireImpedance(1e-3, 1e6, { sigma: F.SIGMA_CU })
line('1 mm wire at 1 MHz, Rac over Rdc', sig(wz.ratio, 5))
const wh = F.wireHighFrequency(1e-3, 1e6, { sigma: F.SIGMA_CU })
line('  the tube formula is high by', `${sig(100 * wh.error, 3)} per cent`)
const whLow = F.wireHighFrequency(1e-3, 1e4, { sigma: F.SIGMA_CU })
line('  at 10 kHz it is wrong by', `${sig(100 * whLow.error, 3)} per cent`)
line('  and its guard says', whLow.guard.ok ? 'inside' : 'past the threshold')
const eddy = F.eddyLossSheet({ thickness: 0.35e-3, Bpeak: 1.2, f: 50, rho: 4.7e-7 })
line('eddy loss, 0.35 mm lamination at 50 Hz', sig(eddy.P / 1000, 4), 'kW/m3')
const eddy2 = F.eddyLossSheet({ thickness: 0.175e-3, Bpeak: 1.2, f: 50, rho: 4.7e-7 })
line('  halving the lamination gives', sig(eddy2.P / 1000, 4), 'kW/m3')
line('  the ratio of the two', sig(eddy.P / eddy2.P, 4))

head('Group G to H: Maxwell, the plane wave, reflection')
const pw = F.planeWave(1e9, { epsr: 1 })
line('free space eta', sig(pw.etaMag, 7), 'ohm')
line('  wavelength at 1 GHz', sig(pw.lambda * 1000, 4), 'mm')
const glass = F.planeWave(1e9, { epsr: 4 })
line('epsr 4: eta', sig(glass.etaMag, 5), 'ohm')
line('  wavelength', sig(glass.lambda * 1000, 4), 'mm')
line('  speed as a fraction of c', sig(glass.vp / F.C0, 4))
const swater = F.planeWave(1e6, { epsr: 81, sigma: 4 })
line('seawater at 1 MHz: loss tangent', sig(swater.lossTangent, 4))
line('  attenuation', sig(swater.alpha, 4), 'Np/m')
line('  penetration depth', sig(swater.penetration * 100, 4), 'cm')
line('  eta angle', sig(swater.etaDeg, 4), 'degrees')
const rn = F.reflectNormal(1e9, { epsr: 1 }, { epsr: 4 })
line('air into epsr 4: reflection', sig(rn.mag, 4))
line('  power reflected', `${sig(100 * rn.powerReflected, 4)} per cent`)
line('  the two power fractions sum to', sig(rn.powerReflected + rn.powerTransmitted, 12))
line('  standing wave ratio', sig(rn.swr, 4))
const brew = F.reflectOblique(63.43494882292201, { epsr: 1 }, { epsr: 4 }, 'parallel')
line('Brewster angle into epsr 4', sig(brew.brewsterDeg, 6), 'degrees')
line('  parallel reflection there', brew.mag.toExponential(2))
line('  perpendicular reflection there', sig(brew.perpendicular.mag, 4))
const tir = F.reflectOblique(45, { epsr: 4 }, { epsr: 1 }, 'perpendicular')
line('epsr 4 into air, critical angle', sig(tir.criticalDeg, 5), 'degrees')
line('  at 45 degrees, total reflection', String(tir.total))
line('  the magnitude there', sig(tir.mag, 6))
const circ = F.polarisation({ ax: 1, ay: 1, phaseDeg: 90 })
line('equal amplitudes, quarter cycle', `${circ.kind}, ${circ.sense}`)
const ell = F.polarisation({ ax: 1, ay: 0.5, phaseDeg: 90 })
line('two to one, quarter cycle: axial ratio', sig(ell.axialRatioDb, 4), 'dB')

head('Group I: transmission lines')
const rg = F.describeLine({ Z0: 50, vp: 2e8, len: 2 })
line('50 ohm line, vp 2e8, L per metre', sig(rg.L * 1e9, 4), 'nH/m')
line('  C per metre', sig(rg.C * 1e12, 4), 'pF/m')
line('  one-way delay of 2 m', sig(rg.delay * 1e9, 4), 'ns')
const geo = F.lineFromGeometry(coax, { len: 2 })
line('the same line from the coax geometry, Z0', sig(geo.Z0, 4), 'ohm')
line('  vp as a fraction of c', sig(geo.vp / F.C0, 6))
line('  1 / sqrt(epsr)', sig(1 / Math.sqrt(2.25), 6))
line('reflection into 100 ohm', sig(F.reflectionCoefficient(100, 50)[0], 4))
line('  into 25 ohm', sig(F.reflectionCoefficient(25, 50)[0], 4))
line('  into an open', sig(F.reflectionCoefficient(Infinity, 50)[0], 4))
const at100 = F.lineAt(rg, 1e8)
line('at 100 MHz, wavelength on the line', sig(at100.lambda, 4), 'm')
line('  2 m is this many wavelengths', sig(2 / at100.lambda, 4))
const zq = F.inputImpedance(rg, 100, 1e8, { atLength: at100.lambda / 4 })
line('quarter wave of 50 into 100 gives', sig(zq.Z[0], 6), 'ohm')
const zh = F.inputImpedance(rg, 100, 1e8, { atLength: at100.lambda / 2 })
line('half wave of 50 into 100 gives', sig(zh.Z[0], 6), 'ohm')
const zo = F.inputImpedance(rg, Infinity, 1e8, { atLength: at100.lambda / 8 })
line('eighth wave open stub', sig(zo.Z[1], 5), 'ohm reactance')
const qw = F.quarterWave(50, 100)
line('quarter-wave transformer 50 to 100', sig(qw.Z0, 6), 'ohm')
const sm = F.sMatrix(rg, 1e8, 50)
line('S21 of a matched 2 m line at 100 MHz', `${sig(Math.hypot(sm.s21[0], sm.s21[1]), 6)} at ${sig((Math.atan2(sm.s21[1], sm.s21[0]) * 180) / Math.PI, 6)} degrees`)
line('  S11', Math.hypot(sm.s11[0], sm.s11[1]).toExponential(2))

head('Group I: the bounce diagram')
const bd = F.bounceDiagram({ Vs: 5, Rs: 25, Z0: 50, RL: 150, len: 2, vp: 2e8 })
line('Vs 5 V, Rs 25, Z0 50, RL 150: first wave', sig(bd.first, 5), 'V')
line('  source reflection', sig(bd.gammaS, 5))
line('  load reflection', sig(bd.gammaL, 5))
line('  one-way delay', sig(bd.T * 1e9, 4), 'ns')
line('  load voltage after the first arrival', sig(bd.atEnd(1.5 * bd.T).v, 5), 'V')
line('  after the second', sig(bd.atEnd(3.5 * bd.T).v, 5), 'V')
line('  the steady state', sig(bd.steady.v, 6), 'V')
line('  the divider it equals', sig(bd.steady.divider, 6), 'V')
line('  waves before the tail fell below 1e-12', String(bd.waves.length))
const bdOpen = F.bounceDiagram({ Vs: 5, Rs: 0, Z0: 50, RL: Infinity, len: 2, vp: 2e8 })
line('the same line, ideal source and open', bdOpen.rings ? 'rings for ever' : 'settles')
const bdMatch = F.bounceDiagram({ Vs: 5, Rs: 50, Z0: 50, RL: 50, len: 2, vp: 2e8 })
line('matched at both ends: waves', String(bdMatch.waves.length))
line('  load voltage after one delay', sig(bdMatch.atEnd(1.5 * bdMatch.T).v, 5), 'V')

head('Group J: the lossy line, in frequency and declined in time')
const lossy = F.describeLine({ R: 0.5, L: 250e-9, G: 1e-6, C: 100e-12, len: 100 })
const la = F.lineAt(lossy, 1e6)
line('lossy line at 1 MHz: Z0', `${sig(la.Z0mag, 5)} ohm at ${sig(la.Z0deg, 4)} degrees`)
line('  attenuation', sig(la.dbPerMetre * 100, 4), 'dB per 100 m')
const la2 = F.lineAt(lossy, 1e4)
line('  at 10 kHz: Z0', `${sig(la2.Z0mag, 5)} ohm at ${sig(la2.Z0deg, 4)} degrees`)
line('  phase velocity at 10 kHz', sig(la2.vp / 1e8, 4), 'e8 m/s')
line('  phase velocity at 1 MHz', sig(la.vp / 1e8, 4), 'e8 m/s')
line('  the two differ by', `${sig((100 * Math.abs(la.vp - la2.vp)) / la.vp, 3)} per cent`)
line('time domain available?', F.timeDomainAvailable(lossy).ok ? 'yes' : 'no')

head('Group K: waveguide and cavity')
const wr90 = { a: 0.02286, b: 0.01016 }
line('WR-90 TE10 cutoff', sig(F.cutoff(wr90, 1, 0) / 1e9, 5), 'GHz')
line('  TE20 cutoff', sig(F.cutoff(wr90, 2, 0) / 1e9, 5), 'GHz')
line('  TE01 cutoff', sig(F.cutoff(wr90, 0, 1) / 1e9, 5), 'GHz')
const band = F.singleModeBand(wr90)
line('  single-mode band', `${sig(band.from / 1e9, 5)} to ${sig(band.to / 1e9, 5)} GHz`)
const m10 = F.modeAt(wr90, 10e9)
line('at 10 GHz: guide wavelength', sig(m10.lambdaGuide * 1000, 5), 'mm')
line('  free-space wavelength', sig(m10.lambdaFree * 1000, 5), 'mm')
line('  phase velocity over c', sig(m10.vp / F.C0, 5))
line('  group velocity over c', sig(m10.vg / F.C0, 5))
line('  their product over c squared', sig(m10.check.vpvg / m10.check.v2, 12))
line('  TE10 wave impedance', sig(m10.eta, 5), 'ohm')
const below = F.modeAt(wr90, 5e9)
line('at 5 GHz, below cutoff, decay', sig(below.dbPerMetre, 4), 'dB/m')
const cav = { ...wr90, d: 0.02 }
line('cavity 22.86 by 10.16 by 20 mm, TE101', sig(F.cavityResonance(cav) / 1e9, 6), 'GHz')
const cq = F.cavityQ(cav, { sigma: F.SIGMA_CU })
line('  its Q with copper walls', sig(cq.Q, 4))
line('  its bandwidth', sig(cq.bandwidth / 1e6, 4), 'MHz')
line('  the skin depth there', sig(cq.delta * 1e9, 4), 'nm')

head('Group L: antennas')
const hz = F.hertzianDipole(0.01)
line('Hertzian element, directivity', sig(hz.directivity, 6))
line('  by quadrature on sin theta', sig(F.directivityOf((t) => Math.sin(t)).directivity, 12))
line('  its radiation resistance at 0.01 lambda', sig(hz.radiationResistance, 4), 'ohm')
const hw = F.dipole(0.5)
line('half-wave dipole directivity', sig(hw.directivity, 6))
line('  in dBi', sig(hw.directivityDbi, 5), 'dBi')
line('  half-power beamwidth', sig(hw.beamwidthDeg, 5), 'degrees')
line('  radiation resistance', sig(hw.radiationResistance, 6), 'ohm')
line('  the closed form agrees', sig(hw.radiationResistanceClosed, 6), 'ohm')
line('  the tables round eta/4pi to 30 and get', sig(hw.roundedCoefficient, 6), 'ohm')
const fwd = F.dipole(1)
line('full-wave dipole directivity', sig(fwd.directivity, 6))
line('  its resistance at the current maximum', sig(fwd.radiationResistanceAtMax, 6), 'ohm')
line('  at the feed', String(fwd.radiationResistance))
const best = F.dipole(1.25)
line('1.25 wavelength dipole directivity', sig(best.directivity, 6))
const g = F.gainOf(hw.directivity, 0.9)
line('half-wave at 90 per cent efficiency, gain', sig(g.gainDbi, 5), 'dBi')
const af4 = F.arrayFactor({ n: 4, spacingOverLambda: 0.5, betaDeg: 0 })
line('four elements at half a wavelength, D', sig(af4.directivity, 6))
line('  beamwidth', sig(af4.beamwidthDeg, 5), 'degrees')
line('  grating lobes', String(af4.grating.length))
const af8 = F.arrayFactor({ n: 8, spacingOverLambda: 0.5, betaDeg: 0 })
line('eight elements, D', sig(af8.directivity, 6))
line('  beamwidth', sig(af8.beamwidthDeg, 5), 'degrees')
const steer = F.arrayFactor({ n: 4, spacingOverLambda: 0.5, betaDeg: -90 })
line('four elements, 90 degrees of phase, beam at', sig(steer.mainBeamDeg, 5), 'degrees')
const grate = F.arrayFactor({ n: 4, spacingOverLambda: 1.5, betaDeg: 0 })
line('the same at 1.5 wavelengths, grating lobes', String(grate.grating.length))
const fr = F.friis({ f: 2.4e9, distance: 1000, gainT: 10 ** 1.2, gainR: 10 ** 0.2, powerT: 0.1 })
line('2.4 GHz, 1 km, 12 and 2 dBi, 100 mW', sig(fr.receivedDbm, 5), 'dBm')
line('  free-space path loss', sig(fr.freeSpaceLossDb, 5), 'dB')
line('  wavelength', sig(fr.lambda * 100, 4), 'cm')
line('  effective aperture of the 12 dBi antenna', sig(F.effectiveAperture(10 ** 1.2, fr.lambda) * 1e4, 4), 'cm2')
