import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {describe, it, expect} from 'vitest'
import {byId, defaultsOf} from './experiments.js'
import {analyse} from './math.js'
import {acEquivalent} from './completionAC.js'
import {WorkedMethod} from './components/WorkedMethod.jsx'

describe('AC equivalents and design', () => {
  for (const id of ['h9', 'h10', 'h11']) it(`${id}: complex reduction and native nodal analysis agree`, () => {
    for (const amplitude of [-7, 0, 5]) for (const frequency of [100, 900, 4000]) {
      const p = {...defaultsOf(id), A: amplitude, f: frequency, phi: 35}, exp = byId[id], x = analyse(exp, p)
      const study = exp.study(id, p, x)
      for (const r of study.checks) expect(Math.abs(r.predicted - r.measured), r.label).toBeLessThan(1e-8)
      expect(renderToStaticMarkup(<WorkedMethod exp={exp} params={p} x={x} />)).not.toMatch(/katex-error|NaN|undefined/)
    }
  })
  it('applying the calculated match maximizes power locally', () => {
    const exp = byId.h10, p = defaultsOf('h10'), study = exp.study(exp.id, p, analyse(exp, p))
    const matched = {...p, ...study.action.settings}
    const loadPower = p => .5 * acEquivalent(p).I.reduce((s, v) => s + v * v, 0) * p.R2
    const maximum = loadPower(matched)
    for (const factor of [.7, .95, 1.05, 1.3]) {
      expect(loadPower({...matched, R2: matched.R2 * factor})).toBeLessThan(maximum)
      expect(loadPower({...matched, L1: matched.L1 * factor})).toBeLessThan(maximum)
    }
  })
  it('the calculated capacitor cancels source reactive power', () => {
    const exp = byId.h11, p = defaultsOf('h11'), study = exp.study(exp.id, p, analyse(exp, p))
    const corrected = {...p, ...study.action.settings}
    expect(Math.abs(acEquivalent(corrected).S[1])).toBeLessThan(1e-12)
    const x = analyse(exp, corrected)
    for (const r of exp.study(exp.id, corrected, x).checks) expect(Math.abs(r.predicted - r.measured)).toBeLessThan(1e-8)
  })
})
