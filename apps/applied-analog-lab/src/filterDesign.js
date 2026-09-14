import {complex,solveComplex,expm,matVecMul} from '@ee-labs/network'
const {cmul,cdiv,cabs}=complex
export const db=z=>20*Math.log10(Math.max(1e-30,cabs(z)))
export const poly=(a,z)=>a.reduce((v,c)=>{const p=cmul(v,z);return [p[0]+c,p[1]]},[0,0])
export const logpoints=(fn,lo,hi,n=241)=>Array.from({length:n},(_,i)=>{const x=lo*(hi/lo)**(i/(n-1));return{x,y:fn(x)}})
export function spec({pass=1e5,ratio=5,ripple=.5,stop=40}={},cheb=false){
 const eps2=10**(ripple/10)-1,target=10**(stop/10)-1,raw=cheb?Math.acosh(Math.sqrt(target/eps2))/Math.acosh(ratio):Math.log(target/eps2)/(2*Math.log(ratio)),order=Math.ceil(raw),corner=cheb?pass:pass/eps2**(1/(2*order))
 const attenuation=f=>{const u=f/pass,t=u<=1?Math.cos(order*Math.acos(u)):Math.cosh(order*Math.acosh(u));return 10*Math.log10(1+(cheb?eps2*t*t:(f/corner)**(2*order)))}
 return {eps2,target,raw,order,corner,attenuation,achieved:attenuation(pass*ratio)}
}
// Reverse Bessel polynomial, delay normalization: H(q)=105/(q^4+10q^3+45q^2+105q+105).
export const BESSEL=[1,10,45,105,105],BUTTER=[1,2.613125929752753,3.414213562373095,2.613125929752753,1]
function crossing(fn,target,lo=.0001,hi=10){for(let i=0;i<70;i++){const m=Math.sqrt(lo*hi);if(fn(m)>target)hi=m;else lo=m}return Math.sqrt(lo*hi)}
export function prototype(kind='bessel',corner=1e5){
 const a=kind==='bessel'?BESSEL:BUTTER,b=a.at(-1),atq=q=>cdiv([b,0],poly(a,[0,q])),q3=crossing(q=>-db(atq(q)),10*Math.log10(2)),scale=2*Math.PI*corner/q3
 const at=f=>atq(2*Math.PI*f/scale),der=a.slice(0,-1).map((v,i)=>v*(a.length-1-i)),delay=f=>cdiv(poly(der,[0,2*Math.PI*f/scale]),poly(a,[0,2*Math.PI*f/scale]))[0]/scale
 // Controllable companion in normalized time; state [y,y',y'',y'''] and unit step.
 const A=[[0,1,0,0,0],[0,0,1,0,0],[0,0,0,1,0],[-a[4],-a[3],-a[2],-a[1],b],[0,0,0,0,0]],end=20/Math.min(scale,2*Math.PI*corner),dt=end/600,transition=expm(A.map(row=>row.map(v=>v*scale*dt)))
 let x=[0,0,0,0,1];const response=[];for(let i=0;i<=600;i++){response.push({x:i*dt,y:x[0]});x=matVecMul(transition,x)}
 return {a,b,q3,scale,at,delay,response,overshoot:Math.max(0,...response.map(p=>p.y-1))*100}
}
export function sallen({r1=1000,r2=1000,cf=2e-9,cg=1e-9}={}){const w=1/Math.sqrt(r1*r2*cf*cg),q=Math.sqrt(r1*r2*cf*cg)/(cg*(r1+r2));return {w,f:w/(2*Math.PI),q}}
export function tolerance({tolerance=.01,seed=7}={}){
 const base={r1:1000,r2:1000,cf:2e-9,cg:1e-9},nom=sallen(base),keys=Object.keys(base),h=1e-5
 const sensitivities=keys.map(key=>{const up=sallen({...base,[key]:base[key]*(1+h)}),dn=sallen({...base,[key]:base[key]*(1-h)});return {key,f:(up.f-dn.f)/(2*h*nom.f),q:(up.q-dn.q)/(2*h*nom.q)}})
 let state=seed>>>0;const random=()=>{state=(1664525*state+1013904223)>>>0;return state/4294967296}
 const trials=Array.from({length:2000},()=>sallen(Object.fromEntries(keys.map(key=>[key,base[key]*(1+tolerance*(2*random()-1))]))))
 const spread=key=>{const avg=trials.reduce((s,x)=>s+x[key],0)/trials.length;return Math.sqrt(trials.reduce((s,x)=>s+(x[key]-avg)**2,0)/(trials.length-1))/nom[key]}
 return {base,nom,sensitivities,trials,sigmaF:spread('f'),sigmaQ:spread('q'),predF:tolerance/Math.sqrt(3),predQ:tolerance/Math.sqrt(6)}
}
// Exact nodal AC of explicitly connected unity-gain SK and inverting MFB circuits.
// Amplifier A(s)=wt/s: an ideal dominant-pole integrator, no output resistance or slew.
export function section({topology=0,corner=1e5,q=Math.SQRT1_2,gbw=3e6}={}){
 const w0=2*Math.PI*corner,wt=2*Math.PI*gbw,c2=1e-9,c1=(topology?9:4)*q*q*c2,R=1/((topology?3:2)*q*w0*c2),g=1/R
 const at=f=>{if(f===0)return [topology?-1:1,0];const w=2*Math.PI*f
  const matrix=topology?[
   [[3*g,w*c1],[-g,0],[-g,0]],
   [[-g,0],[g,w*c2],[0,-w*c2]],
   [[0,0],[1,0],[0,w/wt]]
  ]:[
   [[2*g,w*c1],[-g,0],[0,-w*c1]],
   [[-g,0],[g,w*c2],[0,0]],
   [[0,0],[-1,0],[1,w/wt]]
  ];return solveComplex(matrix,[[g,0],[0,0],[0,0]])[2]
 }
 const ideal=f=>cdiv([topology?-1:1,0],[1-(f/corner)**2,f/(corner*q)]),ideal3=crossing(f=>-db(ideal(f)),10*Math.log10(2),corner/100,corner*100),actual3=crossing(f=>-db(at(f)),10*Math.log10(2),corner/100,corner*100)
 return {R,c1,c2,q,corner,gbw,at,ideal,ideal3,actual3,error:100*(actual3/ideal3-1)}
}
export function cascade({gbw=3e6,topology=0,scale=1,damping=1}={}){
 const design=spec(),fc=design.corner*scale,qs=[.541196100146197,1.306562964876377],sections=qs.map(q=>section({topology,corner:fc,q:q*damping,gbw})),at=f=>sections.reduce((z,s)=>cmul(z,s.at(f)),[1,0]),passLoss=-db(at(1e5)),stopLoss=-db(at(5e5)),passGrid=logpoints(f=>db(at(f)),10,1e5,501),min=Math.min(0,...passGrid.map(p=>p.y)),max=Math.max(0,...passGrid.map(p=>p.y))
 return {sections,at,passLoss,stopLoss,min,max,meets:min>=-.5-1e-8&&max<=1e-8&&stopLoss>=40}
}
// Circuit drawings share the same connections and values as the nodal model.
export function sectionDrawing(x,topology=0){
 const wire=(...v)=>({wire:v}),ground=(x,y)=>({gnd:[x,y]}),R=(id,a,b,value)=>({type:'R',id,nodes:[a,b],value}),C=(id,a,b,value)=>({type:'C',id,nodes:[a,b],value}),V={type:'V',id:'V1',nodes:['in','gnd'],value:1},U={type:'OPAMP',id:'U1',nodes:['out'],ctrl:topology?['gnd','b']:['b','out'],label:x.gbw?'U1 A(s) = ωt/s':'U1 ideal'}
 const elements=[V,U,R('R1','in','a',x.R),R('R2','a',topology?'out':'b',x.R),...(topology?[R('R3','a','b',x.R)]:[]),C('C1','a',topology?'gnd':'out',x.c1),C('C2','b',topology?'out':'gnd',x.c2)]
 const common=[{el:'V1',x:40,y:145,dir:'v'},ground(40,165),wire(40,125,40,90),wire(40,90,80,90),{el:'R1',x:100,y:90,dir:'h'},wire(120,90,260,90),{node:'a',x:170,y:90,labelPos:'b'},{el:topology?'R3':'R2',x:280,y:90,dir:'h'},wire(300,90,330,90),{node:'b',x:330,y:90,labelPos:'t'},wire(330,90,360,90),wire(360,90,360,108),wire(360,108,390,108),{el:'U1',x:390,y:120,invertTop:!!topology},wire(428,120,515,120),{node:'out',x:515,y:120,labelPos:'r'}]
 const items=topology?[...common,wire(390,132,365,132),ground(365,132),wire(170,90,170,155),{el:'C1',x:170,y:175,dir:'v'},ground(170,195),wire(170,90,170,30),wire(170,30,260,30),{el:'R2',x:280,y:30,dir:'h'},wire(300,30,515,30),wire(515,30,515,120),wire(330,90,330,225),wire(330,225,385,225),{el:'C2',x:405,y:225,dir:'h'},wire(425,225,480,225),wire(480,225,480,120)]:[...common,wire(330,90,330,155),{el:'C2',x:330,y:175,dir:'v'},ground(330,195),wire(170,90,170,30),wire(170,30,260,30),{el:'C1',x:280,y:30,dir:'h'},wire(300,30,515,30),wire(515,30,515,120),wire(470,120,470,225),wire(470,225,375,225),wire(375,225,375,132),wire(375,132,390,132)]
 return {elements,layout:{w:580,h:270,items},caption:topology?'Inverting MFB section: C1 shunts node a; C2 feeds back from output to inverting node b. All three resistors equal R. F5 solves A(s)=2πGBW/s.':'Unity-gain Sallen–Key section: C1 feeds back from output to a, C2 shunts b, and the amplifier follows b. F4 uses an ideal follower; F5 solves A(s)=2πGBW/s.'}
}
