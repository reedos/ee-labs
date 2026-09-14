import {it,expect} from 'vitest'
import {difference,instrumentation,offsetBudget,chopping,calibration} from './precision.js'
import {PARTS} from './models.js'
it('checks differential/common-mode decomposition against native two-source solves',()=>{
 for(const t of [.0001,.001,.01])for(const vcm of [-12,0,12])for(const vd of [-.01,0,.01]){
  const p={e1:-t,e2:t,e3:t,e4:-t,vcm,vd},x=difference(p),a=instrumentation({...p,bridge:1500})
  expect(x.native).toBeCloseTo(x.out,10);expect(a.native).toBeCloseTo(a.out,9)
  expect(x.cmrr).toBeCloseTo(20*Math.log10(1/(2*t)),9)
  expect(a.dm*vd+a.cm*vcm).toBeCloseTo(a.out,12)
 }
 expect(difference({e1:0,e2:0,e3:0,e4:0}).cmrr).toBeNull()
 expect(instrumentation().g).toBe(50.8)
})
it('keeps offset temperature coefficients distinct from output drift',()=>{
 for(let part=0;part<PARTS.length;part++)for(const inverting of [0,1]){
  const x=offsetBudget({part,gain:100,delta:60,inverting})
  expect(x.drift).toBe(PARTS[part].drift)
  expect(x.total).toBeCloseTo(100*(PARTS[part].vos+60*PARTS[part].drift),14)
  expect(x.input).toBeCloseTo(x.total/(inverting?99:100),14)
 }
})
it('checks chopped periodic state, harmonic amplitude and approximation boundary',()=>{
 for(const clock of [10000,100000,1e6]){
  const x=chopping({clock}),m=x.points
  for(const p of m)expect(p.y-x.dc).toBeCloseTo(x.at(p.x/1e6),9)
  expect(x.at(x.period)).toBeCloseTo(-x.peak,12)
  expect(x.fundamental).toBeLessThan(x.peak)
 }
 expect(chopping({clock:10000,corner:1000}).allowed).toBe(true)
 expect(chopping({clock:9999,corner:1000}).allowed).toBe(false)
})
it('calibrates endpoints and independently finds the drifted nonlinear error envelope',()=>{
 for(const gainError of [-.02,0,.02])for(const delta of [0,60,100]){
  const p={gainError,delta},x=calibration(p),zero=calibration({...p,delta:0})
  expect(zero.corrected(0)).toBeCloseTo(0,12);expect(zero.corrected(10)).toBeCloseTo(10,12)
  let sampled=0;for(let i=0;i<=10000;i++)sampled=Math.max(sampled,Math.abs(x.corrected(i/1000)-i/1000))
  expect(x.worst).toBeGreaterThanOrEqual(sampled-1e-12);expect(x.worst-sampled).toBeLessThan(1e-9)
 }
 expect(calibration().worst).toBeLessThan(calibration().limit)
 expect(calibration({part:1}).worst).toBeGreaterThan(calibration().limit)
})
