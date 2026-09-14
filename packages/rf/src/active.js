// Linear RF device descriptions are exact at their stated frequency. Stability
// tests concern the supplied two-port, not large-signal oscillation amplitude.
// Cubic IP3 and Leeson are named models with explicit extrapolation limits.
import {complex as cx} from '@ee-labs/network'
import {fft} from '@ee-labs/dsp'
import {sparam,sFromNetlist} from './sparam.js'
const {C,cadd,csub,cmul,cdiv,cabs,carg,conj:cconj,polar}=cx
const one=C(1),abs2=z=>cabs(z)**2
export const DEVICE_SETS=[
  sparam({f:2e9,s:[[{mag:.894,deg:-60.6},{mag:.020,deg:62.4}],[{mag:3.122,deg:123.6},{mag:.781,deg:-27.6}]]}),
  sparam({f:8e9,s:[[{mag:.641,deg:171.3},{mag:.057,deg:16.3}],[{mag:2.058,deg:28.5},{mag:.572,deg:-95.7}]]}),
]
export function stability(sp){
  const [[a,b],[c,d]]=sp.s,delta=csub(cmul(a,d),cmul(b,c)),product=cabs(cmul(b,c))
  const K=(1-abs2(a)-abs2(d)+abs2(delta))/(2*product)
  const mu=(1-abs2(a))/(cabs(csub(d,cmul(delta,cconj(a))))+product)
  const circle=(x,y)=>{const den=abs2(x)-abs2(delta);return {center:cdiv(cconj(csub(x,cmul(delta,cconj(y)))),C(den)),radius:product/Math.abs(den),singular:Math.abs(den)<1e-14}}
  const stable=K>1&&cabs(delta)<1
  const gain=cabs(cdiv(c,b))*(stable?K-Math.sqrt(K*K-1):1)
  return {delta,K,mu,stable,loadCircle:circle(d,a),sourceCircle:circle(a,d),gain,gainDb:10*Math.log10(gain),gainKind:stable?'MAG':'MSG'}
}
export function transducerGain(sp,source=C(0),load=C(0)){
  const [[a,b],[c,d]]=sp.s
  if(cabs(source)>=1||cabs(load)>=1)throw Error('Transducer gain requires passive source and load reflection magnitudes below one.')
  const denominator=csub(cmul(csub(one,cmul(a,source)),csub(one,cmul(d,load))),cmul(cmul(b,c),cmul(source,load)))
  return (1-abs2(source))*abs2(c)*(1-abs2(load))/abs2(denominator)
}
export function conjugateMatch(sp){
  const z=stability(sp);if(!z.stable)throw Error('Simultaneous passive conjugate matching is not offered for a potentially unstable device. MSG is a stability-boundary gain, not a guaranteed realizable stable MAG.')
  const [[a,b],[c,d]]=sp.s,delta=z.delta
  const match=(x,y)=>{const B=1+abs2(x)-abs2(y)-abs2(delta),cc=csub(x,cmul(delta,cconj(y))),root=Math.sqrt(Math.max(0,B*B-4*abs2(cc))),g=cdiv(C(B-root),cmul(C(2),cc));return cabs(g)<1?g:cdiv(C(B+root),cmul(C(2),cc))}
  const source=match(a,d),load=match(d,a)
  return {source,load,gain:transducerGain(sp,source,load)}
}
export function unilateral(sp){
  const [[a,b],[c,d]]=sp.s,U=cabs(cmul(cmul(a,b),cmul(c,d)))/((1-abs2(a))*(1-abs2(d)))
  const source=cconj(a),load=cconj(d),exact=transducerGain(sp,source,load),approx=transducerGain({...sp,s:[[a,C(0)],[c,d]]},source,load)
  return {U,lower:-20*Math.log10(1+U),upper:U<1?-20*Math.log10(1-U):null,error:10*Math.log10(exact/approx),exact,approx,source,load,usable:U<1&&-20*Math.log10(1-U)<=1}
}
export function hybridPi({ic=1e-3,beta=100,cpi=1e-12,cmu=.1e-12,ro=100000,f=1e9}={}){
  const gm=ic/.02585,rpi=beta/gm
  const net={elements:[{id:'rpi',type:'R',nodes:['base','gnd'],value:rpi},{id:'ro',type:'R',nodes:['collector','gnd'],value:ro},
    {id:'Cpi',type:'C',nodes:['base','gnd'],value:cpi},{id:'Cmu',type:'C',nodes:['base','collector'],value:cmu},
    {id:'gm',type:'VCCS',nodes:['collector','gnd'],ctrl:['base','gnd'],gain:gm}]}
  const sp=sFromNetlist(net,['base','collector'],f,{z0:50}),omega=2*Math.PI*f
  // Short-circuit current gain differs from matched-port S21.
  const h21=cdiv(C(gm,-omega*cmu),C(1/rpi,omega*(cpi+cmu)))
  const ft=Math.sqrt(Math.max(0,gm*gm-1/(rpi*rpi)))/Math.sqrt((2*Math.PI)**2*((cpi+cmu)**2-cmu**2))
  return {net,sp,gm,rpi,h21,ft,ftApprox:gm/(2*Math.PI*(cpi+cmu))}
}
export function noiseFactor(source,{fminDb=.8,optimum=C(56.7,13.6),rn=15,z0=50}={}){
  const gamma=z=>cdiv(csub(z,C(z0)),cadd(z,C(z0))),g=gamma(source),go=gamma(optimum)
  if(cabs(g)>=1)throw Error('Noise-factor source impedance must have a positive real part.')
  return 10**(fminDb/10)+4*rn/z0*abs2(csub(g,go))/((1-abs2(g))*abs2(cadd(one,go)))
}
export function noiseCircle(nfDb,{fminDb=.8,optimum=C(56.7,13.6),rn=15,z0=50}={}){
  const go=cdiv(csub(optimum,C(z0)),cadd(optimum,C(z0))),factor=(10**(nfDb/10)-10**(fminDb/10))*abs2(cadd(one,go))/(4*rn/z0)
  if(factor<0)throw Error('A noise circle cannot lie below the minimum noise figure.')
  return {center:cdiv(go,C(1+factor)),radius:Math.sqrt(factor*factor+factor*(1-abs2(go)))/(1+factor)}
}
export function sourceGainCircle(sp,relativeGain=.5){
  const a=sp.s[0][0],den=1-(1-relativeGain)*abs2(a)
  if(!(relativeGain>0&&relativeGain<=1))throw Error('Normalized source gain must be in (0, 1].')
  return {center:cdiv(cmul(C(relativeGain),cconj(a)),C(den)),radius:Math.sqrt(1-relativeGain)*(1-abs2(a))/den}
}
export function cubicTone({amplitude=.05,a1=1,a3=-.1,N=4096}={}){
  const re=new Float64Array(N),im=new Float64Array(N),f1=25,f2=40
  for(let i=0;i<N;i++){const x=amplitude*(Math.cos(2*Math.PI*f1*i/N)+Math.cos(2*Math.PI*f2*i/N));re[i]=a1*x+a3*x**3}
  fft(re,im);const magnitude=k=>2*Math.hypot(re[k],im[k])/N,main=magnitude(f1),product=magnitude(2*f1-f2),gap=20*Math.log10(main/product)
  const pin=10*Math.log10(amplitude**2/(2*50)/.001),pout=10*Math.log10(main**2/(2*50)/.001),iip3=10*Math.log10(Math.abs(4*a1/(3*a3))/(2*50)/.001)
  const a1db=Math.sqrt((1-10**(-1/20))*Math.abs(4*a1/(3*a3))),p1db=10*Math.log10(a1db*a1db/(2*50)/.001),headroom=p1db-pin
  return {main,product,gap,pin,pout,iip3,estimate:pin+gap/2,headroom,guard:headroom<3?'declined':headroom<10?'warning':'accepted',p1db,bins:[f1,f2,2*f1-f2,2*f2-f1].map(bin=>({bin,amplitude:magnitude(bin)}))}
}
export function leeson(offset,{f0=1e9,Q=20,powerDbm=0,Fdb=3,corner=1e5,T=290}={}){
  if(!(offset>0&&Q>0))throw Error('Offset frequency and loaded Q must be positive.')
  const watts=.001*10**(powerDbm/10),F=10**(Fdb/10)
  return 10*Math.log10(2*F*1.380649e-23*T/watts*(1+(f0/(2*Q*offset))**2)*(1+corner/offset))
}
