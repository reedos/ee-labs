import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {describe, it, expect} from 'vitest'
import {byId, defaultsOf} from './experiments.js'
import {analyse} from './math.js'
import {WorkedMethod} from './components/WorkedMethod.jsx'

describe('the additional circuit-analysis methods', () => {
  for (const id of ['d7', 'd8', 'd9', 'd10']) {
    it(`${id}: derivation agrees with independent circuits through sign reversals and unbalanced loads`, () => {
      const exp = byId[id]
      for (const factor of [-1, 0, .2, 1, 2]) {
        const p = {...defaultsOf(id), V1: 8 * factor, R1: 730, RL: 3900, R2: 1700, R3: 4700, V2: -2, I1: factor * .001}
        const x = analyse(exp, p)
        const study = exp.study(id, p, x)
        for (const row of study.checks) expect(Math.abs(row.predicted - row.measured), row.label).toBeLessThan(1e-8)
        expect(study.steps.length).toBeGreaterThanOrEqual(5)
        const html = renderToStaticMarkup(<WorkedMethod exp={exp} params={p} x={x} />)
        expect(html).not.toMatch(/katex-error|NaN|undefined/)
        expect(html).toContain('Independent practice')
      }
    })
  }
  it('does not claim that transformed networks preserve internal source power', () => {
    const p = defaultsOf('d7'), x = analyse(byId.d7, p)
    expect(byId.d7.study('d7', p, x).limitation).toContain('Internal resistor and source powers can differ')
  })
})
