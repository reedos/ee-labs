import {it,expect} from 'vitest'
import {parameterEnsemble} from './parameterEnsemble.js'
it('repeats seeds, carries sampling uncertainty, and rejects invalid runs',()=>{
 const options={sample:r=>r.uniformIn(-1,1),evaluate:x=>x*x,accept:x=>x<.25,count:16384},a=parameterEnsemble(options)
 expect(a.values).toEqual(parameterEnsemble(options).values)
 expect(Math.abs(a.mean.value-1/3)).toBeLessThan(4*a.mean.se)
 expect(a.yield.ci[0]).toBeLessThan(.5);expect(a.yield.ci[1]).toBeGreaterThan(.5)
 expect(()=>parameterEnsemble({...options,count:1})).toThrow(/count/)
 expect(()=>parameterEnsemble({...options,evaluate:()=>NaN})).toThrow(/Nonfinite/)
 const all=parameterEnsemble({...options,accept:()=>true});expect(all.yield.ci[0]).toBeLessThan(1)
})
