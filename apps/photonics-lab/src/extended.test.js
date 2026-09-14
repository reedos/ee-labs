import {it,expect} from 'vitest'
import katex from 'katex'
import {defaults,evaluate} from '@ee-labs/lessons/model'
import {EXTENDED} from './extended.js'
it('provides four complete receiver lessons with renderable definitions and math across settings',()=>{
  expect(EXTENDED.map(l=>l.id)).toEqual(['b1','b2','b3','b4'])
  for(const l of EXTENDED)for(const p of [defaults(l),...l.knobs.flatMap(k=>[k.min,k.max].map(v=>({...defaults(l),[k.key]:v})))]){
    const x=evaluate(l,p)
    expect(x.steps.length).toBeGreaterThanOrEqual(3)
    expect(Number.isFinite(x.practice.answer)).toBe(true)
    x.readings.forEach(r=>expect(Number.isFinite(r.value)).toBe(true))
    for(const tex of [...l.symbols.map(a=>a[0]),...x.steps.flatMap(s=>[s.tex,s.substitution].filter(Boolean))]){
      expect(tex).not.toMatch(/[\t\r\n]/)
      expect(()=>katex.renderToString(tex,{throwOnError:true})).not.toThrow()
    }
  }
})
