import {describe,it,expect} from 'vitest'
import katex from 'katex'
import {EXTENDED} from './extended.js'
import {defaults,evaluate} from '@ee-labs/lessons/model'
import {gatePath,wire,rcPath,butterfly,storageTransfer,mosCurrent,flipFlop,characterizeFlipFlop,repeatedDelay,optimumRepeaters} from './networks.js'
import {CU,RU,CARD} from './model.js'
describe('VLSI extended physical models',()=>{
  it('covers every B–G entry and renders its mathematical definitions and steps',()=>{
    expect(EXTENDED.map(e=>e.id)).toEqual(['b1','b2','b3','b4','c1','c2','c3','c4','c5','d1','d2','d3','d4','e1','e2','e3','e4','e5','f1','f2','f3','g1','g2','g3','g4'])
    for(const l of EXTENDED){const z=evaluate(l,defaults(l));expect(Number.isFinite(z.practice.answer),l.id).toBe(true);for(const [tex] of l.symbols)expect(()=>katex.renderToString(tex,{throwOnError:true}),`${l.id}: ${tex}`).not.toThrow();for(const step of z.steps)for(const tex of [step.tex,step.substitution].filter(Boolean))expect(()=>katex.renderToString(tex,{throwOnError:true}),`${l.id}: ${tex}`).not.toThrow()}
  },20000)
  it('reduced gate crossings equal independently derived RC delays, and rejects a pass network',()=>{
    for(let gate=0;gate<5;gate++)for(const load of [0,3*CU,30*CU]){const z=gatePath(gate,load),want=RU*(z.g.self*CU+load)*Math.LN2;expect(Math.abs(z.t50/want-1)).toBeLessThan(1e-10)}
    expect(()=>gatePath(5)).toThrow(/independent|internal dynamic/)
    expect(gatePath(1,3*CU,true,true).t50).toBeGreaterThan(gatePath(1,3*CU,true,false).t50)
  })
  it('wire first moments match the hand sum and crossings converge under section refinement',()=>{
    const z=[1,4,16,32].map(N=>wire(1000,200e-15,N))
    for(let i=0;i<z.length;i++){const N=[1,4,16,32][i];expect(z[i].elmore/200e-12).toBeCloseTo((N+1)/(2*N),12);expect(z[i].t50).toBeLessThan(z[i].elmore);if(i)expect(z[i].t50).toBeLessThan(z[i-1].t50)}
    expect(z[0].t50/(200e-12)).toBeCloseTo(Math.LN2,12)
    expect(z.at(-1).t50/(200e-12)).toBeGreaterThan(.378)
    expect(z.at(-1).t50/(200e-12)).toBeLessThan(.392)
  })
  it('storage DC points satisfy transistor current balance',()=>{
    const beta=CARD.knPrime*CARD.width/CARD.length
    for(const ratio of [1,2,4])for(const word of [0,1.4,1.8])for(const vin of [.1,.5,.85,1.1,1.6]){
      const out=storageTransfer(vin,{ratio,word}),residual=mosCurrent(1.8-vin,1.8-out,beta)+mosCurrent(word-out,1.8-out,beta)-mosCurrent(vin,out,beta*ratio)
      expect(Math.abs(residual)).toBeLessThan(1e-12)
    }
    const hold=butterfly({ratio:2}),read=butterfly({ratio:2,word:1.8}),strong=butterfly({ratio:4,word:1.8})
    expect(read.snm).toBeLessThan(hold.snm);expect(strong.snm).toBeGreaterThan(read.snm)
    expect(read.upper).toBeCloseTo(read.lower,12)
    expect(Math.abs(read.snm-butterfly({ratio:2,word:1.8},2001).snm)).toBeLessThan(.003)
  })
  it('connected latches capture and hold across event-grid refinement and source segmentation',()=>{
    const runs=[201,401,801].map(points=>flipFlop({points,setup:100e-12,hold:10e-12}))
    for(const z of runs){expect(z.captured).toBe(true);expect(z.clkQ).toBeCloseTo(runs[0].clkQ,20);expect(z.wave(z.tEnd)).toBeGreaterThan(1.79)}
    for(const hold of [0,20e-12,400e-12]){const z=flipFlop({setup:100e-12,hold});expect(z.captured).toBe(true);expect(z.clkQ).toBeCloseTo(runs[0].clkQ,20)}
    expect(flipFlop({setup:5e-12}).captured).toBe(false)
    const c=characterizeFlipFlop(),safe=flipFlop({setup:c.setup+2*c.setupResolution}),late=flipFlop({setup:c.setup-2*c.setupResolution})
    expect(safe.captured&&safe.clkQ<=c.limit).toBe(true);expect(late.captured&&late.clkQ<=c.limit).toBe(false)
  },20000)
  it('repeater search minimum is no worse than either neighbouring size or count',()=>{
    const z=optimumRepeaters(5000,1e-12)
    for(const [N,size] of [[z.stages-1,z.size],[z.stages+1,z.size],[z.stages,z.size-1],[z.stages,z.size+1]])expect(z.delay).toBeLessThanOrEqual(repeatedDelay(5000,1e-12,N,size))
  })
  it('RC supply and resistor energy integrals satisfy conservation independently',()=>{
    for(const R of [1000,6250,15000]){
      const C=6*CU,tau=R*C,dt=tau/1000;let supply=0,heat=0
      for(let i=0;i<30000;i++){const current=1.8/R*Math.exp(-(i+.5)*dt/tau);supply+=1.8*current*dt;heat+=R*current*current*dt}
      expect(supply/(C*1.8**2)).toBeCloseTo(1,6);expect(heat/(C*1.8**2)).toBeCloseTo(.5,6)
    }
  })
})
