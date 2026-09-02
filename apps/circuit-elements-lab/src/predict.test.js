import { describe, expect, test } from 'vitest'
import { EXPERIMENTS, byId, defaultsOf } from './experiments.js'
import { analyse } from './math.js'
import { readQuantity } from './lessons.js'
import { predictFor, printQ, nameOf, unitOf } from './predict.js'

const ITEMS = EXPERIMENTS.map((e) => [e.id, predictFor(e)]).filter(([, q]) => q)

describe('predict before you turn', () => {
  test('most experiments pose a question, and every one that does has three distinct answers', () => {
    expect(ITEMS.length).toBeGreaterThanOrEqual(36)
    for (const [id, q] of ITEMS) {
      expect(q.options, id).toHaveLength(3)
      expect(new Set(q.options.map((o) => o.text)).size, id).toBe(3)
      expect(q.options.filter((o) => o.rule === 'solver'), id).toHaveLength(1)
      // Sorted, so the student sees small → large and cannot read the answer off its position.
      const values = q.options.map((o) => o.value)
      expect([...values].sort((a, b) => a - b), id).toEqual(values)
    }
  })

  test('the right answer is what the solver reads once the knob is set', () => {
    for (const [id, q] of ITEMS) {
      const e = byId[id]
      const p = { ...defaultsOf(id), ...q.set }
      const x = analyse(e, p, e.try[q.step].at)
      const v = readQuantity(x, p, q.path, e)
      expect(v, id).toBeCloseTo(q.correct, 9)
      expect(q.options.find((o) => o.rule === 'solver').text, id).toBe(printQ(v, q.unit))
    }
  })

  test('the question names the knob and the quantity, and the reason is the step’s own sentence', () => {
    for (const [id, q] of ITEMS) {
      const e = byId[id]
      const knob = e.params.find((k) => k.key === q.knob)
      expect(q.ask, id).toContain(knob.label)
      expect(q.ask, id).toContain(nameOf(q.path))
      expect(q.ask, id).toMatch(/^Set .+ to .+: what does .+ read\?$/)
      expect(q.reason, id).toBe(e.try[q.step].say)
    }
  })

  test('the wrong answers are the student’s habits — same, proportional, inverse, double, half', () => {
    const rules = new Set(ITEMS.flatMap(([, q]) => q.options.map((o) => o.rule)))
    rules.delete('solver')
    for (const r of rules) expect(['same', 'proportional', 'inverse', 'double', 'half']).toContain(r)
    // A1 at R = 100 Ω: Ohm's law says 120 mA; "nothing changes" says 12 mA; "current falls with R" says 1.2 mA.
    const a1 = predictFor(byId.a1)
    expect(a1.options.map((o) => o.text)).toEqual(['1.2 mA', '12 mA', '120 mA'])
    expect(a1.options[2].rule).toBe('solver')
  })

  test('readings print the way a student writes them', () => {
    expect(printQ(0.012, 'A')).toBe('12 mA')
    expect(printQ(-3, 'V')).toBe('−3 V')
    expect(printQ(0.95, '')).toBe('0.95')
    expect(printQ(1e6, '')).toBe('1 million')
    expect(printQ(-43.1, '°')).toBe('−43.1°')
    expect(printQ(-3.01, 'dB')).toBe('−3.01 dB')
    expect(unitOf('i.R1')).toBe('A')
    expect(unitOf('state.tau')).toBe('s')
    expect(unitOf('state.zeta')).toBe('')
    expect(unitOf('mag.volt.C1')).toBe('V')
    expect(unitOf('H.db')).toBe('dB')
    expect(nameOf('i.R2')).toBe('the current through R₂')
    expect(nameOf('thevenin.voc')).toBe('V_th')
    expect(nameOf('state.alpha')).toBe('α')
  })

  test('experiments whose first knob step is a toggle or a refusal pose no question', () => {
    const none = EXPERIMENTS.filter((e) => !predictFor(e)).map((e) => e.id)
    // i5's first step chooses a diode model, which is a structural choice
    // like a toggle: there is no number to predict.
    expect(none).toEqual(['a3', 'd2', 'd4', 'e3', 'e6', 'g3', 'g5', 'i5'])
  })
})
