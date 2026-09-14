import {describe,it,expect} from 'vitest'
import katex from 'katex'
import {defaults,evaluate} from '@ee-labs/lessons/model'
import {EXTENDED} from './extended.js'
import * as F from '@ee-labs/fields'
const result=(id,override={})=>{const l=EXTENDED.find(l=>l.id===id);return evaluate(l,{...defaults(l),...override})}
describe('Fields I–L learning calculations',()=>{
  it('covers all 17 planned lessons with finite readings and renderable math at defaults and every knob endpoint',()=>{
    expect(EXTENDED.map(l=>l.id)).toEqual(['i1','i2','i3','i4','i5','i6','i7','j1','j2','k1','k2','k3','l1','l2','l3','l4','l5'])
    for(const l of EXTENDED){
      const d=defaults(l)
      for(const p of [d,...l.knobs.flatMap(k=>[k.min,k.max].map(v=>({...d,[k.key]:v})))] ){
        const x=evaluate(l,p)
        expect(x.steps.length).toBeGreaterThanOrEqual(3)
        expect(Number.isFinite(x.practice.answer),`${l.id}: practice`).toBe(true)
        x.readings.forEach(r=>expect(Number.isFinite(r.value),`${l.id}: ${r.label}`).toBe(true))
        for(const tex of [...l.symbols.map(a=>a[0]),...x.steps.flatMap(s=>[s.tex,s.substitution].filter(Boolean))]){
          expect(tex).not.toMatch(/[\t\r\n]/)
          expect(()=>katex.renderToString(tex,{throwOnError:true})).not.toThrow()
        }
        for(const plot of x.plots) for(const trace of plot.traces??(plot.points&&plot.kind!=='smith'?[plot]:[])) {
          for(const p of trace.points) expect(Number.isFinite(p.x)&&Number.isFinite(p.y),`${l.id}: plot`).toBe(true)
        }
      }
    }
  })
  it('uses physical distance in the bounce ladder and only round-trip-spaced load arrivals',()=>{
    const x=result('i4'),rows=x.table.rows
    expect(rows[0]).toEqual([1,10,5])
    expect(rows[1][1]).toBeCloseTo(30,10)
    expect(rows[1][2]).toBeCloseTo(25/6,10)
    const trace=x.plots[1].traces
    expect(trace[0].points).toEqual([{x:0,y:0},{x:2,y:10}])
    expect(trace[1].points).toEqual([{x:2,y:10},{x:0,y:20}])
    const matched=result('i4',{Rs:50})
    expect(new Set(matched.table.rows.map(r=>r[2])).size).toBe(1)
  })
  it('checks geometric coax scaling and line transformations',()=>{
    const a=F.lineFromGeometry({kind:'coax',a:.00045,b:.001475,epsr:2.25,length:1})
    const b=F.lineFromGeometry({kind:'coax',a:.0009,b:.00295,epsr:2.25,length:1})
    expect(a.Z0).toBeCloseTo(b.Z0,10)
    expect(a.vp/F.C0).toBeCloseTo(2/3,12)
    expect(result('i5').readings[0].value).toBeCloseTo(25,10)
    expect(result('i5',{fraction:.5}).readings[0].value).toBeCloseTo(100,10)
    expect(result('i5',{open:1,fraction:.125}).readings[1].value).toBeCloseTo(-50,10)
    expect(result('i6',{reactance:10}).conclusion).toMatch(/declined/)
  })
  it('checks waveguide limits and guarded cavity estimates',()=>{
    const g={a:.02286,b:.01016},m=F.modeAt(g,10e9)
    expect(m.vp*m.vg/F.C0**2).toBeCloseTo(1,12)
    expect(result('k1').readings[2].value).toBeCloseTo(772.25824,4)
    const low=result('k3',{sigma:1000})
    expect(low.readings.some(r=>r.label==='Unloaded Q')).toBe(false)
    const q=result('k3').readings.find(r=>r.label==='Unloaded Q').value
    const q2=result('k3',{sigma:5.8e7/4}).readings.find(r=>r.label==='Unloaded Q').value
    expect(q/q2).toBeCloseTo(2,10)
  })
  it('checks antenna scaling, steering convention and far-field refusal',()=>{
    expect(result('l1',{u:.02}).readings[1].value/result('l1').readings[1].value).toBeCloseTo(4,10)
    expect(result('l3',{eff:45}).readings[1].value-result('l3',{eff:90}).readings[1].value).toBeCloseTo(-10*Math.log10(2),10)
    expect(result('l4',{phase:90}).readings.find(r=>r.label==='Order-zero beam').value).toBeCloseTo(120,8)
    expect(result('l4',{phase:-90}).readings.find(r=>r.label==='Order-zero beam').value).toBeCloseTo(60,8)
    const power=x=>x.readings.find(r=>r.label==='Received power')?.value
    expect(power(result('l5',{distance:2000}))-power(result('l5'))).toBeCloseTo(-20*Math.log10(2),10)
    expect(power(result('l5',{distance:.1}))).toBeUndefined()
  })
})
