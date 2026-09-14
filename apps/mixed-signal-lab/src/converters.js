import {chargeStep} from '@ee-labs/switched'
import {rng,parameterEnsemble,sampleVariance} from '@ee-labs/random'
const sum=a=>a.reduce((s,x)=>s+x,0),clip=(x,a,b)=>Math.max(a,Math.min(b,x)),dot=(weights,code)=>sum(weights.map((w,i)=>(code>>i&1)*w))
export function chargeDAC({bits=12,unit=20e-15,code=2730,vref=1,split=0,phase=1}={}){
 code=clip(Math.round(code),0,2**bits-1);const low=Math.floor(bits/2),high=bits-low,bridge=2**low/(2**low-1)*unit
 const capacitors=Array.from({length:bits},(_,i)=>({id:'C'+i,a:split&&i<low?'low':'out',b:'b'+i,c:2**(split&&i>=low?i-low:i)*unit}))
 capacitors.push({id:'Cd',a:split?'low':'out',b:'gnd',c:unit})
 if(split)capacitors.push({id:'Cb',a:'out',b:'low',c:bridge})
 const driven={gnd:0,...Object.fromEntries(Array.from({length:bits},(_,i)=>['b'+i,phase&&(code>>i&1)?vref:0]))},previous=Object.fromEntries(capacitors.map(c=>[c.id,0]))
 const result=chargeStep({capacitors,previous,driven}),charge=node=>sum(capacitors.map(c=>c.c*result.voltage[c.id]*(c.a===node?1:c.b===node?-1:0)))
 return{bits,low,high,bridge,code,capacitors,driven,result,out:result.voltages.out,total:sum(capacitors.map(c=>c.c)),qout:charge('out'),qlow:split?charge('low'):0,ideal:phase?vref*code/2**bits:0}
}
export function sar({bits=12,fraction=.63,clock=20e6,vref=1,weights}={}){
 const L=2**bits,w=weights??Array.from({length:bits},(_,i)=>2**i/L),vin=clip(fraction,0,1)*vref,rows=[];let code=0
 for(let bit=bits-1;bit>=0;bit--){const trial=code+2**bit,test=dot(w,trial)*vref,keep=test<=vin;code=keep?trial:code;rows.push({bit,trial,test,comparison:vin-test,keep,code,residue:vin-dot(w,code)*vref,width:vref*2**bit/L})}
 return{rows,code,vin,dac:dot(w,code)*vref,residue:vin-dot(w,code)*vref,clocks:bits+2,rate:clock/(bits+2)}
}
function drawArray(r,bits,sigma){const caps=Array.from({length:bits},(_,i)=>2**i+sigma*Math.sqrt(2**i)*r.normal()),dummy=1+sigma*r.normal();if(Math.min(...caps,dummy)<=0)throw Error('This Gaussian draw has nonpositive capacitance; choose a physically valid spread.');return{caps,dummy,weights:caps.map(c=>c/(sum(caps)+dummy))}}
export function arrayErrors({bits=12,sigma=.00316,seed=42}={}){
 const x=drawArray(rng(seed),bits,sigma),L=2**bits,full=sum(x.caps),levels=Array.from({length:L},(_,code)=>dot(x.caps,code)/full*(L-1)),inl=levels.map((v,i)=>({x:i,y:v-i})),dnl=levels.slice(1).map((v,i)=>({x:i+1,y:v-levels[i]-1}))
 return{...x,levels,inl,dnl,worstINL:Math.max(...inl.map(p=>Math.abs(p.y))),worstDNL:Math.max(...dnl.map(p=>Math.abs(p.y))),midDNL:dnl[L/2-1].y}
}
export function mismatchStats({bits=12,sigma=.00316,seed=42,count=2048}={}){
 const L=2**bits,run=parameterEnsemble({seed,count,sample:r=>drawArray(r,bits,sigma).caps,evaluate:c=>(L-1)*(c.at(-1)-sum(c.slice(0,-1)))/sum(c)-1,accept:d=>Math.abs(d)<=.5}),variance=sampleVariance(run.values)
 return{...run,sd:Math.sqrt(variance.value),sdCI:variance.ci.map(v=>Math.sqrt(Math.max(0,v))),estimate:sigma*Math.sqrt(L-1),requiredSigma:.5/(3*Math.sqrt(L-1)),area:(3*sigma*Math.sqrt(L-1)/.5)**2}
}
export function flash({bits=6,sigma=.25,seed=42,fraction=.4,encoder=0}={}){
 const L=2**bits,random=rng(seed),thresholds=Array.from({length:L-1},(_,i)=>(i+1+sigma*random.normal())/L),encode=x=>encoder?thresholds.reduce((k,t,i)=>x>=t?i+1:k,0):thresholds.filter(t=>x>=t).length
 // Sort voltage breakpoints only to integrate bins. Comparator identities and
 // encoder order stay unchanged; this does not repair thermometer bubbles.
 const cuts=[0,...thresholds.filter(t=>t>0&&t<1).sort((a,b)=>a-b),1],widths=Array(L).fill(0)
 for(let i=1;i<cuts.length;i++)widths[encode((cuts[i-1]+cuts[i])/2)]+=cuts[i]-cuts[i-1]
 let boundary=0;const inl=widths.slice(0,-1).map((w,i)=>{boundary+=w;return{x:i+1,y:L*boundary-(i+1)}}),dnl=widths.map((w,i)=>({x:i,y:L*w-1})),thermometer=thresholds.map(t=>fraction>=t?1:0)
 return{thresholds,thermometer,encode,code:encode(fraction),ideal:clip(Math.floor(fraction*L),0,L-1),widths,inl,dnl,missing:widths.filter(w=>w===0).length,inversions:thresholds.slice(1).filter((v,i)=>v<thresholds[i]).length,worstINL:Math.max(...inl.map(p=>Math.abs(p.y)))}
}
export function pipeline({stages=10,fraction=.3,offset=.15}={}){
 let residue=fraction,valid=Math.abs(fraction)<=1;const rows=[]
 for(let i=1;i<=stages;i++){const input=residue,d=input<-.25+offset?-1:input>=.25+offset?1:0;residue=2*input-d;valid&&=Math.abs(residue)<=1+1e-12;rows.push({stage:i,input,d,residue,weight:2**-i})}
 const backend=clip(Math.floor((residue+1)*2+1e-12),0,3),L=2**(stages+2),raw=L/2+sum(rows.map(q=>q.d*2**(stages+1-q.stage)))-2+backend,code=clip(raw,0,L-1)
 return{rows,backend,bits:stages+2,code,ideal:clip(Math.floor((fraction+1)*L/2+1e-10),0,L-1),valid,residue,reconstructed:2*code/L-1,guard:Math.abs(offset)<=.25}
}
export function calibrateWeights({bits=12,sigma=.00316,seed=42,measurement=.05,averages=16}={}){
 const x=drawArray(rng(seed),bits,sigma),random=rng(seed+100000),L=2**bits,sd=measurement/Math.sqrt(averages),measured=x.weights.map(w=>w*L+sd*random.normal()),before=[],after=[]
 for(let code=0;code<L;code++){const actual=dot(x.weights,code)*L;before.push({x:code,y:code-actual});after.push({x:code,y:dot(measured,code)-actual})}
 return{...x,measured,sd,before,after,worstBefore:Math.max(...before.map(p=>Math.abs(p.y))),worstAfter:Math.max(...after.map(p=>Math.abs(p.y))),allOn95:1.96*sd*Math.sqrt(bits)}
}
export function dacDrawing(p){const x=chargeDAC(p),wire=(...v)=>({wire:v}),ground=(a,b)=>({gnd:[a,b]}),bitCaps=x.capacitors.filter(c=>c.id!=='Cb').sort((a,b)=>p.split?(a.a==='low'?0:1)-(b.a==='low'?0:1):0),positions=bitCaps.map((c,i)=>({c,x:70+95*i,y:c.a==='low'?200:40})),width=180+95*bitCaps.length
 const items=positions.flatMap(({c,x:a,y})=>[wire(a,y,a,y+30),{el:c.id,x:a,y:y+50,dir:'v'},wire(a,y+70,a,y+90),...(c.b==='gnd'?[ground(a,y+90)]:[{node:`b${c.id.slice(1)}=${x.driven[c.b]?'Vref':'0'}`,x:a,y:y+90,labelPos:'b'}])])
 for(const node of ['out',...(p.split?['low']:[])]){const ps=positions.filter(v=>v.c.a===node);for(let i=1;i<ps.length;i++)items.push(wire(ps[i-1].x,ps[i-1].y,ps[i].x,ps[i].y));items.push({node,x:ps[0].x,y:ps[0].y,labelPos:'t'})}
 if(p.split){const lo=positions.find(v=>v.c.a==='low'),hi=positions.find(v=>v.c.a==='out'),bx=width-55;items.push(wire(hi.x,40,bx,40),wire(bx,40,bx,105),{el:'Cb',x:bx,y:125,dir:'v'},wire(bx,145,bx,180),wire(bx,180,lo.x-30,180),wire(lo.x-30,180,lo.x-30,200),wire(lo.x-30,200,lo.x,200))}
 return{elements:x.capacitors.map(c=>({type:'C',id:c.id,value:c.c})),layout:{w:width,h:p.split?335:225,items},caption:`${p.phase?'Code phase: bottom plates connect to the indicated reference or ground. Both floating top-node charges remain zero.':'Reset phase: all plates start at zero voltage before the top node is released.'} ${p.split?'Split array: Cd is on the low bank only; Cb links the two floating top conductors.':'Binary array: Cd is the one-unit dummy.'} The drawing shows settled switch connections.`}
}
