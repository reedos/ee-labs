import {it,expect} from 'vitest'
import katex from 'katex'
import {defaults,evaluate} from '@ee-labs/lessons/model'
import {EXTENDED} from './extended.js'
import {systemChain,systemBudget,chainSpectrum,phaseEnsemble,linkBudget} from './budgetModels.js'
it('covers the 21 planned topics with finite calculations and renderable math at defaults and endpoints',()=>{
  expect(EXTENDED.map(l=>l.id)).toEqual(['b1','b2','b3','b4','b5','c1','c2','c3','c4','c5','d1','d2','d3','d4','e1','e2','e3','e4','f1','f2','f3'])
  for(const l of EXTENDED)for(const p of [defaults(l),...l.knobs.flatMap(k=>[k.min,k.max].map(v=>({...defaults(l),[k.key]:v})))]){
    const x=evaluate(l,p)
    expect(x.steps.length,l.id).toBeGreaterThanOrEqual(3)
    expect(Number.isFinite(x.practice.answer),l.id).toBe(true)
    x.readings.forEach(r=>expect(Number.isFinite(r.value),l.id).toBe(true))
    for(const tex of [...l.symbols.map(a=>a[0]),...x.steps.flatMap(s=>[s.tex,s.substitution].filter(Boolean))]){
      expect(tex,l.id).not.toMatch(/[\t\r\n]/)
      expect(()=>katex.renderToString(tex,{throwOnError:true}),l.id).not.toThrow()
    }
  }
  const d=EXTENDED.find(l=>l.id==='d4')
  expect(()=>evaluate(d,{...defaults(d),sampleRate:50e6,bandwidth:40e6})).toThrow(/Nyquist/)
})
it('checks Friis against forward propagation of independent source and stage noise',()=>{
  const c=systemBudget(),blocks=systemChain(),kT=1.380649e-23*290
  let output=kT,totalGain=1
  for(const b of blocks){const G=10**(b.gainDb/10),F=10**((b.nfDb??-b.gainDb)/10);output=G*output+G*(F-1)*kT;totalGain*=G}
  expect(10*Math.log10(output/(kT*totalGain))).toBeCloseTo(c.nfDb,12)
  expect(c.nfDb).toBeCloseTo(4.66628772446,10)
  for(const key of ['noiseShare','ip3Share','powerShare'])expect(c.blocks.reduce((sum,b)=>sum+b[key],0)).toBeCloseTo(1,12)
})
it('measures cascaded cubic products using FFT rather than setting the answer to the budget',()=>{
  const low=chainSpectrum({pin:-60}),high=chainSpectrum({pin:-50})
  expect(Math.abs(low.estimatedInputIp3-low.budget.iip3Dbm)).toBeLessThan(.001)
  expect(Math.abs(low.estimatedInputIp3-low.budget.iip3Dbm)).toBeLessThan(Math.abs(high.estimatedInputIp3-high.budget.iip3Dbm))
  expect(high.fundamental-low.fundamental).toBeCloseTo(10,2)
  expect(high.im3-low.im3).toBeCloseTo(30,2)
  const alternate=chainSpectrum({pin:-60,N:2048})
  expect(alternate.estimatedInputIp3).toBeCloseTo(low.estimatedInputIp3,7)
})
it('shows the actual random-phase distribution and uncertainty instead of a false universal ordering',()=>{
  const x=phaseEnsemble({runs:20000,seed:42})
  expect(Math.abs(x.estimate.value-x.expected)).toBeLessThan(4*x.estimate.se)
  expect(x.intercepts[0]).toBeGreaterThanOrEqual(x.aligned-1e-10)
  expect(x.intercepts.some(v=>v<x.power)).toBe(true)
  expect(x.intercepts.some(v=>v>x.power)).toBe(true)
  expect(phaseEnsemble({runs:500,seed:9}).median).toBe(phaseEnsemble({runs:500,seed:9}).median)
})
it('checks bandwidth scaling, an independent line intersection, and link reciprocity',()=>{
  const a=systemBudget({bandwidth:2e5}),b=systemBudget({bandwidth:20e6})
  expect(b.floor-a.floor).toBeCloseTo(20,12)
  expect(b.sfdr-a.sfdr).toBeCloseTo(-40/3,12)
  const crossing=a.floor+a.sfdr
  expect(3*crossing-2*a.iip3Dbm+a.gainDb).toBeCloseTo(a.floor+a.gainDb,12)
  expect(linkBudget({distance:200}).received-linkBudget({distance:100}).received).toBeCloseTo(-20*Math.log10(2),12)
  expect(linkBudget({gt:8,gr:2}).received).toBeCloseTo(linkBudget({gt:2,gr:8}).received,12)
  expect(linkBudget({distance:1000}).margin).toBeLessThan(0)
})
it('lets all three active blocks affect the capstone and includes a feasible design',()=>{
  const l=EXTENDED.find(l=>l.id==='f3'),p=defaults(l),base=evaluate(l,p)
  expect(base.readings.every(r=>r.value>=0)).toBe(true)
  for(const block of ['lna','mixer','ifamp']){
    const changed=evaluate(l,{...p,[block+'Power']:p[block+'Power']+10})
    expect(changed.readings[2].value).toBeCloseTo(base.readings[2].value-10,12)
    expect(systemBudget({...p,[block+'Nf']:p[block+'Nf']+1}).nfDb).toBeGreaterThan(systemBudget(p).nfDb)
  }
})
