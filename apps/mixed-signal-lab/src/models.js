import {transient} from '@ee-labs/network'
import {rng,sampleMean} from '@ee-labs/random'
export const K=1.380649e-23,COX=8.63e-3
export function acquisition({resistance=1000,capacitance=1e-12,bits=12,time=9e-9,voltage=1}={}){const tau=resistance*capacitance,error=voltage*Math.exp(-time/tau),limit=voltage/2**(bits+1);return{tau,fc:1/(2*Math.PI*tau),error,limit,required:(bits+1)*Math.LN2*tau,held:voltage-error}}
export function chargeShare({c1=1e-12,c2=1e-12,v1=1,v2=0,resistance=1}={}){
 const charge=c1*v1+c2*v2,voltage=charge/(c1+c2),initial=.5*(c1*v1*v1+c2*v2*v2),final=.5*(c1+c2)*voltage*voltage,tau=resistance*c1*c2/(c1+c2)
 return{charge,voltage,initial,final,loss:initial-final,tau,at:t=>{const dv=(v1-v2)*Math.exp(-t/tau);return{v1:voltage+c2/(c1+c2)*dv,v2:voltage-c1/(c1+c2)*dv}}}
}
export function chargeNet({c1=1e-12,c2=1e-12,resistance=1}={}){return{elements:[{type:'C',id:'C1',nodes:['a','gnd'],value:c1},{type:'C',id:'C2',nodes:['b','gnd'],value:c2},{type:'R',id:'Rs',nodes:['a','b'],value:resistance}]}}
export function chargeNative(p={}){const x=chargeShare(p),w=transient(chargeNet(p),{tEnd:20*x.tau,points:101,x0:[p.v1??1,p.v2??0]});return w.at(20*x.tau).sol.v}
export function injection({width=1e-6,length=.18e-6,capacitance=1e-12,vin=0,clock=1.8,threshold=.45,partition=.5,overlap=.2e-15,dummy=0,mismatch=0}={}){
 const overdrive=Math.max(0,clock-vin-threshold),q=width*length*COX*overdrive,channel=-partition*q/capacitance,dummyStep=dummy*.5*q*(1+mismatch)/capacitance,feed=-overlap*clock/capacitance
 return{q,channel,dummy:dummyStep,feed,total:channel+dummyStep+feed,lsb:1/4096}
}
export function thermal({capacitance=1e-12,temperature=300,resistance=1000,bits=14}={}){const variance=K*temperature/capacitance,rms=Math.sqrt(variance),snr=20*Math.log10(1/rms),target=6.02*bits+1.76;return{variance,rms,snr,target,minC:K*temperature*10**(target/10),fc:1/(2*Math.PI*resistance*capacitance)}}
export function bottomPlate({vin=.5,capacitance=1e-12,order=1,phase=2}={}){
 // Ideal two-phase charge bookkeeping: once bottom plate is floating, opening
 // the input switch cannot change capacitor differential voltage. Parasitics omitted.
 const normal=injection({vin,capacitance,overlap:0}).channel,constant=-injection({vin:0,capacitance,overlap:0}).channel,error=phase===0?0:order?constant:normal
 return{normal,constant,error,held:vin+error}
}
export function jitter({frequency=10e6,sigma=1e-12,bits=12,seed=42,count=8192}={}){
 const random=rng(seed),fs=160e6,w=2*Math.PI*frequency,errors=[],record=[]
 for(let i=0;i<count;i++){const t=i/fs,ideal=Math.sin(w*t),actual=Math.sin(w*(t+random.normal(0,sigma))),error=actual-ideal;errors.push(error*error);if(i<128)record.push({x:i,y:error*1e6})}
 const estimate=sampleMean(errors),exact=-Math.expm1(-.5*(w*sigma)**2),target=6.02*bits+1.76,required=10**(-target/20)/w
 return{fs,record,estimate,mse:exact,snr:-20*Math.log10(w*sigma),measured:10*Math.log10(.5/estimate.value),ci:estimate.ci.map(v=>10*Math.log10(.5/v)).reverse(),required,target}
}
const wire=(...v)=>({wire:v}),gnd=(x,y)=>({gnd:[x,y]})
export function rcSchematic({resistance=1000,capacitance=1e-12}={}){return{caption:'Track phase: the closed switch is represented by Ron; Cs stores the output node voltage. During ideal hold, Ron is disconnected.',elements:[{type:'V',id:'V1',nodes:['in','gnd'],value:1},{type:'R',id:'Ron',nodes:['in','held'],value:resistance},{type:'C',id:'Cs',nodes:['held','gnd'],value:capacitance}],layout:{w:340,h:160,items:[{el:'V1',x:50,y:85,dir:'v'},wire(50,65,50,40),wire(50,40,140,40),{el:'Ron',x:160,y:40,dir:'h'},wire(180,40,270,40),wire(270,40,270,65),{el:'Cs',x:270,y:85,dir:'v'},gnd(50,105),gnd(270,105),{node:'held',x:270,y:40,labelPos:'t'}]}}}
export function shareSchematic(p={}){return{caption:'After connection, Rs joins two initially charged capacitors. The ideal switch projection is the zero-duration limit; the finite-R trace resolves the charge redistribution.',elements:chargeNet(p).elements,layout:{w:340,h:160,items:[{el:'C1',x:65,y:85,dir:'v'},wire(65,65,65,40),wire(65,40,140,40),{el:'Rs',x:160,y:40,dir:'h'},wire(180,40,270,40),wire(270,40,270,65),{el:'C2',x:270,y:85,dir:'v'},gnd(65,105),gnd(270,105),{node:'a',x:65,y:40,labelPos:'t'},{node:'b',x:270,y:40,labelPos:'t'}]}}}

export function bottomSchematic(p={}){const phase=p.phase??2,order=p.order??1;return{caption:`Phase ${phase}: ${phase===0?'both switches track':phase===1?(order?'ground switch opens first':'input switch opens first'):'both switches open; differential voltage held'}. VH is Vtop − Vbottom.`,elements:[{type:'V',id:'V1',nodes:['in','gnd'],value:p.vin??.5},{type:'SW',id:'Sinput',nodes:['in','top'],closed:phase===0||(phase===1&&order===1)},{type:'C',id:'Cs',nodes:['top','bottom'],value:p.capacitance??1e-12},{type:'SW',id:'Sground',nodes:['bottom','gnd'],closed:phase===0||(phase===1&&order===0)}],layout:{w:370,h:240,items:[{el:'V1',x:50,y:110,dir:'v'},wire(50,90,50,40),wire(50,40,160,40),{el:'Sinput',x:180,y:40,dir:'h'},wire(200,40,290,40),wire(290,40,290,90),{el:'Cs',x:290,y:110,dir:'v'},wire(290,130,290,150),{el:'Sground',x:290,y:170,dir:'v'},gnd(290,190),gnd(50,130),{node:'top',x:290,y:40,labelPos:'t'},{node:'bottom',x:290,y:140,labelPos:'r'}]}}}
