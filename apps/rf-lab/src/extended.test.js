import {it,expect} from 'vitest'
import katex from 'katex'
import {defaults,evaluate} from '@ee-labs/lessons/model'
import {EXTENDED} from './extended.js'
it('renders all RF E–H math and finite default/end-point results or a named physical boundary',()=>{
 expect(EXTENDED.map(l=>l.id)).toEqual(['e1','e2','e3','e4','e5','f1','f2','f3','f4','g1','g2','g3','g4','h1','h2','h3'])
 for(const l of EXTENDED)for(const p of [defaults(l),...l.knobs.flatMap(k=>[k.min,k.max].map(v=>({...defaults(l),[k.key]:v})))]){
  const x=evaluate(l,p)
  expect(x.steps.length,l.id).toBeGreaterThanOrEqual(3)
  expect(Number.isFinite(x.practice.answer),l.id).toBe(true)
  x.readings.forEach(r=>expect(Number.isFinite(r.value),`${l.id}: ${r.label}`).toBe(true))
  for(const tex of [...l.symbols.map(a=>a[0]),...x.steps.flatMap(s=>[s.tex,s.substitution].filter(Boolean))])expect(()=>katex.renderToString(tex,{throwOnError:true}),`${l.id}: ${tex}`).not.toThrow()
 }
})
