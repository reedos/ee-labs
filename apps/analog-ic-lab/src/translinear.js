export const VT=1.380649e-23*300/1.602176634e-19
export function translinear({i1=100e-6,i2=50e-6,i3=20e-6,mismatch=0}={}){const is=1e-15,i4=i1*i3/i2*(1+mismatch),currents=[i1,i2,i3,i4],saturations=[is,is,is,is*(1+mismatch)],voltages=currents.map((i,k)=>VT*Math.log(i/saturations[k]));return{i4,ideal:i1*i3/i2,voltages,residual:voltages[0]+voltages[2]-voltages[1]-voltages[3],error:100*mismatch}}
export const bipolar=v=>Math.tanh(v/(2*VT))
export function mosPair(v,overdrive=.2){const a=Math.abs(v)/overdrive;return a>=Math.SQRT2?Math.sign(v):v/overdrive*Math.sqrt(1-a*a/4)}
export function pairLimits({error=.01,overdrive=.2}={}){let lo=1e-9,hi=5;for(let i=0;i<70;i++){const x=(lo+hi)/2;if(1-Math.tanh(x)/x>error)hi=x;else lo=x}return{bjt:2*VT*(lo+hi)/2,mos:2*overdrive*Math.sqrt(1-(1-error)**2),mosFull:Math.SQRT2*overdrive,bjt99:2*VT*Math.atanh(.99)}}
export function tone(y,cycles){let re=0,im=0;for(let i=0;i<y.length;i++){const a=2*Math.PI*cycles*(i+.5)/y.length;re+=y[i]*Math.cos(a);im+=y[i]*Math.sin(a)}return 2*Math.hypot(re,im)/y.length}
export function gilbert({signal=.001,lo=.2,mismatch=.01,hard=1}={}){
 const count=8192,signalCycles=4,loCycles=40,tail=.001,load=1000,signalGain=tail*load/(2*VT),input=[],carrier=[],output=[]
 for(let n=0;n<count;n++){const t=(n+.5)/count,vi=signal*Math.sin(2*Math.PI*signalCycles*t),vl=lo*Math.sin(2*Math.PI*loCycles*t),m=hard?Math.sign(vl):bipolar(vl),out=tail*load*(bipolar(vi)+mismatch)*m;input.push(vi);carrier.push(m);output.push(out)}
 const lower=tone(output,loCycles-signalCycles),upper=tone(output,loCycles+signalCycles),feed=tone(output,loCycles),conversion=lower/(signalGain*signal)
 return{count,signalCycles,loCycles,tail,load,signalGain,input,carrier,output,lower,upper,feed,conversion,conversionDb:20*Math.log10(conversion),ideal:2/Math.PI,expectedFeed:4/Math.PI*tail*load*mismatch,tones:[9,10,11,29,30,31].map(f=>({x:f,y:tone(output,f*4)}))}
}
export function vga({control=.001,reference=.001,limit=.005}={}){const demand=control/reference,rawDelta=VT*Math.log(demand),realized=Math.min(control,limit)/reference,gainDb=20*Math.log10(realized);return{demand,rawDelta,realized,gainDb,idealDb:20*Math.log10(demand),limited:control>limit,at:v=>Math.min(Math.exp(v/VT),limit/reference)}}
