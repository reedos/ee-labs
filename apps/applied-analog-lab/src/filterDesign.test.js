import {it,expect} from 'vitest'
import {complex} from '@ee-labs/network'
import {spec,prototype,tolerance,section,cascade,db} from './filterDesign.js'
const near=(a,b,t=1e-8)=>expect(Math.abs(a-b)).toBeLessThan(t*Math.max(1,Math.abs(b)))
it('derives minimal integer order from both masks and rechecks the achieved response',()=>{
 for(const cheb of [false,true])for(const ratio of [2,5,10])for(const ripple of [.1,.5,1])for(const stop of [20,40,80]){const p={ratio,ripple,stop},x=spec(p,cheb);expect(x.achieved).toBeGreaterThanOrEqual(stop-1e-9);near(x.attenuation(1e5),ripple);const prev=x.order-1,loss=10*Math.log10(1+x.eps2*(cheb?Math.cosh(prev*Math.acosh(ratio))**2:ratio**(2*prev)));expect(loss).toBeLessThan(stop)}
 near(spec().achieved,46.7819466544);near(spec({},true).achieved,44.5792412737)
})
it('compares prototypes at equal half-power bandwidth and checks phase derivative against group delay',()=>{
 for(const kind of ['bessel','butter']){const x=prototype(kind);near(db(x.at(1e5)),-10*Math.log10(2));near(x.response.at(-1).y,1,1e-3);for(const f of [1e3,5e4,1e5]){const h=.01,a=x.at(f-h),b=x.at(f+h),phase=Math.atan2(b[1]*a[0]-b[0]*a[1],b[0]*a[0]+b[1]*a[1]);near(x.delay(f),-phase/(4*Math.PI*h),1e-12)}}
 expect(prototype('bessel').overshoot).toBeLessThan(1);expect(prototype('butter').overshoot).toBeGreaterThan(10)
})
it('Monte Carlo reproduces independent uniform-part standard deviations rather than tolerance limits',()=>{
 const x=tolerance({tolerance:.001});expect(x.sigmaF/x.predF).toBeCloseTo(1,1);expect(x.sigmaQ/x.predQ).toBeCloseTo(1,1);x.sensitivities.forEach((a,i)=>{near(a.f,-.5);near(a.q,[0,0,.5,-.5][i])});expect(tolerance({seed:9}).sigmaF).not.toBe(tolerance({seed:7}).sigmaF)
})
it('finite-amplifier nodal solutions converge to independent ideal topology equations',()=>{
 for(const topology of [0,1])for(const q of [.54,.707,1.306]){const x=section({topology,q,gbw:1e14});for(const f of [0,1e4,1e5,1e6]){const ideal=complex.cdiv([topology?-1:1,0],[1-(f/1e5)**2,f/(1e5*q)]);near(x.at(f)[0],ideal[0],1e-7);near(x.at(f)[1],ideal[1],1e-7)}}
})
it('the constrained practical design exercise has achievable answers and rejects peaking',()=>{
 expect(cascade().meets).toBe(false);for(const p of [{topology:0,scale:1.1,damping:.95},{topology:1,scale:1.2,damping:.95}]){const x=cascade(p);expect(x.meets).toBe(true);for(let i=0;i<=2000;i++){const gain=db(x.at(i*50));expect(gain).toBeLessThan(1e-8);expect(gain).toBeGreaterThanOrEqual(-.5)}}
})
