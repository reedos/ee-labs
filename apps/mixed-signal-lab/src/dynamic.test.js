import {it,expect} from 'vitest'
import {transient,solveAC} from '@ee-labs/network'
import {defaults,evaluate} from '@ee-labs/lessons/model'
import {DEFAULT_TAU,settling,slewing,slewAdvance,regeneration,converterRecord,converterSpectrum,spectralMetrics,harmonicBins,density,stimulusCDF,stimulusInverse} from './dynamic.js'
import {DYNAMIC_LESSONS} from './dynamicLessons.js'
const sum=xs=>xs.reduce((a,b)=>a+b,0)
it('derives the resolution budget and verifies its state and phasor against the native RC',()=>{
 for(const bits of [8,12,14])for(const tau of [.5e-9,DEFAULT_TAU,20e-9]){
  const x=settling({bits,tau}),w=transient(x.net,{tEnd:50e-9,points:81,x0:[0]})
  for(let i=0;i<w.t.length;i++)expect(w.samples[i].sol.v.out).toBeCloseTo(x.at(w.t[i]),10)
  expect(1-x.at(x.required)).toBeCloseTo(x.tolerance,12)
  const f=1/(2*Math.PI*tau),v=solveAC(x.net,2*Math.PI*f,{sources:{V1:[1,0]},anyFreq:true}).v.out
  expect(v[0]).toBeCloseTo(.5,10);expect(v[1]).toBeCloseTo(-.5,10)
 }
 expect(settling().maxTau*1e9).toBeCloseTo(2.77441354,8);expect(settling().gbw/1e6).toBeCloseTo(114.730512,6)
 expect(settling({step:0}).maxTau).toBeNull();expect(settling({step:0}).required).toBe(0)
})
it('joins slew and exponential regions continuously and covers both step signs and tolerance regions',()=>{
 const x=slewing();expect(x.ts*1e9).toBeCloseTo(7.22558646,8);expect(x.required*1e9).toBeCloseTo(28.6683841,7)
 for(const step of [-1,-.1,0,.1,1])for(const sr of [10e6,100e6,500e6]){
  const a=slewing({step,sr}),h=1e-14
  expect(a.at(0)).toBeCloseTo(0,14);expect(slewing({step:-step,sr}).at(20e-9)).toBeCloseTo(-a.at(20e-9),12)
  if(a.ts>0){expect(a.at(a.ts-h)).toBeCloseTo(a.at(a.ts+h),5);expect((a.at(a.ts+h)-a.at(a.ts-h))/(2*h)/sr).toBeCloseTo(Math.sign(step),5)}
  if(step)expect(Math.abs(step-a.at(a.required))).toBeCloseTo(a.tolerance,12)
 }
 const boundary=100e6*DEFAULT_TAU;expect(slewing({step:boundary}).ts).toBe(0)
 const loose=slewing({bits:1,sr:1e6,tau:1e-9});expect(loose.required).toBeLessThan(loose.ts);expect(loose.at(loose.required)).toBeCloseTo(.75,12)
 expect(slewing({step:0}).required).toBe(0)
})
it('checks slew propagation against independent numerical integration and preserves composition',()=>{
 for(const target of [-1,.1,1])for(const sr of [10e6,100e6,500e6]){
  const initial=.05,tau=DEFAULT_TAU,end=40e-9,count=20000,dt=end/count,f=v=>Math.sign(target-v)*Math.min(sr,Math.abs(target-v)/tau)
  let v=initial
  for(let i=0;i<count;i++){const a=f(v),b=f(v+a*dt/2),c=f(v+b*dt/2),d=f(v+c*dt);v+=dt*(a+2*b+2*c+d)/6}
  expect(slewAdvance(initial,target,end,tau,sr)).toBeCloseTo(v,8)
  expect(slewAdvance(slewAdvance(initial,target,15e-9,tau,sr),target,25e-9,tau,sr)).toBeCloseTo(v,8)
 }
})
it('checks regenerative capacitor growth and conditional probability units',()=>{
 for(const tau of [10e-12,20e-12,40e-12]){
  const x=regeneration({tau}),w=transient(x.net,{tEnd:x.end,points:51,x0:[x.initial]})
  for(let i=0;i<w.t.length;i++)expect(w.samples[i].sol.v.out).toBeCloseTo(x.at(w.t[i]),9)
  expect(x.at(x.decision)).toBeCloseTo(.5,12)
 }
 const late=regeneration({time:400e-12});expect(late.threshold/1e-9).toBeCloseTo(1.030576811,8);expect(late.interval).toBeCloseTo(.0970330391,10)
 expect(regeneration({initial:0}).decision).toBeNull();expect(regeneration({initial:0}).at(400e-12)).toBe(0)
 expect(regeneration({rate:1e9}).probability).toBe(regeneration().probability)
 expect(regeneration({rate:1e9}).interval/regeneration().interval).toBeCloseTo(5,12)
})
it('accounts for spectral power and aliased harmonics using a known coherent waveform',()=>{
 const n=8192,k=997,values=Float64Array.from({length:n},(_,i)=>.2+.5*Math.sin(2*Math.PI*k*i/n)+.005*Math.sin(6*Math.PI*k*i/n)),x=spectralMetrics(values,20e6,k)
 expect(x.signal).toBeCloseTo(.125,12);expect(x.distortion).toBeCloseTo(.005**2/2,12);expect(x.thd).toBeCloseTo(-40,8);expect(x.sndr).toBeCloseTo(40,8)
 const mean=sum(values)/n,variance=sum(Array.from(values,v=>(v-mean)**2))/n
 expect(x.total).toBeCloseTo(variance,12);expect(x.signal+x.noise+x.distortion).toBeCloseTo(variance,12)
 expect(harmonicBins(64,15)).toEqual([30,19,4,11,26,23,8,7,22])
 const nearNyquist=Float64Array.from({length:n},(_,i)=>.5*Math.sin(2*Math.PI*3001*i/n)+.005*Math.sin(6*Math.PI*3001*i/n))
 expect(spectralMetrics(nearNyquist,20e6,3001).thd).toBeCloseTo(-40,8)
})
it('distinguishes linear tracking error from distortion and measures combined records directly',()=>{
 const linear=converterRecord({acquire:true,quantize:false,tau:20e-9,sr:1e12}),r=Math.exp(-linear.time/20e-9),theta=2*Math.PI*linear.bin/linear.n,gain=(1-r)/Math.hypot(1-r*Math.cos(theta),r*Math.sin(theta))
 expect(Math.sqrt(linear.signal/.125)).toBeCloseTo(gain,10);expect(linear.trackingRMS).toBeGreaterThan(.01);expect(linear.sndr).toBeGreaterThan(200)
 const limited=converterRecord({acquire:true,quantize:false,tau:20e-9,sr:10e6});expect(limited.distortion).toBeGreaterThan(1e-6)
 const allOff=converterSpectrum({jitter:0,h3:0,sr:1e12,tau:.5e-9})
 expect(allOff.rows[0].values).toEqual(allOff.rows[1].values);expect(allOff.rows[0].values).toEqual(allOff.rows[3].values)
 expect(converterRecord().sndr).toBeGreaterThan(73);expect(converterRecord().sndr).toBeLessThan(75)
 expect(converterRecord({jitter:50e-12}).sndr).toBeLessThan(converterRecord().sndr)
 const a=converterRecord({jitter:20e-12});expect(a.values).toEqual(converterRecord({jitter:20e-12}).values)
})
it('normalizes both histogram stimuli and keeps measured zero-count uncertainty',()=>{
 for(const sine of [0,1])for(const sigma of [0,.25,1]){
  const x=density({sine,sigma,count:1024});expect(sum(x.counts)).toBe(1024);expect(sum(x.probabilities)).toBeCloseTo(1,12);expect(sum(x.device.widths)).toBeCloseTo(1,12)
  for(let i=0;i<64;i++){
   expect(x.edges[i+1]).toBeGreaterThanOrEqual(x.edges[i]);expect(x.rows[i].ci[1]).toBeGreaterThan(x.rows[i].ci[0])
   if(x.rows[i].hits===0)expect(x.rows[i].ci[1]).toBeGreaterThan(-1)
  }
  for(const v of [0,.01,.2,.5,.99,1])expect(stimulusInverse(stimulusCDF(v,sine),sine)).toBeCloseTo(v,12)
 }
 const x=density();expect(x.perCode95).toBeCloseTo(4267.245516,5);expect(x.total95).toBe(17478638)
})
it('checks histogram interval coverage against known widths across independent records',()=>{
 let uniformCovered=0,sineCovered=0;const trials=160
 for(let seed=1;seed<=trials;seed++){
  const u=density({seed,sigma:0,count:4096}),a=u.rows[31];uniformCovered+=a.ci[0]<=0&&a.ci[1]>=0?1:0
  const s=density({seed,sine:1,sigma:0,count:4096});sineCovered+=s.rows.every(a=>a.ci[0]<=0&&a.ci[1]>=0)?1:0
 }
 expect(uniformCovered/trials).toBeGreaterThan(.9);expect(sineCovered/trials).toBeGreaterThanOrEqual(.95)
 const small=density({sine:1,count:1024}),large=density({sine:1,count:65536});expect(large.epsilon/small.epsilon).toBeCloseTo(1/8,12)
})
it('handles the lesson boundaries without invalid result numbers',()=>{
 for(const [index,params] of [[1,{step:0}],[2,{initial:0}],[3,{effect:4,tau:20e-9,sr:10e6,clock:80e6,jitter:50e-12}],[4,{sine:1,sigma:1,count:1024,code:0}]]){
  const l=DYNAMIC_LESSONS[index],x=evaluate(l,{...defaults(l),...params})
  for(const v of x.readings)expect(Number.isFinite(v.value)).toBe(true)
  for(const plot of x.plots)for(const point of plot.points??plot.traces.flatMap(t=>t.points))expect(Number.isFinite(point.x)&&Number.isFinite(point.y)).toBe(true)
 }
})
