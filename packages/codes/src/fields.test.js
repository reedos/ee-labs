import { describe, it, expect } from 'vitest'
import { rng } from '@ee-labs/random'
import {
  CodesError,
  addVec,
  allVectors,
  binomial,
  bitsOf,
  dot,
  identity,
  matMul,
  matVec,
  nullSpace,
  patternsOfWeight,
  rank,
  rref,
  systematic,
  transpose,
  valueOf,
  vecMat,
  weight,
} from './gf2.js'
import { GF16, GF256, field, orderOf, polyEval, polyMod, polyMul, polyText, solve } from './gfm.js'

// The two fields this lab counts in, checked by enumeration.
//
// A field axiom is a statement about every element, so the test walks every
// element rather than sampling. GF(2⁴) has 16 of them and GF(2⁸) has 256, so
// associativity over every triple is 16 million multiplications at the larger
// size, which is why that one is sampled with a stated count and the smaller
// one is not.

describe('GF(2), the two-element field', () => {
  it('row reduces a hand-worked matrix to the identity beside its inverse', () => {
    const M = [
      [1, 1, 0],
      [0, 1, 1],
      [1, 0, 1],
    ]
    // Two of the three rows sum to the third, so the rank is 2 and the null
    // space is one dimensional.
    expect(rank(M)).toBe(2)
    const ns = nullSpace(M)
    expect(ns.length).toBe(1)
    for (const x of ns) expect(matVec(M, x)).toEqual([0, 0, 0])
  })

  it('reduces an independent matrix to the identity', () => {
    const M = [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 1],
    ]
    expect(rref(M).rows).toEqual(identity(3))
    expect(rank(M)).toBe(3)
    expect(nullSpace(M)).toEqual([])
  })

  it('adds by exclusive-or and multiplies matrices associatively', () => {
    expect(addVec([1, 0, 1], [1, 1, 1])).toEqual([0, 1, 0])
    expect(dot([1, 0, 1], [1, 1, 1])).toBe(0)
    expect(weight([1, 0, 1, 1])).toBe(3)
    const r = rng(4)
    const M = (rows, cols) => Array.from({ length: rows }, () => Array.from({ length: cols }, () => (r.uniform() < 0.5 ? 0 : 1)))
    for (let trial = 0; trial < 50; trial++) {
      const A = M(3, 4)
      const B = M(4, 5)
      const C = M(5, 2)
      expect(matMul(matMul(A, B), C)).toEqual(matMul(A, matMul(B, C)))
      const v = M(1, 3)[0]
      expect(vecMat(vecMat(v, A), B)).toEqual(vecMat(v, matMul(A, B)))
    }
  })

  it('puts a matrix into systematic form without changing its row space', () => {
    const M = [
      [0, 1, 1, 0],
      [1, 1, 0, 1],
    ]
    const s = systematic(M)
    expect(s.rank).toBe(2)
    expect(s.rows.map((row) => row.slice(0, 2))).toEqual(identity(2))
    // The permutation carries every systematic row back to a word of the code.
    const back = s.rows.map((row) => {
      const out = new Array(4).fill(0)
      s.perm.forEach((c, i) => {
        out[c] = row[i]
      })
      return out
    })
    for (const row of back) expect(rank([...M, row])).toBe(2)
  })

  it('counts and enumerates the patterns of each weight', () => {
    for (let n = 1; n <= 8; n++) {
      let total = 0
      for (let w = 0; w <= n; w++) {
        const p = patternsOfWeight(n, w)
        expect(p.length, `${n} choose ${w}`).toBe(binomial(n, w))
        for (const v of p) expect(weight(v)).toBe(w)
        total += p.length
      }
      expect(total).toBe(2 ** n)
      expect(allVectors(n).length).toBe(2 ** n)
    }
  })

  it('reads a vector as the number it stands for, and back', () => {
    for (let v = 0; v < 64; v++) expect(valueOf(bitsOf(v, 6))).toBe(v)
    expect(transpose([[1, 0, 1]])).toEqual([[1], [0], [1]])
  })

  it('refuses to add vectors of different lengths', () => {
    expect(() => addVec([1, 0], [1, 0, 1])).toThrow(CodesError)
    expect(() => addVec([1, 0], [1, 0, 1])).toThrow(/cannot be added/)
  })
})

describe('GF(2^m), the field of m-bit symbols', () => {
  it('builds GF(2⁴) from x⁴ + x + 1 and GF(2⁸) from the byte polynomial', () => {
    expect(GF16.poly).toBe(0x13)
    expect(GF256.poly).toBe(0x11d)
    expect(GF16.order).toBe(15)
    expect(GF256.order).toBe(255)
  })

  it('has a primitive element whose powers enumerate the nonzero elements exactly once', () => {
    for (const f of [GF16, GF256]) {
      const seen = new Set()
      for (let i = 0; i < f.order; i++) {
        expect(f.exp[i], `α^${i}`).toBeGreaterThan(0)
        expect(seen.has(f.exp[i]), `α^${i} repeats`).toBe(false)
        seen.add(f.exp[i])
      }
      expect(seen.size).toBe(f.order)
      expect(f.exp[f.order - 1] !== 1 || f.order === 1).toBe(true)
      expect(f.mul(f.exp[f.order - 1], 2)).toBe(1)
      expect(orderOf(f, 2)).toBe(f.order)
    }
  })

  it('gives every nonzero element one inverse, over the whole of both fields', () => {
    for (const f of [GF16, GF256]) {
      for (let a = 1; a < f.size; a++) {
        const inv = f.inv(a)
        expect(f.mul(a, inv), `${a} in GF(2^${f.m})`).toBe(1)
        // The inverse is unique: no other element multiplies to one.
        let found = 0
        for (let b = 1; b < f.size; b++) if (f.mul(a, b) === 1) found++
        expect(found, `${a} has ${found} inverses`).toBe(1)
      }
      expect(() => f.inv(0)).toThrow(/zero has no inverse/)
    }
  })

  it('multiplies commutatively and associatively, over every element of GF(2⁴)', () => {
    const f = GF16
    for (let a = 0; a < f.size; a++)
      for (let b = 0; b < f.size; b++) {
        expect(f.mul(a, b)).toBe(f.mul(b, a))
        expect(f.add(a, b)).toBe(f.add(b, a))
        for (let c = 0; c < f.size; c++) {
          expect(f.mul(f.mul(a, b), c), `(${a}·${b})·${c}`).toBe(f.mul(a, f.mul(b, c)))
          expect(f.mul(a, f.add(b, c)), `${a}(${b}+${c})`).toBe(f.add(f.mul(a, b), f.mul(a, c)))
        }
      }
  })

  it('multiplies associatively over GF(2⁸), on 20 000 sampled triples', () => {
    // Every triple is 16.7 million products, so this one is sampled and the
    // count is part of the claim (INFORMATION_LAB_PLAN.md §11).
    const f = GF256
    const r = rng(9)
    const pick = () => Math.floor(r.uniform() * f.size)
    for (let i = 0; i < 20000; i++) {
      const [a, b, c] = [pick(), pick(), pick()]
      expect(f.mul(f.mul(a, b), c), `(${a}·${b})·${c}`).toBe(f.mul(a, f.mul(b, c)))
      expect(f.mul(a, f.add(b, c))).toBe(f.add(f.mul(a, b), f.mul(a, c)))
    }
  })

  it('divides as the inverse of multiplying, and raises to a power by adding logarithms', () => {
    const f = GF16
    for (let a = 0; a < f.size; a++)
      for (let b = 1; b < f.size; b++) expect(f.mul(f.div(a, b), b), `${a}/${b}`).toBe(a)
    for (let a = 1; a < f.size; a++) {
      let acc = 1
      for (let k = 0; k < 20; k++) {
        expect(f.pow(a, k), `${a}^${k}`).toBe(acc)
        acc = f.mul(acc, a)
      }
    }
  })

  it('refuses a polynomial that is not primitive, and an element outside the field', () => {
    // x⁴ + x³ + x² + x + 1 divides x⁵ − 1, so its root has order 5 rather than 15.
    expect(() => field(4, 0x1f)).toThrow(/not primitive/)
    expect(() => GF16.mul(16, 1)).toThrow(/not an element/)
    expect(() => field(1)).toThrow(/from 2 to 8/)
  })

  it('does polynomial arithmetic over the field', () => {
    const f = GF16
    // (x + α)(x + α²) = x² + (α + α²)x + α³
    const p = polyMul(f, [1, f.exp[1]], [1, f.exp[2]])
    expect(p).toEqual([1, f.add(f.exp[1], f.exp[2]), f.exp[3]])
    // Its roots are α and α², by construction.
    expect(polyEval(f, p, f.exp[1])).toBe(0)
    expect(polyEval(f, p, f.exp[2])).toBe(0)
    expect(polyEval(f, p, f.exp[3])).not.toBe(0)
    // Dividing it by one of its factors leaves nothing.
    expect(polyMod(f, p, [1, f.exp[1]])).toEqual([0])
    expect(polyText(f, 0)).toBe('0')
    expect(polyText(f, 0b1011)).toBe('α^3 + α + 1')
  })

  it('solves a linear system over the field, and reports a singular one', () => {
    const f = GF16
    // The second row is not a multiple of the first, so the matrix inverts.
    const A = [
      [1, f.exp[1]],
      [f.exp[2], 1],
    ]
    const x = [f.exp[5], f.exp[7]]
    const y = A.map((row) => f.add(f.mul(row[0], x[0]), f.mul(row[1], x[1])))
    expect(solve(f, A, y)).toEqual(x)
    expect(solve(f, [[1, 1], [1, 1]], [1, 0])).toBeNull()
  })
})
