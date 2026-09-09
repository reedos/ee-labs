import {it,expect} from 'vitest'
import katex from 'katex'
import {defaults,evaluate} from '@ee-labs/lessons/model'
import {EXTENDED} from './extended.js'
it('has 35 usable lessons with defined symbols and finite endpoint calculations',()=>{
 expect(EXTENDED.map(l=>l.id)).toEqual(['a1','a2','a3','a4','a5','a6','b1','b2','b3','b4','b5','c1','c2','c3','c4','c5','d1','d2','d3','d4','d5','e1','e2','e3','e4','e5','f1','f2','f3','f4','f5','g1','g2','g3','g4'])
 for(const l of EXTENDED)for(const p of [defaults(l),...l.knobs.flatMap(k=>[k.min,k.max].map(v=>({...defaults(l),[k.key]:v})))]){
  const x=evaluate(l,p)
  expect(x.steps.length,l.id).toBeGreaterThanOrEqual(3)
  expect(Number.isFinite(x.practice.answer),l.id).toBe(true)
  x.readings.forEach(r=>expect(Number.isFinite(r.value),`${l.id}: ${r.label}`).toBe(true))
  for(const plot of x.plots??[])for(const point of plot.points??plot.traces?.flatMap(t=>t.points)??[])expect(Number.isFinite(point.x)&&Number.isFinite(point.y),l.id).toBe(true)
  for(const tex of [...l.symbols.map(a=>a[0]),...x.steps.flatMap(s=>[s.tex,s.substitution].filter(Boolean))]){
   expect(tex,l.id).not.toMatch(/[\t\r\n]/)
   expect(()=>katex.renderToString(tex,{throwOnError:true}),`${l.id}: ${tex}`).not.toThrow()
  }
 }
},30000)

import {solveAC} from '@ee-labs/network'
import {amplifier,ampNet,filter,filterCheck,slewTrace,inputNoise,offset,supply} from './models.js'
it('matches the eliminated amplifier and cubic filter against native nodal AC solves',()=>{
 for(const part of [0,2,5])for(const gain of [2,11,101]){const x=amplifier({part,gain});for(const f of [100,x.fc,10*x.fc])expect(Math.hypot(...solveAC(ampNet({part,gain}),2*Math.PI*f,{anyFreq:true}).v.out)).toBeCloseTo(x.dc/Math.hypot(1,f/x.fc),7)}
 for(const gbw of [.5e6,1e6,20e6]){const x=filter({gbw});for(const f of [1000,50000,100000,300000,1e6])expect(filterCheck({gbw},f)).toBeCloseTo(x.response(f).magnitude,9);expect(x.response(x.fc).magnitude/x.h).toBeCloseTo(1/Math.SQRT2,12)}
 expect(filter().fc).toBeGreaterThan(98000);expect(filter().fc).toBeLessThan(99000)
})
it('shows the native slew slope and independently budgets noise, bias and supply edges',()=>{
 const a=slewTrace({part:0,peak:10}),b=slewTrace({part:2,peak:10})
 const near=a.find(p=>p.x>2&&p.x<10),slope=near.y/(near.x*1e-6)
 expect(slope/.5e6).toBeCloseTo(1,2)
 expect(b.find(p=>p.y>9).x).toBeLessThan(a.find(p=>p.y>9).x)
 const n=inputNoise({part:0,resistance:1e5,bandwidth:2e4});expect(n.rms*n.rms).toBeCloseTo((20e-9**2+(.5e-12*1e5)**2+4*1.380649e-23*300*1e5)*2e4,20)
 expect(offset({part:2,temp:85}).ib/offset({part:2,temp:25}).ib).toBe(64)
 expect(supply().inductive).toBeCloseTo(.02,12)
})
