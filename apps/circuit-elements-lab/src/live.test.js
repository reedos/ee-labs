import { describe, expect, test } from 'vitest'
import { EXPERIMENTS, byId, defaultsOf } from './experiments.js'
import { analyse } from './math.js'
import { bindingsOf, liveSee, liveText, provenance, quoted, readBinding, regimeOf, stands, REGIME_WORDS } from './live.js'

// Numbers a note may leave unbound: the constants of the subject and the
// zeros of a formula. Anything else in a `see` must read from the solution.
const LITERALS = {
  f3: ['0'], // "t = 0"
  f6: ['0'],
  g2: ['2'], // "R = 2√(L/C)" (the surrounding "= 200 Ω" is bound)
  g5: ['0'], // "α = 0"
  g6: ['0'],
  h1: ['0'],
}

const seeAt = (e, p) => e.seeAt ?? (e.window ? e.cursor * e.window(p) : undefined)
const atDefaults = (e) => {
  const p = defaultsOf(e.id)
  return { p, x: analyse(e, p, seeAt(e, p)) }
}

// A deterministic spread of settings: every knob nudged by a factor from a
// fixed cycle, clipped to its range, and the toggles left alone.
const FACTORS = [2, 0.5, 1.3, 0.7, 3]
const settingsOf = (e, k) => {
  const p = defaultsOf(e.id)
  e.params
    .filter((q) => q.kind !== 'toggle')
    .forEach((q, i) => {
      const v = p[q.key] * FACTORS[(i + k) % FACTORS.length]
      p[q.key] = Math.min(q.max, Math.max(q.min, v))
    })
  return p
}

describe('notes that are alive', () => {
  test('at the defaults every note renders exactly as written', () => {
    for (const e of EXPERIMENTS) {
      const { p, x } = atDefaults(e)
      expect(liveText(liveSee(e, x, p)), e.id).toBe(e.see)
    }
  })

  test('every number in a note is bound to the solution, bar the listed constants', () => {
    for (const e of EXPERIMENTS) {
      const literal = bindingsOf(e)
        .filter((b) => b.kind === 'literal')
        .map((b) => b.text)
      expect(literal, `${e.id} unbound: ${literal.join(', ')}`).toEqual(LITERALS[e.id] || [])
    }
  })

  test('the tokens a note binds are the same ones the justification test counts', () => {
    // A `see` with numbers has bindings; the bindings cover every unit-bearing number.
    for (const e of EXPERIMENTS) {
      const units = quoted(e.see).filter((q) => q.unit !== '')
      const bound = bindingsOf(e).filter((b) => b.unit !== '')
      expect(bound.length, e.id).toBe(units.length)
    }
    expect(EXPERIMENTS.filter((e) => bindingsOf(e).some((b) => b.kind !== 'literal')).length).toBeGreaterThanOrEqual(44)
  })

  test('a knob named just before its number claims it', () => {
    const c4 = bindingsOf(byId.c4)
    expect(c4.find((b) => b.text === '1010 Ω')).toMatchObject({ kind: 'knob', key: 'R4' })
    expect(c4.find((b) => b.text === '1000 Ω')).toMatchObject({ kind: 'knob', key: 'R1' })
    // "behind 500 Ω into 500 Ω" — R_s then R_L, not R_s twice.
    expect(bindingsOf(byId.d6).filter((b) => b.text === '500 Ω').map((b) => b.key)).toEqual(['Rs', 'RL'])
    // D3's two 3 mA are i₂ and the shared resistor's difference current.
    expect(bindingsOf(byId.d3).filter((b) => b.text === '3 mA').map((b) => b.key)).toEqual(['i.R3', 'i.R2'])
  })

  test('at other settings each bound number re-reads the live value, printed faithfully', () => {
    let changed = 0
    for (const e of EXPERIMENTS) {
      for (let k = 0; k < FACTORS.length; k++) {
        const p = settingsOf(e, k)
        const x = analyse(e, p, seeAt(e, p))
        const segs = liveSee(e, x, p)
        for (const s of segs) {
          if (!s.live) continue
          const b = bindingsOf(e).find((q) => (q.kind === 'knob' ? `knob:${q.key}` : q.kind === 'cursor' ? 'cursor' : `${q.kind}:${q.key}`) === s.key)
          const v = readBinding(b, e, x, p)
          if (!Number.isFinite(v)) {
            expect(s.text, `${e.id} ${s.key}`).toBe('—')
            continue
          }
          const [q] = quoted(`= ${s.text}`) // a bare reprint ("ζ = 0.09") is read as the sentence reads it
          expect(q, `${e.id} ${s.key} printed ${s.text}`).toBeDefined()
          expect(stands(q, v), `${e.id} ${s.key}: "${s.text}" for ${v}`).toBe(true)
          if (/^[-−]/.test(s.text)) expect(v, `${e.id} ${s.key} sign`).toBeLessThan(0)
          if (s.changed) changed++
        }
      }
    }
    expect(changed).toBeGreaterThan(300)
  })

  test('a note keeps its own words while they still stand, and marks what it reprints', () => {
    const e = byId.a1
    const p = { ...defaultsOf('a1'), E: 12.02 } // 12.02 V still reads as "12 V"
    const s = liveSee(e, analyse(e, p), p).filter((t) => t.live)
    expect(s.map((t) => t.text)).toEqual(['12 V', '12 mA'])
    expect(s.every((t) => !t.changed)).toBe(true)
    const p2 = { ...defaultsOf('a1'), E: 24 }
    const s2 = liveSee(e, analyse(e, p2), p2).filter((t) => t.live)
    expect(s2.map((t) => [t.text, t.changed])).toEqual([
      ['24 V', true],
      ['24 mA', true],
    ])
  })

  test('a written minus tracks the sign; a magnitude stays a magnitude', () => {
    const b3 = byId.b3
    const p = { ...defaultsOf('b3'), E: 6 }
    const s = liveSee(b3, analyse(b3, p), p).filter((t) => t.live)
    expect(s.at(-1).text).toBe('−6 mW') // the source still delivers
    // F7's "swinging 0.25 V either side" is a magnitude: it reads 0.25 V whichever way the triangle points.
    const f7 = byId.f7
    const p7 = defaultsOf('f7')
    for (const t of [0.25, 0.75].map((f) => f * f7.window(p7))) {
      const x7 = analyse(f7, p7, t)
      expect(liveText(liveSee(f7, x7, p7)), `t = ${t}`).toContain('swinging 0.25 V either side')
    }
  })

  test('G2 names the repeated root −α from the positive α the solver keeps', () => {
    const b = bindingsOf(byId.g2).find((q) => q.text === '−10 krad/s')
    expect(b).toMatchObject({ kind: 'read', key: 'state.alpha', flip: true })
    const p = { ...defaultsOf('g2'), R1: 400 }
    const s = liveSee(byId.g2, analyse(byId.g2, p), p).filter((t) => t.live)
    expect(s.find((t) => t.key === 'read:state.alpha').text).toBe('−20 krad/s')
  })

  test('the regime a note was written for, and when a knob leaves it', () => {
    for (const id of ['g1', 'g2', 'g4', 'g5']) {
      const e = byId[id]
      const { p, x } = atDefaults(e)
      expect(REGIME_WORDS[regimeOf(x, e)], id).toBeDefined()
    }
    const { p, x } = atDefaults(byId.g1)
    expect(regimeOf(x, byId.g1)).toBe('overdamped')
    const p2 = { ...p, R1: 50 }
    expect(regimeOf(analyse(byId.g1, p2, seeAt(byId.g1, p2)), byId.g1)).toBe('underdamped')
    // Notes with no damping story have no regime to leave; a refusal is one.
    const h4 = atDefaults(byId.h4)
    expect(regimeOf(h4.x, byId.h4)).toBe(null)
    const a1 = atDefaults(byId.a1)
    expect(regimeOf(a1.x, byId.a1)).toBe(null)
    const e3 = atDefaults(byId.e3)
    expect(regimeOf(e3.x, byId.e3)).toBe('refused')
  })

  test('a diode lesson retires when a knob moves the circuit to a different arrangement of its diodes', () => {
    // I3 is written about D₁ conducting and D₂ blocking. Reverse the supply and
    // every number still re-reads — but the sentence naming which diode is on
    // does not, and that is the class of defect the provenance line exists for.
    const i3 = byId.i3
    const p = defaultsOf('i3')
    expect(regimeOf(analyse(i3, p), i3)).toBe('regions:D1=on,D2=off')
    const flipped = { ...p, E: -5 }
    const prov = provenance(i3, analyse(i3, flipped), false)
    expect(prov).toMatch(/written for a circuit with D1 conducting and D2 blocking/)
    expect(prov).toMatch(/at your settings it is D1 blocking and D2 conducting/)
    expect(prov).toMatch(/the story may not hold/)
    // Below both drops neither conducts, and that is a third arrangement.
    expect(provenance(i3, analyse(i3, { ...p, E: 0.5 }), false)).toMatch(/D1 blocking and D2 blocking/)
    // Untouched, the note is the note: no provenance line at all.
    expect(provenance(i3, analyse(i3, p), true)).toBe(null)
    // And I8's regulator, which is written about a Zener in breakdown.
    const i8 = byId.i8
    const d8 = defaultsOf('i8')
    expect(regimeOf(analyse(i8, d8), i8)).toBe('regions:D1=zener')
    expect(provenance(i8, analyse(i8, { ...d8, RL: 220 }), false)).toMatch(/written for a circuit with D1 in breakdown; at your settings it is D1 blocking/)
  })
})
