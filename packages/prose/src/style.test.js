import { describe, expect, it } from 'vitest'
import { styleReport, violations, sentences, words } from './style.js'
import { BUDGETS } from './style.js'

// The rules are only worth having if they catch the sentences that prompted
// them. Every case below is a real string from the suite before the rewrite, or
// its replacement, so a change to the regexes that stops catching the old voice
// fails here.

describe('the counters', () => {
  it('splits sentences without breaking on decimals', () => {
    const s = 'The output is 5.000 V with 3.65 mV of ripple. The filter passes the average.'
    expect(sentences(s)).toHaveLength(2)
    expect(words(s)).toBe(15)
  })

  it('counts em dashes and semicolons', () => {
    const r = styleReport(
      'Voltage is energy per unit of charge — how hard each coulomb is pushed; the source decides.',
    )
    expect(r.emDash).toBe(1)
    expect(r.semicolon).toBe(1)
  })

  it('counts a colon that reveals, and leaves a colon that introduces', () => {
    // Two full clauses joined by a colon: the shape S4 bans.
    expect(
      styleReport(
        "The cutoff is not a convention: it is the frequency where the capacitor's impedance equals the resistor's.",
      ).colonReveal,
    ).toBe(1)
    // A colon introducing a list, a definition or a value: allowed.
    expect(styleReport('Admissible: every block, every cascade, every comb.').colonReveal).toBe(0)
    expect(styleReport("Ohm's law read the other way: v = I·R.").colonReveal).toBe(0)
  })

  it('reports a fragment, and does not report a long sentence as one', () => {
    expect(styleReport('One sine, one line.').fragments).toBe(1)
    expect(styleReport('One sine wave produces one line in the spectrum.').fragments).toBe(0)
    expect(
      styleReport(
        'In steady state the inductor current ends each period where it began, so its voltage averages to zero.',
      ).fragments,
    ).toBe(0)
  })
})

describe('the banned constructions', () => {
  const caught = (s) => violations(s, {}, 'x').join(' ')

  it('catches personified solvers and loops', () => {
    expect(caught('the solver refuses the circuit and says why')).toMatch(/S7/)
    expect(caught('the loop must fight it off')).toMatch(/S7/)
  })

  it('catches praise of the work and theatrical second person', () => {
    expect(caught('the thing that makes this subject worth loving')).toMatch(/S8/)
    expect(caught('the resonance stands up in front of you')).toMatch(/S10/)
  })

  it('catches the aphoristic closer and emphasis by capital', () => {
    expect(caught('does not move by a microvolt — that is what a source means')).toMatch(/S1/)
    expect(caught('THAT is why feedback exists')).toMatch(/S9/)
  })

  it('passes the rewritten forms', () => {
    expect(
      violations(
        'The source sets the voltage. The resistor sets the current. Lower R and the current rises while the source voltage stays at 12 V.',
        BUDGETS.see,
        'see',
      ),
    ).toEqual([])
    expect(
      violations(
        'A disturbance enters at the plant, as a load transient or supply ripple would. Under proportional control it leaves a permanent offset of P(0)/(1+L(0)), which is 0.1 here.',
        BUDGETS.note,
        'note',
      ),
    ).toEqual([])
  })
})

describe('the budgets', () => {
  it('holds a note to its word cap and sentence average', () => {
    const long = `${'word '.repeat(95)}.`
    expect(violations(long, BUDGETS.note, 'note').join(' ')).toMatch(/words, cap 90/)
  })

  it('allows one em dash per 150 words and no more', () => {
    const short = 'A parenthetical — one only — in a short note.'
    expect(violations(short, BUDGETS.note, 'note').join(' ')).toMatch(/em dashes/)
  })
})
