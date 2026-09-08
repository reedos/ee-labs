import {transient,returnRatioAt,marginsOf,expm,matVecMul,complex} from '@ee-labs/network'
const {cdiv,cmul,cadd,cabs}=complex
export const A0=1e5
const resistor=(id,a,b,value)=>({type:'R',id,nodes:[a,b],value}),capacitor=(id,a,b,value)=>({type:'C',id,nodes:[a,b],value})
const poleAmp=(id,plus,minus,out,gbw)=>[{type:'VCVS',id,nodes:[id+'drive','gnd'],ctrl:[plus,minus],gain:A0},resistor(id+'Rp',id+'drive',id+'state',1000),capacitor(id+'Cp',id+'state','gnd',A0/(2*Math.PI*gbw*1000)),{type:'VCVS',id:id+'buffer',nodes:[out,'gnd'],ctrl:[id+'state','gnd'],gain:1}]
export function loadCircuit({gbw=10e6,ro=50,cl=1e-9,riso=0,rl=Infinity}={}){
 const net={elements:[{type:'V',id:'V1',nodes:['in','gnd'],wave:{kind:'step',from:0,to:.01}},...poleAmp('A1','in','amp','core',gbw),resistor('Ro','core','amp',ro),...(riso? [resistor('Riso','amp','out',riso)]:[{type:'V',id:'Join',nodes:['amp','out'],value:0}]),capacitor('CL','out','gnd',cl),...(Number.isFinite(rl)?[resistor('RL','out','gnd',rl)]:[])]}
 const tau=A0/(2*Math.PI*gbw),b0=Number.isFinite(rl)?riso+rl:1,b1=Number.isFinite(rl)?riso*rl*cl:riso*cl,d0=Number.isFinite(rl)?ro+riso+rl:1,d1=Number.isFinite(rl)?(ro+riso)*rl*cl:(ro+riso)*cl,loop={b:[A0*b1,A0*b0],a:[tau*d1,d1+tau*d0,d0]},closed={b:[A0*(Number.isFinite(rl)?rl:1)],a:[tau*d1,d1+tau*d0+A0*b1,d0+A0*b0]}
 return{net,loop,closed,gbw,cl,ro,riso,rl,tau,dc:closed.b[0]/closed.a[2],pole:1/(2*Math.PI*(ro+riso)*cl),zero:riso?1/(2*Math.PI*riso*cl):null}
}
export function tiaCircuit({gbw=10e6,rf=1e6,cin=25e-12,cf=0}={}){
 const net={elements:[{type:'I',id:'I1',nodes:['gnd','sum'],wave:{kind:'step',from:0,to:1e-9}},...poleAmp('A1','gnd','sum','out',gbw),resistor('Rf','out','sum',rf),capacitor('Cin','sum','gnd',cin),...(cf?[capacitor('Cf','sum','out',cf)]:[])]},tau=A0/(2*Math.PI*gbw),sum=rf*(cin+cf),loop={b:[A0*rf*cf,A0],a:[tau*sum,tau+sum,1]},closed={b:[-A0*rf],a:[tau*sum,tau+sum+A0*rf*cf,1+A0]}
 // Cf is not an independent third state: Vo equals the amplifier pole state.
 // Eliminate its derivative using tau*Vo' = -Vo-A0*Vsum.
 const stateMatrix=[[-(1/rf+A0*cf/tau)/(cin+cf),(1/rf-cf/tau)/(cin+cf)],[-A0/tau,-1/tau]]
 return{net,loop,closed,stateMatrix,tau,gbw,rf,cin,cf,dc:closed.b[0]/closed.a[2],noiseZero:1/(2*Math.PI*rf*(cin+cf)),feedbackPole:cf?1/(2*Math.PI*rf*cf):null,cfDesign:Math.sqrt(2*cin/(2*Math.PI*rf*gbw))}
}
export function compositeCircuit({gbw=1e6,inner=10,outer=100}={}){
 const tau=A0/(2*Math.PI*gbw),net={elements:[{type:'V',id:'V1',nodes:['in','gnd'],wave:{kind:'step',from:0,to:1e-4}},...poleAmp('A1','in','fb','mid',gbw),...poleAmp('A2','mid','local','out',gbw),resistor('Rfg','out','fb',(outer-1)*1000),resistor('Rgg','fb','gnd',1000),resistor('Rfl','out','local',(inner-1)*1000),resistor('Rgl','local','gnd',1000)]},loop={b:[A0*A0/outer],a:[tau*tau,tau*(2+A0/inner),1+A0/inner]},closed={b:[A0*A0],a:[tau*tau,tau*(2+A0/inner),1+A0/inner+A0*A0/outer]}
 return{net,loop,closed,gbw,inner,outer,tau,dc:closed.b[0]/closed.a[2]}
}
export function at(tf,f){const w=2*Math.PI*f,poly=coeff=>coeff.reduce((z,c)=>cadd(cmul(z,[0,w]),[c,0]),[0,0]);return cdiv(poly(tf.b),poly(tf.a))}
export function stability(model,{input=.01}={}){
 const {loop,closed,net}=model,T=f=>at(loop,f),m=marginsOf(T,{lo:.001,hi:1e12}),[a2,a1,a0]=closed.a,wn=Math.sqrt(a0/a2),zeta=a1/(2*Math.sqrt(a2*a0)),tEnd=zeta<1?Math.min(8/(zeta*wn),16*Math.PI/(wn*Math.sqrt(1-zeta*zeta))):8*(zeta+Math.sqrt(zeta*zeta-1))/wn
 const wave=model.stateMatrix?(()=>{
  const final=[-input*model.dc/A0,input*model.dc]
  const at=t=>{const delta=matVecMul(expm(model.stateMatrix.map(row=>row.map(v=>v*t))),final);return{sol:{v:{out:final[1]-delta[1]}}}}
  const t=Array.from({length:601},(_,i)=>tEnd*i/600)
  return{t,samples:t.map(at),at}
 })():transient(net,{tEnd,points:601}),points=Array.from(wave.t,(t,i)=>({x:t*1e6,y:wave.samples[i].sol.v.out/(input*model.dc)})),peakTime=zeta<1?Math.PI/(wn*Math.sqrt(1-zeta*zeta)):tEnd,overshoot=Math.max(0,100*(wave.at(peakTime).sol.v.out/(input*model.dc)-1))
 let lo=.001,hi=1e12;for(let i=0;i<80;i++){const f=Math.sqrt(lo*hi);if(cabs(at(closed,f))>Math.abs(model.dc)/Math.SQRT2)lo=f;else hi=f}
 return{...model,...m,wn,zeta,tEnd,points,overshoot,bandwidth:Math.sqrt(lo*hi),checkError:cabs(cadd(returnRatioAt(net,'A1',2*Math.PI*m.crossover),T(m.crossover).map(v=>-v)))}
}
export const logSamples=(fn,lo=1e3,hi=1e8)=>Array.from({length:201},(_,i)=>{const f=lo*(hi/lo)**(i/200);return{x:f,y:fn(f)}})
export function loopHandover(x,id){const pad=a=>[...Array(3-a.length).fill(0),...a];return{app:'control-lab',label:'Inspect this loop in Control Lab',patch:{plant:{type:'custom',params:[...pad(x.loop.b),...pad(x.loop.a)]},ctrl:{type:'p',params:[1]},from:{app:'applied-analog-lab',id,label:'Amplifier loop return ratio'}},note:'Transfers the loop return ratio T(s) as the plant with unity proportional control. The displayed closed-loop response is T/(1+T), which may differ from the load-voltage transfer when feedback is taken before an isolation resistor.'}}
const wire=(...v)=>({wire:v}),gnd=(x,y)=>({gnd:[x,y]})
export function loadDrawing(p){return{caption:'Finite-GBW amplifier with internal output resistance Ro. Feedback senses amp, before Riso; CL and RL are at out. Supply and internal pole are represented by the amplifier model.',elements:[{type:'OPAMP',id:'U1',gain:A0},{type:'R',id:'Ro',value:p.ro},{type:'R',id:'Riso',value:p.riso,label:p.riso?'Riso '+p.riso+' Ω':'Riso 0 Ω (short)'},{type:'C',id:'CL',value:p.cl},{type:'R',id:'RL',value:p.rl,label:Number.isFinite(p.rl)?'RL '+p.rl+' Ω':'RL absent'}],layout:{w:520,h:240,items:[{el:'U1',x:75,y:75,invertTop:false},wire(35,63,75,63),{node:'in',x:35,y:63,labelPos:'t'},wire(113,75,140,75),{el:'Ro',x:160,y:75,dir:'h'},wire(180,75,245,75),{node:'amp',x:215,y:75,labelPos:'t'},{el:'Riso',x:265,y:75,dir:'h'},wire(285,75,450,75),{node:'out',x:355,y:75,labelPos:'t'},wire(355,75,355,115),{el:'CL',x:355,y:135,dir:'v'},gnd(355,155),...(Number.isFinite(p.rl)?[wire(450,75,450,115),{el:'RL',x:450,y:135,dir:'v'},gnd(450,155)]:[]),wire(215,75,215,205),wire(215,205,55,205),wire(55,205,55,87),wire(55,87,75,87)]}}}
export function tiaDrawing(p){return{caption:'Positive photocurrent enters sum. The amplifier inverts it, giving negative output voltage. Cin shunts the summing node; Rf and optional Cf connect that node to out.',elements:[{type:'OPAMP',id:'U1',gain:A0},{type:'I',id:'I1',value:1e-9},{type:'R',id:'Rf',value:p.rf},{type:'C',id:'Cin',value:p.cin},{type:'C',id:'Cf',value:p.cf,label:p.cf?'Cf '+(p.cf*1e12).toPrecision(3)+' pF':'Cf absent'}],layout:{w:500,h:280,items:[{el:'I1',x:50,y:160,dir:'v',flip:true},gnd(50,180),wire(50,140,50,95),wire(50,95,245,95),{node:'sum',x:130,y:95,labelPos:'t'},wire(130,95,130,140),{el:'Cin',x:130,y:160,dir:'v'},gnd(130,180),{el:'U1',x:245,y:107,invertTop:true},wire(210,119,245,119),gnd(210,119),wire(283,107,425,107),{node:'out',x:425,y:107,labelPos:'r'},wire(185,95,185,45),wire(185,45,250,45),{el:'Rf',x:270,y:45,dir:'h'},wire(290,45,425,45),wire(425,45,425,107),...(p.cf?[wire(185,95,185,225),wire(185,225,250,225),{el:'Cf',x:270,y:225,dir:'h'},wire(290,225,425,225),wire(425,225,425,107)]:[])]}}}
