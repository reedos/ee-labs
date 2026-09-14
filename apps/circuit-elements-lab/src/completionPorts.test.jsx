import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {describe, it, expect} from 'vitest'
import {byId, defaultsOf} from './experiments.js'
import {analyse} from './math.js'
import {WorkedMethod} from './components/WorkedMethod.jsx'

describe('two-port and capstone circuit checks', () => {
  for (const id of ['e10','m1','m2','m3','g8','n1']) it(`${id}: circuit and worked method agree`, () => {
    for (const over of [{}, {V1: -8, V2: 5, E: -4, A: -3, phi: 60}, {R1: 700, R2: 1300, R3: 400}, {f: 240, v0: -2, i0: .003}]) {
      const exp = byId[id], p = {...defaultsOf(id), ...over}, x = analyse(exp, p)
      expect(x.sol, x.refusal?.message).toBeTruthy()
      const study = exp.study(id, p, x)
      for (const r of study.checks) expect(Math.abs(r.predicted - r.measured), `${id} ${r.label}`).toBeLessThan(1e-7)
      expect(Math.abs(exp.closedHeadline(p, x) - exp.headline.value(x))).toBeLessThan(1e-7)
      expect(renderToStaticMarkup(<WorkedMethod exp={exp} params={p} x={x} />)).not.toMatch(/katex-error|NaN|undefined/)
    }
  })
})
