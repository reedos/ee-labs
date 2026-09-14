import {it,expect} from 'vitest'
import {returnRatioAt,transient,solveAC,complex,bandgap,loopCrossings} from '@ee-labs/network'
import {reference,ldo,nativeSupply,thermal,selection} from './regulators.js'
import {bandgap as icBandgap} from '../../analog-ic-lab/src/bias.js'
import {REGULATOR_LESSONS} from './regulatorLessons.js'
import {defaults,evaluate} from '@ee-labs/lessons/model'
import {buildLink,parseLink} from '../../../packages/ui/src/deeplink.js'
import {buckFromLink} from '../../power-lab/src/fromLink.js'
import {analyse} from '../../power-lab/src/analysis.js'
import {byId} from '../../power-lab/src/experiments.js'
const close=(a,b)=>expect(Math.hypot(...complex.csub(a,b))/Math.max(1e-10,Math.hypot(...b))).toBeLessThan(2e-8)
it('shares the reference law and checks its derivative and interior full-range extremum',()=>{
 expect(bandgap).toBe(icBandgap)
 expect(reference().slopePTAT*1e6).toBeCloseTo(179.192407638,7)
 expect(reference().slope).toBeCloseTo(0,15)
 for(const n of [2,8,16])for(const trim of [-.05,0,.05]){
  const x=reference({n,trim});let lo=Infinity,hi=-Infinity
  for(let i=0;i<=16500;i++){const v=x.at(-40+i/100).reference;lo=Math.min(lo,v);hi=Math.max(hi,v)}
  expect(x.span).toBeGreaterThanOrEqual(hi-lo-1e-13);expect(x.span-(hi-lo)).toBeLessThan(1e-9)
  const temp=40,h=.001,y=reference({n,trim,temp})
  expect((x.at(temp+h).reference-x.at(temp-h).reference)/(2*h)).toBeCloseTo(y.slope,10)
 }
})
it('matches the LDO return ratio and closed transfer to independent native nodal solves',()=>{
 for(const load of [.001,.1,1])for(const esr of [0,.1,1,2]){
  const x=ldo({load,esr})
  expect(x.crossings.length).toBe(1)
  expect(Math.hypot(...x.at(x.crossover))).toBeCloseTo(1,10)
  for(const f of [1,x.pole,x.crossover,1e6]){
   close(returnRatioAt(x.net,'A1',2*Math.PI*f),x.at(f))
   const expected=complex.cdiv(x.at(f),complex.cmul([x.beta,0],complex.cadd([1,0],x.at(f))))
   close(solveAC(x.net,2*Math.PI*f,{sources:{Vref:[1,0],Vs:[0,0]},anyFreq:true}).v.out,expected)
  }
 }
 expect(ldo({esr:0}).zero).toBeNull();expect(ldo({esr:1}).pm).toBeGreaterThan(ldo({esr:.1}).pm)
 expect(loopCrossings(()=>[.1,0]).pm).toBeNull()
})
it('checks the derived two-state step against native capacitor-state propagation',()=>{
 for(const load of [.001,.1,1])for(const esr of [0,.1,2]){
  const x=ldo({load,esr}),wave=transient(x.net,{tEnd:x.tEnd,points:101})
  expect(x.response(0)).toBeCloseTo(0,14)
  for(let i=0;i<wave.t.length;i++)expect(x.response(wave.t[i])).toBeCloseTo(wave.samples[i].sol.v.out,9)
  expect(x.response(x.settleEnd*4)).toBeCloseTo(x.dc*.001,8)
 }
})
it('adds supply paths as complex voltages and independently excites the supply',()=>{
 for(const load of [.001,.1,1])for(const rho of [0,.001])for(const alpha of [0,1]){
  const x=ldo({load,rho,alpha,esr:1})
  for(const f of [0,100,10000,1e6]){
   const h=x.paths(f);close(nativeSupply(x,f),h.total)
   close(complex.cadd(complex.cadd(h.pass,h.reference),h.amplifier),h.total)
  }
 }
 const x=ldo({rho:.001})
 expect(x.paths(0).reference[0]).toBeCloseTo(.001/x.beta,6)
 expect(Math.abs(-20*Math.log10(Math.hypot(...x.paths(100).total))-20*Math.log10(Math.hypot(...complex.cadd([1,0],x.at(100)))))).toBeGreaterThan(10)
})
it('conserves power with IQ, rejects dropout and distinguishes the thermal limit',()=>{
 const a=thermal({vin:12,load:.1,iq:0});expect(a.loss).toBeCloseTo(.87,12);expect(a.eta).toBeCloseTo(.275,12);expect(a.rise).toBeCloseTo(43.5,12)
 for(const vin of [3.3,5,12])for(const load of [.001,.1,1])for(const iq of [0,50e-6,.005]){
  const x=thermal({vin,load,iq});expect(x.pin-x.pout).toBeCloseTo(x.loss,12);expect(x.eta).toBeLessThanOrEqual(3.3/vin+2*Number.EPSILON)
  expect(x.regulated).toBe(vin-3.3>=load*.3)
 }
 expect(thermal({vin:3.3}).regulated).toBe(false);expect(thermal({load:1}).thermalMargin).toBeLessThan(0)
 expect(thermal({load:.001}).pole).toBeCloseTo(ldo({load:.001}).pole,12)
})
it('keeps assumed efficiency, integrated noise, in-band ripple and aliasing separate',()=>{
 const a=selection(),b=selection({vin:12,load:1}),c=selection({fs:50000,enBuck:100e-9})
 expect(a.linearPass).toBe(true);expect(a.buckPass).toBe(false)
 expect(a.linearNoise).toBeCloseTo(100e-9*Math.sqrt(1e5),14)
 expect(b.buckLoss).toBeCloseTo(.3666666666666667,12)
 expect(thermal({vin:12,load:1,iq:0}).loss).toBeCloseTo(8.7,12)
 expect(a.buckTotal).toBe(a.buckNoise);expect(c.buckTotal**2).toBeCloseTo(c.buckNoise**2+.01**2/2,14)
 expect(a.alias).toBe(40000);expect(selection({fs:960000}).alias).toBe(0)
 expect(selection({enBuck:100e-9}).buckPass).toBe(true)
})
it('round-trips the exact LDO transfer and a validated, editable Power Lab operating point',()=>{
 const d2=REGULATOR_LESSONS[1],d5=REGULATOR_LESSONS[4]
 const x=evaluate(d2,defaults(d2)),patch=parseLink(buildLink(x.handover.patch)).patch,m=ldo(defaults(d2))
 expect(patch.plant.params).toEqual([0,...m.loop.b,...m.loop.a])
 for(const vin of [4,5,15])for(const load of [.05,.2,1])for(const fs of [50000,2e6]){
  const y=evaluate(d5,{...defaults(d5),vin,load,fs}),parsed=parseLink(buildLink(y.handover.patch)),incoming=buckFromLink(parsed.patch)
  expect(parsed.warnings).toEqual([]);expect(incoming.initialId).toBe('b3')
  expect(incoming.initialParams.Vin*incoming.initialParams.D).toBeCloseTo(3.3,5)
  expect(3.3/incoming.initialParams.R).toBeCloseTo(load,12)
  expect(incoming.initialParams.D).toBe(3.3/vin)
  const actual=analyse(byId.b3,incoming.initialParams)
  expect(actual.m.mode).toBe('CCM')
  expect(actual.m.sig.vout.avg).toBeCloseTo(3.3,8)
  expect(actual.m.eta).toBeCloseTo(1,8)
 }
 expect(buckFromLink({blocks:[{type:'buck',params:[12,.275,100e-6,100e-6,3.3,-1]}]}).error).toBeTruthy()
 expect(buckFromLink({blocks:[{type:'buck',params:[12,NaN,100e-6,100e-6,3.3,1e6]}]}).error).toBeTruthy()
})
