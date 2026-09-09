import {rng,periodogram,proportion,zFor} from '@ee-labs/random'
import {flash} from './converters.js'
const clip=(x,a,b)=>Math.max(a,Math.min(b,x)),sum=xs=>xs.reduce((a,b)=>a+b,0)
export const DEFAULT_TAU=25e-9/(13*Math.LN2)
export function settling({bits=12,clock=20e6,tau=DEFAULT_TAU,beta=.5,step=1}={}){
 const time=.5/clock,lsb=2**-bits,tolerance=lsb/2,e0=Math.abs(step),constants=e0>tolerance?Math.log(e0/tolerance):0,required=tau*constants
 const maxTau=constants?time/constants:null,error=e0*Math.exp(-time/tau),at=t=>step*(-Math.expm1(-t/tau))
 const net={elements:[{type:'V',id:'V1',nodes:['in','gnd'],wave:{kind:'step',from:0,to:step}},{type:'R',id:'R1',nodes:['in','out'],value:tau/1e-12},{type:'C',id:'C1',nodes:['out','gnd'],value:1e-12}]}
 return{bits,clock,tau,beta,step,time,lsb,tolerance,e0,constants,required,maxTau,requiredBW:maxTau?1/(2*Math.PI*maxTau):0,gbw:maxTau?1/(2*Math.PI*maxTau*beta):0,error,errorLSB:error/lsb,at,net,pass:required<=time*(1+1e-14)}
}

// Exact propagation of a constant target with a continuous current limit.
// This kernel is also used sample by sample by the spectrum experiment.
export function slewAdvance(initial,target,time,tau,sr){
 const delta=target-initial,mag=Math.abs(delta),direction=Math.sign(delta),transition=sr*tau,ts=Math.max(0,(mag-transition)/sr)
 const error=time<ts?mag-sr*time:Math.min(mag,transition)*Math.exp(-(time-ts)/tau)
 return target-direction*error
}
export function slewing(p={}){
 const x=settling(p),sr=p.sr??100e6,transition=sr*x.tau,ts=Math.max(0,(x.e0-transition)/sr)
 const required=x.e0<=x.tolerance?0:x.tolerance>=transition?(x.e0-x.tolerance)/sr:ts+x.tau*Math.log(Math.min(x.e0,transition)/x.tolerance)
 const at=t=>slewAdvance(0,x.step,t,x.tau,sr),error=Math.abs(x.step-at(x.time))
 return{...x,sr,transition,ts,required,linearRequired:x.required,at,error,errorLSB:error/x.lsb,pass:required<=x.time*(1+1e-14)}
}
export function regeneration({tau=20e-12,time=200e-12,initial=100e-6,rate=5e9}={}){
 const target=.5,span=1,threshold=target*Math.exp(-time/tau),probability=Math.min(1,2*threshold/span),failRate=rate*probability,interval=1/failRate
 const decision=initial===0?null:Math.max(0,tau*Math.log(target/Math.abs(initial))),end=decision===null?time:Math.min(time,decision)
 const at=t=>initial*Math.exp(t/tau),cap=1e-12
 const net={elements:[{type:'C',id:'C1',nodes:['out','gnd'],value:cap},{type:'VCCS',id:'G1',nodes:['gnd','out'],ctrl:['out','gnd'],gain:cap/tau}]}
 return{tau,time,initial,rate,target,span,threshold,probability,failRate,interval,decision,end,at,net}
}

export const SPECTRUM_LENGTH=8192,SIGNAL_BIN=997
export function harmonicBins(n,k,highest=10){return [...new Set(Array.from({length:highest-1},(_,i)=>{const raw=(i+2)*k%n;return Math.min(raw,n-raw)}))].filter(i=>i!==0&&i!==k)}
export function spectralMetrics(values,fs,k=SIGNAL_BIN){
 const spectrum=periodogram(values,fs,{window:'none',removeMean:true}),powers=Array.from(spectrum.psd,v=>v*spectrum.df),harmonics=harmonicBins(values.length,k),set=new Set(harmonics)
 const signal=powers[k],distortion=sum(harmonics.map(i=>powers[i])),noise=sum(powers.filter((_,i)=>i!==0&&i!==k&&!set.has(i))),residual=noise+distortion
 const sndr=10*Math.log10(signal/residual),snr=10*Math.log10(signal/noise),thd=10*Math.log10(distortion/signal)
 return{spectrum,powers,harmonics,signal,distortion,noise,residual,sndr,snr,thd,enob:(sndr-1.76)/6.02,total:sum(powers)}
}
export function converterRecord({bits=12,clock=20e6,tau=DEFAULT_TAU,sr=100e6,jitter=0,h3=0,seed=42,acquire=false,quantize=true,n=SPECTRUM_LENGTH,bin=SIGNAL_BIN}={}){
 const random=rng(seed),frequency=clock*bin/n,time=.5/clock,lsb=2**-bits,values=new Float64Array(n),targets=new Float64Array(n),held=new Float64Array(n)
 let state=0,tracking=0,clipped=0
 // One full unmeasured cycle removes initial acquisition transients. Even at
 // the largest lesson tau, n intervals exceed 1000 decay constants.
 for(let i=-n;i<n;i++){
  const phase=2*Math.PI*(bin*i/n+frequency*jitter*random.normal()),target=.5*(Math.sin(phase)+h3*Math.sin(3*phase))
  state=acquire?slewAdvance(state,target,time,tau,sr):target
  if(i>=0){targets[i]=target;held[i]=state;tracking+=(state-target)**2/n;if(state<-.5||state>.5)clipped++;const code=clip(Math.floor((state+.5)/lsb),0,2**bits-1);values[i]=quantize?-.5+(code+.5)*lsb:state}
 }
 return{bits,tau,sr,jitter,h3,acquire,values,targets,held,trackingRMS:Math.sqrt(tracking),clipped,frequency,time,lsb,n,bin,clock,...spectralMetrics(values,clock,bin)}
}
export function converterSpectrum(p={}){
 const selected=p.effect??4,settings=[{}, {jitter:p.jitter??2e-12}, {acquire:true}, {h3:p.h3??.001}, {acquire:true,jitter:p.jitter??2e-12,h3:p.h3??.001}]
 const rows=settings.map((extra,i)=>({label:['Quantization only','Jitter only','Acquisition only','Third harmonic only','All selected effects'][i],...converterRecord({...p,jitter:0,h3:0,acquire:false,...extra})}))
 return{rows,selected:rows[selected]}
}

export const stimulusCDF=(x,sine)=>sine?.5+Math.asin(clip(2*x-1,-1,1))/Math.PI:clip(x,0,1)
export const stimulusInverse=(p,sine)=>sine?.5+.5*Math.sin(Math.PI*(clip(p,0,1)-.5)):clip(p,0,1)
export function density({count=16384,sigma=.25,seed=42,sine=0,code=31,planningBits=12,precision=.03}={}){
 const bits=6,levels=2**bits,device=flash({bits,sigma,seed,encoder:0}),random=rng(seed+104729),counts=Array(levels).fill(0)
 for(let i=0;i<count;i++){const u=random.uniform(),v=stimulusInverse(u,sine);counts[device.encode(v)]++}
 const trueEdges=[0];for(const w of device.widths)trueEdges.push(trueEdges.at(-1)+w);trueEdges[levels]=1
 const probabilities=device.widths.map((_,i)=>stimulusCDF(trueEdges[i+1],sine)-stimulusCDF(trueEdges[i],sine))
 let cumulative=0;const measuredCDF=[0];for(const n of counts){cumulative+=n;measuredCDF.push(cumulative/count)}
 const edges=measuredCDF.map(p=>stimulusInverse(p,sine)),epsilon=Math.sqrt(Math.log(2/.05)/(2*count))
 const bounds=measuredCDF.map((p,i)=>i===0?[0,0]:i===levels?[1,1]:[stimulusInverse(p-epsilon,sine),stimulusInverse(p+epsilon,sine)])
 const rows=counts.map((hits,i)=>{
  const estimate=levels*(edges[i+1]-edges[i])-1,ci=sine?[levels*Math.max(0,bounds[i+1][0]-bounds[i][1])-1,levels*Math.min(1,bounds[i+1][1]-bounds[i][0])-1]:proportion(hits,count).ci.map(p=>levels*p-1)
  return{code:i,hits,probability:probabilities[i],truth:levels*device.widths[i]-1,estimate,ci}
 })
 const plannedLevels=2**planningBits,z=zFor(.95),perCode=(1-1/plannedLevels)/precision**2,perCode95=z*z*perCode,total95=Math.ceil(perCode95*plannedLevels)
 return{count,sigma,seed,sine,code:clip(Math.round(code),0,levels-1),bits,levels,device,counts,trueEdges,probabilities,measuredCDF,edges,epsilon,rows,perCode,perCode95,total95,selected:rows[clip(Math.round(code),0,levels-1)],zeroCounts:counts.filter(n=>n===0).length}
}
