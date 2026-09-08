import {complex,solveAC,marginsOf,mosfetOf,mosfetCurrent} from '@ee-labs/network'
const {cadd,csub,cmul,cdiv,cabs}=complex
const R=(id,a,b,value)=>({type:'R',id,nodes:[a,b],value}),C=(id,a,b,value)=>({type:'C',id,nodes:[a,b],value})
const G=(id,a,b,plus,minus,gain)=>({type:'VCCS',id,nodes:[a,b],ctrl:[plus,minus],gain})
const V={type:'V',id:'V1',nodes:['in','gnd'],value:1}
export const logPoints=(fn,lo=1e3,hi=1e9)=>Array.from({length:161},(_,i)=>{const x=lo*(hi/lo)**(i/160);return{x,y:fn(x)}})
export function tfAt({b,a},f){const s=[0,2*Math.PI*f],poly=cs=>cs.reduce((z,c)=>cadd(cmul(z,s),[c,0]),[0,0]);return cdiv(poly(b),poly(a))}
export const nativeAt=(net,f)=>solveAC(net,2*Math.PI*f,{sources:{V1:[1,0]},anyFreq:true}).v.out
export function loopCrossings(at){
 const grid=Array.from({length:601},(_,i)=>10**(-3+15*i/600)),crossings=[]
 let previousPhase=0,unwrapped=0
 const points=grid.map(f=>{const z=at(f),phase=Math.atan2(z[1],z[0])*180/Math.PI;let delta=phase-previousPhase;while(delta>180)delta-=360;while(delta< -180)delta+=360;unwrapped+=delta;previousPhase=phase;return{f,mag:cabs(z),phase:unwrapped}})
 for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];if((a.mag-1)*(b.mag-1)>0)continue;let lo=a.f,hi=b.f
  for(let j=0;j<60;j++){const mid=Math.sqrt(lo*hi);if((a.mag-1)*(cabs(at(mid))-1)<=0)hi=mid;else lo=mid}
  const crossover=Math.sqrt(lo*hi),z=at(crossover);let phase=Math.atan2(z[1],z[0])*180/Math.PI;while(phase-a.phase>180)phase-=360;while(phase-a.phase< -180)phase+=360
  crossings.push({crossover,pm:180+phase,direction:b.mag<a.mag?'Falling':'Rising'})
 }
 const critical=crossings.reduce((a,b)=>!a||b.pm<a.pm?b:a,null)
 return{crossings,crossover:critical?.crossover??null,pm:critical?.pm??null}
}
export function cascode({tail=40e-6,gmid=15,cl=2e-12,vdd=1.8,vcm=.7,folded=0,boost=0,auxGBW=200e6,feedback=false}={}){
 const branch=tail/2,gm=branch*gmid,ro=10/branch,g=1/ro,cs=20e-15,vov=2/gmid,tau=boost/(2*Math.PI*auxGBW)
 const elements=[V,G('Ginput','gnd','out','in',feedback?'out':'gnd',gm),C('CL','out','gnd',cl)]
 for(const side of ['n','p']){
  const node=side+'stack',gate=boost?side+'gate':'gnd'
  elements.push(R(side+'r1',node,'gnd',ro),R(side+'r2','out',node,ro),G(side+'gm','out',node,gate,node,gm),C(side+'Cs',node,'gnd',cs))
  if(boost)elements.push({type:'VCVS',id:'B'+side,nodes:[side+'drive','gnd'],ctrl:['gnd',node],gain:boost},R(side+'Rb',side+'drive',side+'pole',1000),C(side+'Cb',side+'pole','gnd',tau/1000),{type:'VCVS',id:side+'buffer',nodes:[gate,'gnd'],ctrl:[side+'pole','gnd'],gain:1})
 }
 const B=f=>cdiv([boost,0],[1,2*Math.PI*f*tau]),Y=(f,b=boost?B(f):[0,0])=>cdiv(cmul([g,0],[g,2*Math.PI*f*cs]),cadd([2*g+gm,2*Math.PI*f*cs],cmul([gm,0],b)))
 const at=f=>cdiv([gm,0],cadd([0,2*Math.PI*f*cl],cmul([2,0],Y(f))))
 // Break one booster, retain the other. Solve the two passive stack equations
 // for Vstack/Vgate, then multiply by its negative-feedback amplifier B(s).
 const auxAt=f=>{const sc=[0,2*Math.PI*f*cs],d=cadd([2*g+gm,0],sc),yo=cadd([g,2*Math.PI*f*cl],Y(f)),den=csub(cmul(d,yo),[g*(g+gm),0]);return cmul(B(f),cdiv(cmul([gm,0],csub(yo,[g,0])),den))}
 const rout=(2*ro+gm*(1+boost)*ro*ro)/2,dc=gm*rout,m=loopCrossings(at),aux=boost?loopCrossings(auxAt):null
 const cmMin=folded?0:.45+vov+.1,cmMax=folded?vdd-.45-vov-.1:.3+.45,outMin=folded?2*vov:.3+vov,outMax=vdd-2*vov
 return{net:{elements},at,auxAt,gm,ro,g,cs,cl,vov,boost,tau,rout,dc,...m,aux,cmMin,cmMax,outMin,outMax,swing:Math.max(0,outMax-outMin),headroom:Math.min(vcm-cmMin,cmMax-vcm),power:vdd*(tail*(folded?2:1)+(boost?20e-6:0)),estimate:gm/(2*Math.PI*cl)}
}
export function miller({gm1=200e-6,gm2=500e-6,cc=1e-12,cl=2e-12,vdd=1.8,feedback=false}={}){
 const c1=.1e-12,r1=100/gm1,r2=50/gm2,g1=1/r1,g2=1/r2
 const net={elements:[V,G('G1','a','gnd','in',feedback?'out':'gnd',gm1),G('G2','out','gnd','a','gnd',gm2),R('R1','a','gnd',r1),R('R2','out','gnd',r2),C('C1','a','gnd',c1),C('CL','out','gnd',cl),C('Cc','a','out',cc)]}
 const tf={b:[-gm1*cc,gm1*gm2],a:[c1*cl+c1*cc+cl*cc,g1*(cl+cc)+g2*(c1+cc)+gm2*cc,g1*g2]},at=f=>tfAt(tf,f),dc=gm1*gm2/(g1*g2)
 return{net,tf,at,dc,...marginsOf(at),gm1,gm2,cc,cl,c1,g1,g2,r1,r2,estimate:gm1/(2*Math.PI*cc),zero:gm2/(2*Math.PI*cc),power:vdd*(gm1/10+gm2/10),swing:vdd-.4,slew:gm1/(10*cc)}
}
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),device=kn=>mosfetOf({type:'M',id:'M',kn,vt:.45,lambda:0})
export function outputStage({iq=20e-6,vdd=1.8,drive=.3,fraction=.5,follower=0}={}){
 const vov=.15,vt=.45,beta=2*iq/vov**2,d=device(beta),out=fraction*vdd
 const upperGate=clamp(follower?out+vt+vov+drive:vdd-vt-vov-drive,0,vdd),lowerGate=clamp(follower?out-vt-vov+drive:vt+vov-drive,0,vdd)
 const upper=mosfetCurrent(d,{vgs:follower?upperGate-out:vdd-upperGate,vds:vdd-out}),lower=mosfetCurrent(d,{vgs:follower?out-lowerGate:lowerGate,vds:out})
 return{upper,lower,upperGate,lowerGate,out,current:upper.id-lower.id,beta,iq,power:vdd*iq,swing:Math.max(0,vdd-2*(vov+(follower?vt:0)))}
}
export function railInput({vcm=.9,vdd=1.8,tail=40e-6,steer=0,cl=2e-12}={}){
 const beta=tail/.15**2,tailBeta=2*tail/.1**2,dt=device(tailBeta),target=Math.sqrt(beta*tail)
 const pair=(common,command)=>{
  if(!command||common<=.45)return{current:0,gm:0,region:'cutoff',headroom:common-.45}
  const vgs=.45+Math.sqrt(2*command/tailBeta)
  let lo=0,hi=command
  for(let i=0;i<55;i++){const mid=(lo+hi)/2,headroom=common-.45-Math.sqrt(mid/beta),actual=mosfetCurrent(dt,{vgs,vds:Math.max(0,headroom)}).id;if(actual>mid)lo=mid;else hi=mid}
  const current=(lo+hi)/2,headroom=common-.45-Math.sqrt(current/beta),region=headroom<=0?'cutoff':mosfetCurrent(dt,{vgs,vds:headroom}).region
  return{current,gm:Math.sqrt(beta*current),region,headroom}
 }
 const both=scale=>{const n=pair(vcm,tail*scale),p=pair(vdd-vcm,tail*scale);return{n,p,gm:n.gm+p.gm}}
 let scale=1
 if(steer&&both(1).gm>target){let lo=0,hi=1;for(let i=0;i<45;i++){const mid=(lo+hi)/2;if(both(mid).gm>target)hi=mid;else lo=mid}scale=(lo+hi)/2}
 const x=both(scale),ro=1e5,dc=x.gm*ro,corner=1/(2*Math.PI*ro*cl),cross=dc>1?corner*Math.sqrt(dc*dc-1):0
 return{...x,scale,target,beta,tailBeta,power:vdd*(x.n.current+x.p.current),dc,crossover:cross,estimate:x.gm/(2*Math.PI*cl),at:f=>cdiv([dc,0],[1,f/corner])}
}
export const magnitude=f=>z=>20*Math.log10(cabs(z(f)))
export function millerDrawing(p){const x=miller(p),wire=(...v)=>({wire:v}),ground=(a,b)=>({gnd:[a,b]});return{elements:x.net.elements.map(e=>e.type==='VCCS'?{...e,label:e.id==='G1'?'gm1·vi':'gm2·va'}:e),caption:'The exact two-node small-signal network used in the equations. Both controlled currents point toward ground. Their control voltages are vi and va respectively; Cc connects the two output nodes.',layout:{w:680,h:310,items:[wire(80,110,270,110),{node:'a',x:200,y:110,labelPos:'t'},wire(400,110,590,110),{node:'out',x:500,y:110,labelPos:'t'},wire(200,110,200,40),wire(200,40,315,40),{el:'Cc',x:335,y:40,dir:'h'},wire(355,40,500,40),wire(500,40,500,110),...[['G1',80],['R1',175],['C1',270],['G2',400],['R2',495],['CL',590]].flatMap(([id,a])=>[wire(a,110,a,170),{el:id,x:a,y:190,dir:'v'},wire(a,210,a,270),ground(a,270)])]}}}
