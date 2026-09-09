import {it,expect} from 'vitest'
import {expm,matVecMul,solvePWL} from '@ee-labs/network'
import {preamp,regeneration,schmitt,schmittNet,metastability} from './comparators.js'
it('refers offset through finite acquisition gain and adds independent noise powers',()=>{
 const x=preamp();expect(x.offset*x.effective).toBeCloseTo(.005,12);expect(x.noise*x.noise).toBeCloseTo((50e-6)**2+(.001/x.effective)**2,14);expect(preamp({time:20e-9}).effective).toBeCloseTo(10,4);expect(preamp({time:.1e-9}).offset).toBeGreaterThan(x.offset)
})
it('regeneration agrees with independent matrix-exponential state propagation through the threshold',()=>{
 for(const gm of [.0002,.001,.005])for(const cap of [10e-15,50e-15,200e-15])for(const initial of [1e-6,.001,.01]){const x=regeneration({gm,cap,initial});expect(matVecMul(expm([[gm/cap*x.time]]),[initial])[0]).toBeCloseTo(.5,9);expect(x.at(x.time)).toBeCloseTo(.5,12)}
 expect(regeneration().time*1e12).toBeCloseTo(310.7304049,6)
})
it('native PWL regions admit both rail histories inside thresholds and reject impossible history outside',()=>{
 const a=schmitt(),b=schmitt({history:1});expect(a.output).toBe(.5);expect(b.output).toBe(-.5);expect(a.width).toBeCloseTo(.1,12);expect(a.refusal).toMatch(/hysteresis/);expect(a.states.map(s=>s.region).sort()).toEqual(['high','linear','low']);expect(schmitt({input:.2}).output).toBe(-.5);expect(schmitt({input:-.2,history:1}).output).toBe(.5)
 for(const beta of [.02,.4])for(const rail of [.2,2]){for(const direction of [-1,1]){const edge=beta*rail*direction;expect(solvePWL(schmittNet({beta,rail,input:edge*1.001})).sol.v.out).toBeCloseTo(-direction*rail,10)}}
})
it('uses a two-sided input interval, nanovolt resolution and the actual decision rate',()=>{
 const x=metastability();expect(x.resolution*1e9).toBeCloseTo(1.030576811,8);expect(x.probability).toBeCloseTo(2.061153622e-9,17);expect(x.interval).toBeCloseTo(.097033039,8);expect(metastability({gain:10}).rate/x.rate).toBeCloseTo(.1,12);expect(metastability({gain:10}).credit*1e12).toBeCloseTo(46.05170186,7)
})
