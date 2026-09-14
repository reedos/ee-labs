import {DEFAULTS,pinDrive} from './pin.js'

export function uart(byte,baud,receiverBaud=baud,capacitance=50e-12) {
  const bits=[0,...Array.from({length:8},(_,i)=>(byte>>i)&1),1]
  const T=1/baud, run=pinDrive({...DEFAULTS,cload:capacitance},bits.map((value,i)=>({t:i*T,value})),{tEnd:12*T,initial:3.3})
  const start=run.crossings.find(c=>c.level==='vm'&&c.dir===-1)?.t
  const sample=(t)=>t>run.tEnd?1:run.wave(t)>=1.65?1:0
  const read=Array.from({length:8},(_,i)=>({t:start+(i+1.5)/receiverBaud,value:sample(start+(i+1.5)/receiverBaud)}))
  return {bits,run,T,start,read,decoded:read.reduce((n,b,i)=>n+(b.value<<i),0),stop:sample(start+9.5/receiverBaud),stopTime:start+9.5/receiverBaud}
}
export function spi(byte,mode,frequency) {
  const idle=mode>>1,phase=mode&1,T=1/frequency
  const events=Array.from({length:16},(_,i)=>({t:(i+1)*T/2,clock:i%2?idle:1-idle,action:i%2===phase?'sample':'shift'}))
  let index=0,decoded=0
  const samples=events.filter(e=>e.action==='sample').map(e=>{const bit=(byte>>(7-index++))&1;decoded=(decoded<<1)|bit;return {...e,bit}})
  return {events,samples,decoded,T,idle,phase}
}
export function arbitration(a,b,bits=11) {
  let activeA=true,activeB=true
  return Array.from({length:bits},(_,i)=>{
    const A=(a>>(bits-1-i))&1,B=(b>>(bits-1-i))&1,bus=(activeA?A:1)&(activeB?B:1)
    const lostA=activeA&&A>bus,lostB=activeB&&B>bus
    activeA=activeA&&!lostA;activeB=activeB&&!lostB
    return {bit:i+1,A,B,bus,lostA,lostB,activeA,activeB}
  })
}
export function stuff(bits) {
  const out=[];let ones=0
  for(const b of bits){out.push(b);ones=b?ones+1:0;if(ones===6){out.push(0);ones=0}}
  return out
}
export function pwm(R,C,V,f,D) {
  const T=1/f,tau=R*C,a=Math.exp(-D*T/tau),b=Math.exp(-(1-D)*T/tau)
  const high=V*(-Math.expm1(-D*T/tau))/(-Math.expm1(-T/tau)),low=high*b
  const wave=t=>{const q=((t%T)+T)%T;return q<=D*T?V+(low-V)*Math.exp(-q/tau):high*Math.exp(-(q-D*T)/tau)}
  return {T,tau,high,low,ripple:high-low,wave}
}
// Eleven rising closures in five milliseconds, followed by a stable press.
export const bounceEdges=()=>Array.from({length:22},(_,i)=>({t:i*.00025,value:i%2?1:0}))
export function bounce(tau) {
  const edges=[...bounceEdges(),{t:.0055,value:0}]
  let voltage=1,logic=1
  const segments=[],changes=[]
  for(let i=0;i<edges.length;i++){
    const e=edges[i],end=edges[i+1]?.t??.025,threshold=logic?.4:.6,ratio=(threshold-e.value)/(voltage-e.value)
    if(ratio>0&&ratio<1){const t=e.t-tau*Math.log(ratio);if(t<=end){logic=1-logic;changes.push({t,value:logic})}}
    segments.push({...e,end,initial:voltage});voltage=e.value+(voltage-e.value)*Math.exp(-(end-e.t)/tau)
  }
  const wave=t=>{const s=segments.findLast(s=>t>=s.t);return s.value+(s.initial-s.value)*Math.exp(-(t-s.t)/tau)}
  return {segments,changes,wave}
}

// Classical CAN oscillator bounds: Bosch, The Configuration of CAN Bit Timing §4.
export function canTolerance({prop=7,phase1=4,phase2=4,sjw=1}={}){
 if(sjw>Math.min(phase1,phase2))throw Error('Synchronization jump width must not exceed either phase segment.')
 const total=1+prop+phase1+phase2,phase=Math.min(phase1,phase2)/(2*(13*total-phase2)),resync=sjw/(20*total)
 return{total,phase,resync,bound:Math.min(phase,resync),samplePoint:(total-phase2)/total}
}
