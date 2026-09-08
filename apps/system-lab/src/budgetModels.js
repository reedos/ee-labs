import {cascade,reorder,noiseFloorDbm,fromDbm} from '@ee-labs/rf'
import {fft} from '@ee-labs/dsp'
import {rng,sampleMean} from '@ee-labs/random'
import {referenceChain} from './groups/a.js'

export const CUBIC_BACKOFF=-10*Math.log10(1-10**(-1/20))
export function systemChain(p={}) {
  let blocks=referenceChain({lnaGainDb:p.gain??15})
  blocks=blocks.map(b=>b.id==='lna'?{...b,nfDb:p.nf??b.nfDb,iip3Dbm:p.ip3??b.iip3Dbm,powerMw:p.power??b.powerMw}:b)
  blocks=blocks.map(b=>['lna','mixer','ifamp'].includes(b.id)?{...b,gainDb:p[`${b.id}Gain`]??b.gainDb,nfDb:p[`${b.id}Nf`]??b.nfDb,iip3Dbm:p[`${b.id}Ip3`]??b.iip3Dbm,powerMw:p[`${b.id}Power`]??b.powerMw}:b)
  return p.first?reorder(blocks,'presel','lna'):blocks
}
export function systemBudget(p={}) {
  const c=cascade(systemChain(p)),bandwidth=p.bandwidth??2e5,floor=noiseFloorDbm(bandwidth,c.nfDb),p1=c.iip3Dbm-CUBIC_BACKOFF
  return {...c,bandwidth,floor,p1,sensitivity:floor+(p.snr??10),sfdr:2*(c.iip3Dbm-floor)/3,linearRange:p1-floor}
}
// A coherent two-tone voltage record propagated through all six memoryless
// stages. The mixer is an equivalent in-band conversion-gain block here.
// Cubic coefficients are set by each stage's own input IP3 at a 50 Ω reference.
export function chainSpectrum({pin=-55,gain=15,N=4096}={}) {
  const blocks=systemChain({gain}),budget=cascade(blocks),A=Math.sqrt(2*50*.001*fromDbm(pin)),re=new Float64Array(N),im=new Float64Array(N)
  for(let i=0;i<N;i++){
    let v=A*(Math.cos(2*Math.PI*25*i/N)+Math.cos(2*Math.PI*40*i/N))
    for(const b of blocks){const g=10**(b.gainDb/20),c=b.iip3Dbm===undefined?0:-4*g/(3*2*50*.001*fromDbm(b.iip3Dbm));v=g*v+c*v**3}
    re[i]=v
  }
  fft(re,im)
  const power=bin=>10*Math.log10((2*Math.hypot(re[bin],im[bin])/N)**2/(2*50)/.001)
  const fundamental=power(25),im3=power(10),gap=fundamental-im3,headroom=budget.iip3Dbm-CUBIC_BACKOFF-pin
  return {fundamental,im3,gap,estimatedInputIp3:pin+gap/2,estimatedOutputIp3:fundamental+gap/2,headroom,guard:headroom<3?'declined':headroom<10?'warning':'accepted',bins:[10,25,40,55,75,90,105,120].map(bin=>({bin,power:power(bin)})),budget}
}
export function phaseEnsemble({gain=15,seed=42,runs=2000}={}) {
  const c=cascade(systemChain({gain})),terms=c.blocks.filter(b=>b.ip3Term>0).map(b=>b.ip3Term),gen=rng(seed),powers=[],intercepts=[]
  for(let i=0;i<runs;i++) {let re=0,im=0;for(const a of terms){const phase=2*Math.PI*gen.uniform();re+=a*Math.cos(phase);im+=a*Math.sin(phase)}const p=re*re+im*im;powers.push(p);intercepts.push(-5*Math.log10(p))}
  intercepts.sort((a,b)=>a-b)
  const estimate=sampleMean(powers),expected=terms.reduce((s,a)=>s+a*a,0)
  return {aligned:c.iip3Dbm,power:c.iip3PowerDbm,median:intercepts[Math.floor(runs/2)],p05:intercepts[Math.floor(.05*runs)],p95:intercepts[Math.floor(.95*runs)],estimate,expected,intercepts}
}
export function linkBudget(p={}) {
  const frequency=p.frequency??2.4e9,distance=p.distance??100,tx=p.tx??20,gt=p.gt??2,gr=p.gr??2,loss=p.loss??0,nf=p.nf??6,bandwidth=p.bandwidth??20e6,snr=p.snr??20
  const lambda=299792458/frequency,fspl=20*Math.log10(4*Math.PI*distance/lambda),received=tx+gt+gr-fspl-loss,floor=noiseFloorDbm(bandwidth,nf),ratio=received-floor,cn0=received-noiseFloorDbm(1,nf),rate=p.rate??1e6
  return {lambda,fspl,received,floor,snr:ratio,margin:ratio-snr,cn0,ebn0:cn0-10*Math.log10(rate),capacity:bandwidth*Math.log2(1+10**(ratio/10)),items:[['Transmit power',tx],['Transmit antenna gain',gt],['Receive antenna gain',gr],['Free-space loss',-fspl],['Extra losses',-loss]]}
}
