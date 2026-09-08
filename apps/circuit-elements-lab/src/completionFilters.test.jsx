import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {describe,it,expect} from 'vitest'
import {byId,defaultsOf} from './experiments.js'
import {analyse} from './math.js'
import {WorkedMethod} from './components/WorkedMethod.jsx'
describe('filter and Fourier derivations',()=>{
  for(const id of ['k1','k2','k3','k4']) it(id,()=>{
    for(const override of [{},{A:0},{A:-3,phi:70},{f:130,harmonics:25,v0:3},{f:900,harmonics:1,v0:-2}]){
      const exp=byId[id],p={...defaultsOf(id),...override},x=analyse(exp,p)
      expect(x.sol,x.refusal?.message).toBeTruthy()
      for(const c of exp.study(id,p,x).checks) expect(Math.abs(c.predicted-c.measured),c.label).toBeLessThan(c.abs+1e-7)
      expect(Math.abs(exp.closedHeadline(p,x)-exp.headline.value(x))).toBeLessThan(1e-7)
      expect(renderToStaticMarkup(<WorkedMethod exp={exp} params={p} x={x}/>)).not.toMatch(/katex-error|NaN|undefined/)
    }
  })
})
