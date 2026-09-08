import {it,expect} from 'vitest'
import {transferCharge,scCoefficients,integrator,continuousComparison,scBiquad,biquadResponse,hz,signalHandover} from './sc.js'
import {buildLink,parseLink} from '../../../packages/ui/src/deeplink.js'
import {stateFromLink} from '../../signal-lab/src/fromLink.js'
import {INITIAL} from '../../signal-lab/src/state.js'
import {biquadResponse as magnitude} from '@ee-labs/dsp'
it('derives topology-specific coefficients from charge balance, with parasitics and finite gain',()=>{
 for(const ratio of [.01,.1,.5])for(const gain of [100,1000,10000,Infinity]){
  const cs=ratio*1e-11,cf=1e-11,x=scCoefficients({cs,cf,gain}),a=Number.isFinite(gain)?(gain+1)/(gain+1+ratio):1,b=Number.isFinite(gain)?ratio*gain/(gain+1+ratio):ratio
  expect(x.a).toBeCloseTo(a,13);expect(x.b).toBeCloseTo(b,13)
  const v=transferCharge({cs,cf,gain,prior:.3,vin:-.2});expect(v.voltages.out).toBeCloseTo(a*.3-b*.2,13);expect(Math.abs(v.injected.sum)).toBeLessThan(1e-24)
 }
 for(const top of [0,.1e-12,1e-12])for(const bottom of [0,.1e-12,1e-12]){
  expect(scCoefficients({top,bottom}).b).toBeCloseTo(.1,13)
  expect(scCoefficients({top,bottom,sensitive:true}).b).toBeCloseTo(-(.1+top/1e-11),13)
 }
 expect(integrator({gain:100}).dc).toBeCloseTo(100,8)
})
it('measures exact unity gain and both sides of the continuous approximation boundary',()=>{
 const x=integrator();expect(Math.hypot(...hz(x.tf,x.unity,1e6))).toBeCloseTo(1,12)
 expect(x.unity).toBeGreaterThan(x.continuous)
 expect(continuousComparison(20).allowed).toBe(true);expect(continuousComparison(19.999).allowed).toBe(false)
 expect(100*(continuousComparison(20).ratio-1)).toBeCloseTo(.41242,4);expect(continuousComparison(5).lag).toBe(36)
})
it('checks the phase-ordered state recurrence against an independent IIR recurrence',()=>{
 for(const exact of [true,false]){
  const x=scBiquad({exact}),points=biquadResponse(x,200),[,b1]=x.tf.b,[,a1,a2]=x.tf.a;let y1=0,y2=0
  for(let n=1;n<points.length;n++){const y=b1*.1-a1*y1-a2*y2;expect(points[n].y).toBeCloseTo(y,12);y2=y1;y1=y}
 }
 const x=scBiquad();expect(x.frequency).toBeCloseTo(50000,7);expect(x.q).toBeCloseTo(2,12);expect(x.k6).toBeCloseTo(.170089,5)
 const approx=scBiquad({exact:false});expect(approx.frequency).toBeCloseTo(48373.6,0);expect(approx.q).toBeCloseTo(2.0832,3)
})
it('round-trips exact coefficients through the real Signal consumer and labels time scaling',()=>{
 for(const fs of [48000,192000,1e6])for(const tf of [integrator({fs}).tf,integrator({fs,gain:100}).tf,scBiquad({fs,frequency:.05*fs}).tf]){
  const link=signalHandover(tf,fs,'b5',fs*.05),{patch}=parseLink(buildLink(link.patch)),{state,warnings}=stateFromLink(patch,INITIAL)
  expect(warnings).toEqual([]);expect(state.sampleRate).toBe(Math.min(fs,192000))
  for(const normalized of [.01,.05,.1,.4])expect(magnitude(state.blocks[0].params,normalized*state.sampleRate,state.sampleRate)).toBeCloseTo(Math.hypot(...hz(tf,normalized*fs,fs)),10)
  if(fs>192000)expect(link.note).toMatch(/rescaled/)
 }
})
