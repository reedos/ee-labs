import {it,expect} from 'vitest'
import {solveAC} from '@ee-labs/network'
import {filter} from './models.js'
import {nominalParts,section,corners,toleranceRuns,yields,canon} from './designMethods.js'
it('derives sensitivities from perturbed circuit coefficients, including unequal resistors',()=>{
 for(const ratio of [.8,1,1.2]){const parts=nominalParts.map((v,i)=>v*(i===0?ratio:1)),x=section(parts)
  for(let i=0;i<4;i++){const plus=section(parts.map((v,j)=>v*(j===i?1.00001:1))),minus=section(parts.map((v,j)=>v*(j===i?.99999:1)));for(const [key,ds] of [['f0',x.sf],['q',x.sq]])expect((Math.log(plus[key])-Math.log(minus[key]))/(Math.log(1.00001)-Math.log(.99999))).toBeCloseTo(ds[i],8)}
 }
})
it('retains the finite follower at all passive vertices and matches native nodal AC',()=>{
 for(const gbw of [.5e6,1e6,1.5e6]){const x=corners({tolerance:.05,gbw});expect(x.vertices).toHaveLength(16)
  for(const v of x.vertices){const net=filter({gbw}).net;net.elements=net.elements.map(e=>{const j=['R1','R2','C1','C2'].indexOf(e.id);return j<0?e:{...e,value:v.parts[j]}})
   for(const f of [1000,v.fc,1e6]){const out=solveAC(net,2*Math.PI*f,{anyFreq:true}).v.out;expect(Math.hypot(...out)).toBeCloseTo(v.magnitude(f),9)}
   expect(v.magnitude(v.fc)).toBeCloseTo(v.h/Math.SQRT2,12)
   expect(v.f0).toBeGreaterThanOrEqual(x.fLow*(1-1e-14));expect(v.f0).toBeLessThanOrEqual(x.fHigh*(1+1e-14))
  }
  expect(x.qFace).toBeGreaterThan(Math.max(...x.qEnds))
 }
})
it('bounds interior natural frequencies and exposes the nonmonotone Q face',()=>{
 const x=corners({tolerance:.05});for(let i=0;i<300;i++){const v=section(nominalParts.map((p,j)=>p*(1+.05*Math.sin(i*(j+1)+j))));expect(v.f0).toBeGreaterThanOrEqual(x.fLow);expect(v.f0).toBeLessThanOrEqual(x.fHigh)}
 expect(section().sq.slice(0,2)).toEqual([0,0]);expect(x.face[40].y).toBeCloseTo(x.qFace,12)
})
it('reproduces seeded ensembles, analytic sigmas and the linear Gaussian yield comparison',()=>{
 expect(toleranceRuns({runs:20,seed:9}).data).toEqual(toleranceRuns({runs:20,seed:9}).data)
 const x=yields({runs:100000,seed:71});expect(x.fs.sd/x.predF).toBeCloseTo(1,2);expect(x.qs.sd/x.predQ).toBeCloseTo(1,2)
 expect(x.analytic[0]).toBeCloseTo(.9973002039367398,9);expect(x.analytic[1]).toBeCloseTo(.9661051464753108,8)
 for(let i=0;i<3;i++)expect(Math.abs(x.linear[i].value-x.analytic[i])).toBeLessThan(4*Math.sqrt(x.analytic[i]*(1-x.analytic[i])/x.data.length))
 expect(Math.abs(x.correlation)).toBeLessThan(.02)
 expect(x.data.some(v=>Math.abs(v.f-v.fl)>1e-5)).toBe(true)
})
it('Wilson intervals retain width with all or no passing samples and shrink with sample count',()=>{
 const all=yields({runs:200,fLimit:.9,qLimit:.9}),none=yields({runs:200,fLimit:1e-12,qLimit:1e-12});expect(all.exact[2].value).toBe(1);expect(all.exact[2].ci[0]).toBeLessThan(1);expect(none.exact[2].value).toBe(0);expect(none.exact[2].ci[1]).toBeGreaterThan(0)
 const more=yields({runs:10000,fLimit:.9,qLimit:.9});expect(more.exact[2].ci[0]).toBeGreaterThan(all.exact[2].ci[0])
})
it('flags a measured linearization residual beyond the stated one-percent-of-sigma check',()=>{
 expect(toleranceRuns({tolerance:.001}).linearCheck).toBe(true)
 const x=toleranceRuns({tolerance:.05});expect(x.linearCheck).toBe(false);expect(Math.max(x.residualF,x.residualQ)).toBeGreaterThan(.01)
})
it('keeps datasheet fields, ideal estimates and current corrections distinct',()=>{
 const x=canon();expect(x.corner).toBeCloseTo(90909.090909,5);expect(x.timer).toBeCloseTo(4808.9834696,6);expect(x.voltage).toBeCloseTo(5.036,12);expect(x.adjust).toBeCloseTo(.036,12);expect(x.fullPower).toBeCloseTo(79577.4715459,5);expect(x.noise).toBeCloseTo(.707106781e-6,14)
 expect(canon({bandwidth:80000}).noise/x.noise).toBeCloseTo(2,12)
})
