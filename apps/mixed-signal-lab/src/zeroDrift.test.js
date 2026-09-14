import {it,expect} from 'vitest'
import {KB,chopper,injection,autozero,noisePaths,cds} from './zeroDrift.js'
import {ZERO_DRIFT_LESSONS} from './zeroDriftLessons.js'
import {defaults,evaluate} from '@ee-labs/lessons/model'
import {buildLink,parseLink} from '../../../packages/ui/src/deeplink.js'
import {stateFromLink} from '../../signal-lab/src/fromLink.js'
import {INITIAL} from '../../signal-lab/src/state.js'
import {BLOCK_TYPES} from '../../signal-lab/src/dsp/blocks.js'
it('propagates each chopper phase continuously and closes the periodic orbit',()=>{
 for(const clock of [20000,1e5,5e5])for(const corner of [100,1000,5000])for(const start of [0,1]){
 const x=chopper({clock,corner,start});expect(x.points[0].y).toBeCloseTo(x.initial,12);for(let i=1;i<x.phases.length;i++)expect(x.phases[i].before).toBe(x.phases[i-1].after)
 if(start)expect(x.phases[1].after).toBeCloseTo(x.initial,12);else expect(x.initial).toBe(0)
 // Independently integrate the ODE by RK4 over one switch period.
 let y=x.initial;const dt=x.period/10000;for(let i=0;i<10000;i++){const u=x.dc+(i<5000?x.amp:-x.amp),f=v=>(u-v)/x.tau,k1=f(y),k2=f(y+dt*k1/2),k3=f(y+dt*k2/2),k4=f(y+dt*k3);y+=dt*(k1+2*k2+2*k3+k4)/6}expect(y).toBeCloseTo(x.phases[1].after,10)
 }
 expect(chopper().fundamental*1000).toBeCloseTo(12.731758,5);expect(chopper({offset:0}).points.every(p=>p.y===.01)).toBe(true)
})
it('distinguishes charge-step height from periodic DC error by integrating a cycle',()=>{
 for(const charge of [-5e-15,0,1e-15])for(const cap of [.5e-12,10e-12])for(const resistance of [1e5,1e7]){const x=injection({charge,cap,resistance});expect(x.after-x.before).toBeCloseTo(charge/cap,14);let sum=0;for(let i=0;i<20000;i++)sum+=x.at((i+.5)*x.T/20000)/20000;expect(Math.abs(sum-x.mean)).toBeLessThan(Math.max(1e-12,Math.abs(x.mean)*1e-5))}
 expect(injection().jump).toBe(.001);expect(injection().inputJump).toBe(1e-6);expect(injection().inputMean).toBeCloseTo(1e-7,18);expect(injection({cap:10e-12}).mean).toBe(injection().mean)
})
it('acquires the offset and thermal variance from their initial conditions',()=>{
 const x=autozero(),short=autozero({acquire:1e-9,cap:20e-12}),long=autozero({acquire:100e-9}),leak=autozero({leak:1e-12});expect(x.stored+x.settle).toBeCloseTo(.001,14);expect(short.settle).toBeGreaterThan(x.settle);expect(long.sigma).toBeCloseTo(Math.sqrt(KB*300/1e-12),14);expect(leak.droop/x.droop).toBeCloseTo(10,12)
 for(const seed of [1,7,99]){const y=autozero({seed});expect(Math.abs(y.mean-y.residual)).toBeLessThan(5*y.sigma/64);expect(Math.abs(y.sd/y.sigma-1)).toBeLessThan(.05)}
 expect(autozero({seed:7}).draws).toEqual(x.draws);expect(autozero({seed:8}).draws).not.toEqual(x.draws)
})
it('counts held aliases and checks the chopper against Parseval and a band-limited sum',()=>{
 const x=noisePaths();expect(x.count).toBe(20);expect(x.sampled/10e-9).toBeCloseTo(Math.sqrt(20)*Math.sin(.01*Math.PI)/(.01*Math.PI),12)
 for(const ratio of [1,2,3,10,20]){const y=noisePaths({bandwidth:ratio*1e5},1000);expect(y.count).toBe(2*ratio);expect(y.chop).toBeGreaterThan(0);expect(y.chop).toBeLessThan(1)}
 expect(noisePaths({bandwidth:1e9}).chop).toBeCloseTo(1,4);expect(noisePaths({},0).fold).toBe(19) // strict cutoff excludes ±B; lesson plots interior frequencies.
})
it('checks differencing against a coherent sine and the stationary covariance law',()=>{
 for(const delay of [1,2])for(const ratio of [.01,.1,.25,.49]){const x=cds({frequency:ratio*1e5,delay});let signal=0,error=0;for(let n=0;n<10000;n++){const a=Math.sin(2*Math.PI*ratio*n),b=Math.sin(2*Math.PI*ratio*(n-delay));signal+=a*a;error+=(a-b)**2}expect(Math.sqrt(error/signal)).toBeCloseTo(x.magnitude,10)}
 for(const delay of [1,2])for(const rho of [0,.5,.99]){const x=cds({delay,rho});expect(x.noise).toBeCloseTo(1e-5*Math.sqrt(2*(1-rho**delay)),14);expect(Math.abs(x.measured/x.noise-1)).toBeLessThan(.04)}
 expect(cds({frequency:0}).magnitude).toBe(0);expect(cds({frequency:5e4}).magnitude).toBe(2)
})
it('runs the exact exported difference filter in Signal Lab for either separation',()=>{
 const l=ZERO_DRIFT_LESSONS[4];for(const delay of [1,2]){const p={...defaults(l),delay},x=evaluate(l,p),{patch,warnings:parseWarnings}=parseLink(buildLink(x.handover.patch)),{state,warnings}=stateFromLink(patch,INITIAL);expect(parseWarnings).toEqual([]);expect(warnings).toEqual([]);expect(state.sampleRate).toBe(p.clock);expect(state.sources[0].freq).toBe(p.clock*p.ratio);const filter=BLOCK_TYPES.biquad.make(state.blocks[0].params,p.clock),history=[];for(let n=0;n<30;n++){const value=Math.cos(.23*n);history.push(value);expect(filter.process(value,n/p.clock)).toBeCloseTo(value-(n>=delay?history[n-delay]:0),12)}}
})
