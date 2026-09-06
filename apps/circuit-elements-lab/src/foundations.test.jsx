import React from 'react'
import { it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import katex from 'katex'
import { complex as cx } from '@ee-labs/network'
import { EXPERIMENTS, byId, defaultsOf } from './experiments.js'
import { analyse } from './math.js'
import { FOUNDATIONS, foundationFor, foundationSteps } from './foundations.js'
import { FoundationsPane } from './components/FoundationsPane.jsx'

const close = (a,b) => expect(Math.abs(a-b)).toBeLessThan(1e-7*Math.max(1,Math.abs(a),Math.abs(b)))

it('introduces each method at its first use, before frequency response', () => {
  expect(EXPERIMENTS.find(e=>e.views.includes('state')).id).toBe('f1')
  expect(EXPERIMENTS.find(e=>e.views.includes('phasor')).id).toBe('h1')
  expect(EXPERIMENTS.find(e=>e.views.includes('state') && e.net(defaultsOf(e.id)).elements.filter(e=>['C','L'].includes(e.type)).length>1).id).toBe('g1')
  for(const id of Object.keys(FOUNDATIONS)) expect(byId[id].view).toBe('foundations')
  const order=EXPERIMENTS.map(e=>e.id)
  expect(order.indexOf('h8')).toBeLessThan(order.indexOf('h6'))
  expect(order.indexOf('h8')).toBeGreaterThan(order.indexOf('h5'))
  for(const e of EXPERIMENTS) for(const view of ['state','phasor']) {
    if(!e.views.includes(view)) continue
    const intro=foundationFor(e,view)
    expect(order.indexOf(intro)).toBeLessThanOrEqual(order.indexOf(e.id))
    expect(byId[intro].views).toContain('foundations')
  }
})

it('checks the foundational arithmetic against the live circuit and state solver', () => {
  for(const id of Object.keys(FOUNDATIONS)) {
    for(const over of [{}, {R1:2000,Rs:20,C1:2e-6,L1:.02,phi:45}, {A:0.1,E:-2,phi:-90}]) {
      const p={...defaultsOf(id),...over}
      const x=analyse(byId[id],p)
      const work=foundationSteps(id,x)
      for(const step of work.steps) {
        expect(()=>katex.renderToString(String.raw`\begin{aligned}`+step.latex.map(l=>`&${l}`).join(String.raw`\\`)+String.raw`\end{aligned}`,{throwOnError:true})).not.toThrow()
      }
      if(id==='f1') { close(work.slope,x.now.dxdt[0]); close(work.current,x.sol.i.C1) }
      if(id==='g1') {
        work.slopes.forEach((v,i)=>close(v,x.now.dxdt[i]))
        work.A.forEach((r,i)=>r.forEach((v,j)=>close(v,x.dyn.A[i][j])))
        work.B.forEach((r,i)=>r.forEach((v,j)=>close(v,x.dyn.B[i][j])))
      }
      if(id==='h1') close(cx.cabs(cx.csub(work.I,x.ac.i.R1)),0)
      const html=renderToStaticMarkup(<FoundationsPane exp={byId[id]} x={x} onChoose={()=>{}} />)
      expect(html).toContain('data-role="foundations"')
      expect(html).toContain('Continue to')
      expect(html).not.toMatch(/katex-error|NaN|Infinity/)
    }
  }
})
