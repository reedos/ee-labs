import {complex,loopCrossings,expm,matVecMul,rootsOf} from '@ee-labs/network'
const {cadd,cdiv,cmul,cabs}=complex
export const db=z=>20*Math.log10(Math.max(1e-30,cabs(z)))
export const logpoints=(fn,lo,hi,n=241)=>Array.from({length:n},(_,i)=>{const x=lo*(hi/lo)**(i/(n-1));return{x,y:fn(x)}})
const atpoly=(a,z)=>a.reduce((x,v)=>{const y=cmul(x,z);return[y[0]+v,y[1]]},[0,0])
export function pll({current=100e-6,kv=1e8,division=100,cap=1e-9,resistance=6324.555320336759,extra=0}={}){
 const kd=current/(2*Math.PI),K=kd*(2*Math.PI*kv)/division,wn=Math.sqrt(K/cap),zeta=resistance*Math.sqrt(K*cap)/2,c2=cap*extra
 // Z=(1+sRC1)/[s(C1+C2)+s²RC1C2]; T=K Z/s.
 const b=[K*resistance*cap,K],a=c2?[resistance*cap*c2,cap+c2,0,0]:[cap,0,0],at=f=>cdiv(atpoly(b,[0,2*Math.PI*f]),atpoly(a,[0,2*Math.PI*f])),margin=loopCrossings(at),closed=a.map((v,i)=>v+(b[i-(a.length-b.length)]??0)),poles=rootsOf(closed)
 return {current,kv,division,cap,resistance,extra,c2,kd,K,wn,zeta,b,a,at,...margin,poles,stable:poles.every(p=>p[0]<0),zero:1/(2*Math.PI*resistance*cap),pole:c2?(cap+c2)/(2*Math.PI*resistance*cap*c2):null,ref:f=>cdiv(at(f),cadd([1,0],at(f))),vco:f=>cdiv([1,0],cadd([1,0],at(f)))}
}
export function linearStep(p={},frequencyStep=1e3){const x=pll({...p,extra:0}),wn=x.wn,z=x.zeta,delta=2*Math.PI*frequencyStep
 // θ=wn*t, states phase error e and normalized capacitor contribution h.
 const A=[[-2*z,-1,delta/wn],[1,0,0],[0,0,0]],end=20,dt=end/800,M=expm(A.map(row=>row.map(v=>v*dt)));let state=[0,0,1];const points=[]
 for(let i=0;i<=800;i++){const t=i*dt/wn;points.push({x:t,error:state[0],frequency:frequencyStep-(delta-2*z*wn*state[0]-wn*state[1])/(2*Math.PI)});state=matVecMul(M,state)}
 return {...x,points,peak:Math.max(...points.map(v=>Math.abs(v.error))),overshoot:100*Math.max(0,...points.map(v=>v.frequency/frequencyStep-1))}
}
// Ideal edge-driven PFD, zero reset delay, constant-current charge pump.
// Between events vc is linear and divided VCO phase is quadratic; edge times are solved exactly.
export function acquisition(p={},frequencyStep=1e5,n=801){
 const x=pll({...p,extra:0}),fr=1e6,wr=2*Math.PI*(fr+frequencyStep),end=20/x.wn,dt=end/(n-1);let t=0,vc=0,phi=0,nextCycle=1,refCycle=1,up=false,down=false,sample=0,events=0;const points=[]
 while(sample<n&&events<100000){const current=x.current*((up?1:0)-(down?1:0)),b=2*Math.PI*(fr+x.kv*(vc+x.resistance*current)/x.division),a=2*Math.PI*x.kv*current/(x.division*x.cap),remaining=nextCycle*2*Math.PI-phi,disc=b*b+2*a*remaining
  let dv=Infinity;if(remaining<1e-10)dv=0;else if(Math.abs(a)<1e-10){if(b>0)dv=remaining/b}else if(disc>=0){const denom=b+Math.sqrt(disc);if(denom>0)dv=2*remaining/denom}
  const tv=t+dv,tr=refCycle/(fr+frequencyStep),ts=sample*dt,next=Math.min(tv,tr,ts),h=Math.max(0,next-t)
  phi+=b*h+.5*a*h*h;vc+=current*h/x.cap;t=next
  const isV=Math.abs(t-tv)<1e-15,isR=Math.abs(t-tr)<1e-15,isS=Math.abs(t-ts)<1e-15
  if(isR){up=true;refCycle++;events++}if(isV){down=true;nextCycle++;events++}if(up&&down){up=false;down=false}
  if(isS){const cp=x.current*((up?1:0)-(down?1:0));points.push({x:t,error:wr*t-phi,voltage:vc,frequency:x.kv*(vc+x.resistance*cp)/x.division,current:cp});sample++}
 }
 return {...x,points,complete:sample===n,events,peak:Math.max(...points.map(p=>Math.abs(p.error))),finalError:points.at(-1)?.error??0,wrapped:Math.atan2(Math.sin(points.at(-1)?.error??0),Math.cos(points.at(-1)?.error??0))}
}
export function detector({phase=1,current=100e-6}={}){
 // Equal-frequency aligned cycle pair on one acquisition branch: pulse width / period=|φ|/(2π).
 const fraction=Math.min(1,Math.abs(phase)/(2*Math.PI)),average=current*Math.sign(phase)*fraction
 const points=Array.from({length:401},(_,i)=>({x:i/400,y:(i/400<fraction?Math.sign(phase)*current:0)*1e6}))
 return {fraction,average,linear:current*phase/(2*Math.PI),points,inside:Math.abs(phase)<=2*Math.PI}
}
export function phaseNoise({level=-120,offset=1e6,low=1e4,high=1e7,carrier=1e8}={}){
 const c=10**(level/10)*offset**2,variance=2*c*(1/low-1/high),rms=Math.sqrt(variance),jitter=rms/(2*Math.PI*carrier)
 return {c,variance,rms,jitter,at:f=>c/f**2}
}
export function clockBudget({bandwidth=5e4,input=1e7,reference=-150}={}){
 const cap=1e-9,current=100e-6,division=100,kv=(2*Math.PI*bandwidth)**2*division*cap/current,resistance=2*.7071067811865476/(2*Math.PI*bandwidth*cap),loop=pll({kv,resistance}),vco=phaseNoise(),refPSD=10**(reference/10),low=1e4,high=1e7,n=2000,h=Math.log(high/low)/n
 let vr=0,vv=0;const density=f=>({ref:2*division**2*cabs(loop.ref(f))**2*refPSD,vco:2*cabs(loop.vco(f))**2*vco.at(f)})
 for(let i=0;i<=n;i++){const f=low*Math.exp(i*h),d=density(f),weight=(i===0||i===n)?1:i%2?4:2;vr+=weight*d.ref*f;vv+=weight*d.vco*f}vr*=h/3;vv*=h/3
 const variance=vr+vv,jitter=Math.sqrt(variance)/(2*Math.PI*1e8),snr=-20*Math.log10(2*Math.PI*input*jitter)
 return {loop,vr,vv,variance,jitter,snr,bits:(snr-1.76)/6.02,density}
}
export function loopDrawing(x){return {elements:[{type:'I',id:'Icp',nodes:['gnd','ctrl'],value:x.current},{type:'R',id:'R',nodes:['ctrl','vc'],value:x.resistance},{type:'C',id:'C1',nodes:['vc','gnd'],value:x.cap},...(x.c2?[{type:'C',id:'C2',nodes:['ctrl','gnd'],value:x.c2}]:[])],caption:'Charge pump injects current into ctrl. R and C1 form a series path to ground; optional C2 is in parallel with that entire path. The VCO senses ctrl with no loading.',layout:{w:450,h:260,items:[{wire:[70,50,360,50]},{node:'ctrl',x:270,y:50,labelPos:'t'},{wire:[70,50,70,110]},{el:'Icp',x:70,y:130,dir:'v',flip:true},{wire:[70,150,70,230]},{gnd:[70,230]},{wire:[220,50,220,80]},{el:'R',x:220,y:100,dir:'v'},{wire:[220,120,220,160]},{node:'vc',x:220,y:140,labelPos:'r'},{el:'C1',x:220,y:180,dir:'v'},{wire:[220,200,220,230]},{gnd:[220,230]},...(x.c2?[{wire:[360,50,360,110]},{el:'C2',x:360,y:130,dir:'v'},{wire:[360,150,360,230]},{gnd:[360,230]}]:[])]}}}
