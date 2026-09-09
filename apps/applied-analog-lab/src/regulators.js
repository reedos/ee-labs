import {bandgap,complex,loopCrossings,expm,matVecMul,solveAC} from '@ee-labs/network'
const {cadd,cmul,cdiv,cabs}=complex
export {bandgap}
export const logGrid=(fn,lo=1,hi=1e7,n=241)=>Array.from({length:n},(_,i)=>{const x=lo*(hi/lo)**(i/(n-1));return{x,y:fn(x)}})
export const db=z=>20*Math.log10(Math.max(1e-30,cabs(z)))
export function reference({temp=26.85,n=8,trim=0}={}){
 const optimum=bandgap({n}).optimum,m=optimum*(1+trim),at=t=>bandgap({n,m,temperature:t+273.15}),x=at(temp),temperatures=[-40,125]
 if(x.stationaryTemperature>=233.15&&x.stationaryTemperature<=398.15)temperatures.push(x.stationaryTemperature-273.15)
 const values=temperatures.map(t=>at(t).reference),span=Math.max(...values)-Math.min(...values),nominal=at(26.85).reference
 return{...x,m,at,span,nominal,box:span/(nominal*165)*1e6}
}
const R=(id,a,b,value)=>({type:'R',id,nodes:[a,b],value}),C=(id,a,b,value)=>({type:'C',id,nodes:[a,b],value})
const E=(id,a,b,plus,minus,gain)=>({type:'VCVS',id,nodes:[a,b],ctrl:[plus,minus],gain})
// Incremental circuit about 3.3 V. The pass control increases sourced current;
// its output resistance is physically connected to the input supply.
export function ldo({load=.1,cap=10e-6,esr=.1,fa=100,rho=0,alpha=0}={}){
 const a0=1e4,gm=.1,rpass=1e4,beta=1.25/3.3,rl=3.3/load,g=1/rl+1/rpass,r=1/g,ta=1/(2*Math.PI*fa),tz=esr*cap,to=(r+esr)*cap,k=a0*gm*r*beta
 const loop={b:[k*tz,k],a:[ta*to,ta+to,1]},closed={b:[a0*gm*r*tz,a0*gm*r],a:[ta*to,ta+to+k*tz,1+k]}
 const at=f=>{const w=2*Math.PI*f;return cdiv([k,k*w*tz],cmul([1,w*ta],[1,w*to]))}
 const z=f=>cdiv([r,r*2*Math.PI*f*tz],[1,2*Math.PI*f*to])
 const amp=f=>cdiv([a0,0],[1,2*Math.PI*f*ta])
 const paths=f=>{const Z=z(f),A=amp(f),den=cadd([1,0],at(f)),pass=cmul([1/rpass,0],Z),ref=cmul([gm*rho,0],cmul(A,Z)),amplifier=cmul([gm*alpha,0],cmul(cdiv([1,0],[1,2*Math.PI*f*ta]),Z));return{pass:cdiv(pass,den),reference:cdiv(ref,den),amplifier:cdiv(amplifier,den),open:cadd(cadd(pass,ref),amplifier),total:cdiv(cadd(cadd(pass,ref),amplifier),den)}}
 const net={elements:[{type:'V',id:'Vref',nodes:['ref','gnd'],wave:{kind:'step',from:0,to:.001}},{type:'V',id:'Vs',nodes:['supply','gnd'],value:0},E('ReferenceSupply','plus','ref','supply','gnd',rho),E('Feedback','fb','gnd','out','gnd',beta),E('A1','raw','gnd','plus','fb',a0),E('AmpSupply','drive','raw','supply','gnd',alpha),R('Ra','drive','ae',1000),C('Ca','ae','gnd',ta/1000),{type:'VCCS',id:'Gpass',nodes:['gnd','out'],ctrl:['ae','gnd'],gain:gm},R('Rpass','supply','out',rpass),R('RL','out','gnd',rl),...(esr?[R('ESR','out','vc',esr)]:[{type:'V',id:'Join',nodes:['out','vc'],value:0}]),C('Cout','vc','gnd',cap)]}
 const q=r/(r+esr),d=esr*q*gm,state=[[-(1+a0*beta*d)/ta,-a0*beta*q/ta],[r*gm/to,-1/to]],dc=a0*gm*r/(1+k),final=[dc/(gm*r)*.001,dc*.001]
 const [a2,a1,a00]=closed.a,wn=Math.sqrt(a00/a2),zeta=a1/(2*Math.sqrt(a2*a00)),decay=zeta<1?zeta*wn:wn/(zeta+Math.sqrt(zeta*zeta-1)),end=8/decay
 const response=t=>{const delta=matVecMul(expm(state.map(row=>row.map(v=>v*t))),final),ae=final[0]-delta[0],vc=final[1]-delta[1];return q*vc+d*ae}
 // Up to eight cycles with >=60 points/cycle; otherwise show the full settling interval.
 const period=zeta<1?2*Math.PI/(wn*Math.sqrt(1-zeta*zeta)):Infinity,tEnd=Math.min(end,8*period)
 return{net,loop,closed,at,z,amp,paths,a0,gm,rpass,beta,rl,g,r,ta,tz,to,k,dc,state,q,d,zeta,tEnd,settleEnd:end,response,pole:1/(2*Math.PI*to),zero:esr?1/(2*Math.PI*tz):null,...loopCrossings(at)}
}
export const nativeSupply=(x,f)=>solveAC(x.net,2*Math.PI*f,{sources:{Vs:[1,0],Vref:[0,0]},anyFreq:true}).v.out
export function thermal({vin=12,load=.1,iq=50e-6,ron=.3,ambient=25,theta=50,cap=10e-6}={}){
 const target=3.3,headroom=vin-target,dropout=load*ron,regulated=headroom>=dropout,loss=(vin-target)*load+vin*iq,pin=vin*(load+iq),pout=target*load,tj=ambient+theta*loss,pole=1/(2*Math.PI*((1/(load/target+1/1e4))+.1)*cap)
 return{target,headroom,dropout,regulated,loss,pin,pout,eta:pout/pin,tj,rise:theta*loss,thermalMargin:125-tj,pole}
}
// Explicit scenario assumptions, not commercial regulator specifications.
export function selection({vin=5,load=.2,eta=.9,enLinear=100e-9,enBuck=500e-9,band=1e5,ripple=.01,fs=1e6,adc=96000}={}){
 const linear=thermal({vin,load}),pout=3.3*load,buckLoss=pout*(1/eta-1),linearNoise=enLinear*Math.sqrt(band),buckNoise=enBuck*Math.sqrt(band),alias=Math.abs(fs-Math.round(fs/adc)*adc),rippleInBand=fs<=band?ripple/Math.SQRT2:0
 const duty=3.3/vin,inductance=Math.max(100e-6,3.3*(1-duty)/(.4*load*fs))
 return{linear,pout,buckLoss,linearNoise,buckNoise,buckTotal:Math.hypot(buckNoise,rippleInBand),alias,linearPass:linear.regulated&&linear.tj<=125&&linearNoise<100e-6,buckPass:buckNoise**2+rippleInBand**2<(100e-6)**2,duty,inductance,rl:3.3/load}
}
const wire=(...v)=>({wire:v}),ground=(x,y)=>({gnd:[x,y]})
export function ldoDrawing(p={}){
 const x=ldo(p)
 return{caption:'Incremental circuit about 3.3 V: Gpass sources gm·va into out; Rpass connects out to the supply disturbance vs. RL and the series ESR–Cout branch load out. The amplifier block includes its pole; feedback is β·vo. All lowercase voltages are changes from bias. D3 also adds the two stated supply-coupling paths at the amplifier.',elements:[{type:'OPAMP',id:'Amp',label:'A(s)'},{type:'VCCS',id:'Gp',gain:x.gm,label:'gm va'},{type:'R',id:'Rp',value:x.rpass,label:'Rpass'},{type:'R',id:'RL',value:x.rl},{type:'R',id:'Re',value:p.esr??.1,label:'ESR'},{type:'C',id:'Co',value:p.cap??10e-6,label:'Cout'},{type:'VCVS',id:'Fb',gain:x.beta,label:'β vo'}],layout:{w:700,h:360,items:[{el:'Amp',x:70,y:92,invertTop:false},wire(25,80,70,80),{node:'vref',x:25,y:80,labelPos:'t'},wire(108,92,150,92),{node:'va',x:150,y:92,labelPos:'r'},{el:'Gp',x:285,y:190,dir:'v',flip:true},ground(285,210),wire(285,170,285,92),wire(285,92,640,92),{node:'out',x:575,y:92,labelPos:'t'},wire(405,92,405,55),{el:'Rp',x:405,y:35,dir:'v'},{node:'vs',x:405,y:15,labelPos:'t'},wire(520,92,520,170),{el:'RL',x:520,y:190,dir:'v'},ground(520,210),wire(640,92,640,140),{el:'Re',x:640,y:160,dir:'v'},wire(640,180,640,215),{node:'vc',x:640,y:205,labelPos:'r'},{el:'Co',x:640,y:235,dir:'v'},ground(640,255),{el:'Fb',x:150,y:285,dir:'v'},ground(150,305),wire(150,265,150,235),wire(150,235,35,235),wire(35,235,35,104),wire(35,104,70,104)]}}
}
