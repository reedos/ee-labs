import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {describe, it, expect} from 'vitest'
import {byId, defaultsOf} from './experiments.js'
import {analyse} from './math.js'
import {WorkedMethod} from './components/WorkedMethod.jsx'

describe('complete responses and Laplace inversion', () => {
  for (const id of ['f8', 'f9', 'j1', 'j2', 'j3', 'j4', 'j5', 'j6', 'j7']) {
    it(`${id}: independent inversion agrees with state-space evolution`, () => {
      const exp = byId[id]
      for (const factor of [-1, 0, 1, 2]) {
        const p = {...defaultsOf(id), E: 3 * factor}
        if ('v0' in p) p.v0 = -factor
        if ('i0' in p) p.i0 = factor * .002
        for (const fraction of [0, .03, .2, .8]) {
          const x = analyse(exp, p, fraction * exp.window(p))
          expect(x.sol, x.refusal?.message).toBeTruthy()
          const study = exp.study(id, p, x)
          for (const row of study.checks) expect(Math.abs(row.predicted - row.measured), `${id} ${fraction} ${row.label}`).toBeLessThan(1e-7)
          expect(Math.abs(exp.closedHeadline(p, x) - x.sol.volt.C1)).toBeLessThan(1e-7)
          const html = renderToStaticMarkup(<WorkedMethod exp={exp} params={p} x={x} />)
          expect(html).not.toMatch(/katex-error|NaN|undefined/)
        }
      }
    })
  }
})
