import {describe,it,expect} from 'vitest'
import katex from 'katex'
import {EXTENDED} from './extended.js'
import {uart,spi,arbitration,stuff,pwm,bounce,canTolerance} from './protocols.js'
import {defaults,evaluate,grade} from '@ee-labs/lessons/model'
describe('Interfaces B–G curriculum',()=>{
  it('has all planned groups and renders every expression at defaults and parameter endpoints',()=>{
    expect(EXTENDED.map(l=>l.id)).toEqual(['b1','b2','b3','b4','c1','c2','c3','c4','c5','d1','d2','d3','e1','e2','e3','e4','f1','f2','f3','f4','f5','g1','g2','g3','g4'])
    for(const l of EXTENDED){
      for(const [symbol] of l.symbols) expect(()=>katex.renderToString(symbol,{throwOnError:true})).not.toThrow()
      for(const p of [defaults(l),...l.knobs.flatMap(k=>[k.min,k.max].map(v=>({...defaults(l),[k.key]:v})))]){
        const x=evaluate(l,p)
        expect(x.steps.length,l.id).toBeGreaterThanOrEqual(3)
        expect(Number.isFinite(x.practice.answer),l.id).toBe(true)
        for(const step of x.steps) for(const tex of [step.tex,step.substitution].filter(Boolean)) expect(()=>katex.renderToString(tex,{throwOnError:true}),`${l.id}: ${tex}`).not.toThrow()
        for(const v of x.readings) expect(Number.isFinite(v.value),`${l.id}: ${v.label}`).toBe(true)
      }
    }
  })
  it('reads all 256 UART bytes from the analog pin and all four ideal SPI modes',()=>{
    for(let byte=0;byte<256;byte++){
      const u=uart(byte,115200);expect(u.decoded).toBe(byte);expect(u.stop).toBe(1)
      for(let mode=0;mode<4;mode++){const z=spi(byte,mode,10e6);expect(z.decoded).toBe(byte);expect(z.samples).toHaveLength(8);expect(z.samples[0].t).toBeCloseTo((1+(mode&1))*z.T/2,14)}
    }
  })
  it('keeps the lower identifier active and removes the loser at its first recessive mismatch',()=>{
    for(const [a,b] of [[291,293],[293,291],[0,2047],[55,55]]){
      const z=arbitration(a,b),last=z.at(-1);expect(last.activeA).toBe(a<=b);expect(last.activeB).toBe(b<=a)
      const i=z.findIndex(r=>r.lostA||r.lostB);if(i>=0) for(const row of z.slice(i+1)) expect(row.bus).toBe(a<b?row.A:row.B)
    }
  })
  it('stuffing guarantees a zero after six ones and preserves arbitrary payloads when decoded',()=>{
    for(let n=1;n<=120;n++){
      const raw=Array.from({length:n},(_,i)=>i%13!==0?1:0),encoded=stuff(raw),decoded=[];let ones=0
      for(let i=0;i<encoded.length;i++){const b=encoded[i];decoded.push(b);ones=b?ones+1:0;if(ones===6){expect(encoded[++i]).toBe(0);ones=0}}
      expect(decoded).toEqual(raw)
    }
  })
  it('periodic PWM agrees with independent numerical cycle integration and charge balance',()=>{
    for(const D of [.1,.5,.9]){
      const z=pwm(10000,1e-6,3.3,20000,D),dt=z.T/20000
      let integral=0;for(let i=0;i<20000;i++) integral+=z.wave((i+.5)*dt)*dt
      expect(integral/z.T).toBeCloseTo(3.3*D,8)
      expect(z.wave(z.T)).toBeCloseTo(z.low,12)
      expect(z.wave(D*z.T)).toBeCloseTo(z.high,12)
      expect(z.high-z.low).toBeCloseTo(z.ripple,14)
    }
  })
  it('corrects the jitter reference and infeasible I2C resistor case',()=>{
    const get=id=>EXTENDED.find(l=>l.id===id)
    expect(evaluate(get('g2'),defaults(get('g2'))).readings[1].value).toBeCloseTo(40.848815,5)
    const z=evaluate(get('c2'),{...defaults(get('c2')),C:400e-12});expect(z.readings[1].value).toBeLessThan(z.readings[0].value)
    expect(bounce(.01).changes).toHaveLength(1);expect(bounce(.0001).changes.length).toBeGreaterThan(1)
    expect(grade('',1)).toContain('finite');expect(grade('Infinity',1)).toContain('finite');expect(grade('1',1)).toContain('Correct');expect(grade('2',1)).toContain('Not yet')
  })
})

it('requires both classical CAN oscillator bounds and valid jump width',()=>{
 const max=canTolerance({prop:1,phase1:4,phase2:4,sjw:4});expect(max.bound*100).toBeCloseTo(1.5873015873,9)
 const a=canTolerance(),b=canTolerance({sjw:4});expect(a.resync).toBeLessThan(a.phase);expect(b.phase).toBeLessThan(b.resync)
 expect(()=>canTolerance({phase1:2,sjw:4})).toThrow(/jump width/)
})
