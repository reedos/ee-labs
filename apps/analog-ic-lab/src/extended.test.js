import {it,expect} from 'vitest'
import katex from 'katex'
import {defaults,evaluate} from '@ee-labs/lessons/model'
import {EXTENDED} from './extended.js'
it('has 29 usable lessons with defined symbols and finite endpoint calculations',()=>{
 expect(EXTENDED.map(l=>l.id)).toEqual(['a1','a2','a3','a4','a5','a6','b1','b2','b3','b4','b5','c1','c2','c3','c4','c5','c6','d1','d2','d3','d4','e1','e2','e3','e4','f1','f2','f3','f4'])
 for(const l of EXTENDED)for(const p of [defaults(l),...l.knobs.flatMap(k=>[k.min,k.max].map(v=>({...defaults(l),[k.key]:v})))]){
  const x=evaluate(l,p)
  expect(x.steps.length,l.id).toBeGreaterThanOrEqual(3)
  expect(Number.isFinite(x.practice.answer),l.id).toBe(true)
  x.readings.forEach(r=>expect(Number.isFinite(r.value),`${l.id}: ${r.label}`).toBe(true))
  for(const plot of x.plots??[])for(const point of plot.points??plot.traces?.flatMap(t=>t.points)??[])expect(Number.isFinite(point.x)&&Number.isFinite(point.y),l.id).toBe(true)
  for(const tex of [...l.symbols.map(a=>a[0]),...x.steps.flatMap(s=>[s.tex,s.substitution].filter(Boolean))]){
   expect(tex,l.id).not.toMatch(/[\t\r\n]/)
   expect(()=>katex.renderToString(tex,{throwOnError:true}),`${l.id}: ${tex}`).not.toThrow()
  }
 }
},30000)

import {PROCESS as P,inversion,atOverdrive,sizeFor,matching,shortChannel} from './models.js'
it('derives gm from the same continuous current law and round-trips sizing',()=>{
 for(const ic of [.001,.01,.1,1,10,100]){const a=inversion(ic),h=1e-6,gm=(atOverdrive(a.vov+h).jd-atOverdrive(a.vov-h).jd)/(2*h);expect(gm/a.jd).toBeCloseTo(a.gmid,6);expect(atOverdrive(a.vov).ic).toBeCloseTo(ic,8)}
 for(const gmid of [5,10,24]){const x=sizeFor({gmid});expect(inversion(x.ic).jd*x.ratio).toBeCloseTo(x.id,14);expect(x.gmid).toBeCloseTo(gmid,12)}
 expect(atOverdrive(.2).gmid).toBeCloseTo(8.090498,5)
})
it('checks area scaling, exact matching target, and corrected-current derivatives',()=>{
 expect(matching({area:10}).offset/matching({area:2.5}).offset).toBeCloseTo(.5,12)
 expect(matching().targetArea/1e-6).toBeCloseTo(17,12)
 for(const velocity of [0,1])for(const body of [0,1])for(const clm of [0,1]){const p={velocity,body,clm,vov:.3},h=1e-6,x=shortChannel(p);expect((shortChannel({...p,vov:p.vov+h}).id-shortChannel({...p,vov:p.vov-h}).id)/(2*h)).toBeCloseTo(x.gm,10)}
 expect(()=>matching({area:.1})).toThrow(/area/)
 expect(()=>sizeFor({gmid:1/(P.n*P.vt)})).toThrow(/ceiling/)
})
