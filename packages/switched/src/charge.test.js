import {it,expect} from 'vitest'
import {chargeStep} from './charge.js'
import {transient} from '@ee-labs/network'
it('conserves floating-conductor charge and matches a finite-resistance native limit',()=>{
 for(const c2 of [.1e-12,1e-12,10e-12]){
  const capacitors=[{id:'C1',a:'join',b:'gnd',c:1e-12},{id:'C2',a:'join',b:'gnd',c:c2}],x=chargeStep({capacitors,previous:{C1:1,C2:-.2}}),tau=1000*1e-12*c2/(1e-12+c2)
  const net={elements:[{type:'C',id:'C1',nodes:['a','gnd'],value:1e-12},{type:'C',id:'C2',nodes:['b','gnd'],value:c2},{type:'R',id:'R1',nodes:['a','b'],value:1000}]}
  const native=transient(net,{x0:[1,-.2],tEnd:30*tau,points:5}).at(30*tau).sol.v
  expect(native.a).toBeCloseTo(x.voltages.join,10);expect(native.b).toBeCloseTo(x.voltages.join,10);expect(Math.abs(x.injected.join)).toBeLessThan(1e-25)
  expect(x.energy).toBeLessThan(.5*(1e-12+c2*.04))
 }
})
it('distinguishes a voltage-constrained floating input from an output charge source',()=>{
 const x=chargeStep({capacitors:[{id:'C',a:'sum',b:'out',c:1e-12}],previous:{C:-2},actuators:['out'],constraints:[{terms:{sum:1},value:0}]})
 expect(x.voltages.out).toBe(2);expect(x.injected.sum).toBe(0)
 expect(()=>chargeStep({capacitors:[{id:'C',a:'a',b:'b',c:1}],previous:{C:1},actuators:['a']})).toThrow(/equation/)
})
