import {it,expect} from 'vitest'
import {complex,returnRatioAt} from '@ee-labs/network'
import {cascode,miller,nativeAt,outputStage,railInput,loopCrossings,tfAt} from './architectures.js'
const {cabs,csub,cdiv,cadd}=complex
const same=(a,b)=>expect(cabs(csub(a,b))/Math.max(1e-14,cabs(b))).toBeLessThan(1e-8)
it('derives cascode and boosted gain from native nodal and broken-loop equations',()=>{
 for(const boost of [0,5,40])for(const tail of [20e-6,40e-6,80e-6]){
  const p={boost,tail},x=cascode(p),closed=cascode({...p,feedback:true})
  for(const f of [1,1e4,1e6,2e7,1e9]){
   same(x.at(f),nativeAt(x.net,f));same(x.at(f),returnRatioAt(closed.net,'Ginput',2*Math.PI*f))
   same(nativeAt(closed.net,f),cdiv(x.at(f),cadd([1,0],x.at(f))))
   if(boost)for(const side of ['n','p'])same(x.auxAt(f),returnRatioAt(x.net,'B'+side,2*Math.PI*f))
  }
 }
 expect(cascode().rout).toBeCloseTo(38e6,4)
 expect(cascode().dc).toBeCloseTo(11400,7)
 expect(cascode({folded:1}).power/cascode().power).toBe(2)
})
it('checks the Miller feedforward zero and feedback response against the native circuit',()=>{
 for(const cc of [.5e-12,1e-12,3e-12]){
  const x=miller({cc}),closed=miller({cc,feedback:true})
  for(const f of [1,1e4,1e6,2e7,1e9]){same(x.at(f),nativeAt(x.net,f));same(x.at(f),returnRatioAt(closed.net,'G1',2*Math.PI*f));same(nativeAt(closed.net,f),cdiv(x.at(f),cadd([1,0],x.at(f))))}
  expect(-x.tf.b[1]/x.tf.b[0]).toBeGreaterThan(0)
 }
 expect(miller().dc).toBeCloseTo(5000,8)
 expect(miller().slew).toBeCloseTo(20e6,4)
 expect(miller({cc:3e-12}).pm).toBeGreaterThan(miller().pm)
})
it('preserves output-stage symmetry, quiescent current and rail-dependent current capability',()=>{
 for(const follower of [0,1]){
  const rest=outputStage({drive:0,follower});expect(rest.upper.id).toBeCloseTo(20e-6,12);expect(rest.lower.id).toBeCloseTo(20e-6,12)
  for(const fraction of [.1,.5,.9]){const a=outputStage({drive:.3,fraction,follower}),b=outputStage({drive:-.3,fraction:1-fraction,follower});expect(a.current).toBeCloseTo(-b.current,12)}
 }
 expect(outputStage({fraction:.9}).current).toBeGreaterThan(outputStage({fraction:.9,follower:1}).current)
 expect(outputStage().current).toBeGreaterThan(outputStage().iq)
})
it('solves tail compliance and constant-gm steering, including the square-law quarter-current condition',()=>{
 const overlap=railInput(),steered=railInput({steer:1});expect(overlap.gm/overlap.target).toBeCloseTo(2,8);expect(steered.scale).toBeCloseTo(.25,8)
 for(const vcm of [0,.3,.5,.6,.9,1.2,1.5,1.8]){
  const x=railInput({vcm,steer:1});expect(x.gm/x.target).toBeCloseTo(1,6)
  const mirror=railInput({vcm:1.8-vcm,steer:1});expect(x.n.current).toBeCloseTo(mirror.p.current,12)
  expect(x.n.current).toBeLessThanOrEqual(40e-6*x.scale+1e-15)
  expect(x.p.current).toBeLessThanOrEqual(40e-6*x.scale+1e-15)
 }
})

it('finds both unity crossings when the low and high frequency gains are below one',()=>{
 const w=2*Math.PI*1e6,tf={b:[.5*w*w],a:[1,w/5,w*w]},x=loopCrossings(f=>tfAt(tf,f))
 expect(x.crossings).toHaveLength(2);expect(x.crossings.map(c=>c.direction)).toEqual(['Rising','Falling'])
 for(const c of x.crossings)expect(cabs(tfAt(tf,c.crossover))).toBeCloseTo(1,10)
})

it('does not wrap an unstable Miller phase into a falsely positive margin',()=>{
 const x=miller({gm1:500e-6,gm2:250e-6,cl:10e-12,cc:.5e-12})
 expect(x.tf.a[1]+x.tf.b[0]).toBeLessThan(0)
 expect(x.pm).toBeLessThan(0)
})
