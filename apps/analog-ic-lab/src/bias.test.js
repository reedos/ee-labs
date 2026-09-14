import {it,expect} from 'vitest'
import {mosfetOf,mosfetCurrent} from '@ee-labs/network'
import {bandgap,betaBias,ratioRun,driftRun} from './bias.js'
it('checks both beta-multiplier roots against native device currents and injected KCL',()=>{
 for(const ratio of [2,4,16])for(const start of [0,5e-9,100e-9]){
  const p={ratio,start},x=betaBias(p),I=x.operating,Vgs=.45+x.overdrive,Vs=I*10000
  const m1=mosfetCurrent(mosfetOf({id:'M1',kn:x.beta,vt:.45,lambda:0}),{vgs:Vgs,vds:1})
  const m2=mosfetCurrent(mosfetOf({id:'M2',kn:x.beta*ratio,vt:.45,lambda:0}),{vgs:Vgs-Vs,vds:1})
  expect(m1.id).toBeCloseTo(I+start,16);expect(m2.id).toBeCloseTo(I,16)
  expect(x.residual(I)).toBeCloseTo(0,14);expect(x.roots.length).toBe(start?1:2)
  if(start)expect(x.residual(0)).toBeGreaterThan(0)
 }
 expect(betaBias().gm).toBeCloseTo(100e-6,15);expect(betaBias().current).toBeCloseTo(2.5e-6,15)
})
it('differentiates the full junction law and includes ln N in the PTAT slope',()=>{
 for(const n of [2,8,16])for(const temperature of [233.15,300,398.15]){
  const m=bandgap({n}).weight,h=.001,x=bandgap({n,m,temperature}),derivative=(bandgap({n,m,temperature:temperature+h}).reference-bandgap({n,m,temperature:temperature-h}).reference)/(2*h)
  expect(derivative).toBeCloseTo(x.slope,10)
 }
 const x=bandgap();expect(x.slope).toBeCloseTo(0,15);expect(x.reference).toBeCloseTo(1.28356,4);expect(x.slopePTAT*1e6).toBeCloseTo(179.1924,2)
})
it('preserves correlation cancellation and exact nonlinear tolerance endpoints',()=>{
 const a=ratioRun({absolute:.01}),b=ratioRun({absolute:.3});expect(a.values).toEqual(b.values)
 const independent=ratioRun({mode:1});expect(independent.mean.sampleVariance).toBeGreaterThan(a.mean.sampleVariance*10000)
 const x=driftRun();expect(Math.min(...x.values)).toBeGreaterThanOrEqual(1/1.2**2);expect(Math.max(...x.values)).toBeLessThanOrEqual(1/.8**2)
 expect(driftRun({mode:1}).mean.sampleVariance).toBeLessThan(x.mean.sampleVariance)
})
