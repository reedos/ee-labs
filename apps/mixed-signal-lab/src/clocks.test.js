import {it,expect} from 'vitest'
import {complex} from '@ee-labs/network'
import {pll,linearStep,acquisition,detector,phaseNoise,clockBudget} from './clocks.js'
import {clockLink} from './clockLessons.js'
import {PLANTS} from '../../control-lab/src/systems.js'
import {stateFromLink} from '../../control-lab/src/fromLink.js'
const {cdiv,cadd,cmul,cabs}=complex,near=(a,b,t=1e-8)=>expect(Math.abs(a-b)).toBeLessThan(t*Math.max(Math.abs(b),1e-12))
it('derives detector gain from pulse charge and marks the one-cycle branch',()=>{
 for(const phase of [-Math.PI,0,Math.PI]){const x=detector({phase});near(x.average,100e-6*phase/(2*Math.PI));expect(x.inside).toBe(true)}expect(detector({phase:7}).inside).toBe(false)
})
it('PLL polynomial matches an independent sum of filter admittances and closes stably',()=>{
 for(const extra of [0,.1,.3]){const x=pll({extra});for(const f of [1e3,5e4,1e6]){const w=2*Math.PI*f,ys=cdiv([0,w*x.cap],[1,w*x.resistance*x.cap]),z=cdiv([1,0],cadd(ys,[0,w*x.c2])),independent=cmul([0,-x.K/w],z);near(x.at(f)[0],independent[0]);near(x.at(f)[1],independent[1])}expect(x.stable).toBe(true);near(cabs(x.at(x.crossover)),1,1e-6)}
 near(pll().wn,Math.sqrt(1e11));near(pll().zeta,1);near(pll({extra:.1}).pole,276810.6665746787)
})
it('critical phase-error response and zero-containing output overshoot match closed forms',()=>{
 const x=linearStep({},1e5);for(const p of x.points){near(p.error,2*Math.PI*1e5*p.x*Math.exp(-x.wn*p.x),1e-5)}near(x.peak,2*Math.PI*1e5/(Math.E*x.wn),1e-8);near(x.overshoot,100*Math.exp(-2),1e-8)
 // A phase guard at 2π converts to e*wn Hz, not e*fn Hz.
 const guard=linearStep({},Math.E*x.wn);near(guard.peak,2*Math.PI)
})
it('edge-driven acquisition is sample-grid independent, aligns after slips, and preserves zero-step lock',()=>{
 const zero=acquisition({},0);expect(zero.complete).toBe(true);expect(Math.max(...zero.points.map(p=>Math.abs(p.error)))).toBeLessThan(1e-8)
 for(const step of [1e3,1e5,1e6,2e6]){const a=acquisition({},step),b=acquisition({},step,1601);expect(a.complete&&b.complete).toBe(true);for(let i=0;i<a.points.length;i++){near(a.points[i].voltage,b.points[i*2].voltage,1e-5)}expect(Math.abs(a.wrapped)).toBeLessThan(.001);expect(a.points.at(-1).frequency/step).toBeCloseTo(1,4)}
 expect(acquisition({},1e6).finalError).toBeGreaterThan(2*Math.PI)
})
it('both exact handovers preserve coefficients and mathematical degree',()=>{
 for(const extra of [0,.1]){const x=pll({extra}),patch=clockLink(x).patch,{state,warnings}=stateFromLink(patch);expect(warnings).toEqual([]);const tf=PLANTS[state.plantId].tf(state.plantP);expect(tf.a).toEqual(x.a);expect(tf.b).toEqual(x.b)}
})
it('phase-noise integral matches numeric quadrature, sideband factor and inverse carrier scaling',()=>{
 const x=phaseNoise(),n=20000,h=Math.log(1e7/1e4)/n;let sum=0;for(let i=0;i<n;i++){const f=1e4*Math.exp((i+.5)*h);sum+=2*x.at(f)*f*h}near(sum,x.variance,1e-7);near(x.variance,.0001998);near(phaseNoise({carrier:2e8}).jitter,x.jitter/2)
})
it('clock noise powers add and sine SNR loses 20 dB per input-frequency decade',()=>{
 const x=clockBudget(),y=clockBudget({input:1e6});near(x.variance,x.vr+x.vv);near(y.snr-x.snr,20);expect(clockBudget({reference:-130}).jitter).toBeGreaterThan(x.jitter);const low=clockBudget({bandwidth:1e4}),high=clockBudget({bandwidth:3e5});expect(high.vv).toBeLessThan(low.vv);expect(high.vr).toBeGreaterThan(low.vr)
})
