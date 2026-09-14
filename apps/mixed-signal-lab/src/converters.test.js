import {it,expect} from 'vitest'
import {chargeDAC,sar,arrayErrors,mismatchStats,flash,pipeline,calibrateWeights} from './converters.js'
it('conserves each floating-node charge and resolves binary/split weights with a single dummy',()=>{
 for(const bits of [4,5,6,8,12])for(const split of [0,1])for(const code of [0,1,2**(bits-1),2**bits-1]){
  const x=chargeDAC({bits,split,code});expect(x.out).toBeCloseTo(code/2**bits,12);expect(Math.abs(x.qout)).toBeLessThan(1e-24);expect(Math.abs(x.qlow)).toBeLessThan(1e-24)
  expect(chargeDAC({bits,split,code,phase:0}).out).toBe(0)
 }
 expect(chargeDAC().total/1e-12).toBeCloseTo(81.92,9)
 expect(chargeDAC({split:1}).total/1e-12).toBeCloseTo(2.56031746031746,10)
})
it('makes every SAR trial agree with native charge projection and bounds the final error',()=>{
 for(const bits of [4,8,12])for(const fraction of [0,.001,.3,.63,.9999,1]){
  const x=sar({bits,fraction});expect(x.code).toBe(Math.min(2**bits-1,Math.floor(fraction*2**bits)));expect(x.rows).toHaveLength(bits)
  for(const q of x.rows)expect(q.test).toBeCloseTo(chargeDAC({bits,code:q.trial,split:1}).out,12)
  expect(x.residue).toBeGreaterThanOrEqual(-1e-14);expect(x.residue).toBeLessThanOrEqual(1/2**bits+1e-14)
 }
 expect(sar().rate).toBeCloseTo(20e6/14,8)
})
it('uses endpoint normalization and checks mismatch statistics with uncertainty',()=>{
 const ideal=arrayErrors({sigma:0});expect(ideal.worstINL).toBeLessThan(1e-10);expect(ideal.worstDNL).toBeLessThan(1e-10)
 const x=arrayErrors();expect(x.inl[0].y).toBe(0);expect(x.inl.at(-1).y).toBeCloseTo(0,10)
 for(let i=0;i<x.dnl.length;i++)expect(x.dnl[i].y).toBeCloseTo(x.inl[i+1].y-x.inl[i].y,10)
 const m=mismatchStats({count:8192});expect(m.sd/m.estimate).toBeCloseTo(1,1);expect(m.sdCI[0]).toBeLessThan(m.estimate);expect(m.sdCI[1]).toBeGreaterThan(m.estimate)
 expect(m.area).toBeCloseTo(1.472,2)
})
it('retains physical flash comparator ordering and integrates encoder-dependent code bins',()=>{
 for(const encoder of [0,1]){
  const ideal=flash({sigma:0,encoder});expect(ideal.missing).toBe(0);expect(Math.max(...ideal.dnl.map(x=>Math.abs(x.y)))).toBe(0)
  const x=flash({sigma:1.5,encoder});expect(x.inversions).toBeGreaterThan(0);expect(x.widths.reduce((a,b)=>a+b,0)).toBeCloseTo(1,12)
  const count=Array(64).fill(0);for(let i=0;i<100000;i++)count[x.encode((i+.5)/100000)]++
  x.widths.forEach((w,i)=>expect(Math.abs(w-count[i]/100000)).toBeLessThan(2e-5))
 }
 expect(flash({sigma:1.5,encoder:1}).missing).toBeGreaterThan(flash({sigma:1.5,encoder:0}).missing)
})
it('corrects redundant pipeline decisions only while all residues fit the backend range',()=>{
 for(const offset of [-.25,-.15,0,.15,.25])for(let i=0;i<=4096;i++){
  const x=pipeline({fraction:-1+i/2048,offset});expect(x.valid).toBe(true);expect(x.code).toBe(x.ideal)
 }
 expect(pipeline({fraction:.04,offset:.3}).guard).toBe(false)
 expect(pipeline({fraction:.54,offset:.3}).valid).toBe(false)
})
it('calibrates code-level voltage estimates without changing the physical DAC',()=>{
 const x=calibrateWeights({measurement:0});expect(x.worstAfter).toBeLessThan(1e-10)
 const a=calibrateWeights({averages:1}),b=calibrateWeights({averages:16});expect(a.weights).toEqual(b.weights);expect(a.before).toEqual(b.before);expect(a.worstAfter/b.worstAfter).toBeCloseTo(4,8)
 expect(b.allOn95).toBeCloseTo(1.96*.05/4*Math.sqrt(12),12)
})
