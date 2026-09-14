import {chargeStep} from '@ee-labs/switched'
import {parameterEnsemble} from '@ee-labs/random'
import {complex} from '@ee-labs/network'
const {cadd,cmul,cdiv}=complex
export function transferCharge({cs=1e-12,cf=10e-12,vin=1,prior=0,top=0,bottom=0,sensitive=false,gain=Infinity}={}){
 // In the insensitive transfer phase the sampled positive plate is grounded,
 // and the previously grounded negative plate joins the summing conductor.
 const caps=[{id:'Cs',a:sensitive?'sum':'gnd',b:sensitive?'gnd':'sum',c:cs},{id:'Cf',a:'sum',b:'out',c:cf}],previous={Cs:vin,Cf:-(1+1/gain)*prior}
 if(top){caps.push({id:'CpTop',a:sensitive?'sum':'gnd',b:'gnd',c:top});previous.CpTop=vin}
 if(bottom){caps.push({id:'CpBottom',a:sensitive?'gnd':'sum',b:'gnd',c:bottom});previous.CpBottom=0}
 // During the sample phase Cf remains in feedback. Its old charge includes
 // Vsum=-Vout/A0. Cs resets to the new sampled input independently.
 return chargeStep({capacitors:caps,previous,actuators:['out'],constraints:[{terms:{sum:1,out:1/gain}}]})
}
export function scCoefficients(p={}){const a=transferCharge({...p,vin:0,prior:1}).voltages.out,b=transferCharge({...p,vin:1,prior:0}).voltages.out;return{a,b}}
export function hz({b,a},f,fs){const z=[Math.cos(2*Math.PI*f/fs),Math.sin(2*Math.PI*f/fs)],poly=v=>v.reduce((p,c)=>cadd(cmul(p,z),[c,0]),[0,0]);return cdiv(poly(b),poly(a))}
export function integrator({ratio=.1,fs=1e6,gain=Infinity}={}){const cf=10e-12,cs=ratio*cf,{a,b}=scCoefficients({cs,cf,gain});return{a,b,tf:{b:[0,b],a:[1,-a]},unity:fs/Math.PI*Math.asin(ratio/2),continuous:ratio*fs/(2*Math.PI),dc:Number.isFinite(gain)?b/(1-a):Infinity}}
export function sampleResponse({a,b,input=.1,count=50}={}){let y=0;return Array.from({length:count},(_,n)=>{const p={x:n,y};y=a*y+b*input;return p})}
export function continuousComparison(samplesPerCycle){if(!(samplesPerCycle>2))throw Error('Frequency must be below Nyquist.');const x=Math.PI/samplesPerCycle;return{ratio:x/Math.sin(x),lag:180/samplesPerCycle,allowed:samplesPerCycle>=20}}
export function scTolerance({capTolerance=.2,clockTolerance=.001,seed=42,count=2048}={}){return parameterEnsemble({seed,count,sample:r=>[r.uniformIn(-capTolerance,capTolerance),r.uniformIn(-clockTolerance,clockTolerance)],evaluate:([c,f])=>1/((1+c)*(1+f)),accept:v=>Math.abs(v-1)<=.01})}
export function scBiquad({frequency=50000,q=2,fs=1e6,exact=true}={}){
 if(!(q>.5&&frequency>0&&frequency<fs/2))throw Error('Choose underdamped poles below Nyquist.')
 const w=2*Math.PI*frequency/fs,radius=Math.exp(-w/(2*q)),angle=w*Math.sqrt(1-1/(4*q*q)),targetA1=-2*radius*Math.cos(angle),targetA2=radius*radius,k6=exact?1/targetA2-1:w/q,product=exact?(1+targetA1+targetA2)/targetA2:w*w,k4=Math.sqrt(product),k5=k4,d=1+k6,A=[[1,-k4],[k5/d,(1-product)/d]],B=[k4,product/d],a1=-(2+k6-product)/d,a2=1/d,rad=Math.sqrt(a2),ang=Math.acos(-a1/(2*rad)),re=fs*Math.log(rad),im=fs*ang,wn=Math.hypot(re,im)
 return{k4,k5,k6,product,A,B,tf:{b:[0,product/d,0],a:[1,a1,a2]},radius:rad,angle:ang,frequency:wn/(2*Math.PI),q:wn/(-2*re),targetA1,targetA2,fs}
}
export function biquadResponse(x,count=100){let state=[0,0];return Array.from({length:count},(_,n)=>{const p={x:n,y:state[1]},u=.1;state=x.A.map((row,i)=>row[0]*state[0]+row[1]*state[1]+x.B[i]*u);return p})}
export function signalHandover(tf,fs,id,frequency){const b=[...Array(3-tf.b.length).fill(0),...tf.b],a=[...tf.a,...Array(3-tf.a.length).fill(0)];if(tf.a.length===2){b[0]=tf.b[0];b[1]=tf.b[1];b[2]=0}
 const rate=Math.min(fs,192000),scale=rate/fs;return{app:'signal-lab',label:scale===1?'Inspect the exact sampled filter in Signal Lab':'Inspect a time-scaled copy in Signal Lab',patch:{rate,blocks:[{type:'biquad',params:[...b,a[1],a[2]]}],sources:[{type:'sine',freq:frequency*scale,amp:.1}],zoom:Math.min(rate/2,frequency*scale*4),from:{app:'mixed-signal-lab',id,label:'Exact switched-capacitor filter'}},note:scale===1?'Transfers the computed discrete-time coefficients at the same sample rate.':`Signal Lab accepts clocks up to 192 kHz. This copy keeps every z coefficient and scales the clock from ${fs} Hz to ${rate} Hz, with source frequency scaled by ${scale}. Responses agree versus cycles/sample; physical seconds and hertz are rescaled.`}}

const wire=(...v)=>({wire:v}),ground=(x,y)=>({gnd:[x,y]})
export function phaseDrawing({ratio=.1,vin=.1,phase=1,sensitive=0,top=0,bottom=0,gain=Infinity}={}){return{caption:`${phase?'φ2 transfer':'φ1 sample'}: Cs left terminal is its original positive plate. ${phase?(sensitive?'Left plate joins sum; right plate remains grounded.':'Left plate is grounded; right plate joins sum.'):'Left plate samples Vin; right plate is grounded and isolated from sum.'} Cf stays in feedback. Wires show settled phase connections; clock switches are represented by their selected connections.`,elements:[{type:'V',id:'Vin',value:vin},{type:'C',id:'Cs',value:ratio*10e-12},{type:'C',id:'Cf',value:10e-12},{type:'OPAMP',id:'U1',gain:Number.isFinite(gain)?gain:1e9},...(top?[{type:'C',id:'CpTop',value:top}]:[]),...(bottom?[{type:'C',id:'CpBottom',value:bottom}]:[])],layout:{w:560,h:330,items:[{el:'Cs',x:150,y:180,dir:'h'},...(!phase?[{el:'Vin',x:50,y:220,dir:'v'},ground(50,240),wire(50,200,50,180),wire(50,180,130,180),wire(170,180,200,180),ground(200,180)]:sensitive?[wire(130,180,100,180),wire(100,180,100,80),wire(100,80,300,80),wire(300,80,300,110),wire(170,180,200,180),ground(200,180)]:[wire(130,180,100,180),ground(100,180),wire(170,180,290,180),wire(290,180,290,110),wire(290,110,335,110)]),{el:'U1',x:335,y:122,invertTop:true},wire(335,134,315,134),ground(315,134),wire(373,122,505,122),{node:'out',x:505,y:122,labelPos:'r'},wire(300,110,335,110),{node:'sum',x:300,y:110,labelPos:'t'},wire(300,110,300,40),wire(300,40,380,40),{el:'Cf',x:400,y:40,dir:'h'},wire(420,40,505,40),wire(505,40,505,122),...(top?[wire(130,180,130,240),{el:'CpTop',x:130,y:260,dir:'v'},ground(130,280)]:[]),...(bottom?[wire(170,180,230,180),wire(230,180,230,240),{el:'CpBottom',x:230,y:260,dir:'v'},ground(230,280)]:[])]}}}
