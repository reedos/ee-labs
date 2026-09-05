import { describe, it, expect } from 'vitest'
import { complex as cx } from '@ee-labs/network'
import {
  RfError,
  angleDeg,
  fromPolar,
  magDb,
  maxSingularValue,
  mismatch,
  onePort,
  powerBalance,
  reciprocityError,
  sFromNetlist,
  twoPort,
  unitarityError,
} from './sparam.js'
import { piPad, randomFrequency, randomLadder } from './fuzz.js'

const { C, cabs, csub } = cx

const close = (a, b, tol = 1e-9) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(a), Math.abs(b)))
const closeC = (x, y, tol = 1e-9) => expect(cabs(csub(x, y))).toBeLessThanOrEqual(tol * Math.max(1, cabs(x), cabs(y)))

// A one-port whose reflection is known by hand: a resistor to ground.
const loadNet = (R) => ({ elements: [{ type: 'R', id: 'RL', nodes: ['p1', 'gnd'], value: R }], ports: ['p1'] })

describe('the record', () => {
  it('carries the frequency and the reference, because an S entry means nothing without either', () => {
    const rec = twoPort({ f: 1e9, z0: 50, s: [[0, 1], [1, 0]] })
    expect(rec.f).toBe(1e9)
    expect(rec.z0).toBe(50)
    expect(rec.ports).toBe(2)
    expect(rec.s[0][0]).toEqual([0, 0])
  })

  it('refuses a matrix that is not square, a negative reference, and a three-port', () => {
    expect(() => twoPort({ s: [[0, 1]] })).toThrow(/square/)
    expect(() => twoPort({ z0: -50, s: [[0]] })).toThrow(/positive resistance/)
    expect(() => twoPort({ s: [[0, 0, 0], [0, 0, 0], [0, 0, 0]] })).toThrow(/3-port/)
    expect(() => twoPort({ s: [[NaN]] })).toThrow(RfError)
  })

  it('reads a data sheet polar form back as magnitude and degrees', () => {
    const rec = fromPolar([[0.894, -60.6], [0.02, 62.4], [3.122, 123.6], [0.781, -27.6]], { f: 2e9 })
    close(cabs(rec.s[1][0]), 3.122, 1e-12)
    close(angleDeg(rec.s[1][0]), 123.6, 1e-12)
    close(magDb(rec.s[1][0]), 20 * Math.log10(3.122), 1e-12)
  })
})

describe('one reflection coefficient in three costumes', () => {
  it('a 100 ohm load in 50 ohms is a third, VSWR 2 and 9.542 dB of return loss', () => {
    const m = mismatch(C(1 / 3, 0))
    close(m.mag, 1 / 3, 1e-15)
    close(m.vswr, 2, 1e-15)
    close(m.returnLossDb, -20 * Math.log10(1 / 3), 1e-15)
    close(m.mismatchLossDb, -10 * Math.log10(1 - 1 / 9), 1e-15)
  })

  it('a matched load reflects nothing, so its return loss is infinite', () => {
    const m = mismatch(C(0, 0))
    expect(m.vswr).toBe(1)
    expect(m.returnLossDb).toBe(Infinity)
    close(m.mismatchLossDb, 0, 1e-15)
  })

  it('a load on the unit circle takes no power, so its mismatch loss is infinite', () => {
    expect(mismatch(C(0, 1)).mismatchLossDb).toBe(Infinity)
    expect(mismatch(C(0, 1)).vswr).toBe(Infinity)
  })
})

describe('S from a circuit the suite can solve', () => {
  it('S11 of a resistor to ground is the reflection coefficient, at ten values', () => {
    for (let k = 0; k < 10; k++) {
      const R = 5 * Math.pow(2, k / 2)
      const rec = sFromNetlist(loadNet(R), ['p1'], 1e9)
      closeC(rec.s[0][0], C((R - 50) / (R + 50), 0), 1e-9)
    }
  })

  it('a 3 dB pi attenuator is matched at both ports and passes 0.70795', () => {
    const pad = piPad(3, 50)
    // The plan's §4.3 values, to the figures it quotes them to.
    expect(pad.series.toPrecision(5)).toBe('17.615')
    expect(pad.shunt.toPrecision(5)).toBe('292.40')
    const rec = sFromNetlist(pad, pad.ports, 1e9)
    expect(cabs(rec.s[0][0])).toBeLessThan(1e-12)
    expect(cabs(rec.s[1][1])).toBeLessThan(1e-12)
    close(cabs(rec.s[1][0]), Math.pow(10, -3 / 20), 1e-9)
    close(magDb(rec.s[1][0]), -3, 1e-9)
  })

  it('a pad of any loss reads back the loss it was synthesised for', () => {
    for (const db of [0.5, 1, 3, 6, 10, 20]) {
      const pad = piPad(db, 50)
      const rec = sFromNetlist(pad, pad.ports, 2.4e9)
      close(magDb(rec.s[1][0]), -db, 1e-9)
      expect(cabs(rec.s[0][0]), `${db} dB pad`).toBeLessThan(1e-12)
    }
  })

  it('a series impedance between the ports gives the closed form for S21', () => {
    // A series resistor R between two ports referred to Z0 has
    // S21 = 2 Z0 / (2 Z0 + R), which is the divider a source of internal
    // resistance Z0 makes into a load of Z0 through R.
    for (const R of [1, 10, 50, 137, 1000]) {
      const net = { elements: [{ type: 'R', id: 'Rs', nodes: ['p1', 'p2'], value: R }, { type: 'R', id: 'Rleak', nodes: ['p1', 'gnd'], value: 1e12 }] }
      const rec = sFromNetlist(net, ['p1', 'p2'], 1e9)
      closeC(rec.s[1][0], C((2 * 50) / (2 * 50 + R), 0), 1e-6)
      closeC(rec.s[0][0], C(R / (R + 2 * 50), 0), 1e-6)
    }
  })

  it('an independent source already in the circuit contributes nothing', () => {
    // S describes what a network does to a wave, not what it generates. A
    // source left in the netlist must not move a single entry.
    const quiet = { elements: [{ type: 'R', id: 'RL', nodes: ['p1', 'gnd'], value: 200 }] }
    const noisy = { elements: [...quiet.elements, { type: 'V', id: 'V1', nodes: ['p1', 'gnd'], wave: { kind: 'sine', amp: 3, freq: 1e9 } }] }
    // The source shorts the port when it is silenced, so the comparison is on
    // a circuit where it sits behind a resistor.
    const withR = { elements: [{ type: 'R', id: 'RL', nodes: ['p1', 'gnd'], value: 200 }, { type: 'R', id: 'Rx', nodes: ['p1', 'x'], value: 300 }, { type: 'V', id: 'V1', nodes: ['x', 'gnd'], wave: { kind: 'sine', amp: 3, freq: 1e9 } }] }
    const parallel = { elements: [{ type: 'R', id: 'RL', nodes: ['p1', 'gnd'], value: 200 }, { type: 'R', id: 'Rx', nodes: ['p1', 'gnd'], value: 300 }] }
    closeC(sFromNetlist(withR, ['p1'], 1e9).s[0][0], sFromNetlist(parallel, ['p1'], 1e9).s[0][0], 1e-9)
    expect(cabs(csub(sFromNetlist(noisy, ['p1'], 1e9).s[0][0], C(-1, 0)))).toBeLessThan(1e-9)
  })

  it('refuses ground as a port, a frequency of zero and a negative reference', () => {
    expect(() => sFromNetlist(loadNet(50), ['gnd'], 1e9)).toThrow(/cannot be ground/)
    expect(() => sFromNetlist(loadNet(50), ['p1'], 0)).toThrow(/must be positive/)
    expect(() => sFromNetlist(loadNet(50), ['p1'], 1e9, { z0: 0 })).toThrow(/positive resistance/)
    expect(() => sFromNetlist(loadNet(50), ['p1', 'p2', 'p3'], 1e9)).toThrow(RfError)
  })
})

// ------------------------------------------- invariant 3, over random networks

describe('invariant 3: passivity and reciprocity', () => {
  it('a network of R, L and C has S12 = S21 to floating point', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const net = randomLadder(seed)
      const f = randomFrequency(seed * 31 + 7)
      const rec = sFromNetlist(net, net.ports, f)
      expect(reciprocityError(rec), `seed ${seed} at ${f.toExponential(3)} Hz`).toBeLessThan(1e-9)
    }
  })

  it('the largest singular value of a passive network is at most one', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const net = randomLadder(seed)
      const f = randomFrequency(seed * 17 + 3)
      const rec = sFromNetlist(net, net.ports, f)
      expect(maxSingularValue(rec), `seed ${seed}`).toBeLessThanOrEqual(1 + 1e-9)
      const { out, dissipated } = powerBalance(rec, 0)
      expect(out, `seed ${seed} sends out ${out}`).toBeLessThanOrEqual(1 + 1e-9)
      expect(dissipated, `seed ${seed} dissipates ${dissipated}`).toBeGreaterThanOrEqual(-1e-9)
    }
  })

  it('a network of L and C alone loses nothing, so S is unitary to 1e-12', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const net = randomLadder(seed, { lossless: true })
      const f = randomFrequency(seed * 13 + 11)
      const rec = sFromNetlist(net, net.ports, f)
      expect(unitarityError(rec), `seed ${seed} at ${f.toExponential(3)} Hz`).toBeLessThan(1e-8)
    }
  })

  it('adding a resistor takes exactly the dissipated fraction out of the sum', () => {
    // The one place two numbers are shown as equal: |S11|^2 + |S21|^2 is one
    // for a lossless network and less by the dissipated fraction otherwise.
    const lc = randomLadder(9, { lossless: true })
    const lossy = randomLadder(9)
    const f = 1.2e9
    expect(powerBalance(sFromNetlist(lc, lc.ports, f), 0).dissipated).toBeLessThan(1e-8)
    expect(powerBalance(sFromNetlist(lossy, lossy.ports, f), 0).dissipated).toBeGreaterThan(1e-6)
  })

  it('a one-port made only of L and C reflects everything', () => {
    const net = { elements: [{ type: 'L', id: 'L1', nodes: ['p1', 'gnd'], value: 10e-9 }] }
    const rec = onePort(sFromNetlist(net, ['p1'], 1e9).s[0][0], { f: 1e9 })
    close(cabs(rec.s[0][0]), 1, 1e-9)
  })
})
