import { describe, it, expect } from 'vitest'
import { CARD, psOf } from './engine/card.js'
import { EXPERIMENTS, GROUPS, VIEW_LABELS, VIEW_ORDER, byId, defaultsOf, noteOf, signalsOf } from './experiments.js'
import { analyse, kindOf, quantitiesOf, readQuantity } from './analysis.js'

// Every note makes a claim, and every claim is measured here.
//
// The rule this lab adds to the suite's: no number in a lesson is a constant in
// a test. Two tests hold that. The register checks below require every quoted
// number to be a reading the engine produced at the setting the register names.
// And "every time scales with the card" runs all thirty experiments a second
// time on a model card with every delay doubled, and requires every time to
// double while every count stays where it is. A number typed into a group file
// instead of computed cannot pass both.

/**
 * What this sitting has built, as the two counts the sidebar shows and
 * `NEEDS.md` gives the progression test. The plan names 30 experiments in 7
 * groups, and this number moves when a group lands and not before.
 */
const BUILT = { groups: 7, experiments: 30 }

const at = (id, over = {}) => {
  const exp = byId[id]
  const p = { ...defaultsOf(id), ...over }
  return { exp, p, x: analyse(exp, p) }
}

describe('every experiment', () => {
  it('has a unique id, a group from the list, knobs, views and a first pane', () => {
    const ids = new Set()
    for (const e of EXPERIMENTS) {
      expect(ids.has(e.id), e.id).toBe(false)
      ids.add(e.id)
      expect(GROUPS, e.id).toContain(e.group)
      expect(e.name.length, e.id).toBeGreaterThan(8)
      expect(e.params.length, e.id).toBeGreaterThan(0)
      expect(e.views, e.id).toContain(e.view)
      expect(VIEW_ORDER, `${e.id} main`).toContain(e.main)
      for (const v of e.views) expect(VIEW_ORDER, `${e.id} view ${v}`).toContain(v)
      for (const k of e.params) {
        if (k.kind === 'bit') {
          expect([0, 1], `${e.id}.${k.key}`).toContain(k.default)
          continue
        }
        if (k.kind === 'choice') {
          expect(k.options.length, `${e.id}.${k.key}`).toBeGreaterThan(1)
          expect(k.options.map((o) => o.value), `${e.id}.${k.key} default`).toContain(k.default)
          continue
        }
        expect(k.default, `${e.id}.${k.key}`).toBeGreaterThanOrEqual(k.min)
        expect(k.default, `${e.id}.${k.key}`).toBeLessThanOrEqual(k.max)
      }
    }
  })

  it('runs at its defaults, and every quantity it names is a finite reading', () => {
    for (const e of EXPERIMENTS) {
      const { x, p } = at(e.id)
      const rows = quantitiesOf(x)
      expect(rows.length, `${e.id} produces readings`).toBeGreaterThan(2)
      for (const r of rows) {
        expect(VALID_KINDS, `${e.id} ${r.path}`).toContain(kindOf(r.path))
        expect(typeof r.label, `${e.id} ${r.path} has a label`).toBe('string')
        if (typeof r.read === 'string') continue
        expect(Number.isFinite(r.read), `${e.id} ${r.path} reads ${r.read}`).toBe(true)
      }
      for (const s of signalsOf(e, p)) expect(x.norm.nets, `${e.id} draws ${s}`).toContain(s)
    }
  })

  const VALID_KINDS = ['ps', 'ns', 'g', 'freq', 'share', 'cycles', 'bytes', 'n', 'word', 'text']

  it('every time scales with the model card, and every count does not', () => {
    // The card with every delay doubled. A time the engine computed doubles
    // with it. A count, a share and a gate delay do not, because none of them
    // is a time. A number typed into a group file fails whichever way it goes.
    const twice = {
      ...CARD,
      gate: 2 * CARD.gate,
      inverter: 2 * CARD.inverter,
      fo4: 2 * CARD.fo4,
      tcq: 2 * CARD.tcq,
      tsu: 2 * CARD.tsu,
      th: 2 * CARD.th,
    }
    for (const e of EXPERIMENTS) {
      const p = defaultsOf(e.id)
      const one = analyse(e, p)
      const two = analyse(e, p, twice)
      for (const r of quantitiesOf(one)) {
        const other = quantitiesOf(two).find((o) => o.path === r.path)
        expect(other, `${e.id} ${r.path} at the second card`).toBeTruthy()
        if (typeof r.read === 'string') continue
        // A reading is a time, a rate or neither, and the kind says which.
        // The two entries that are a time under another name say so
        // themselves, with `scale`.
        const kind = r.scale || kindOf(r.path)
        const want = kind === 'ps' || kind === 'ns' || kind === 'time' ? 2 * r.read : kind === 'freq' || kind === 'rate' ? r.read / 2 : r.read
        expect(close(other.read, want), `${e.id} ${r.path}: ${r.read} became ${other.read}, and ${want} was the card's answer`).toBe(true)
      }
    }
  })
})

const close = (got, want) => (want === 0 ? Math.abs(got) < 1e-9 : Math.abs(got - want) <= Math.max(1e-9, 1e-6 * Math.abs(want)))

// The lesson registers, measured. A step's `set` is applied over the defaults,
// each `reads` pair is solved and compared, and then every number in the
// sentence has to be one of those readings or a knob value.
describe('every lesson is measured', () => {
  const SCALE = { p: 1, n: 1e3, µ: 1e6, u: 1e6, m: 1e9, '': 1e12 }
  const HZ = { k: 1e3, M: 1e6, G: 1e9, '': 1 }
  const TIME = /(-?\d[\d ]*(?:\.\d+)?)\s*([pnµum]?)s(?![A-Za-z])/g
  const FREQ = /(-?\d+(?:\.\d+)?)\s*([kMG]?)Hz(?![A-Za-z])/g
  const PERCENT = /(-?\d+(?:\.\d+)?)\s*%/g
  const SIZE = /(-?\d+(?:\.\d+)?)\s*(kB|MB|B)(?![A-Za-z])/g
  const NOUN =
    /(-?\d[\d\s]*(?:\.\d+)?)[\s-](gate delays?|gates?|cycles?|bits?|bytes?|words?|references?|addresses|blocks?|ways?|sets?|lines?|instructions?|misses|hits|stalls?|bubbles?|states?|opcodes?|signals?|rows?|entries|pages?|stages?|registers?|adders?|iterations?|branches|mispredictions?|reads?|writes?|levels?)(?![A-Za-z])/g
  const BARE = /(?<![\d.])(-?\d+\.\d+)(?![\d])/g

  /**
   * Every number-with-a-unit in a sentence, in the unit a reading uses.
   *
   * Each rule takes its matches out of the string before the next rule runs,
   * so "51.95 %" is one reading of a share and not also a bare 51.95.
   */
  const quoted = (text) => {
    let s = String(text).replace(/−/g, '-')
    const out = []
    const take = (re, valueOf) => {
      s = s.replace(re, (...args) => {
        const m = args.slice(0, -2)
        out.push({ text: m[0].trim(), digits: (m[1].split('.')[1] || '').length, value: Math.abs(valueOf(m)) })
        return ' '.repeat(m[0].length)
      })
    }
    take(TIME, (m) => +m[1].replace(/ /g, '') * SCALE[m[2]])
    take(FREQ, (m) => +m[1] * HZ[m[2]])
    take(PERCENT, (m) => +m[1] / 100)
    take(SIZE, (m) => +m[1] * (m[2] === 'MB' ? 2 ** 20 : m[2] === 'kB' ? 1024 : 1))
    take(NOUN, (m) => +m[1].replace(/\s/g, ''))
    take(BARE, (m) => +m[1])
    return out
  }
  /** A quoted number stands for a value when it is that value rounded to the digits printed. */
  const stands = (q, v) => {
    const half = 0.5 * 10 ** -q.digits
    return Math.abs(q.value - Math.abs(v)) <= Math.max(1e-9, half * (1 + 1e-9), 1e-4 * Math.abs(v))
  }
  const words = (s) => s.trim().split(/\s+/).length
  const knobOf = (e, key) => e.params.find((k) => k.key === key)
  const knobValues = (e) => e.params.filter((k) => !k.kind).map((k) => k.default)

  /** Solve one register and check its reads. Returns the numbers it justifies. */
  function measure(e, p, reads, label) {
    const x = analyse(e, p)
    const values = []
    for (const [path, want] of reads) {
      const got = readQuantity(x, path)
      if (typeof want === 'string') {
        expect(got, `${label}: ${path} reads ${got}, the lesson says ${want}`).toBe(want)
        continue
      }
      expect(Number.isFinite(got), `${label}: ${path} is ${got}`).toBe(true)
      expect(near(got, want), `${label}: ${path} reads ${got}, the lesson says ${want}`).toBe(true)
      values.push(want)
      // A time is quoted in nanoseconds as readily as in picoseconds, and a
      // share is quoted as a percentage, so both readings justify both forms.
      if (path.startsWith('ns.')) values.push(want * 1000)
      if (path.startsWith('ps.')) values.push(want / 1000)
    }
    return values
  }
  const near = (got, want) => Math.abs(got - want) <= Math.max(1e-9, 5e-4 * Math.abs(want) || 1e-9)

  /** Every quoted number in `text` stands for one of `values`. */
  function justified(text, values, label) {
    for (const q of quoted(text)) {
      const ok = values.some((v) => stands(q, v))
      expect(ok, `${label}: "${q.text}" is not a reading or a knob value (have ${values.map((v) => +v.toPrecision(6)).join(', ')})`).toBe(true)
    }
  }

  it('every experiment has a see, two to four tries and a why, all within their budgets', () => {
    for (const e of EXPERIMENTS) {
      expect(typeof e.see, e.id).toBe('string')
      expect(typeof e.why, e.id).toBe('string')
      expect(e.try.length, `${e.id} tries`).toBeGreaterThanOrEqual(2)
      expect(e.try.length, `${e.id} tries`).toBeLessThanOrEqual(4)
      expect(words(e.see), `${e.id} see is ${words(e.see)} words`).toBeLessThanOrEqual(70)
      expect(words(e.why), `${e.id} why is ${words(e.why)} words`).toBeLessThanOrEqual(160)
      for (const t of e.try) expect(words(t.say), `${e.id} try "${t.say.slice(0, 30)}…" is ${words(t.say)} words`).toBeLessThanOrEqual(45)
      expect(noteOf(e)).toBe(`${e.see} ${e.why}`)
    }
  })

  it('the numbers in see and why are readings at the defaults, or at a setting the register names', () => {
    for (const e of EXPERIMENTS) {
      const p = defaultsOf(e.id)
      const seen = measure(e, p, e.seeReads || [], `${e.id} see`)
      const also = (list, label) =>
        (list || []).flatMap((a, i) => [
          ...Object.entries(a.set || {})
            .filter(([key]) => !knobOf(e, key).kind)
            .map(([, v]) => v),
          ...measure(e, { ...p, ...a.set }, a.reads || [], `${label} also ${i + 1}`),
        ])
      const seeAlso = also(e.seeAlso, `${e.id} see`)
      justified(e.see, [...seen, ...seeAlso, ...knobValues(e)], `${e.id} see`)
      const why = measure(e, p, e.whyReads || [], `${e.id} why`)
      const whyAlso = also(e.whyAlso, `${e.id} why`)
      justified(e.why, [...why, ...whyAlso, ...seen, ...seeAlso, ...knobValues(e)], `${e.id} why`)
    }
  })

  it('every try sets knobs inside their range and reads what it says', () => {
    let steps = 0
    for (const e of EXPERIMENTS) {
      const d = defaultsOf(e.id)
      e.try.forEach((t, i) => {
        const label = `${e.id} try ${i + 1}`
        const values = []
        for (const [key, v] of Object.entries(t.set || {})) {
          const k = knobOf(e, key)
          expect(k, `${label} sets ${key}, which is not a knob`).toBeDefined()
          if (k.kind === 'bit') expect([0, 1], `${label} ${key}`).toContain(v)
          else if (k.kind === 'choice') expect(k.options.map((o) => o.value), `${label} ${key}`).toContain(v)
          else {
            expect(v, `${label} ${key} below min`).toBeGreaterThanOrEqual(k.min)
            expect(v, `${label} ${key} above max`).toBeLessThanOrEqual(k.max)
            values.push(v)
          }
        }
        const p = { ...d, ...(t.set || {}) }
        values.push(...measure(e, p, t.reads || [], label))
        justified(t.say, [...values, ...knobValues(e)], label)
        steps++
      })
    }
    expect(steps).toBeGreaterThanOrEqual(2 * EXPERIMENTS.length)
  })

  it('readQuantity names the paths an experiment has, and refuses one it does not', () => {
    const a1 = at('a1')
    expect(readQuantity(a1.x, 'g.carry')).toBe(64)
    expect(psOf(a1.x.q['ps.carry'].value)).toBe(readQuantity(a1.x, 'ps.carry'))
    expect(() => readQuantity(a1.x, 'ps.nothing')).toThrow(/does not produce that quantity/)
  })
})

describe('the chrome names what it shows', () => {
  it('every view in the order has a label and a hover title', () => {
    for (const v of VIEW_ORDER) {
      expect(VIEW_LABELS[v], v).toBeDefined()
      expect(VIEW_LABELS[v].label.split(/\s+/).length, `${v} label`).toBeLessThanOrEqual(4)
      expect(VIEW_LABELS[v].title.length, `${v} title`).toBeGreaterThan(20)
    }
  })

  it('every group heading names its content, and every experiment belongs to a built one', () => {
    const built = GROUPS.filter((g) => EXPERIMENTS.some((e) => e.group === g))
    for (const g of GROUPS) expect(g, g).toMatch(/^[A-G] · /)
    for (const e of EXPERIMENTS) expect(built, e.id).toContain(e.group)
    expect(GROUPS.length).toBe(7)
    expect(built.length).toBe(BUILT.groups)
    expect(EXPERIMENTS.length).toBe(BUILT.experiments)
  })

  it('offers the Numbers pane everywhere, so every reading a lesson quotes is on screen', () => {
    for (const e of EXPERIMENTS) expect(e.views, e.id).toContain('counts')
  })
})
