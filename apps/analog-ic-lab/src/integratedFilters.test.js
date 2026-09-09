import {it,expect} from 'vitest'
import {solveAC,transferOf,complex} from '@ee-labs/network'
import {gmIntegrator,gmBiquad,stateAt,stateStep,tuning,tuneCommand,ladderState,cascadeState,ladder,ladderNet,ladderSections,filterHandover,halfPower} from './integratedFilters.js'
import {tfAt} from './architectures.js'
import {buildLink,parseLink} from '../../../packages/ui/src/deeplink.js'
import {stateFromLink} from '../../signal-lab/src/fromLink.js'
import {INITIAL} from '../../signal-lab/src/state.js'
import {BLOCK_TYPES} from '../../signal-lab/src/dsp/blocks.js'
const close=(a,b)=>expect(Math.hypot(a[0]-b[0],a[1]-b[1])/Math.max(1,Math.hypot(...b))).toBeLessThan(1e-8)
const native=(net,f)=>solveAC(net,2*Math.PI*f,{sources:{V1:[1,0]},anyFreq:true}).v.out
it('matches the leaky integrator to a native nodal circuit and the exact unity condition',()=>{
 for(const gm of [20e-6,100e-6,500e-6])for(const ro of [1e5,1.5e6,1e7]){const x=gmIntegrator({gm,ro});for(const f of [10,1e4,1e6,1e8])close(x.at(f),native(x.net,f));expect(Math.hypot(...x.at(x.unity))).toBeCloseTo(1,12);expect(x.unity).toBeLessThan(x.ideal);expect(x.step(0)).toBe(0);expect(x.step(30*ro*x.cap)/x.dc).toBeCloseTo(1,12)}
 expect(gmIntegrator().dc).toBe(150);expect(gmIntegrator({gm:1e-7,ro:1000}).unity).toBeNull()
})
it('checks biquad state, native AC and independently extracted transfer with both leakage paths',()=>{
 for(const gm1 of [20e-6,100e-6,500e-6])for(const q of [.5,1,5])for(const ratio of [.5,2]){const x=gmBiquad({gm1,q,ratio});for(const f of [1e3,1e5,1e6,1e8]){close(x.at(f),native(x.net,f));close(x.at(f),stateAt(x.A,x.B,f)[1])}const z=[.02,-.01],vin=.03,dx=x.A.map((row,i)=>row.reduce((s,a,j)=>s+a*z[j],0)+x.B[i]*vin);expect(x.c1*dx[0]).toBeCloseTo(gm1*(vin-z[1])-x.go*z[0],15);expect(x.c2*dx[1]).toBeCloseTo(1e-4*z[0]-(x.gd+x.go)*z[1],15)}
 const x=gmBiquad(),t=transferOf(x.net,{input:'V1',output:'out'});for(const f of [1e3,1e6,1e8])close(tfAt(t,f),x.at(f));expect(stateStep(x.A,x.B,1,1,40/x.a[1]).at(-1).y).toBeCloseTo(x.dc,7);expect(gmBiquad({q:5}).Q).toBeLessThan(5);expect(gmBiquad({gm1:20e-6}).Q).toBeGreaterThan(gmBiquad({gm1:20e-6}).idealQ)
})
it('calibrates common variation within range and retains clipping and slave mismatch',()=>{
 for(const c of [.6,1,1.4])for(const g of [.6,1,1.4]){const u=tuneCommand(c,g,3);expect(u).toBeCloseTo(Math.max(.5,c/g),10)}
 const exact=tuning({mismatch:0,max:3}),local=tuning({mismatch:.05,max:3}),clipped=tuning({spread:.4,mismatch:0,max:1.1});expect(exact.tuned.rms).toBeLessThan(1e-10);expect(local.tuned.rms).toBeGreaterThan(.02);expect(clipped.clipped).toBeGreaterThan(0);expect(clipped.tuned.rms).toBeGreaterThan(.01);expect(tuning({seed:7}).after).toEqual(tuning({seed:7}).after);expect(tuning({seed:8}).after).not.toEqual(tuning({seed:7}).after)
})
it('matches all four LC states to native AC and the equal-response Butterworth cascade',()=>{
 const nominal=ladderState();for(const f of [1e3,1e5,5e5,1e6,2e6,1e7]){close(nominal.at(f),cascadeState().at(f));expect(Math.hypot(...nominal.at(f))).toBeCloseTo(1/Math.sqrt(1+(f/1e6)**8),10)}expect(halfPower(nominal.at)).toBeCloseTo(1e6,7)
 for(let i=0;i<4;i++)for(const error of [-.2,0,.2]){const factors=[1,1,1,1];factors[i]+=error;const x=ladderState(factors);for(const f of [1e3,5e5,1e6,1e7])close(x.at(f),native(ladderNet(factors),f).map(v=>2*v))}
 const scaled=ladderState([1.1,1.1,1.1,1.1]);expect(halfPower(scaled.at)).toBeCloseTo(1e6/1.1,7);const s=ladder({error:0}).sensitivity;expect(s.reduce((a,x)=>a+x.ladder,0)).toBeCloseTo(-1,5);expect(s.reduce((a,x)=>a+x.cascade,0)).toBeCloseTo(-1,5)
})
it('factors the entire perturbed ladder and preserves it through the scaled bilinear receiver',()=>{
 for(let element=0;element<4;element++)for(const error of [-.2,.2]){const factors=[1,1,1,1];factors[element]+=error;const sections=ladderSections(factors),x=ladderState(factors);expect(sections).toHaveLength(2);for(const f of [1e4,5e5,1e6,1e7])close(sections.map(s=>tfAt(s,f)).reduce(complex.cmul,[1,0]),x.at(f));const link=filterHandover(sections,'h4'),{patch}=parseLink(buildLink(link.patch)),{state,warnings}=stateFromLink(patch,INITIAL);expect(warnings).toEqual([]);for(const fd of [100,500,1000,10000]){const digital=state.blocks.reduce((g,b)=>g*BLOCK_TYPES.biquad.response(b.params,fd,state.sampleRate),1),fa=state.sampleRate/Math.PI*Math.tan(Math.PI*fd/state.sampleRate)*1000;expect(digital).toBeCloseTo(Math.hypot(...x.at(fa)),9)}}
 const x=gmBiquad({q:5}),h=filterHandover([{a:x.a,b:x.b}],'h2');expect(stateFromLink(parseLink(buildLink(h.patch)).patch,INITIAL).warnings).toEqual([])
})
