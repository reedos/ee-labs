import {it,expect} from 'vitest'
import katex from 'katex'
import {solveDC,newtonDC,solveAC,returnRatioAt,transient,complex} from '@ee-labs/network'
import {defaults,evaluate} from '@ee-labs/lessons/model'
import {outputBias,halfCircuits,feedbackModes,sensors} from './differential.js'
import {DIFFERENTIAL_LESSONS} from './differentialLessons.js'
import {buildLink,parseLink} from '../../../packages/ui/src/deeplink.js'
import {stateFromLink} from '../../control-lab/src/fromLink.js'
const {csub,cadd,cdiv,cmul,cabs}=complex
const close=(a,b)=>expect(cabs(csub(a,b))/Math.max(1e-9,cabs(b))).toBeLessThan(2e-8)
const voltage=(net,f,sources)=>solveAC(net,2*Math.PI*f,{sources,anyFreq:true}).v
it('checks common drift against full linear and nonlinear two-output nodal circuits',()=>{
 for(const feedback of [0,1])for(const vdd of [1.4,1.8,2.4])for(const epsilon of [-.1,-.01,0,.01,.05,.1]){
  const x=outputBias({feedback,vdd,epsilon}),v=solveDC(x.net).v
  expect(v.p+x.bias).toBeCloseTo(x.linear,10);expect(v.n).toBeCloseTo(v.p,12)
  const elements=[{type:'V',id:'Vdd',nodes:['vdd','gnd'],value:vdd},{type:'V',id:'Vgn',nodes:['gn','gnd'],value:.65},{type:'V',id:'Vgp',nodes:['gp','gnd'],value:vdd-.65},{type:'V',id:'Vb',nodes:['bias','gnd'],value:vdd/2}]
  for(const side of ['p','n'])elements.push({type:'M',id:'Mn'+side,nodes:[side,'gn','gnd'],kn:x.kn,vt:.45,lambda:x.lambda},{type:'M',id:'Mp'+side,nodes:[side,'gp','vdd'],polarity:'p',kn:x.kn,vt:.45,lambda:x.lambda},{type:'I',id:'I'+side,nodes:['gnd',side],value:x.delta},{type:'VCCS',id:'Gc'+side,nodes:[side,'gnd'],ctrl:[side,'bias'],gain:x.gc})
  const solved=newtonDC({elements});expect(solved.converged).toBe(true);const actual=solved.sol.v
  expect(actual.p).toBeCloseTo(x.vo,6);expect(actual.n).toBeCloseTo(x.vo,6)
  expect(Math.abs(x.residual)).toBeLessThan(1e-17)
  if(x.inSaturation)expect(x.vo).toBeCloseTo(x.linear,10)
 }
 expect(outputBias({epsilon:.05}).inSaturation).toBe(true)
 expect(outputBias({epsilon:.1}).p.region).toBe('triode')
 expect(outputBias({epsilon:-.1}).n.region).toBe('triode')
 expect(outputBias({epsilon:.1,feedback:1}).inSaturation).toBe(true)
})
it('matches both exact halves to the full pair over frequency and keeps CMRR conventions distinct',()=>{
 for(const gm of [50e-6,200e-6,500e-6])for(const rt of [10e3,1e6,2e6])for(const ro of [100e3,500e3,2e6]){
  const x=halfCircuits({gm,rt,ro})
  for(const f of [0,1e4,1e6,1e8]){
   const vd=voltage(x.full,f,{Vp:[.5,0],Vn:[-.5,0]}),vc=voltage(x.full,f,{Vp:[1,0],Vn:[1,0]})
   close(csub(vd.op,vd.on),x.dm(f));close(voltage(x.dmHalf,f,{V1:[1,0]}).out,x.dm(f))
   close(vc.op,x.cm(f));close(vc.on,x.cm(f));close(voltage(x.cmHalf,f,{V1:[1,0]}).out,x.cm(f))
   expect(cabs(csub(vc.op,vc.on))).toBeLessThan(1e-12)
  }
 }
 const x=halfCircuits();expect(x.ad).toBeCloseTo(-3.846153846,8);expect(x.ac).toBeCloseTo(-.00987556785,10);expect(x.cmrr).toBeCloseTo(45.78869159,7)
 expect(halfCircuits({rt:10e3}).error).toBeGreaterThan(.05)
})
it('independently breaks both physical feedback loops and checks their closed responses',()=>{
 for(const gc of [50e-6,300e-6])for(const cl of [.5e-12,10e-12])for(const fcm of [1e6,100e6])for(const fdm of [2e6,200e6]){
  const x=feedbackModes({gc,cl,fcm,fdm})
  for(const [name,m] of [['cm',x.cm],['dm',x.dm]]){
   expect(m.crossings).toHaveLength(1);expect(cabs(m.at(m.crossover))).toBeCloseTo(1,10)
   for(const f of [1,1e5,m.crossover,1e9]){
    close(returnRatioAt(x.net,'E'+name,2*Math.PI*f),m.at(f))
    const v=voltage(x.net,f,{Vcm:[name==='cm'?1:0,0],Vdm:[name==='dm'?1:0,0]}),out=name==='cm'?cmul([.5,0],cadd(v.op,v.on)):csub(v.op,v.on)
    close(out,cdiv(m.at(f),cadd([1,0],m.at(f))))
   }
  }
 }
 expect(feedbackModes({fcm:1e6}).cm.pm).toBeLessThan(feedbackModes().cm.pm)
 expect(feedbackModes({fcm:1e6}).dm.pm).toBe(feedbackModes().dm.pm)
})
it('reconstructs both physical capacitor waveforms from the two modal state pairs',()=>{
 for(const fcm of [1e6,10e6,100e6])for(const cl of [.5e-12,10e-12])for(const fdm of [2e6,200e6]){
  const x=feedbackModes({fcm,cl,fdm}),wave=transient(x.net,{tEnd:x.tEnd,points:81})
  expect(x.state(0)).toEqual({c:0,d:0,p:0,n:0})
  for(let i=0;i<wave.t.length;i++){const z=x.state(wave.t[i]);expect(wave.samples[i].sol.v.op).toBeCloseTo(z.p,9);expect(wave.samples[i].sol.v.on).toBeCloseTo(z.n,9)}
  expect(x.state(10*x.tEnd).c).toBeCloseTo(x.cm.steady[0],10)
 }
})
it('checks resistive loading and follower transfer with native sensor networks',()=>{
 for(const rs of [10e3,100e3,1e6])for(const cs of [20e-15,1e-12]){
  const x=sensors({rs,cs}),base=[{type:'V',id:'Vp',nodes:['up','gnd'],value:x.up},{type:'V',id:'Vn',nodes:['un','gnd'],value:x.un},...['p','n'].map(side=>({type:'R',id:'Ro'+side,nodes:['u'+side,side],value:x.rout}))]
  const net={elements:[...base,...['p','n'].map(side=>({type:'R',id:'Rs'+side,nodes:[side,'sense'],value:rs})),{type:'C',id:'Cs',nodes:['sense','gnd'],value:cs}]},v=solveDC(net).v
  expect(v.p-v.n).toBeCloseTo(x.resistive.difference,12);expect(v.sense).toBeCloseTo(.9,12)
  for(const f of [0,1e6,1e9]){
   const ac=voltage(net,f,{Vp:[1,0],Vn:[1,0]})
   close(cdiv(ac.sense,ac.p),cdiv([1,0],[1,2*Math.PI*f*rs*cs/2]))
   const sf={elements:[{type:'V',id:'V1',nodes:['in','gnd'],value:0},{type:'VCCS',id:'gm',nodes:['gnd','out'],ctrl:['in','out'],gain:100e-6},{type:'R',id:'ro',nodes:['out','gnd'],value:500e3},{type:'C',id:'Cs',nodes:['out','gnd'],value:cs}]}
   close(voltage(sf,f,{V1:[1,0]}).out,cdiv([100e-6,0],[102e-6,2*Math.PI*f*cs]))
  }
 }
})
it('conserves switching charge and checks the periodic sampler by time integration',()=>{
 for(const cs of [20e-15,100e-15,1e-12])for(const fs of [1e4,1e5,20e6]){
  const x=sensors({cs,fs}),q=x.sc,U=x.up
  expect(q.chargeKick(U)).toBeCloseTo(U*q.kick,12);expect(q.held).toBeCloseTo((x.up+x.un)*q.sample/2,12)
  // Independent repeated charge sharing and exact RC intervals, not the
  // closed-form fixed point. Integrate the final cycle with midpoint samples.
  let before=U
  for(let i=0;i<1000;i++){
   const kick=x.cl*before/(x.cl+cs),captured=U+(kick-U)*Math.exp(-q.half/(x.rout*(x.cl+cs)))
   before=U+(captured-U)*Math.exp(-q.half/(x.rout*x.cl))
  }
  expect(before).toBeCloseTo(U*q.before,12)
  let mean=0;const count=50000
  for(let i=0;i<count;i++)mean+=q.wave(U,(i+.5)*2*q.half/count)/count
  expect(mean).toBeCloseTo(U*q.mean,6)
  expect((U-mean)/x.rout).toBeCloseTo(cs*fs*U*q.sample,10)
  expect(q.mean).toBeGreaterThan(0);expect(q.mean).toBeLessThan(1);expect(q.sample).toBeLessThanOrEqual(1)
 }
 expect(sensors().sc.settled).toBe(true);expect(sensors({cs:1e-12,fs:20e6}).sc.settled).toBe(false)
 const fast=sensors({cs:1e-12,fs:20e6});expect(fast.sc.held).toBeLessThan(.9);expect(fast.sc.mean).toBeLessThan(1)
})
it('preserves both feedback transfers through the actual Control Lab receiver',()=>{
 const lesson=DIFFERENTIAL_LESSONS[2]
 for(const p of [defaults(lesson),{...defaults(lesson),cl:.5e-12,fcm:100e6,fdm:200e6}]){
  const result=evaluate(lesson,p),x=feedbackModes(p)
  for(const [i,m] of [x.cm,x.dm].entries()){
   const parsed=parseLink(buildLink(result.handovers[i].patch)),incoming=stateFromLink(parsed.patch)
   expect(parsed.warnings).toEqual([]);expect(incoming.warnings).toEqual([])
   expect(parsed.patch.plant.params).toEqual([0,0,m.k,...m.tf.a]);expect(incoming.state.plantId).toBe('custom')
  }
 }
})
it('renders every sensor branch and meaningful combined endpoint without invalid math or numbers',()=>{
 const l=DIFFERENTIAL_LESSONS[3]
 for(const sensor of [0,1,2])for(const fs of [1e4,20e6])for(const cs of [20e-15,1e-12]){
  const x=evaluate(l,{...defaults(l),sensor,fs,cs})
  for(const step of x.steps)for(const tex of [step.tex,step.substitution].filter(Boolean))expect(()=>katex.renderToString(tex,{throwOnError:true})).not.toThrow()
  for(const v of x.readings)expect(Number.isFinite(v.value)).toBe(true)
 }
})
