import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {describe, it, expect} from 'vitest'
import {byId, defaultsOf} from './experiments.js'
import {analyse} from './math.js'
import {WorkedMethod} from './components/WorkedMethod.jsx'

describe('coupled and three-phase circuit foundations', () => {
  for (const id of ['l1','l2','l3','l4']) it(`${id}: circuit and worked method agree`, () => {
    for (const over of [{}, {opposed: true, neutral: true}, {k: 0, R1: 70, R2: 130, R3: 40}, {f: 240}]) {
      const exp = byId[id], p = {...defaultsOf(id), ...over}, x = analyse(exp, p)
      expect(x.sol, x.refusal?.message).toBeTruthy()
      const study = exp.study(id, p, x)
      for (const r of study.checks) expect(Math.abs(r.predicted - r.measured), `${id} ${r.label}`).toBeLessThan(1e-7)
      expect(Math.abs(exp.closedHeadline(p, x) - exp.headline.value(x))).toBeLessThan(1e-7)
      expect(renderToStaticMarkup(<WorkedMethod exp={exp} params={p} x={x} />)).not.toMatch(/katex-error|NaN|undefined/)
    }
  })
})
