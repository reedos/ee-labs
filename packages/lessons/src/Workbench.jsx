import React, {useEffect,useMemo,useState,useRef} from 'react'
import {LabNav,LessonNav,NumField,ZPlaneCanvas,SmithCanvas,Schematic,buildLink,siblingUrl} from '@ee-labs/ui'
import {Formula} from '@ee-labs/explain'
import {defaults,evaluate,fmt,grade} from './model.js'
import './style.css'

function Plot({data}) {
  if(data.kind==='zplane') return <figure className="lesson-plot"><figcaption>{data.label}</figcaption><div className="lesson-zplane"><ZPlaneCanvas {...data}/></div><p>Crosses are poles; circles are zeros. Poles strictly inside the unit circle give a decaying zero-input response.</p></figure>
  if(data.kind==='waterfall') return <WaterfallPlot data={data}/>
  if(data.polar) return <PolarPlot data={data}/>
  const traces=(data.traces??[{label:data.label,points:data.points}]).map(t=>({...t,points:t.points.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&(!data.logX||p.x>0)&&(!data.logY||p.y>0))}))
  const points=traces.flatMap(t=>t.points)
  if(!points.length) return <p>No finite values in this range.</p>
  const xValue=x=>data.logX?Math.log10(x):x
  const yValue=y=>data.logY?Math.log10(y):y
  const xs=points.map(p=>xValue(p.x)),ys=points.map(p=>yValue(p.y)),x0=Math.min(...xs),x1=Math.max(...xs),low=Math.min(...ys),high=Math.max(...ys),pad=high===low?Math.max(Math.abs(high)*.05,.01):0,y0=low-pad,y1=high+pad
  const px=x=>65+590*(xValue(x)-x0)/(x1-x0||1),py=y=>230-195*(yValue(y)-y0)/(y1-y0||1)
  const colors=['var(--accent)','var(--blue)','#cc8fff','#e7b95f']
  return <figure className="lesson-plot"><figcaption>{data.label}</figcaption><svg viewBox="0 0 700 290" role="img" aria-label={`${data.label}; horizontal axis ${data.xLabel}; vertical axis ${data.yLabel}`}>
    {[0,.25,.5,.75,1].map(t=><g key={t}><path d={`M65 ${35+195*t}H655`} stroke="var(--line)"/><text x="60" y={39+195*t} textAnchor="end">{Number((data.logY?10**(y1-(y1-y0)*t):y1-(y1-y0)*t).toPrecision(4))}</text><text x={65+590*t} y="248" textAnchor="middle">{Number((data.logX?10**(x0+(x1-x0)*t):x0+(x1-x0)*t).toPrecision(4))}</text></g>)}
    {data.stems?traces.map((trace,i)=><g key={i}>{trace.points.map((p,j)=><g key={j}><path d={`M${px(p.x)},230V${py(p.y)}`} stroke={colors[i%colors.length]} strokeWidth="2"/><circle cx={px(p.x)} cy={py(p.y)} r="3" fill={colors[i%colors.length]}/></g>)}</g>):traces.map((trace,i)=><path key={i} d={`M${trace.points.map(p=>`${px(p.x)},${py(p.y)}`).join('L')}`} fill="none" stroke={colors[i%colors.length]} strokeWidth="2.5" strokeDasharray={trace.dashed?'6 4':undefined}/>)}
    <text x="360" y="277" textAnchor="middle">{data.xLabel}</text><text x="65" y="18">{data.yLabel}</text>
  </svg>{traces.length>1&&<ul className="lesson-plot-key">{traces.map((trace,i)=><li key={i} style={{color:colors[i%colors.length]}}>{trace.label}</li>)}</ul>}</figure>
}
function WaterfallPlot({data}) {
 const values=[0,...data.rows.map(row=>row[2])],lo=Math.min(...values),hi=Math.max(...values),px=v=>190+440*(v-lo)/(hi-lo||1),height=70+data.rows.length*45
 return <figure className="lesson-plot"><figcaption>{data.label}</figcaption><div className="lesson-waterfall-scroll"><svg viewBox={`0 0 740 ${height}`} role="img" aria-label="Link-budget waterfall: signed gains and losses connect successive power levels in dBm.">
 {[0,.25,.5,.75,1].map(t=><g key={t}><path d={`M${190+440*t} 20V${height-35}`} stroke="var(--line)"/><text x={190+440*t} y={height-14} textAnchor="middle">{Number((lo+(hi-lo)*t).toPrecision(4))}</text></g>)}
 {data.rows.map(([name,delta,end],i)=>{const start=i?data.rows[i-1][2]:0,y=30+45*i;return <g key={name}><text x="180" y={y+16} textAnchor="end">{name}</text><rect x={Math.min(px(start),px(end))} y={y} width={Math.max(2,Math.abs(px(end)-px(start)))} height="24" fill={delta<0?'#ed8297':'var(--accent)'}/><text x="650" y={y+16}>{Number(end.toPrecision(5))} dBm</text><title>{name}: {delta} {i?'dB':'dBm'}, running power {end} dBm</title></g>})}
 </svg></div></figure>
}
function PolarPlot({data}) {
  // A meridional cut: mirror the axisymmetric 0..180° power pattern to 360°.
  const half=data.points.filter(p=>Number.isFinite(p.y)),points=[...half,...half.slice().reverse().map(p=>({x:360-p.x,y:p.y}))]
  const at=(deg,r)=>[180+130*r*Math.sin(deg*Math.PI/180),170-130*r*Math.cos(deg*Math.PI/180)]
  return <figure className="lesson-plot lesson-polar"><figcaption>{data.label} — normalized power</figcaption><svg viewBox="0 0 360 350" role="img" aria-label="Polar power pattern. Zero degrees is up along the antenna axis; 90 degrees is broadside to the right.">
    {[.25,.5,.75,1].map(v=><g key={v}><circle cx="180" cy="170" r={130*v} fill="none" stroke="var(--line)"/><text x="184" y={168-130*v}>{v}</text></g>)}
    {[0,45,90,135,180,225,270,315].map(deg=>{const [x,y]=at(deg,1),[tx,ty]=at(deg,1.17);return <g key={deg}><path d={`M180 170L${x} ${y}`} stroke="var(--line)"/><text x={tx} y={ty+4} textAnchor="middle">{deg}°</text></g>})}
    <path d={`M${points.map(p=>at(p.x,p.y).join(',')).join('L')}Z`} fill="none" stroke="var(--accent)" strokeWidth="2.5"/>
  </svg><p>Radius is power relative to the strongest direction. Angle is measured from the antenna axis.</p></figure>
}
function CircuitFigure({data}) {
 const dialog=useRef(null)
 return <figure className="lesson-schematic"><Schematic elements={data.elements} layout={data.layout}/><figcaption>{data.caption}</figcaption><button onClick={()=>dialog.current.showModal()}>Enlarge circuit</button><dialog ref={dialog} className="lesson-drawing-dialog" aria-label="Enlarged circuit"><button autoFocus onClick={()=>dialog.current.close()}>Close circuit</button><p className="lesson-drawing-hint">Scroll sideways to inspect the enlarged diagram.</p><div className="lesson-drawing-scroll" tabIndex={0} role="region" aria-label="Scrollable enlarged diagram"><Schematic elements={data.elements} layout={data.layout}/></div><p>{data.caption}</p></dialog></figure>
}
function Practice({problem}) {
  const [answer,setAnswer]=useState(''),[feedback,setFeedback]=useState(''),[reveal,setReveal]=useState(false)
  return <section className="lesson-practice"><h3>Predict, then check</h3><p>{problem.question}</p><form onSubmit={e=>{e.preventDefault();setFeedback(grade(answer,problem.answer))}}><label>Your answer ({problem.unit||'dimensionless'})<input inputMode="decimal" value={answer} onChange={e=>{setAnswer(e.target.value);setFeedback('')}} /></label><button>Check answer</button></form><p role="status">{feedback}</p><details><summary>Hint</summary><p>{problem.hint}</p></details><button onClick={()=>setReveal(!reveal)}>{reveal?'Hide':'Reveal'} answer</button>{reveal&&<p>{fmt(problem.answer)} {problem.unit}. {problem.reason}</p>}</section>
}
export function CurriculumApp({lab,title,foundation:Foundation,foundations=[],lessons}) {
  const catalog=useMemo(()=>[...foundations,...lessons].sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true})),[foundations,lessons])
  const valid=id=>catalog.some(e=>e.id===id)
  const [id,setId]=useState(()=>valid(location.hash.slice(1))?location.hash.slice(1):catalog[0].id)
  const navigate=next=>{if(valid(next)){history.replaceState(null,'',`#${next}`);setId(next)}}
  useEffect(()=>{const onHash=()=>{if(valid(location.hash.slice(1)))setId(location.hash.slice(1))};addEventListener('hashchange',onHash);return()=>removeEventListener('hashchange',onHash)},[catalog])
  const lesson=lessons.find(e=>e.id===id)
  return lesson ? <Workbench key={id} {...{lab,title,lesson,catalog,navigate}}/> : <Foundation key={id} initialLesson={id} initialId={id} catalog={catalog} onNavigate={navigate}/>
}
export default function Workbench({lab,title,lesson,catalog,navigate}) {
  const [p,setP]=useState(()=>defaults(lesson)),[view,setView]=useState('Start here')
  const outcome=useMemo(()=>{try{return {result:evaluate(lesson,p)}}catch(e){return {error:e.message}}},[lesson,p])
  const r=outcome.result,index=catalog.findIndex(e=>e.id===lesson.id)
  const reset=()=>setP(defaults(lesson))
  const knobField=k=>k.options?<label className="lesson-choice" key={k.key}>{k.label}<select aria-label={k.label} value={p[k.key]} onChange={e=>setP({...p,[k.key]:Number(e.target.value)})}>{k.options.map((name,i)=><option key={i} value={i}>{name}</option>)}</select></label>:<div key={k.key}><NumField {...k} value={p[k.key]} eng={k.eng??Boolean(k.unit)} format={k.format??(!k.unit?(v=>v.toLocaleString('en-US',{useGrouping:false,maximumSignificantDigits:6})):undefined)} onChange={v=>setP({...p,[k.key]:v})}/></div>
  const knobGroups=[...new Set(lesson.knobs.map(k=>k.group).filter(Boolean))]
  return <div className="lesson-workbench">
    <aside className="lesson-controls"><LabNav current={lab} currentLabel={title.replace(' Lab','')}/><h1>{title}</h1><p>{lesson.group}</p>
      <LessonNav index={index} total={catalog.length} noun="experiment" onPrev={()=>index>0&&navigate(catalog[index-1].id)} onNext={()=>index<catalog.length-1&&navigate(catalog[index+1].id)} onReset={reset} dirty={JSON.stringify(p)!==JSON.stringify(defaults(lesson))}/>
      <label className="lesson-select">Experiment<select aria-label="Experiment" value={lesson.id} onChange={e=>navigate(e.target.value)}>{catalog.map(e=><option key={e.id} value={e.id}>{e.id.toUpperCase()}. {e.name}</option>)}</select></label>
      <h2>Settings</h2>{lesson.knobs.filter(k=>!k.group).map(knobField)}{knobGroups.map(group=><details className="lesson-knob-group" key={group}><summary>{group} settings</summary>{lesson.knobs.filter(k=>k.group===group).map(knobField)}</details>)}
      <h2>Try</h2><p>{lesson.try}</p><button onClick={reset}>Reset settings</button>
    </aside>
    <main className="lesson-main"><header className="lesson-heading"><span>{lesson.id.toUpperCase()}</span><h2>{lesson.name}</h2></header>
      <nav className="lesson-tabs" aria-label="Analysis views">{['Start here','Worked math','Explore','Practice'].map(v=><button key={v} aria-pressed={view===v} onClick={()=>setView(v)}>{v}</button>)}</nav>
      <div className="lesson-body">{outcome.error?<section role="alert"><h3>Model boundary</h3><p>{outcome.error}</p><button onClick={reset}>Reset settings</button></section>:<>
        {r.schematic&&view!=='Practice'&&<CircuitFigure data={r.schematic}/>}
        {view==='Start here'&&<><p className="lesson-question">{lesson.question}</p><p>{lesson.intro}</p><h3>Follow the signal</h3><ol className="lesson-flow">{lesson.flow.map((s,i)=><li key={i}>{s}</li>)}</ol><h3>Before the equations</h3><dl className="lesson-definitions">{lesson.symbols.map(([symbol,meaning])=><React.Fragment key={symbol}><dt><Formula>{symbol}</Formula></dt><dd>{meaning}</dd></React.Fragment>)}</dl><h3>Choose an analysis route</h3><p>{lesson.route}</p><h3>Model limits</h3><p>{lesson.limits}</p>{lesson.sources?.length>0&&<p>References: {lesson.sources.map(([label,url])=><a key={url} href={url} target="_blank" rel="noreferrer">{label} </a>)}</p>}</>}
        {view==='Worked math'&&<><p>{lesson.question}</p>{r.steps.map((s,i)=><section className="lesson-step" key={i}><h3>{i+1}. {s.title}</h3><p>{s.explanation}</p><div className="math-formula"><Formula>{s.tex}</Formula></div>{s.substitution&&<div className="math-formula"><Formula>{s.substitution}</Formula></div>}</section>)}<h3>Read the result</h3><p>{r.conclusion}</p>{r.check&&<p className="lesson-check">Independent check: {r.check}</p>}</>}
        {view==='Explore'&&<><p>{r.plotNote}</p>{r.plots?.map((plot,i)=>plot.kind==='smith'?<SmithCanvas key={i} {...plot}/>:<Plot key={i} data={plot}/>)}{r.table&&<div className="lesson-table-wrap"><table><thead><tr>{r.table.headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{r.table.rows.map((row,i)=><tr key={i}>{row.map((v,j)=><td key={j}>{typeof v==='number'?fmt(v):v}</td>)}</tr>)}</tbody></table></div>}<h3>What changed?</h3><p>{r.conclusion}</p></>}
        {view==='Practice'&&<Practice key={JSON.stringify(p)} problem={r.practice}/>}
        {view==='Explore'&&(r.handovers??(r.handover?[r.handover]:[])).map((handover,i)=><section className="lesson-handover" key={i}><h3>Continue exploring</h3><p>{handover.note}</p>{siblingUrl(handover.app,buildLink(handover.patch))?<a href={siblingUrl(handover.app,buildLink(handover.patch))}>{handover.label}</a>:<p>Open the labs through the assembled site to use this handover.</p>}</section>)}{view!=='Practice'&&<div className="lesson-results" aria-label="Calculated results">{r.readings.map((v,i)=><div key={i}><span>{v.label}</span><strong>{fmt(v.value)} {v.unit}</strong></div>)}</div>}
      </>}</div>
    </main>
  </div>
}
