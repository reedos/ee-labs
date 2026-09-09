import {rng,erf,proportion} from '@ee-labs/random'
import {filterSchematic} from './models.js'
import {astable} from './timingAudio.js'
export const nominalParts=[1000,1000,Math.SQRT2/(2*Math.PI*1e5*1000),1/(Math.SQRT2*2*Math.PI*1e5*1000)]
export function section(parts=nominalParts,gbw=1e6){
 const [r1,r2,c1,c2]=parts,a=r1*r2*c1*c2,b=c2*(r1+r2),f0=1/(2*Math.PI*Math.sqrt(a)),q=Math.sqrt(a)/b,h=1e5/100001,tau=h/(2*Math.PI*gbw),d=r1*c1,coeff=[1,b+tau+d*(1-h),a+b*tau+d*tau,a*tau]
 const magnitude=f=>{const w=2*Math.PI*f;return h/Math.hypot(1-coeff[2]*w*w,coeff[1]*w-coeff[3]*w**3)}
 let lo=f0*.001,hi=f0*10;for(let i=0;i<65;i++){const m=(lo+hi)/2;if(magnitude(m)>h/Math.SQRT2)lo=m;else hi=m}
 return{parts,f0,q,fc:(lo+hi)/2,coeff,h,magnitude,sf:[-.5,-.5,-.5,-.5],sq:[.5-r1/(r1+r2),.5-r2/(r1+r2),.5,-.5]}
}
export function methodDrawing(parts=nominalParts,gbw=1e6){const d=filterSchematic({gbw});return{...d,elements:d.elements.map(e=>{const i=['R1','R2','C1','C2'].indexOf(e.id);return i<0?e:{...e,value:parts[i]}}),caption:'Sallen–Key topology: C1 connects node a to the follower output; C2 connects node b to ground. Ideal f0 and Q use an ideal follower; the finite-GBW cutoff uses the stated 100,000 DC-gain follower.'}}
export function corners({tolerance=.01,gbw=1e6}={}){
 const base=section(nominalParts,gbw),vertices=Array.from({length:16},(_,i)=>{const signs=nominalParts.map((_,j)=>(i>>j)&1?1:-1),parts=nominalParts.map((v,j)=>v*(1+signs[j]*tolerance));return{signs,...section(parts,gbw)}}),fLow=base.f0/(1+tolerance)**2,fHigh=base.f0/(1-tolerance)**2
 // Q has its maximum on a face, at matched resistors, not at either R1 endpoint.
 const face=Array.from({length:81},(_,i)=>{const x=-tolerance+2*tolerance*i/80;return{x:x*100,y:section(nominalParts.map((v,j)=>v*(j===0?1+x:1)),gbw).q}})
 return{base,vertices,fLow,fHigh,face,qFace:base.q,qEnds:[face[0].y,face.at(-1).y],worst:vertices.reduce((a,b)=>a.fc<b.fc?a:b)}
}
function stats(a){const mean=a.reduce((s,v)=>s+v,0)/a.length,sd=Math.sqrt(a.reduce((s,v)=>s+(v-mean)**2,0)/(a.length-1));return{mean,sd,se:sd/Math.sqrt(a.length)}}
export function toleranceRuns({tolerance=.01,runs=2000,seed=7}={}){
 const random=rng(seed),sigma=tolerance/3,base=section(),data=Array.from({length:runs},()=>{const e=Array.from({length:4},()=>random.normal(0,sigma));const [r1,r2,c1,c2]=e.map((v,i)=>nominalParts[i]*(1+v));if(Math.min(r1,r2,c1,c2)<=0)throw Error('A Gaussian draw produced a nonpositive part; use a positive-valued process model for this spread.');const a=r1*r2*c1*c2;return{f:1/(2*Math.PI*Math.sqrt(a))/base.f0-1,q:Math.sqrt(a)/(c2*(r1+r2))/base.q-1,fl:-.5*e.reduce((s,v)=>s+v,0),ql:.5*(e[2]-e[3])}})
 const fs=stats(data.map(v=>v.f)),qs=stats(data.map(v=>v.q)),cov=data.reduce((s,v)=>s+(v.f-fs.mean)*(v.q-qs.mean),0)/(runs-1)
 const residualF=Math.sqrt(data.reduce((s,v)=>s+(v.f-v.fl)**2,0)/runs)/sigma,residualQ=Math.sqrt(data.reduce((s,v)=>s+(v.q-v.ql)**2,0)/runs)/(sigma/Math.SQRT2)
 return{sigma,data,fs,qs,cov,residualF,residualQ,linearCheck:Math.max(residualF,residualQ)<=.01,correlation:cov/(fs.sd*qs.sd),predF:sigma,predQ:sigma/Math.SQRT2,cornerLow:1/(1+tolerance)**2-1,cornerHigh:1/(1-tolerance)**2-1}
}
export function yields(p={}){const x=toleranceRuns(p),fLimit=p.fLimit??.01,qLimit=p.qLimit??.005,analyticF=erf(fLimit/(Math.SQRT2*x.predF)),analyticQ=erf(qLimit/(Math.SQRT2*x.predQ)),counts=keys=>{const f=x.data.filter(v=>Math.abs(v[keys[0]])<=fLimit).length,q=x.data.filter(v=>Math.abs(v[keys[1]])<=qLimit).length,both=x.data.filter(v=>Math.abs(v[keys[0]])<=fLimit&&Math.abs(v[keys[1]])<=qLimit).length;return[f,q,both].map(n=>proportion(n,x.data.length))};return{...x,fLimit,qLimit,analytic:[analyticF,analyticQ,analyticF*analyticQ],exact:counts(['f','q']),linear:counts(['fl','ql'])}}
export function canon({gain=11,peak=10,bandwidth=2e4,lower=720,cap=10e-9}={}){return{corner:1e6/gain,timer:astable({cap}).frequency,idealVoltage:1.25*(1+lower/240),adjust:50e-6*lower,voltage:1.25*(1+lower/240)+50e-6*lower,fullPower:5e6/(2*Math.PI*peak),noise:5e-9*Math.sqrt(bandwidth)}}
