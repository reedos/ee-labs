import {it,expect} from 'vitest'
import katex from 'katex'
import {defaults,evaluate} from '@ee-labs/lessons/model'
import {EXTENDED} from './extended.js'
it('has twenty-three usable lessons with defined symbols and finite endpoint calculations',()=>{
 expect(EXTENDED.map(l=>l.id)).toEqual(['a1','a2','a3','a4','a5','a6','b1','b2','b3','b4','b5','b6','c1','c2','c3','c4','c5','c6','d1','d2','d3','d4','d5'])
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

import {transient} from '@ee-labs/network'
import {acquisition,chargeShare,chargeNative,injection,thermal,bottomPlate,jitter} from './models.js'
it('checks acquisition and charge projection against finite-resistance state solves',()=>{
 const a=acquisition({bits:12});expect(a.required/a.tau).toBeCloseTo(13*Math.LN2,12)
 const net={elements:[{type:'V',id:'V1',nodes:['in','gnd'],wave:{kind:'step',from:0,to:1}},{type:'R',id:'R1',nodes:['in','out'],value:1000},{type:'C',id:'C1',nodes:['out','gnd'],value:1e-12}]}
 const w=transient(net,{tEnd:20e-9,points:101,x0:[0]});expect(w.at(9e-9).sol.v.out).toBeCloseTo(a.held,10)
 for(const resistance of [1,10,1000])for(const c2 of [.5e-12,1e-12,5e-12]){const p={resistance,c2},x=chargeShare(p),v=chargeNative(p);expect(v.a).toBeCloseTo(x.voltage,7);expect(v.b).toBeCloseTo(x.voltage,7);const independent=.5*(1e-12*c2/(1e-12+c2));expect(x.loss).toBeCloseTo(independent,24)}
 expect(chargeShare().loss).toBeCloseTo(.25e-12,24)
})
it('keeps injection signs, phase order and kT/C assumptions consistent',()=>{
 const a=injection(),d=injection({dummy:1});expect(a.channel).toBeCloseTo(-.001048545,12);expect(d.total).toBeCloseTo(d.feed,12)
 expect(bottomPlate({order:0}).error).toBeLessThan(0);expect(bottomPlate({order:1}).error).toBeGreaterThan(0)
 expect(bottomPlate({vin:.1}).error).toBe(bottomPlate({vin:.9}).error)
 expect(bottomPlate({phase:1}).held).toBe(bottomPlate({phase:2}).held)
 expect(bottomPlate({phase:0}).error).toBe(0)
 expect(thermal({resistance:100}).rms).toBe(thermal({resistance:10000}).rms)
 expect(thermal({capacitance:4e-12}).rms/thermal().rms).toBe(.5)
 // Independently integrate the resistor PSD with f=fc*tan(theta), midpoint rule.
 let total=0;const n=10000,df=Math.PI/(2*n),R=1000,C=1e-12,fc=1/(2*Math.PI*R*C)
 for(let i=0;i<n;i++){const theta=(i+.5)*df,f=fc*Math.tan(theta);total+=4*1.380649e-23*300*R/(1+(f/fc)**2)*fc/(Math.cos(theta)**2)*df}
 expect(total/thermal().variance).toBeCloseTo(1,10)
})
it('measures seeded jitter errors independently of the analytic SNR curve',()=>{
 const a=jitter(),b=jitter({frequency:1e6}),long=jitter({count:65536})
 expect(a.snr).toBeCloseTo(84.0364,3);expect(b.snr-a.snr).toBeCloseTo(20,10)
 expect(Math.abs(long.estimate.value-long.mse)).toBeLessThan(4*long.estimate.se)
 expect(jitter().measured).toBe(a.measured);expect(jitter({seed:43}).measured).not.toBe(a.measured)
 expect(a.required*1e12).toBeGreaterThan(3);expect(a.required*1e12).toBeLessThan(3.3)
})
