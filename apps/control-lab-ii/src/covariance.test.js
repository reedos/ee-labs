import {it,expect} from 'vitest'
import katex from 'katex'
import {defaults,evaluate} from '@ee-labs/lessons/model'
import {covarianceStep,covarianceHistory,covarianceEnsemble} from './covariance.js'
import {EXTENDED} from './extended.js'
it('renders all three covariance lessons and their defined symbols across setting endpoints',()=>{
  expect(EXTENDED.map(l=>l.id)).toEqual(['F3','F4','F5'])
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
it('agrees with an independent information-form measurement update and preserves positive covariance',()=>{
  const inverse=P=>{const det=P[0]*P[2]-P[1]**2;return[P[2]/det,-P[1]/det,P[0]/det]}
  for(const dt of [.02,.1,.5])for(const r of [.001,.04,1]){
    const h=covarianceStep([2,.2,.4],{dt,r,q:1}),info=inverse(h.prior);info[0]+=1/r
    const expected=inverse(info)
    h.posterior.forEach((v,i)=>expect(v).toBeCloseTo(expected[i],10))
    expect(h.posterior[0]*h.posterior[2]-h.posterior[1]**2).toBeGreaterThan(0)
    expect(h.posterior[0]).toBeLessThan(h.prior[0])
    expect(h.posterior[2]).toBeLessThanOrEqual(h.prior[2])
  }
})
it('has a steady gain independent of initial covariance and a small fixed-point residual',()=>{
  const a=covarianceHistory({p0:.01}),b=covarianceHistory({p0:10})
  expect(a.steady.K).toEqual(b.steady.K)
  expect(a.history[0].K).not.toEqual(b.history[0].K)
  const next=covarianceStep(a.steady.posterior).posterior
  next.forEach((v,i)=>expect(Math.abs(v-a.steady.posterior[i])).toBeLessThan(1e-11))
})
it('checks predicted spread with independent seeded trajectories and exposes sensor mismatch',()=>{
  const x=covarianceEnsemble({runs:3000,seed:42}),P=x.history.at(-1).posterior
  expect(Math.abs(x.position.variance/P[0]-1)).toBeLessThan(4*Math.sqrt(2/2999))
  expect(Math.abs(x.velocity.variance/P[2]-1)).toBeLessThan(4*Math.sqrt(2/2999))
  expect(x.position.ci[0]).toBeLessThan(x.position.variance)
  expect(x.position.ci[1]).toBeGreaterThan(x.position.variance)
  expect(covarianceEnsemble({runs:100,seed:7}).first).toEqual(covarianceEnsemble({runs:100,seed:7}).first)
  const bad=covarianceEnsemble({runs:1000,seed:42,actualScale:4})
  expect(bad.position.ci[0]).toBeGreaterThan(P[0])
})
