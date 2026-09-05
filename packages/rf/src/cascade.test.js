import { describe, it, expect } from 'vitest'
import { complex as cx } from '@ee-labs/network'
import { cascade, cascadeAbcd, cascadeByAbcd, cascadeS, gammaIn, gammaOut, seriesTwoPort, shuntTwoPort, transformerTwoPort } from './cascade.js'
import { magDb, sFromNetlist, twoPort, powerBalance } from './sparam.js'
import { abcdToS, m2, sToAbcd } from './convert.js'
import { piPad, randomFrequency, randomLadder } from './fuzz.js'

const { C, cabs, csub } = cx

const closeC = (x, y, tol = 1e-9) => expect(cabs(csub(x, y))).toBeLessThanOrEqual(tol * Math.max(1, cabs(x), cabs(y)))
const close = (a, b, tol = 1e-9) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(a), Math.abs(b)))
const worstOf = (A, B) => {
  let w = 0
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) w = Math.max(w, cabs(csub(A[i][j], B[i][j])))
  return w
}

describe('what a cascade is', () => {
  it('two 3 dB pads give 6 dB, with the input still matched', () => {
    const pad = piPad(3, 50)
    const one = sFromNetlist(pad, pad.ports, 1e9)
    const two = cascade([one, one])
    close(magDb(two.s[1][0]), 2 * magDb(one.s[1][0]), 1e-9)
    close(magDb(two.s[1][0]), -6, 1e-9)
    expect(cabs(two.s[0][0])).toBeLessThan(1e-12)
    expect(cabs(two.s[1][1])).toBeLessThan(1e-12)
  })

  it('a cascade with nothing in it is the thing itself', () => {
    const pad = piPad(1, 50)
    const one = sFromNetlist(pad, pad.ports, 1e9)
    expect(worstOf(cascade([one]).s, one.s)).toBeLessThan(1e-15)
  })

  it('a series element then a shunt element is the ABCD product of the two', () => {
    const Z = C(30, -40)
    const Y = C(0.004, 0.01)
    const s = seriesTwoPort(Z, { f: 1e9 })
    const p = shuntTwoPort(Y, { f: 1e9 })
    const chain = cascade([s, p])
    const want = abcdToS(cascadeAbcd(m2(C(1), Z, C(0), C(1)), m2(C(1), C(0), Y, C(1))), 50)
    expect(worstOf(chain.s, want)).toBeLessThan(1e-12)
  })

  it('the cascade of a two-port and its reverse is not the identity, and the order is kept', () => {
    const a = seriesTwoPort(C(0, 40), { f: 1e9 })
    const b = shuntTwoPort(C(0, 0.02), { f: 1e9 })
    expect(worstOf(cascade([a, b]).s, cascade([b, a]).s)).toBeGreaterThan(1e-3)
  })

  it('refuses two two-ports at different references or different frequencies', () => {
    const a = twoPort({ f: 1e9, z0: 50, s: [[C(0), C(1)], [C(1), C(0)]] })
    const b = twoPort({ f: 1e9, z0: 75, s: [[C(0), C(1)], [C(1), C(0)]] })
    const c = twoPort({ f: 2e9, z0: 50, s: [[C(0), C(1)], [C(1), C(0)]] })
    expect(() => cascade([a, b])).toThrow(/different impedances/)
    expect(() => cascade([a, c])).toThrow(/different frequencies/)
  })

  it('names the lossless resonance rather than dividing by nothing', () => {
    // Two ideal reflectors facing each other: A22 = 1 and B11 = 1, so the round
    // trip between them has unit gain and the wave never dies.
    const wall = twoPort({ f: 1e9, z0: 50, s: [[C(1), C(0)], [C(0), C(1)]] })
    expect(() => cascadeS(wall, wall)).toThrow(/resonate/)
    expect(() => cascadeS(wall, wall)).toThrow(/never dies/)
  })
})

// ---------------------------------------------------------------- invariant 2

describe('invariant 2: the two cascade routes agree', () => {
  it('the ABCD product and the S composition give one two-port, over random chains', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const left = randomLadder(seed)
      const right = randomLadder(seed + 100)
      const f = randomFrequency(seed * 23 + 9)
      const a = sFromNetlist(left, left.ports, f)
      const b = sFromNetlist(right, right.ports, f)
      const bySisS = cascade([a, b])
      let byAbcd
      try {
        byAbcd = cascadeByAbcd([a, b])
      } catch (err) {
        expect(err.kind, `seed ${seed} threw ${err.message}`).toBe('singular-conversion')
        continue
      }
      // The two routes agree to the arithmetic's precision on the larger of the
      // two chains' own scales, which is what the ABCD detour carries.
      const scale = Math.max(1, ...sToAbcd(a, 50).flat().map(cabs), ...sToAbcd(b, 50).flat().map(cabs))
      expect(worstOf(bySisS.s, byAbcd.s), `seed ${seed} at ${f.toExponential(3)} Hz`).toBeLessThanOrEqual(1e-12 + 1e-15 * scale)
    }
  })

  it('a chain of three composes the same way whichever pair is taken first', () => {
    const parts = [1, 2, 3].map((k) => sFromNetlist(randomLadder(k * 7), ['p1', 'p2'], 9e8))
    const left = cascade([cascade([parts[0], parts[1]]), parts[2]])
    const right = cascade([parts[0], cascade([parts[1], parts[2]])])
    expect(worstOf(left.s, right.s)).toBeLessThan(1e-9)
    expect(worstOf(cascade(parts).s, left.s)).toBeLessThan(1e-12)
  })

  it('cascading a lossless chain keeps it lossless', () => {
    const a = sFromNetlist(randomLadder(5, { lossless: true }), ['p1', 'p2'], 1.4e9)
    const b = sFromNetlist(randomLadder(6, { lossless: true }), ['p1', 'p2'], 1.4e9)
    expect(powerBalance(cascade([a, b]), 0).dissipated).toBeLessThan(1e-7)
  })
})

describe('what a load does to the input', () => {
  it('a matched two-port into a matched load reflects what S11 says', () => {
    const pad = piPad(3, 50)
    const rec = sFromNetlist(pad, pad.ports, 1e9)
    closeC(gammaIn(rec, C(0, 0)), rec.s[0][0], 1e-12)
    closeC(gammaOut(rec, C(0, 0)), rec.s[1][1], 1e-12)
  })

  it('a transformer into a load transforms it by the square of the turns ratio', () => {
    const n = 2
    const t = transformerTwoPort(n, { f: 1e9 })
    // A short at the output is a short at the input, whatever the ratio.
    closeC(gammaIn(t, C(-1, 0)), C(-1, 0), 1e-12)
    // With ABCD [[n, 0], [0, 1/n]] a load of 50 ohms looks like 50 n^2, which
    // is 200 ohms at a turns ratio of two.
    const g = gammaIn(t, C(0, 0))
    const Zin = (50 * (1 + g[0])) / (1 - g[0])
    close(Zin, 50 * n * n, 1e-9)
  })

  it('names the load that resonates against the two-port', () => {
    const wall = twoPort({ f: 1e9, z0: 50, s: [[C(0), C(1)], [C(1), C(1)]] })
    expect(() => gammaIn(wall, C(1, 0))).toThrow(/resonates/)
    expect(() => gammaOut(twoPort({ f: 1e9, z0: 50, s: [[C(1), C(1)], [C(1), C(0)]] }), C(1, 0))).toThrow(/resonates/)
  })
})
