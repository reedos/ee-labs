import {parameterEnsemble} from '@ee-labs/random'
import {thermalVoltage,vbeSlope} from '@ee-labs/network'
export const BG={t0:300,eg:1.206,vbe0:.650,eta:3}
export function bandgap({temperature=300,n=8,m}={}){
 const {t0,eg,vbe0,eta}=BG,ut=thermalVoltage(temperature),vbe=eg+(vbe0-eg)*temperature/t0-eta*ut*Math.log(temperature/t0),ptat=ut*Math.log(n),slopePTAT=thermalVoltage(1)*Math.log(n),slopeCTAT=vbeSlope({vbe,eg,xti:eta},temperature),optimum=-vbeSlope({vbe:vbe0,eg,xti:eta},t0)/slopePTAT,weight=m??optimum
 const stationaryTemperature=t0*Math.exp(((vbe0-eg)/t0+weight*thermalVoltage(1)*Math.log(n))/(eta*thermalVoltage(1))-1)
 return{vbe,ptat,weight,optimum,stationaryTemperature,reference:vbe+weight*ptat,slopePTAT,slopeCTAT,slope:slopeCTAT+weight*slopePTAT}
}
export function betaBias({ratio=4,resistance=10000,wl=10,start=0}={}){
 if(!(ratio>1&&resistance>0&&wl>0&&start>=0))throw Error('Bias parameters outside model domain.')
 const beta=200e-6*wl,gm=2*(1-1/Math.sqrt(ratio))/resistance,current=gm*gm/(2*beta)
 const residual=i=>Math.sqrt(2*(i+start)/beta)-Math.sqrt(2*i/(ratio*beta))-i*resistance
 let lo=current,hi=current+start+1e-9;while(residual(hi)>0)hi*=2
 for(let j=0;j<90;j++){const mid=(lo+hi)/2;if(residual(mid)>0)lo=mid;else hi=mid}
 const operating=start?(lo+hi)/2:current
 return{beta,gm,current,operating,roots:start?[operating]:[0,current],residual,overdrive:Math.sqrt(2*(operating+start)/beta),drop:operating*resistance}
}
export function ratioRun({absolute=.2,match=.001,seed=42,count=2048,mode=0}={}){
 return parameterEnsemble({seed,count,sample:r=>({g:r.uniformIn(-absolute,absolute),d:r.uniformIn(-match,match),h:r.uniformIn(-absolute,absolute)}),evaluate:({g,d,h})=>mode?(1+g)*(1+d)/(1+h):(1+d),accept:value=>Math.abs(value-1)<=.01})
}
export function driftRun({tolerance=.2,mode=0,seed=42,count=2048}={}){
 return parameterEnsemble({seed,count,sample:r=>r.uniformIn(-tolerance,tolerance),evaluate:e=>(1+e)**(mode?-1:-2),accept:value=>Math.abs(value-1)<=.1})
}

const wire=(...v)=>({wire:v}),ground=(x,y)=>({gnd:[x,y]})
export function biasDrawing(p={}){const x=betaBias(p);return{caption:'Icopy1 and Icopy2 represent an ideal unity current mirror: both carry the solved mirrored current I. M1 is diode-connected; M2 has K times its current factor and a source resistor. An active startup source injects into M1 only. Mirror headroom and startup shutoff are not modeled.',elements:[{type:'I',id:'Icopy1',value:x.operating},{type:'I',id:'Icopy2',value:x.operating},{type:'I',id:'Istart',value:p.start??0},{type:'M',id:'M1',polarity:'n',label:'M1 · β1'},{type:'M',id:'M2',polarity:'n',label:'M2 · Kβ1'},{type:'R',id:'R',value:p.resistance??10000}],layout:{w:530,h:340,items:[wire(192,30,412,30),{node:'VDD',x:300,y:30,labelPos:'t'},wire(192,30,192,60),{el:'Icopy1',x:192,y:80,dir:'v'},wire(192,100,192,180),wire(412,30,412,60),{el:'Icopy2',x:412,y:80,dir:'v'},wire(412,100,412,180),{el:'M1',x:180,y:200,dir:'h'},{el:'M2',x:400,y:200,dir:'h'},wire(192,220,192,270),ground(192,270),wire(412,220,412,250),{el:'R',x:412,y:270,dir:'v'},ground(412,290),wire(192,155,140,155),wire(140,155,140,200),wire(140,200,160,200),wire(140,155,330,155),wire(330,155,330,200),wire(330,200,380,200),{node:'gate',x:270,y:155,labelPos:'t'},...(p.start?[{el:'Istart',x:55,y:215,dir:'v',flip:true},ground(55,235),wire(55,195,55,125),wire(55,125,192,125)]:[])]}}}
