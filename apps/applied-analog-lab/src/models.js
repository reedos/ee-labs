import {solveAC,pwlTransient} from '@ee-labs/network'
// These are the curriculum's illustrative classes, not manufacturer SPICE models.
export const PARTS=[
 {name:'General-purpose bipolar',gbw:1e6,sr:.5e6,vos:1e-3,ib:100e-9,en:20e-9,inoise:.5e-12,drift:10e-6},
 {name:'Precision bipolar',gbw:.6e6,sr:.3e6,vos:60e-6,ib:1.2e-9,en:9.6e-9,inoise:.1e-12,drift:.5e-6},
 {name:'JFET input',gbw:3e6,sr:13e6,vos:3e-3,ib:65e-12,en:18e-9,inoise:.01e-12,drift:10e-6},
 {name:'Low-voltage-noise bipolar',gbw:10e6,sr:9e6,vos:.5e-3,ib:200e-9,en:5e-9,inoise:.7e-12,drift:2e-6},
 {name:'Zero-drift',gbw:2e6,sr:2e6,vos:5e-6,ib:100e-12,en:55e-9,inoise:.01e-12,drift:.05e-6},
 {name:'Low-bias CMOS',gbw:1.5e6,sr:1e6,vos:1e-3,ib:10e-12,en:30e-9,inoise:.001e-12,drift:2e-6},
]
export function amplifier({part=0,gain=11}={}){const d=PARTS[part],a0=1e5,dc=a0/(1+a0/gain),fc=d.gbw*(1/a0+1/gain);return {...d,a0,dc,fc}}
export function ampNet(p={},stepTo=null){const d=amplifier(p);return{elements:[{type:'V',id:'V1',nodes:['in','gnd'],...(stepTo===null?{wave:{kind:'sine',amp:1,freq:1000}}:{wave:{kind:'step',from:0,to:stepTo}})},{type:'OPAMP',id:'U1',nodes:['out'],ctrl:['in','n'],gain:d.a0,gbw:d.gbw,...(stepTo===null?{}:{vsat:12,slew:d.sr})},{type:'R',id:'Rf',nodes:['out','n'],value:((p.gain??11)-1)*1000},{type:'R',id:'Rg',nodes:['n','gnd'],value:1000},{type:'R',id:'RL',nodes:['out','gnd'],value:10000}]}}
const wire=(...v)=>({wire:v}),gnd=(x,y)=>({gnd:[x,y]})
export function ampSchematic(p={}){return{elements:ampNet(p).elements.map(e=>e.id==='V1'?{...e,label:'V1 input'}:e),caption:'Non-inverting amplifier. The model uses ±12 V output limits only in the large-signal slew experiment; supply wiring is omitted.',layout:{w:370,h:180,items:[{el:'V1',x:50,y:95,dir:'v'},wire(50,75,50,40),wire(50,40,215,40),wire(215,40,215,48),wire(215,48,230,48),gnd(50,115),{el:'U1',x:230,y:60,invertTop:false},wire(268,60,320,60),wire(320,60,320,80),{el:'RL',x:320,y:100,dir:'v'},gnd(320,120),wire(290,60,290,145),wire(290,145,255,145),{el:'Rf',x:235,y:145,dir:'h'},wire(215,145,170,145),wire(170,145,170,72),wire(170,72,230,72),wire(170,145,140,145),{el:'Rg',x:120,y:145,dir:'h'},wire(100,145,70,145),gnd(70,145)]}}}
export function slewTrace(p){const a=amplifier(p),tEnd=Math.max(8/a.fc,2*p.peak/a.sr),w=pwlTransient(ampNet(p,p.peak/(p.gain??11)),{tEnd,points:241});return Array.from(w.t,t=>({x:t*1e6,y:w.at(t).sol.v.out}))}
export function filter({gbw=1e6,f0=1e5}={}){
 const R=1000,C2=1/(2*Math.PI*f0*R*Math.SQRT2),C1=2*C2,h=1e5/100001,tau=h/(2*Math.PI*gbw),a=R*R*C1*C2,b=2*R*C2,c=[1,b+tau+R*C1*(1-h),a+b*tau+R*C1*tau,a*tau]
 const response=f=>{const w=2*Math.PI*f,re=c[0]-c[2]*w*w,im=c[1]*w-c[3]*w**3;return{magnitude:h/Math.hypot(re,im),phase:-Math.atan2(im,re)*180/Math.PI}}
 let lo=f0*.001,hi=f0*10;for(let i=0;i<70;i++){const mid=(lo+hi)/2;if(response(mid).magnitude>h/Math.SQRT2)lo=mid;else hi=mid}
 const points=Array.from({length:301},(_,i)=>{const x=f0*10**(-2+4*i/300);return{x,y:20*Math.log10(response(x).magnitude)}}),peak=Math.max(...points.map(v=>v.y))-20*Math.log10(h)
 const net={elements:[{type:'V',id:'V1',nodes:['in','gnd'],wave:{kind:'sine',amp:1,freq:1000}},{type:'R',id:'R1',nodes:['in','a'],value:R},{type:'R',id:'R2',nodes:['a','b'],value:R},{type:'C',id:'C1',nodes:['a','out'],value:C1},{type:'C',id:'C2',nodes:['b','gnd'],value:C2},{type:'OPAMP',id:'U1',nodes:['out'],ctrl:['b','out'],gain:1e5,gbw}]}
 return{R,C1,C2,h,tau,c,response,fc:(lo+hi)/2,peak,points,net}
}
export function filterCheck(p,f){const x=filter(p),v=solveAC(x.net,2*Math.PI*f,{anyFreq:true}).v.out;return Math.hypot(...v)}
export function inputNoise({part=0,resistance=1e5,bandwidth=2e4,signal=1e-3}={}){const d=PARTS[part],thermal=4*1.380649e-23*300*resistance,current=(d.inoise*resistance)**2,voltage=d.en**2,density=Math.sqrt(thermal+current+voltage),rms=density*Math.sqrt(bandwidth);return{thermal,current,voltage,density,rms,snr:20*Math.log10(signal/rms)}}
export function offset({part=0,resistance=1e5,temp=25,gain=11}={}){const d=PARTS[part],ib=d.ib*([2,5].includes(part)?2**((temp-25)/10):1),bias=ib*resistance,voltage=d.vos+d.drift*(temp-25);return{ib,bias,voltage,total:bias+voltage,out:gain*(bias+voltage)}}
export function supply({inductance=10e-9,capacitance=100e-9,current=.02,rise=10e-9,resistance=.05}={}){return{inductive:inductance*current/rise,capacitive:current*rise/capacitance,esr:resistance*current,resonance:1/(2*Math.PI*Math.sqrt(inductance*capacitance))}}

export function filterSchematic(p={}){return{elements:filter(p).net.elements.map(e=>e.id==='V1'?{...e,label:'V1 input'}:e),caption:'Unity-gain Sallen–Key filter: C1 returns from node a to the output; C2 shunts node b to ground. The follower uses finite GBW.',layout:{w:470,h:210,items:[{el:'V1',x:40,y:115,dir:'v'},gnd(40,135),wire(40,95,40,70),wire(40,70,70,70),{el:'R1',x:90,y:70,dir:'h'},wire(110,70,190,70),{el:'R2',x:210,y:70,dir:'h'},wire(230,70,280,70),wire(280,70,280,88),wire(280,88,320,88),{el:'U1',x:320,y:100,invertTop:false},wire(358,100,425,100),wire(380,100,380,170),wire(380,170,305,170),wire(305,170,305,112),wire(305,112,320,112),wire(260,70,260,100),{el:'C2',x:260,y:120,dir:'v'},gnd(260,140),wire(150,70,150,25),wire(150,25,190,25),{el:'C1',x:210,y:25,dir:'h'},wire(230,25,425,25),wire(425,25,425,100),{node:'a',x:150,y:70,labelPos:'b'},{node:'b',x:260,y:70,labelPos:'t'},{node:'out',x:425,y:100,labelPos:'r'}]}}}
