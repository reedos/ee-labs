import {rng,periodogram} from '@ee-labs/random'
export const RECORD=16384,TONE_BIN=13
const mean=xs=>xs.reduce((s,v)=>s+v,0)/xs.length,db=x=>10*Math.log10(Math.max(1e-30,x))
export function spectrum(values,window='none'){const x=periodogram(values,1,{window,removeMean:false});return {...x,powers:Array.from(x.psd,p=>p*x.df)}}
export function bandPower(values,osr,window='none'){const x=spectrum(values,window),last=Math.floor(values.length/(2*osr));return {power:x.powers.slice(0,last+1).reduce((a,b)=>a+b,0),last,...x}}
export function quantizationRecord({bits=4,kind=0,seed=42,n=RECORD}={}){
 const random=rng(seed),noise=rng(seed+104729),delta=2/2**bits,input=[],output=[],error=[],white=[]
 for(let i=0;i<n;i++){const u=kind?2*random.uniform()-1:1.8*(i/n)-.9,q=-1+(Math.min(2**bits-1,Math.max(0,Math.floor((u+1)/delta)))+.5)*delta;input.push(u);output.push(q);error.push(q-u);white.push(delta*(noise.uniform()-.5))}
 const avg=mean(error),variance=mean(error.map(v=>(v-avg)**2)),lag=error.slice(1).reduce((s,v,i)=>s+(v-avg)*(error[i]-avg),0)/((n-1)*variance)
 return {input,output,error,white,delta,n,modelPower:delta*delta/12,power:mean(error.map(v=>v*v)),whitePower:mean(white.map(v=>v*v)),lag}
}
export const ntfPower=(order,f)=>(2*Math.sin(Math.PI*f))**(2*order)
export function shapedPower(order,osr,delta=2){
 const top=.5/osr,m=1024,h=top/m;let sum=0
 for(let i=0;i<=m;i++)sum+=(i===0||i===m?1:i%2?4:2)*ntfPower(order,i*h)
 const exact=delta*delta/6*sum*h/3,approx=delta*delta/12*Math.PI**(2*order)/((2*order+1)*osr**(2*order+1))
 return {exact,approx,gainPerDoubling:10*Math.log10(2)*(2*order+1)}
}
// Explicit CIFB timing, with both feedback paths using the PREVIOUS output.
// First order: x1[n]=x1[n-1]+u[n]-y[n-1], y[n]=Q(x1[n]).
// Second order additionally x2[n]=x2[n-1]+x1[n]-y[n-1], y[n]=Q(x2[n]).
export function modulator({order=2,amplitude=.5,dc=false,n=RECORD,bin=TONE_BIN,warm=true,limit=100}={}){
 let x1=0,x2=0,previous=0,maxState=0,stop=null,run=0,longest=0
 const input=[],output=[],state1=[],state2=[],error=[],quantizerError=[],rows=[]
 for(let i=warm?-n:0;i<n;i++){
  const u=dc?amplitude:amplitude*Math.sin(2*Math.PI*bin*i/n),before1=x1,before2=x2,old=previous
  x1+=u-old;if(order===2)x2+=x1-old
  const v=order===1?x1:x2,y=v>=0?1:-1,e=y-v
  maxState=Math.max(maxState,Math.abs(x1),order===2?Math.abs(x2):0)
  if(i>=0){input.push(u);output.push(y);state1.push(x1);state2.push(x2);error.push(y-u);quantizerError.push(e);if(rows.length<8)rows.push({n:i,u,before1,before2,old,x1,x2,y,e});run=y===old?run+1:1;longest=Math.max(longest,run)}
  previous=y
  if(maxState>limit){stop=i;break}
 }
 return {order,amplitude,input,output,state1,state2,error,quantizerError,rows,maxState,stop,longest,complete:stop===null,n,limit,mean:output.length?mean(output):0}
}
export function linearNoise({order=2,seed=42,n=RECORD}={}){const random=rng(seed+209759),values=[];let e1=2*random.uniform()-1,e2=2*random.uniform()-1;for(let i=0;i<n;i++){const e=2*random.uniform()-1;values.push(order===0?e:order===1?e-e1:e-2*e1+e2);e2=e1;e1=e}return values}
export function noiseExperiment({order=2,amplitude=.5,osr=64,seed=42}={}){
 const actual=modulator({order,amplitude}),linear=linearNoise({order,seed}),model=shapedPower(order,osr),measured=actual.complete?bandPower(actual.error,osr,'hann'):null,white=bandPower(linear,osr,'hann'),signal=amplitude**2/2
 return {actual,linear,model,measured,white,signal,predicted:db(signal/model.exact),measuredRatio:measured?db(signal/measured.power):null,linearRatio:db(signal/white.power)}
}
export function sincGain(f,ratio,stages=3){if(Math.abs(f)<1e-15)return 1;return Math.abs(Math.sin(Math.PI*ratio*f)/(ratio*Math.sin(Math.PI*f)))**stages}
export function movingAverage(values,ratio){const result=[],ring=Array(ratio).fill(0);let sum=0;for(let i=0;i<values.length;i++){sum+=values[i]-ring[i%ratio];ring[i%ratio]=values[i];result.push(sum/ratio)}return result}
export function sincDecimate(values,ratio,stages=3){let filtered=Array.from(values);for(let j=0;j<stages;j++)filtered=movingAverage(filtered,ratio);return {filtered,output:filtered.filter((_,i)=>(i+1)%ratio===0)}}
export function decimation({ratio=64,edge=.2,clock=1e6,correct=1}={}){
 const target=sincGain(edge/ratio,ratio),a=(1/target-1)/(2*(1-Math.cos(2*Math.PI*edge))),correction=f=>1+2*a*(1-Math.cos(2*Math.PI*ratio*f)),gain=f=>sincGain(f,ratio)*(correct?correction(f):1)
 const inputLength=ratio*512,bin=13,amplitude=.5,actual=modulator({order:2,amplitude,n:inputLength,bin,warm:false}),filtered=sincDecimate(actual.output,ratio)
 const output=filtered.output.map((v,i)=>correct?(-a*(filtered.output[i-2]??0)+(1+2*a)*(filtered.output[i-1]??0)-a*v):v)
 const frequency=bin/inputLength,delay=3*(ratio-1)/2+(correct?ratio:0),expected=output.map((_,i)=>amplitude*gain(frequency)*Math.sin(2*Math.PI*frequency*((i+1)*ratio-1-delay))),start=8
 const rms=Math.sqrt(mean(output.slice(start).map((v,i)=>(v-expected[i+start])**2)))
 return {ratio,edge,clock,correct,target,a,correction,gain,actual,filtered,output,expected,frequency,delay,rms,rate:clock/ratio,firstNull:clock/ratio,edgeLoss:-20*Math.log10(target),nyquistLoss:-20*Math.log10(sincGain(.5/ratio,ratio)),halfEdgeGain:gain(edge/(2*ratio)),spanGain:gain(edge/ratio)}
}
