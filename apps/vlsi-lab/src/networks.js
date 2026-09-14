import {transient,pwlTransient} from '@ee-labs/network'
import {CARD,CU,RU,inverter} from './model.js'
export const LIBRARY=[
  {name:'Inverter',n:1,kind:'inv',wn:1,wp:2,cin:3,self:3},
  {name:'NAND2',n:2,kind:'nand',wn:2,wp:2,cin:4,self:6},
  {name:'NAND3',n:3,kind:'nand',wn:3,wp:2,cin:5,self:9},
  {name:'NOR2',n:2,kind:'nor',wn:1,wp:4,cin:5,self:6},
  {name:'NOR3',n:3,kind:'nor',wn:1,wp:6,cin:7,self:9},
  {name:'Transmission-gate MUX',n:2,kind:'mux',wn:2,wp:4,cin:6,self:12},
]
export function crossing(fn,target,hi){let lo=0;const rising=fn(hi)>fn(0);if(rising?fn(hi)<target:fn(hi)>target)return null;for(let i=0;i<48;i++){const m=(lo+hi)/2;if((fn(m)<target)===rising)lo=m;else hi=m}return (lo+hi)/2}
export function rcPath(resistors,caps,{initial=Array(caps.length).fill(0),target=CARD.vdd}={}){
  const net={elements:[{id:'V1',type:'V',nodes:['drive','gnd'],value:target},...resistors.map((value,i)=>({id:`R${i+1}`,type:'R',nodes:[i?`q${i}`:'drive',`q${i+1}`],value})),...caps.map((value,i)=>({id:`C${i+1}`,type:'C',nodes:[`q${i+1}`,'gnd'],value}))]}
  const elmore=resistors.reduce((sum,R,i)=>sum+R*caps.slice(i).reduce((a,b)=>a+b,0),0),tEnd=8*elmore
  const run=transient(net,{tEnd,x0:initial,points:2}),wave=t=>run.at(t).x.at(-1),t50=crossing(wave,(initial.at(-1)+target)/2,tEnd)
  return {net,run,wave,t50,elmore,tEnd}
}
export function gatePath(index,load=3*CU,internal=false,charged=true){
  const g=LIBRARY[index];if(!g||g.kind==='mux')throw Error('The transmission-gate MUX has an internal dynamic input node. Use the two-state linear solve; isolated rail-path extraction is refused.')
  const count=internal?g.n:1,rs=Array(count).fill(RU/count),caps=Array(count).fill(2*CU);caps[count-1]=g.self*CU+load
  const initial=Array(count).fill(charged?CARD.vdd:0);initial[count-1]=CARD.vdd
  return {...rcPath(rs,caps,{initial,target:0}),g}
}
export function wire(R,C,N){return rcPath(Array(N).fill(R/N),Array(N).fill(C/N))}
export function repeatedDelay(R,C,stages,size){
  // Elmore first moments per equally spaced repeater segment; NOT 50% delay.
  const cin=3*CU,cp=3*CU
  return stages*((RU/size)*(cp*size+C/stages+cin*size)+(R/stages)*(C/(2*stages)+cin*size))
}
export function optimumRepeaters(R,C){let best={delay:Infinity};for(let stages=1;stages<=32;stages++)for(let size=1;size<=64;size++){const delay=repeatedDelay(R,C,stages,size);if(delay<best.delay)best={stages,size,delay}}return best}
export function mosCurrent(vgs,vds,beta,vt=.45){if(vgs<=vt||vds<=0)return 0;const over=vgs-vt;return beta*(vds>=over?over*over/2:over*vds-vds*vds/2)}
export function storageTransfer(vin,{ratio=2,wp=2,word=0,bitline=1.8,vdd=1.8}={}){
  const beta=CARD.knPrime*CARD.width/CARD.length
  const balance=out=>mosCurrent(vdd-vin,vdd-out,beta*wp/2)-mosCurrent(vin,out,beta*ratio)
    +(bitline>=out?mosCurrent(word-out,bitline-out,beta):-mosCurrent(word-bitline,out-bitline,beta))
  let lo=0,hi=vdd;for(let i=0;i<60;i++){const m=(lo+hi)/2;if(balance(m)>0)lo=m;else hi=m}return (lo+hi)/2
}
// Rotate with u=(x-y)/sqrt(2), v=(x+y)/sqrt(2). u is monotone along each
// falling VTC, so interpolation has one value and no branch ambiguity.
export function butterfly(options={},count=1001){
  const vdd=options.vdd??1.8,root2=Math.SQRT2
  const points=Array.from({length:count},(_,i)=>{const x=vdd*i/(count-1),y=storageTransfer(x,options);return {x,y,u:(x-y)/root2,v:(x+y)/root2}})
  const interp=u=>{if(u<points[0].u||u>points.at(-1).u)return null;let lo=0,hi=points.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(points[m].u<u)lo=m;else hi=m}const a=points[lo],b=points[hi];return a.v+(b.v-a.v)*(u-a.u)/(b.u-a.u)}
  const extent=Math.min(-points[0].u,points.at(-1).u)
  const gaps=Array.from({length:count},(_,i)=>{const u=-extent+2*extent*i/(count-1),a=interp(u),b=interp(-u);return {u,gap:(a-b)/root2}})
  const upper=Math.max(...gaps.map(g=>g.gap)),lower=-Math.min(...gaps.map(g=>g.gap))
  return {points,gaps,snm:Math.min(upper,lower),upper,lower}
}
export function writeThreshold({ratio=2,wp=2,word=1.8}={}){
  // Continue the initially high storage branch while sweeping its bitline down.
  let q=1.8,qbar=0,flip=null
  const points=[]
  for(let i=0;i<=720;i++){
    const bl=1.8*(1-i/720)
    for(let j=0;j<300;j++){const next=storageTransfer(qbar,{ratio,wp,word,bitline:bl}),other=storageTransfer(next,{ratio,wp,word,bitline:1.8});if(Math.abs(q-next)+Math.abs(qbar-other)<1e-10){q=next;qbar=other;break}q=next;qbar=other}
    if(flip===null&&q<qbar)flip=bl
    points.push({x:bl,y:q})
  }
  return {points,flip,resolution:1.8/720}
}

export function flipFlop({setup=100e-12,hold=400e-12,cap=4*CU,resistance=RU/2,strength=4,points=401}={}) {
  const clock=500e-12,end=1200e-12
  if(setup<0||setup>400e-12||hold<0||hold>600e-12)throw Error('Use setup in 0–400 ps and hold in 0–600 ps.')
  const events=[{t:0,kind:'initial'},{t:clock-setup,kind:'rise'},{t:clock,kind:'clock'},{t:clock+hold,kind:'fall'}]
  const times=[...new Set(events.map(e=>e.t))].sort((a,b)=>a-b)
  let x=[0,1.8,0,1.8,0,1.8],segments=[],regions=null
  const base=inverter().net.elements.filter(e=>e.type==='M')
  for(let i=0;i<times.length;i++){
    const t=times[i],t1=times[i+1]??end;if(t1<=t)continue
    const high=t>=clock,data=t>=clock-setup&&t<clock+hold?1.8:0
    const elements=[{id:'VDD',type:'V',nodes:['vdd','gnd'],value:1.8},{id:'D',type:'V',nodes:['d','gnd'],value:data}]
    for(const prefix of ['m','s']){
      const transparent=prefix==='m'?!high:high,input=prefix==='m'?'d':'mq'
      elements.push({id:`${prefix}InputTG`,type:'SW',nodes:[input,`${prefix}x`],closed:transparent,ron:resistance},
        {id:`${prefix}FeedbackTG`,type:'SW',nodes:[`${prefix}f`,`${prefix}x`],closed:!transparent,ron:resistance})
      for(const [from,to] of [['x','q'],['q','f']])for(const mos of base)elements.push({...mos,id:`${prefix}${to}${mos.id}`,ron:mos.ron/(to==='q'?strength:1),width:mos.width*(to==='q'?strength:1),nodes:[`${prefix}${to}`,`${prefix}${from}`,mos.polarity==='p'?'vdd':'gnd']})
      for(const [node,C] of [['x',cap],['q',(3*strength+3)*CU],['f',3*CU]])elements.push({id:`C${prefix}${node}`,type:'C',nodes:[`${prefix}${node}`,'gnd'],value:C})
    }
    const net={elements},walk=pwlTransient(net,{x0:x,tEnd:t1-t,points,start:regions});regions=walk.regionsAt(t1-t);segments.push({t,t1,walk,net});x=walk.at(t1-t).x
  }
  const at=t=>{const seg=segments.findLast(s=>t>=s.t);return seg.walk.at(Math.min(t-seg.t,seg.t1-seg.t))}
  const wave=t=>at(t).sol.v.sq,captured=x[4]>1.35,clkQ=captured?crossing(t=>wave(clock+t),.9,end-clock):null
  return {segments,at,wave,captured,clock,tEnd:end,clkQ,net:segments.find(s=>s.t===clock)?.net??segments.at(-1).net,final:x}
}

const flipCache=new Map()
export function characterizeFlipFlop(cap=4*CU,resistance=RU/2){
  const key=`${cap}:${resistance}`;if(flipCache.has(key))return flipCache.get(key)
  const reference=flipFlop({cap,resistance,setup:400e-12}),limit=1.1*reference.clkQ
  let lo=0,hi=400e-12
  for(let i=0;i<12;i++){const m=(lo+hi)/2,z=flipFlop({cap,resistance,setup:m});if(z.captured&&z.clkQ<=limit)hi=m;else lo=m}
  const result={reference,setup:hi,setupResolution:hi-lo,limit,hold:0,
    holdNote:'Zero hold in this ideal non-overlapping clock-switch model: the master input disconnects exactly at the capture edge. Real clock overlap and device delays require a separate hold characterization.'}
  if(flipCache.size>=32)flipCache.delete(flipCache.keys().next().value)
  flipCache.set(key,result);return result
}
