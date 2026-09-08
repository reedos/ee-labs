import {it,expect} from 'vitest'
import {solveAC,returnRatioAt,complex} from '@ee-labs/network'
import {loadCircuit,tiaCircuit,compositeCircuit,stability,at,loopHandover} from './stability.js'
import {stateFromLink} from '../../control-lab/src/fromLink.js'
import {PLANTS} from '../../control-lab/src/systems.js'
it('agrees with native nodal AC and independently broken-loop circuits',()=>{
 for(const [model,source] of [[loadCircuit(),'V1'],[loadCircuit({riso:50,rl:1000}),'V1'],[tiaCircuit(),'I1'],[tiaCircuit({cf:1e-12}),'I1'],[compositeCircuit(),'V1']]){
  for(const f of [100,10000,100000,1e6,10e6]){
   const v=solveAC(model.net,2*Math.PI*f,{sources:{[source]:[1,0]}}).v.out,z=at(model.closed,f)
   expect(complex.cabs(complex.csub(v,z))/Math.max(1,complex.cabs(z))).toBeLessThan(1e-8)
   expect(complex.cabs(complex.csub(returnRatioAt(model.net,'A1',2*Math.PI*f),at(model.loop,f)))/Math.max(1,complex.cabs(at(model.loop,f)))).toBeLessThan(1e-8)
  }
 }
})
it('measures first-peak overshoot rather than relying on plot samples or confusing frequency definitions',()=>{
 for(const [model,input] of [[loadCircuit(),.01],[loadCircuit({riso:100,rl:1000}),.01],[tiaCircuit(),1e-9],[tiaCircuit({cf:5e-12}),1e-9],[compositeCircuit(),1e-4]]){const x=stability(model,{input}),expected=x.zeta<1?100*Math.exp(-Math.PI*x.zeta/Math.sqrt(1-x.zeta*x.zeta)):0;expect(x.overshoot).toBeCloseTo(expected,6);expect(x.points.every(p=>Number.isFinite(p.y))).toBe(true)}
 const a=stability(loadCircuit()),b=stability(loadCircuit({riso:50,rl:1000}));expect(a.pm).toBeCloseTo(31.41427,4);expect(b.pm).toBeGreaterThan(75)
 const t=stability(tiaCircuit({cf:Math.sqrt(2*25e-12/(2*Math.PI*1e6*10e6))}),{input:1e-9});expect(Math.abs(t.bandwidth-t.feedbackPole)/t.bandwidth).toBeGreaterThan(.1)
 const c=stability(compositeCircuit(),{input:1e-4});expect(c.crossover/1e3).toBeCloseTo(78.6116,3);expect(c.bandwidth).toBeGreaterThan(c.crossover)
 expect(stability(compositeCircuit({gbw:1.5e6}),{input:1e-4}).crossover).toBeGreaterThan(1e5)
})
it('hands the exact loop polynomial into Control Lab without coefficient or gain clamping',()=>{
 for(const model of [loadCircuit(),loadCircuit({riso:50,rl:1000}),tiaCircuit(),compositeCircuit()]){
  const h=loopHandover(model,'b1'),r=stateFromLink(h.patch);expect(r.warnings).toEqual([])
  const tf=PLANTS.custom.tf(r.state.plantP)
  for(const f of [1,1000,1e6])expect(complex.cabs(complex.csub(at(tf,f),at(model.loop,f)))).toBeLessThan(1e-10)
 }
})
