import {complex} from '@ee-labs/network'
import {Phi,phi,qFunction} from '@ee-labs/random'
import {matching} from './models.js'
const {cdiv,cabs}=complex
export function extraElement({gm=200e-6,rd=20000,rs=10000,cap=20e-15}={}){
 const gain=-gm*rd,zd=rs+rd+gm*rs*rd,zn=-1/gm,tau=cap*zd,pole=1/(2*Math.PI*tau),zero=gm/(2*Math.PI*cap),miller=1/(2*Math.PI*cap*rs*(1+gm*rd)),error=miller/pole-1,feedthrough=rd/zd
 const at=f=>cdiv([gain,2*Math.PI*f*cap*rd],[1,2*Math.PI*f*tau]),millerAt=f=>cdiv([gain,0],[1,f/miller]),relative=f=>cdiv([1,-f/zero],[1,f/pole]),phase=f=>-180-(Math.atan(f/zero)+Math.atan(f/pole))*180/Math.PI
 const step=(t,input=.001)=>({state:(1+gm*rd)*input*(-Math.expm1(-t/tau)),output:input*(gain+(feedthrough-gain)*Math.exp(-t/tau))})
 const net={elements:[{type:'V',id:'V1',nodes:['in','gnd'],value:1},{type:'R',id:'Rs',nodes:['in','gate'],value:rs},{type:'R',id:'Rd',nodes:['out','gnd'],value:rd},{type:'VCCS',id:'Gm',nodes:['out','gnd'],ctrl:['gate','gnd'],gain:gm},{type:'C',id:'Cgd',nodes:['gate','out'],value:cap}]}
 return{gm,rd,rs,cap,gain,zd,zn,tau,pole,zero,miller,error,feedthrough,at,millerAt,relative,phase,step,net,db:f=>20*Math.log10(cabs(relative(f))),millerOK:error<=.1,cutoff:zero>Math.SQRT2*pole?1/Math.sqrt(1/pole**2-2/zero**2):null}
}
export function extraDrawing(p={}){const x=extraElement(p),wire=(...v)=>({wire:v}),gnd=(x,y)=>({gnd:[x,y]});return{elements:x.net.elements,caption:'Common-source small-signal equivalent. Gm draws gm·vg from out to ground; its control is gate relative to ground. Rd includes any parallel output resistance. Cgd is the only capacitor. V1 is normalized to 1 V for transfer calculations; the step plot uses 1 mV. Supplies, bias, Cgs, Cdb and device high-frequency effects are omitted.',layout:{w:680,h:250,items:[{el:'V1',x:55,y:155,dir:'v'},gnd(55,175),wire(55,135,55,85),wire(55,85,135,85),{el:'Rs',x:155,y:85,dir:'h'},wire(175,85,265,85),{node:'gate',x:265,y:85,side:'b'},wire(265,85,265,35),wire(265,35,325,35),{el:'Cgd',x:345,y:35,dir:'h'},wire(365,35,550,35),wire(550,35,550,85),{node:'out',x:550,y:85,side:'b'},wire(440,85,595,85),wire(440,85,440,135),{el:'Gm',x:440,y:155,dir:'v'},gnd(440,175),wire(595,85,595,135),{el:'Rd',x:595,y:155,dir:'v'},gnd(595,175)]}}}
export function trimCode(offset,{bits=5,range=.008}={}){const count=2**bits,delta=2*range/count,code=Math.max(0,Math.min(count-1,Math.floor((offset+range)/delta))),correction=-range+(code+.5)*delta;return{count,delta,code,correction,residual:offset-correction,outside:Math.abs(offset)>range}}
// Exact Gaussian bin moments, including the two unbounded saturation cells.
const cdf=z=>z===Infinity?1:z===-Infinity?0:Phi(z),tail=z=>z===Infinity?0:z===-Infinity?1:qFunction(z)
function cellMoment(a,b,c,sigma){const za=a/sigma,zb=b/sigma,pa=Number.isFinite(za)?phi(za):0,pb=Number.isFinite(zb)?phi(zb):0,P=za>=0?tail(za)-tail(zb):cdf(zb)-cdf(za),M1=sigma*(pa-pb),M2=sigma*sigma*(P+(Number.isFinite(za)?za*pa:0)-(Number.isFinite(zb)?zb*pb:0));return{prob:P,first:M1,second:M2,power:Math.max(0,M2-2*c*M1+c*c*P)}}
export function trimPopulation({area=2.5,gmid=10,bits=5,range=.008}={}){
 const sigma=matching({area,gmid}).offset,{count,delta}=trimCode(0,{bits,range});let power=0,insidePower=0;const cells=[]
 for(let k=0;k<count;k++){const center=-range+(k+.5)*delta,a=k===0?-Infinity:-range+k*delta,b=k===count-1?Infinity:-range+(k+1)*delta,m=cellMoment(a,b,center,sigma),bounded=cellMoment(Math.max(a,-range),Math.min(b,range),center,sigma);power+=m.power;insidePower+=bounded.power;cells.push({code:k,center,a,b,prob:m.prob,first:m.first,second:m.second,power:m.power})}
 const outside=2*qFunction(range/sigma),inside=1-outside,uniform=delta/Math.sqrt(12),inRms=Math.sqrt(insidePower/inside),rms=Math.sqrt(power),approxError=Math.abs(uniform/inRms-1),window=Math.min(range,4*delta),points=[]
 for(const cell of cells){const a=Math.max(-window,cell.a),b=Math.min(window,cell.b);if(b>a)points.push({x:a*1000,y:(a-cell.center)*1e6},{x:b*1000,y:(b-cell.center)*1e6})}
 return{sigma,count,delta,cells,power,insidePower,outside,inside,uniform,inRms,rms,approxError,approxOK:approxError<=.05,points}
}
export function calibration({offset=.0026,drift=5e-6,tempco=100e-6,temperature=85,measurement=0,bits=5,range=.008}={}){
 const reference=25,trim=trimCode(offset+measurement,{bits,range}),slope=drift-trim.correction*tempco,at=T=>{const dt=T-reference,before=offset+drift*dt,correction=trim.correction*(1+tempco*dt);return{before,correction,after:before-correction}},selected=at(temperature),baseline=at(reference),ends=[at(-40).after,at(125).after],worst=Math.max(...ends.map(Math.abs)),limit=.0005
 return{reference,trim,slope,at,selected,baseline,ends,worst,limit,passes:worst<=limit,increment:slope*(temperature-reference)}
}
