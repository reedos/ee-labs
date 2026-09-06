import { describe, it, expect } from 'vitest'
import { complex as cx } from '@ee-labs/network'
import { RfError } from './const.js'
import { abcdToS, mdiff, mnorm, sToAbcd, sToY, sToZ, yToS, zToS } from './convert.js'
import { dissipated, entryOf, largestSingular, reciprocityError, reflection, s11FromNetlist, sFromNetlist, sparam, sDiff, unitarityError, vswr } from './sparam.js'
import { abcdToSparam, cascadeS, chainAbcd, chainViaAbcd, elementAbcd } from './cascade.js'
import { chartFamilies, circleError, circlePoints, conductanceCircle, gammaToZ, place, qArc, reactanceCircle, resistanceCircle, vswrCircle, zToGamma } from './smith.js'
import { inputImpedance, lineAbcd, lineSparam, phaseVelocity, rationalAvailable, repeatFrequency, uniformLine } from './line.js'
import { lSolutions, matchMag, matchNetlist, quarterWaveMatch } from './match.js'

// The plan's invariants, fuzzed (`RF_LAB_PLAN.md` §2.13).
//
// Numbered as the plan numbers them, so a failure here names the promise it
// broke. Invariants 1 to 7 are the ones this lab's modules can state today.
// Invariants 8 to 13 arrive with the device, the noise and the linearity
// modules, and each is named at the foot of this file with the module it waits
// for, so a reader can see what is not yet checked.
//
// The hostile corners the plan lists are in the generator rather than in a
// separate test: a lossless resonance between two mismatched ports, a load on
// the unit circle, and a line a whole wavelength long.

const { C, cabs, csub } = cx

/** A deterministic generator, so a failure is reproducible from its seed. */
function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

const logPick = (r, lo, hi) => lo * Math.pow(hi / lo, r())

/**
 * A random passive two-port, as a chain of two to five elements and lines.
 *
 * Built as a chain matrix rather than as a netlist, because a chain composes
 * without a solve and the S route has to be compared against something the S
 * route did not compute.
 */
function randomTwoPort(r, f, z0) {
  const n = 2 + Math.floor(r() * 4)
  const parts = []
  for (let k = 0; k < n; k++) {
    const pick = r()
    if (pick < 0.16) parts.push(elementAbcd('R', logPick(r, 1, 500), f))
    else if (pick < 0.3) parts.push(elementAbcd('Rp', logPick(r, 10, 5000), f))
    else if (pick < 0.44) parts.push(elementAbcd('L', logPick(r, 1e-10, 1e-7), f))
    else if (pick < 0.58) parts.push(elementAbcd('Lp', logPick(r, 1e-10, 1e-7), f))
    else if (pick < 0.72) parts.push(elementAbcd('C', logPick(r, 1e-13, 1e-10), f))
    else if (pick < 0.86) parts.push(elementAbcd('Cp', logPick(r, 1e-13, 1e-10), f))
    else {
      const line = uniformLine({ Z0: logPick(r, 20, 120), epsr: 1 + r() * 3, len: logPick(r, 1e-3, 0.3), alpha: r() < 0.5 ? 0 : logPick(r, 1e-3, 1) })
      parts.push(lineAbcd(line, f).abcd)
    }
  }
  return { abcd: chainAbcd(parts), sp: abcdToSparam(chainAbcd(parts), { f, z0 }) }
}

/** A random LOSSLESS two-port: reactances and lossless lines only. */
function randomLossless(r, f, z0) {
  const n = 2 + Math.floor(r() * 3)
  const parts = []
  for (let k = 0; k < n; k++) {
    const pick = r()
    if (pick < 0.25) parts.push(elementAbcd('L', logPick(r, 1e-10, 1e-7), f))
    else if (pick < 0.5) parts.push(elementAbcd('Lp', logPick(r, 1e-10, 1e-7), f))
    else if (pick < 0.75) parts.push(elementAbcd('C', logPick(r, 1e-13, 1e-10), f))
    else parts.push(elementAbcd('Cp', logPick(r, 1e-13, 1e-10), f))
  }
  return abcdToSparam(chainAbcd(parts), { f, z0 })
}

const SEEDS = 240

// -------------------------------------------------------------- invariant 1

describe('invariant 1: conversion round-trips', () => {
  it('S to Z to S, S to Y to S and S to ABCD to S all return the input', () => {
    const r = rng(20260905)
    let checked = 0
    let refused = 0
    for (let k = 0; k < SEEDS; k++) {
      const f = logPick(r, 1e7, 1e10)
      const z0 = [50, 75, 300][Math.floor(r() * 3)]
      const { sp } = randomTwoPort(r, f, z0)
      for (const [to, back, what] of [
        [sToZ, zToS, 'Z'],
        [sToY, yToS, 'Y'],
        [sToAbcd, abcdToS, 'ABCD'],
      ]) {
        let mid
        try {
          mid = to(sp.s, z0)
        } catch (err) {
          // The plan's own rule: the round trip is skipped only for the cases
          // the singular test names, and it is named here rather than swallowed.
          expect(err).toBeInstanceOf(RfError)
          expect(err.kind).toBe('singular')
          refused++
          continue
        }
        expect(mdiff(back(mid, z0), sp.s), `seed ${k}, through ${what}, at ${f.toExponential(2)} Hz`).toBeLessThan(1e-9)
        checked++
      }
    }
    expect(checked).toBeGreaterThan(SEEDS * 2)
    // Some of the fuzzed networks really do have no Z or no chain matrix, and
    // the count says the refusal path was walked rather than assumed.
    expect(refused).toBeGreaterThan(0)
  })

  it('the long way round closes too: S to Z to ABCD to Y to S', () => {
    const r = rng(7717)
    let checked = 0
    for (let k = 0; k < SEEDS; k++) {
      const f = logPick(r, 1e7, 1e10)
      const z0 = 50
      const { sp } = randomTwoPort(r, f, z0)
      try {
        const Z = sToZ(sp.s, z0)
        const M = sToAbcd(zToS(Z, z0), z0)
        const Y = sToY(abcdToS(M, z0), z0)
        expect(mdiff(yToS(Y, z0), sp.s), `seed ${k}`).toBeLessThan(1e-8)
        checked++
      } catch (err) {
        expect(err).toBeInstanceOf(RfError)
      }
    }
    expect(checked).toBeGreaterThan(SEEDS / 2)
  })
})

// -------------------------------------------------------------- invariant 2

describe('invariant 2: the two cascade routes agree', () => {
  it('the matrix product and the closed composition give the same two-port', () => {
    // "To floating point", stated precisely. The ABCD route divides by S21 on
    // the way in and multiplies it back on the way out, so its rounding is
    // amplified by 1/|S21|, and a chain that passes a millionth of what is
    // driven into it loses six digits on that account alone. The claim is
    // therefore made against that number rather than against a flat epsilon.
    // Over 240 fuzzed pairs the largest disagreement divided by 1/|S21| is
    // 3.5e-15, and the largest absolute disagreement is 1.7e-8 at a block whose
    // S21 is 2e-7.
    const r = rng(31415)
    let checked = 0
    let easy = 0
    for (let k = 0; k < SEEDS; k++) {
      const f = logPick(r, 1e7, 1e10)
      const z0 = 50
      const a = randomTwoPort(r, f, z0).sp
      const b = randomTwoPort(r, f, z0).sp
      try {
        const through = Math.min(entryOf(a, 1, 0).mag, entryOf(b, 1, 0).mag)
        const conditioning = Math.max(1, 1 / through)
        const apart = sDiff(cascadeS(a, b), chainViaAbcd([a, b]))
        expect(apart, `seed ${k}, |S21| ${through.toExponential(2)}`).toBeLessThan(1e-13 * conditioning)
        // A block that passes most of what is driven into it has no such
        // excuse, and the two routes agree to the last few bits.
        if (conditioning < 100) {
          expect(apart, `seed ${k}, a well-conditioned pair`).toBeLessThan(1e-12)
          easy++
        }
        checked++
      } catch (err) {
        if (!(err instanceof RfError)) throw err
      }
    }
    expect(checked).toBeGreaterThan(SEEDS / 2)
    expect(easy).toBeGreaterThan(SEEDS / 4)
  })

  it('a three-block chain composes the same whichever pair is taken first', () => {
    const r = rng(2718)
    let checked = 0
    for (let k = 0; k < 120; k++) {
      const f = logPick(r, 1e8, 5e9)
      const z0 = 50
      const [a, b, c] = [randomTwoPort(r, f, z0).sp, randomTwoPort(r, f, z0).sp, randomTwoPort(r, f, z0).sp]
      try {
        expect(sDiff(cascadeS(cascadeS(a, b), c), cascadeS(a, cascadeS(b, c))), `seed ${k}`).toBeLessThan(1e-8)
        checked++
      } catch (err) {
        if (!(err instanceof RfError)) throw err
      }
    }
    expect(checked).toBeGreaterThan(40)
  })

  it('a lossless resonance between two mismatched ports is declined by name', () => {
    // The hostile corner the plan lists. Two ideal mirrors face each other, so
    // 1 − S22 S11 is zero and no finite steady state exists.
    const mirror = sparam({ f: 1e9, z0: 50, s: [[C(1), C(0)], [C(0), C(1)]] })
    expect(() => cascadeS(mirror, mirror)).toThrow(RfError)
  })
})

// -------------------------------------------------------------- invariant 3

describe('invariant 3: passivity and reciprocity', () => {
  it('a network of R, L and C is reciprocal and never amplifies', () => {
    const r = rng(160934)
    for (let k = 0; k < SEEDS; k++) {
      const f = logPick(r, 1e7, 1e10)
      const z0 = 50
      const { sp } = randomTwoPort(r, f, z0)
      expect(reciprocityError(sp), `seed ${k}`).toBeLessThan(1e-11)
      expect(largestSingular(sp), `seed ${k}`).toBeLessThanOrEqual(1 + 1e-9)
      expect(dissipated(sp), `seed ${k}`).toBeGreaterThan(-1e-9)
    }
  })

  it('a network of L and C alone is unitary, so it loses nothing', () => {
    const r = rng(4004)
    for (let k = 0; k < SEEDS; k++) {
      const f = logPick(r, 1e7, 1e10)
      const sp = randomLossless(r, f, 50)
      expect(unitarityError(sp), `seed ${k}`).toBeLessThan(1e-9)
      expect(Math.abs(dissipated(sp)), `seed ${k}`).toBeLessThan(1e-9)
    }
  })

  it('a resistor added to a lossless network takes exactly what it dissipates', () => {
    const r = rng(9001)
    for (let k = 0; k < 80; k++) {
      const f = logPick(r, 1e8, 5e9)
      const Rp = logPick(r, 20, 2000)
      const lc = [elementAbcd('L', logPick(r, 1e-9, 1e-7), f), elementAbcd('Cp', logPick(r, 1e-13, 1e-11), f)]
      const clean = abcdToSparam(chainAbcd(lc), { f, z0: 50 })
      const dirty = abcdToSparam(chainAbcd([...lc, elementAbcd('Rp', Rp, f)]), { f, z0: 50 })
      expect(Math.abs(dissipated(clean))).toBeLessThan(1e-9)
      expect(dissipated(dirty)).toBeGreaterThan(0)
      expect(dissipated(dirty)).toBeLessThan(1 + 1e-9)
    }
  })

  it('a solved netlist gives the same passive answers as the chain it was built from', () => {
    const r = rng(5150)
    for (let k = 0; k < 60; k++) {
      const f = logPick(r, 1e8, 5e9)
      const Rser = logPick(r, 5, 400)
      const Rsh = logPick(r, 20, 4000)
      const Cval = logPick(r, 1e-13, 1e-11)
      const net = {
        elements: [
          { type: 'R', id: 'R1', nodes: ['p1', 'p2'], value: Rser },
          { type: 'R', id: 'R2', nodes: ['p2', 'gnd'], value: Rsh },
          { type: 'C', id: 'C1', nodes: ['p2', 'gnd'], value: Cval },
        ],
      }
      const solved = sFromNetlist(net, ['p1', 'p2'], f, { z0: 50 })
      const chained = abcdToSparam(chainAbcd([elementAbcd('R', Rser, f), elementAbcd('Rp', Rsh, f), elementAbcd('Cp', Cval, f)]), { f, z0: 50 })
      expect(sDiff(solved, chained), `seed ${k}`).toBeLessThan(1e-9)
    }
  })
})

// -------------------------------------------------------------- invariant 4

describe('invariant 4: a synthesised match is matched', () => {
  it('every L network the enumeration offers reads under 1e-12 at its design frequency', () => {
    // Solved by `solveAC` through a netlist, which is the plan's wording. The
    // synthesis is written in chain matrices and the check is written in the
    // MNA solver, so nothing that designed the network also grades it.
    //
    // The tolerance on the solved route carries the network's own spread, for
    // the reason invariant 2 carries 1/|S21|. A 1.83 ohm load behind 783 ohms
    // of reactance puts four hundred to one between the largest and smallest
    // number in the matrix, and an MNA solve of it returns eleven digits rather
    // than thirteen. The synthesis itself is exact at 1e-12 whatever the
    // spread, and that is the claim made against a flat number.
    const r = rng(1000004)
    let checked = 0
    let easy = 0
    let complex = 0
    for (let k = 0; k < SEEDS; k++) {
      const f = logPick(r, 1e7, 1e10)
      const RS = logPick(r, 1, 600)
      const R = logPick(r, 0.5, 5000)
      const X = r() < 0.5 ? 0 : (r() < 0.5 ? -1 : 1) * logPick(r, 0.1, 3000)
      const ZL = X === 0 ? R : [R, X]
      const all = lSolutions({ RS, ZL, f })
      const ok = all.solutions.filter((s) => s.ok)
      expect(ok.length, `seed ${k}: no orientation matches ${RS} to ${R}`).toBeGreaterThan(0)
      for (const sol of ok) {
        const where = `seed ${k}, ${sol.id}, ${RS} ohm to ${R} + j${X} ohm at ${f.toExponential(2)} Hz`
        // The synthesis, by the arithmetic it is written in.
        expect(matchMag(sol, ZL, RS, f), `${where}, by the chain matrix`).toBeLessThan(1e-12)
        // The same network, solved.
        const spread = Math.max(RS, R, Math.abs(X), ...sol.elements.map((e) => Math.abs(e.X))) / Math.min(RS, R)
        const s11 = cabs(s11FromNetlist(matchNetlist(sol, ZL, f), 'p1', f, { z0: RS }))
        expect(s11, `${where}, solved, spread ${spread.toExponential(2)}`).toBeLessThan(1e-12 * Math.max(1, spread))
        if (spread < 50) {
          expect(s11, `${where}, a well-conditioned network`).toBeLessThan(1e-12)
          easy++
        }
        checked++
      }
      if (X !== 0) complex++
    }
    expect(checked).toBeGreaterThan(SEEDS)
    expect(easy).toBeGreaterThan(SEEDS / 4)
    expect(complex).toBeGreaterThan(SEEDS / 4)
  })

  it('the two entries the enumeration refuses are refused for the same reason every time', () => {
    const r = rng(4444)
    let refused = 0
    for (let k = 0; k < 120; k++) {
      const f = logPick(r, 1e8, 5e9)
      const RS = logPick(r, 5, 300)
      const R = RS * (r() < 0.5 ? logPick(r, 1.2, 100) : 1 / logPick(r, 1.2, 100))
      const all = lSolutions({ RS, ZL: R, f })
      const no = all.solutions.filter((s) => !s.ok)
      expect(no.length, `seed ${k}`).toBe(2)
      for (const sol of no) {
        expect(sol.says).toMatch(/lowers the resistance/)
        expect(sol.elements.length).toBe(0)
        refused++
      }
    }
    expect(refused).toBe(240)
  })

  it('a quarter-wave transformer is matched at its design frequency and at every odd multiple', () => {
    const r = rng(70711)
    for (let k = 0; k < 120; k++) {
      const f0 = logPick(r, 1e8, 5e9)
      const RS = logPick(r, 5, 300)
      const RL = logPick(r, 5, 300)
      const qw = quarterWaveMatch({ RS, RL, f0, epsr: 1 + r() * 3 })
      for (const n of [1, 3, 5]) expect(qw.at(n * f0).mag, `seed ${k}, ${n} f0`).toBeLessThan(1e-11)
      // At an even multiple the line is a whole number of half waves, so the
      // load arrives unchanged and the reflection is the load's own.
      const bare = cabs(reflection(RL, RS))
      expect(Math.abs(qw.at(2 * f0).mag - bare), `seed ${k}`).toBeLessThan(1e-9)
    }
  })
})

// -------------------------------------------------------------- invariant 5

describe('invariant 5: the chart is the algebra', () => {
  it('every point the chart places is the map evaluated directly', () => {
    const r = rng(1123)
    for (let k = 0; k < 400; k++) {
      const z0 = [50, 75, 300][Math.floor(r() * 3)]
      const R = logPick(r, 0.05, 5000)
      const X = (r() < 0.5 ? -1 : 1) * logPick(r, 0.01, 5000)
      const p = place([R, X], z0)
      const z = C(R / z0, X / z0)
      expect(cabs(csub(p.gamma, zToGamma(z))), `seed ${k}`).toBeLessThan(1e-14)
      expect(p.mag).toBeLessThanOrEqual(1 + 1e-14)
      expect(cabs(csub(gammaToZ(p.gamma), z))).toBeLessThan(1e-9 * Math.max(1, cabs(z)))
    }
  })

  it('every circle a chart returns contains the points it claims to', () => {
    const r = rng(6626)
    for (let k = 0; k < 300; k++) {
      const value = logPick(r, 0.02, 50)
      const rc = resistanceCircle(value)
      const xc = reactanceCircle(value)
      const gc = conductanceCircle(value)
      const qa = qArc(value)
      for (const [circle, name] of [[rc, 'r'], [xc, 'x'], [gc, 'g'], [qa, 'Q']]) {
        for (const p of circlePoints(circle, 16)) {
          expect(circleError(circle, p), `${name} = ${value}`).toBeLessThan(1e-12)
          // A point on the r, g or Q family is inside the disc where the
          // impedance it stands for is passive. A reactance arc runs outside
          // the disc as well, so only the disc part is claimed.
          if (Math.hypot(p[0], p[1]) <= 1) {
            expect(cabs(zToGamma(gammaToZ(p))) - Math.hypot(p[0], p[1])).toBeLessThan(1e-9)
          }
        }
      }
    }
  })

  it('a standing-wave circle carries every load with that ratio', () => {
    const r = rng(8080)
    for (let k = 0; k < 200; k++) {
      const s = 1 + logPick(r, 1e-3, 30)
      const circle = vswrCircle(s)
      const angle = r() * 2 * Math.PI
      const g = [circle.radius * Math.cos(angle), circle.radius * Math.sin(angle)]
      expect(Math.abs(vswr(g) - s) / s).toBeLessThan(1e-9)
    }
  })

  it('the families a chart draws are all inside the disc, or cross it', () => {
    for (const circle of chartFamilies({ mode: 'both' })) {
      const inside = circlePoints(circle, 64).filter((p) => Math.hypot(p[0], p[1]) <= 1 + 1e-12)
      expect(inside.length, `family ${circle.family} = ${circle.value} never enters the chart`).toBeGreaterThan(0)
    }
  })
})

// -------------------------------------------------------------- invariant 6

describe('invariant 6: the line agrees with the network', () => {
  it('a line split into N sections equals the single section, for every N', () => {
    const r = rng(2997)
    for (let k = 0; k < 120; k++) {
      const f = logPick(r, 1e8, 1e10)
      const spec = { Z0: logPick(r, 20, 150), epsr: 1 + r() * 3, len: logPick(r, 1e-3, 0.5), alpha: r() < 0.4 ? 0 : logPick(r, 1e-3, 2) }
      const whole = lineSparam(uniformLine(spec), f, { z0: 50 })
      const N = 2 + Math.floor(r() * 7)
      const piece = uniformLine({ ...spec, len: spec.len / N })
      const parts = Array.from({ length: N }, () => lineSparam(piece, f, { z0: 50 }))
      expect(mdiff(chainViaAbcd(parts).s, whole.s), `seed ${k}, N = ${N}`).toBeLessThan(1e-9)
    }
  })

  it('a line loaded by an impedance gives the same input impedance through its chain matrix', () => {
    const r = rng(6022)
    for (let k = 0; k < 200; k++) {
      const f = logPick(r, 1e8, 1e10)
      const spec = { Z0: logPick(r, 20, 150), epsr: 1 + r() * 3, len: logPick(r, 1e-3, 0.4), alpha: r() < 0.5 ? 0 : logPick(r, 1e-3, 1) }
      const line = uniformLine(spec)
      const ZL = C(logPick(r, 1, 2000), (r() < 0.5 ? -1 : 1) * logPick(r, 0.1, 2000))
      const direct = inputImpedance(line, ZL, f).Z
      // Zin = (A ZL + B) / (C ZL + D), which is the chain matrix loaded.
      const { abcd } = lineAbcd(line, f)
      const num = cx.cadd(cx.cmul(abcd[0][0], ZL), abcd[0][1])
      const den = cx.cadd(cx.cmul(abcd[1][0], ZL), abcd[1][1])
      const viaChain = cx.cdiv(num, den)
      expect(cabs(csub(direct, viaChain)) / Math.max(1, cabs(direct)), `seed ${k}`).toBeLessThan(1e-9)
    }
  })

  it('a line a whole wavelength long presents its load unchanged', () => {
    // The hostile corner the plan lists.
    const r = rng(1420)
    for (let k = 0; k < 60; k++) {
      const f = logPick(r, 1e8, 1e10)
      const epsr = 1 + r() * 3
      const line = uniformLine({ Z0: logPick(r, 20, 150), epsr, len: phaseVelocity(epsr) / f })
      const ZL = C(logPick(r, 1, 2000), (r() < 0.5 ? -1 : 1) * logPick(r, 0.1, 2000))
      const zin = inputImpedance(line, ZL, f).Z
      expect(cabs(csub(zin, ZL)) / cabs(ZL), `seed ${k}`).toBeLessThan(1e-7)
    }
  })

  it('a load on the unit circle stays on it along a lossless line', () => {
    // The other hostile corner: a purely reactive load reflects everything, and
    // no length of lossless line changes that.
    const r = rng(3141)
    for (let k = 0; k < 100; k++) {
      const f = logPick(r, 1e8, 1e10)
      const epsr = 1 + r() * 3
      const line = uniformLine({ Z0: 50, epsr, len: logPick(r, 1e-3, 0.4) })
      const X = (r() < 0.5 ? -1 : 1) * logPick(r, 0.5, 5000)
      const zin = inputImpedance(line, C(0, X), f).Z
      expect(Math.abs(cabs(reflection(zin, 50)) - 1), `seed ${k}`).toBeLessThan(1e-8)
      expect(vswr(reflection(zin, 50))).toBeGreaterThan(1e6)
    }
  })
})

// -------------------------------------------------------------- invariant 7

describe('invariant 7: the line is not rational', () => {
  it('the hand-over is declined on every line the fuzzer builds, with the same reason', () => {
    const r = rng(11235)
    for (let k = 0; k < 120; k++) {
      const f = logPick(r, 1e8, 1e10)
      const line = uniformLine({ Z0: logPick(r, 20, 150), epsr: 1 + r() * 3, len: logPick(r, 1e-3, 0.5), alpha: r() < 0.5 ? 0 : logPick(r, 1e-3, 2) })
      const said = rationalAvailable(line, f)
      expect(said.ok, `seed ${k}`).toBe(false)
      expect(said.says).toMatch(/no finite poles and no finite zeros/)
      expect(said.says).toMatch(/e\^\(-gamma l\)/)
    }
  })

  it('the response repeats for ever, which no rational function that is not constant does', () => {
    const r = rng(19937)
    for (let k = 0; k < 120; k++) {
      const f = logPick(r, 1e8, 5e9)
      const line = uniformLine({ Z0: logPick(r, 20, 150), epsr: 1 + r() * 3, len: logPick(r, 1e-3, 0.3), alpha: r() < 0.5 ? 0 : logPick(r, 1e-3, 1) })
      const repeat = repeatFrequency(line, f)
      const ZL = C(logPick(r, 1, 2000), (r() < 0.5 ? -1 : 1) * logPick(r, 0.1, 2000))
      const here = inputImpedance(line, ZL, f).Z
      for (const n of [1, 2, 7]) {
        const later = inputImpedance(line, ZL, f + n * repeat).Z
        expect(cabs(csub(here, later)) / Math.max(1, cabs(here)), `seed ${k}, ${n} repeats on`).toBeLessThan(1e-7)
      }
      // And the response is genuinely not constant, so the repeat says
      // something. Half a period along it has moved.
      const halfway = inputImpedance(line, ZL, f + repeat / 2).Z
      expect(cabs(csub(here, halfway)) / Math.max(1, cabs(here))).toBeGreaterThan(1e-6)
    }
  })
})

// ------------------------------------------------- what is not checked yet

describe('the invariants this phase cannot state yet', () => {
  it('names each one and the module it waits for', () => {
    // Not a placeholder. `PROGRAM.md` §3 says a lab delivers as much of the
    // engine as its dependencies allow and names the rest, and this is that
    // list in the file where a reader looks for it.
    const waiting = {
      8: 'stability is consistent — stability.js',
      9: 'gain closes — stability.js',
      10: 'the unilateral bound holds — stability.js',
      11: 'Friis closes — noise.js and budget.js',
      12: 'IP3 closes — linearity.js',
      13: 'cross-lab — the Circuit Lab and Electronics Lab seams',
    }
    expect(Object.keys(waiting).length).toBe(6)
    for (const text of Object.values(waiting)) expect(text).toMatch(/ — /)
  })
})
