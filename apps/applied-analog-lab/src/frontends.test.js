import {it,expect} from 'vitest'
import {highSide,lowSide,rtd,typeK,inverseK,thermocouple,antiAlias} from './frontends.js'
it('separates resistor-corner gain from common leakage and solves the amplifier KCL',()=>{
 for(const gain of [1,10,20])for(const tolerance of [0,.001,.01]){const p={gain,tolerance},x=highSide(p),vp=x.b/(1+x.b)*12.05,out=(1+x.a)*vp-x.a*11.95;expect(x.output).toBeCloseTo(out,12);expect((11.95-vp)+(out-vp)/x.a).toBeCloseTo(0,12)}
 expect(highSide({tolerance:0}).error).toBe(0);expect(highSide().commonError).toBeCloseTo(-.024024024024,12);expect(highSide().integratedError).toBeCloseTo(.00012,12)
})
it('keeps physical return lift while Kelvin removes the trace measurement error',()=>{
 const k=lowSide(),s=lowSide({kelvin:0});expect(k.inferred).toBe(1);expect(s.inferred).toBeCloseTo(1.1,12);expect(k.ground).toBeCloseTo(.11,12);expect(k.ground).toBe(s.ground);expect(k.traceDrop).toBe(.01)
})
it('balances RTD electrical heating and thermal loss and approaches that equilibrium',()=>{
 for(const current of [.0001,.001,.005])for(const theta of [100,1000]){const x=rtd({current,theta,temp:100});expect(x.rise/theta).toBeCloseTo(current**2*x.resistance,12);expect(x.resistance).toBeCloseTo(100+.3851*(100+x.rise),12);const t=.7,h=1e-5,rate=(x.at(t+h)-x.at(t-h))/(2*h);expect(x.cth*rate).toBeCloseTo(current**2*(x.ambient+x.slope*x.at(t))-x.at(t)/theta,10)}
 expect(rtd().leadError).toBeCloseTo(2.59672812,7);expect(rtd().rise).toBeCloseTo(.050009629,9)
})
it('matches ITS-90 tabulated points and inverses; compensation cancels cold temperature',()=>{
 for(const [t,mv] of [[0,0],[100,4.096],[500,20.644],[1000,41.276]]){expect(typeK(t)*1000).toBeCloseTo(mv,3);expect(inverseK(typeK(t))).toBeCloseTo(t,8)}
 for(const hot of [50,500,1000])for(const cold of [5,80]){const x=thermocouple({hot,cold,offset:0,coldError:0});expect(x.estimate).toBeCloseTo(hot,8)}
 expect(inverseK(-.01)).toBeNull();expect(inverseK(.1)).toBeNull()
 const x=thermocouple({offset:1e-6,coldError:.001});expect(x.error).toBeCloseTo(x.offsetEstimate+x.coldEstimate,5)
})
it('derives the minimum Butterworth order from BOTH constraints',()=>{
 const x=antiAlias();expect(x.required).toBe(5);expect(x.meets).toBe(true);expect(antiAlias({order:4}).feasible).toBe(false)
 for(const clock of [.5e6,1e6,4e6])for(const ripple of [.01,.1,3]){const p={clock,ripple},x=antiAlias(p),y=antiAlias({...p,order:x.required});expect(y.feasible).toBe(true);expect(antiAlias({...p,order:x.required-1}).feasible).toBe(false);expect(antiAlias({...p,order:x.required,corner:y.minimum}).pass).toBeCloseTo(ripple,8);expect(antiAlias({...p,order:x.required,corner:y.maximum}).attenuation).toBeCloseTo(74,8)}
 expect(antiAlias({corner:1e5}).pass).toBeCloseTo(3.0102999566,9)
})
