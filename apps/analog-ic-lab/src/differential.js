import {complex,mosfetOf,mosfetCurrent,loopCrossings,expm,matVecMul} from '@ee-labs/network'
import {chargeStep} from '@ee-labs/switched'
import {tfAt} from './architectures.js'
const {cdiv}=complex
const R=(id,a,b,value)=>({type:'R',id,nodes:[a,b],value}),C=(id,a,b,value)=>({type:'C',id,nodes:[a,b],value})
const G=(id,a,b,plus,minus,gain)=>({type:'VCCS',id,nodes:[a,b],ctrl:[plus,minus],gain})
const E=(id,a,b,plus,minus,gain)=>({type:'VCVS',id,nodes:[a,b],ctrl:[plus,minus],gain})
const V=(id,node,value)=>({type:'V',id,nodes:[node,'gnd'],value})

// Recalibrated, symmetric teaching devices at each selected supply. Each device
// has ro=1 MΩ at the midpoint; the two output conductances add to 1/(500 kΩ).
export function outputBias({epsilon=.01,vdd=1.8,feedback=0}={}){
 const bias=vdd/2,i0=20e-6,rout=500e3,vov=.2,vt=.45,gc=feedback?100e-6:0,gd=300e-6
 const lambda=1/(2*i0*rout-bias),kn=2*i0/((1+lambda*bias)*vov*vov),d=mosfetOf({id:'M',kn,vt,lambda})
 const delta=epsilon*i0,at=v=>{const n=mosfetCurrent(d,{vgs:vt+vov,vds:v}),p=mosfetCurrent(d,{vgs:vt+vov,vds:vdd-v});return{n,p,residual:p.id-n.id+delta-gc*(v-bias)}}
 let lo=0,hi=vdd;for(let i=0;i<70;i++){const m=(lo+hi)/2;if(at(m).residual>0)lo=m;else hi=m}
 const vo=(lo+hi)/2,linear=bias+delta/(1/rout+gc),elements=[]
 for(const side of ['p','n'])elements.push(R('R'+side,side,'gnd',rout),{type:'I',id:'I'+side,nodes:['gnd',side],value:delta},G('D'+side,side,'gnd',side,side==='p'?'n':'p',gd/2),G('C'+side+'p',side,'gnd','p','gnd',gc/2),G('C'+side+'n',side,'gnd','n','gnd',gc/2))
 return{bias,i0,rout,vov,vt,gc,gd,lambda,kn,delta,vo,linear,shift:vo-bias,...at(vo),net:{elements},inSaturation:vo>=vov&&vo<=vdd-vov}
}

// The half-circuit with 2 Rt is exact for a symmetric common-mode excitation.
export function halfCircuits({gm=200e-6,ro=500e3,rd=20e3,rt=1e6,cl=2e-12}={}){
 const go=1/ro,gD=1/rd,gt=1/(2*rt),ad=-gm/(gD+go),ac=-gm*gt/(gD*(gm+go+gt)+go*gt)
 const dm=f=>cdiv([-gm,0],[gD+go,2*Math.PI*f*cl]),cm=f=>cdiv([-gm*gt,0],[gD*(gm+go+gt)+go*gt,2*Math.PI*f*cl*(gm+go+gt)])
 const branch=(suffix,input,out,source)=>[R('RD'+suffix,out,'gnd',rd),R('ro'+suffix,out,source,ro),G('gm'+suffix,out,source,input,source,gm),C('CL'+suffix,out,'gnd',cl)]
 const full={elements:[V('Vp','ip',0),V('Vn','in',0),...branch('p','ip','op','tail'),...branch('n','in','on','tail'),R('Rt','tail','gnd',rt)]}
 const half=common=>({elements:[V('V1','in',0),...branch('1','in','out',common?'tail':'gnd'),...(common?[R('Rt','tail','gnd',2*rt)]:[])]})
 const approx=-rd/(2*rt),error=Math.abs(approx/ac-1)
 return{gm,ro,rd,rt,cl,go,gD,gt,ad,ac,approx,error,cmrr:20*Math.log10(Math.abs(ad/(2*ac))),dm,cm,full,dmHalf:half(false),cmHalf:half(true)}
}

export function feedbackModes({gc=100e-6,gd=300e-6,cl=2e-12,fcm=10e6,fdm=30e6}={}){
 const rout=500e3,g=1/rout
 const mode=(gm,fp,u)=>{
  const tau=1/(2*Math.PI*fp),k=gm*rout,tf={b:[k],a:[rout*cl*tau,rout*cl+tau,1]},at=f=>tfAt(tf,f)
  const a=[[-g/cl,gm/cl],[-1/tau,-1/tau]],steady=[k*u/(1+k),u/(1+k)]
  const state=t=>{const z=matVecMul(expm(a.map(row=>row.map(v=>v*t))),steady);return steady.map((v,i)=>v-z[i])}
  const decay=(g/cl+1/tau)/2,disc=decay*decay-(g+gm)/(cl*tau),slow=disc>=0?decay-Math.sqrt(disc):decay
  return{gm,fp,tau,k,tf,at,...loopCrossings(at),a,steady,u,state,tEnd:10/slow,estimate:gm/(2*Math.PI*cl)}
 }
 const cm=mode(gc,fcm,.01),dm=mode(gd,fdm,.02),elements=[]
 for(const side of ['op','on'])elements.push(R('R'+side,side,'gnd',rout),C('C'+side,side,'gnd',cl),G('Gcm'+side,'gnd',side,'ac','gnd',gc),G('Gdm'+side,'gnd',side,'ad','gnd',side==='op'?gd/2:-gd/2))
 elements.push(E('MeanP','meanP','gnd','op','gnd',.5),E('MeanN','mean','meanP','on','gnd',.5),E('Difference','diff','gnd','op','on',1))
 for(const [name,x,sense,node] of [['cm',cm,'mean','ac'],['dm',dm,'diff','ad']])elements.push({...V('V'+name,'u'+name,0),wave:{kind:'step',from:0,to:x.u}},E('E'+name,'e'+name,'gnd','u'+name,sense,1),R('Rp'+name,'e'+name,node,1000),C('Cp'+name,node,'gnd',x.tau/1000))
 const tEnd=Math.max(cm.tEnd,dm.tEnd),state=t=>{const c=cm.state(t)[0],d=dm.state(t)[0];return{c,d,p:c+d/2,n:c-d/2}}
 return{rout,g,cl,cm,dm,tEnd,state,net:{elements}}
}

// A declared reset-to-ground sampler, not every possible SC common-mode sensor.
// Track and hold each last half a clock period. Only CL remains on the output
// during hold; Cs is isolated and averaged, then reset before the next track.
export function sensors({rs=100e3,cs=100e-15,fs=100e3,ud=.1}={}){
 const rd=20e3,ro=500e3,gm=200e-6,rout=1/(1/rd+1/ro),cl=2e-12,bias=.9,ad=-gm*rout
 const half=1/(2*fs),tauOn=rout*(cl+cs),tauOff=rout*cl,a=cl/(cl+cs),r=Math.exp(-half/tauOn),r0=Math.exp(-half/tauOff)
 const before=(1-r*r0)/(1-a*r*r0),kick=a*before,sample=1+(kick-1)*r,mean=1-rout*cs*fs*sample,approx=1/(1+rout*cs*fs)
 const up=bias+ud/2,un=bias-ud/2
 const chargeKick=u=>chargeStep({capacitors:[{id:'CL',a:'out',b:'gnd',c:cl},{id:'Cs',a:'out',b:'gnd',c:cs}],previous:{CL:u*before,Cs:0},driven:{gnd:0}}).voltages.out
 const held=chargeStep({capacitors:[{id:'Cp',a:'hold',b:'gnd',c:cs},{id:'Cn',a:'hold',b:'gnd',c:cs}],previous:{Cp:up*sample,Cn:un*sample},driven:{gnd:0}}).voltages.hold
 const wave=(u,t)=>t<=half?u*(1+(kick-1)*Math.exp(-t/tauOn)):u*(1+(sample-1)*Math.exp(-(t-half)/tauOff))
 const resistive={gain:ad/(1+rout/rs),difference:ud/(1+rout/rs),sensorTau:rs*cs/2}
 resistive.power=resistive.difference**2/(2*rs)
 const follower={gm:100e-6,go:2e-6,cgate:50e-15,low:.75,high:1.6,gain:ad,power:2*1.8*10e-6}
 follower.sensorGain=follower.gm/(follower.gm+follower.go);follower.pole=(follower.gm+follower.go)/(2*Math.PI*cs)
 const sc={half,tauOn,tauOff,a,r,r0,before,kick,sample,mean,approx,held,chargeKick,wave,gain:ad*mean,power:fs*cs*sample*(up*up+un*un),current:cs*fs*bias*sample,settled:half/tauOn>=7,error:Math.abs(approx/mean-1)}
 return{rs,cs,fs,ud,rout,cl,bias,ad,up,un,resistive,follower,sc}
}

export function pairDrawing(x){
 const elements=[R('RDp','op','gnd',x.rd),R('RDn','on','gnd',x.rd),R('Rt','tail','gnd',x.rt),{type:'M',id:'Mp',polarity:'n',nodes:['op','ip','tail']},{type:'M',id:'Mn',polarity:'n',nodes:['on','in','tail']}]
 return{elements,layout:{w:660,h:300,items:[{el:'RDp',x:230,y:65,dir:'v'},{el:'RDn',x:480,y:65,dir:'v'},{el:'Mp',x:218,y:170},{el:'Mn',x:468,y:170},{el:'Rt',x:355,y:255,dir:'v'},{wire:[230,85,230,150]},{wire:[480,85,480,150]},{wire:[230,190,230,215]},{wire:[230,215,480,215]},{wire:[480,190,480,215]},{wire:[355,215,355,235]},{gnd:[230,45]},{gnd:[480,45]},{gnd:[355,275]},{node:'op',x:230,y:115,side:'l'},{node:'on',x:480,y:115,side:'r'},{wire:[150,170,198,170]},{wire:[390,170,448,170]},{node:'ip',x:150,y:170,side:'l'},{node:'in',x:390,y:170,side:'l'}]},caption:'Symmetric NMOS pair; the supply is AC ground. Each transistor is replaced in the equations by gm(vgate−vsource) and ro between drain and source. Each drain also has CL=2 pF to AC ground (omitted here for clarity). Rt is the incremental tail resistance, not a DC bias-setting resistor.'}
}

export function modeDrawing(x){
 const elements=[{...E('Error','error','gnd','command','c',1),label:'u − c'},R('Rp','error','ac',1000),C('Cp','ac','gnd',x.cm.tau/1000),{...G('Gc','c','gnd','ac','gnd',-x.cm.gm),label:'−gc ac'},R('Rout','c','gnd',x.rout),C('CL','c','gnd',x.cl)]
 return{elements,layout:{w:730,h:220,items:[{el:'Error',x:80,y:125,dir:'v'},{gnd:[80,145]},{wire:[80,105,80,60]},{wire:[80,60,140,60]},{el:'Rp',x:160,y:60},{wire:[180,60,270,60]},{wire:[270,60,270,105]},{el:'Cp',x:270,y:125,dir:'v'},{gnd:[270,145]},{node:'ac',x:270,y:60,side:'t'},{el:'Gc',x:415,y:125,dir:'v'},{el:'Rout',x:525,y:125,dir:'v'},{el:'CL',x:650,y:125,dir:'v'},{gnd:[415,145]},{gnd:[525,145]},{gnd:[650,145]},{wire:[415,105,415,60]},{wire:[415,60,650,60]},{wire:[525,60,525,105]},{wire:[650,60,650,105]},{node:'c',x:590,y:60,side:'t'}]},caption:'Exact common-mode equivalent under symmetry. The ideal error source senses command u minus output c; Rp Cp gives the selected controller time constant. Gc injects gc ac into c (its downward reference is −gc ac). This controlled dependence is not a wire. Replace c, ac and gc by d, ad and gd for the differential equivalent. The two physical outputs are reconstructed below.'}
}
