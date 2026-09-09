import {it,expect} from 'vitest'
import {quantizationRecord,spectrum,bandPower,shapedPower,modulator,linearNoise,sincGain,sincDecimate,decimation} from './noiseShaping.js'
it('measures deterministic quantization rather than substituting a random error',()=>{
 for(const kind of [0,1]){const x=quantizationRecord({kind});expect(Math.max(...x.error.map(Math.abs))).toBeLessThanOrEqual(x.delta/2+1e-14);expect(spectrum(x.error).powers.reduce((a,b)=>a+b,0)).toBeCloseTo(x.power,14)}
 expect(quantizationRecord().lag).toBeGreaterThan(.98);expect(Math.abs(quantizationRecord({kind:1}).lag)).toBeLessThan(.04)
 expect(quantizationRecord({kind:1}).power/quantizationRecord({kind:1}).modelPower).toBeCloseTo(1,1)
})
it('integrates the NTF independently and derives the 3/9/15 dB asymptotes',()=>{
 for(const osr of [8,16,64,256]){expect(shapedPower(0,osr).exact).toBeCloseTo(1/(3*osr),14);const b=1/(2*osr),closed=2/3*(2*b-Math.sin(2*Math.PI*b)/Math.PI);expect(shapedPower(1,osr).exact).toBeCloseTo(closed,14)}
 const b=1/32;expect(shapedPower(2,16).exact).toBeCloseTo(2/3*(6*b-4*Math.sin(2*Math.PI*b)/Math.PI+Math.sin(4*Math.PI*b)/(2*Math.PI)),13)
 for(const order of [0,1,2])expect(10*Math.log10(shapedPower(order,128).exact/shapedPower(order,256).exact)).toBeCloseTo((2*order+1)*10*Math.log10(2),2)
 expect(10*Math.log10(.125/shapedPower(2,64).exact)).toBeCloseTo(73.1542623,6)
})
it('preserves the exact sample timing and additive-error identities',()=>{
 const x=modulator({amplitude:.8,dc:true,warm:false,n:16});expect(x.rows[0].x1).toBe(.8);expect(x.rows[0].x2).toBe(.8);expect(x.rows[1].x1).toBeCloseTo(.6,14);expect(x.rows[1].x2).toBeCloseTo(.4,14);expect(x.output.slice(0,3)).toEqual([1,1,-1])
 for(const order of [1,2]){const x=modulator({order});for(let n=2;n<x.output.length;n++){const e=x.quantizerError,expected=order===1?e[n]-e[n-1]:e[n]-2*e[n-1]+e[n-2];expect(x.error[n]).toBeCloseTo(expected,12)}}
})
it('checks the white-model ensemble with leakage-resistant power estimates',()=>{
 for(const order of [1,2]){let avg=0;for(let seed=1;seed<=24;seed++)avg+=bandPower(linearNoise({order,seed}),64,'hann').power/24;expect(Math.abs(avg/shapedPower(order,64).exact-1)).toBeLessThan(.15)}
})
it('uses an observed guard, not a universal 0.7 full-scale boundary',()=>{
 for(const amplitude of [.6,.7,.8,1])expect(modulator({amplitude,dc:true,warm:false,n:4096}).stop).toBeNull()
 const x=modulator({amplitude:1.1,dc:true,warm:false,n:4096});expect(x.stop).toBe(43);expect(x.output.length).toBe(44);expect(x.maxState).toBeGreaterThan(100);expect(x.state1.every((v,i,a)=>!i||v>a[i-1])).toBe(true)
 expect(modulator({amplitude:1,warm:false}).stop).not.toBeNull()
})
it('matches sinc3 filtering to three direct FIR convolutions and exact gain/delay',()=>{
 const ratio=8,input=Array.from({length:1024},(_,n)=>Math.sin(2*Math.PI*.007*n));let direct=input.slice()
 for(let stage=0;stage<3;stage++){const old=direct;direct=old.map((_,n)=>Array.from({length:ratio},(_,i)=>old[n-i]??0).reduce((a,b)=>a+b,0)/ratio)}
 const x=sincDecimate(input,ratio);x.filtered.forEach((v,i)=>expect(v).toBeCloseTo(direct[i],13));expect(x.output).toEqual(x.filtered.filter((_,n)=>(n+1)%ratio===0))
 for(let n=30;n<input.length;n++)expect(x.filtered[n]).toBeCloseTo(sincGain(.007,ratio)*Math.sin(2*Math.PI*.007*(n-3*(ratio-1)/2)),12)
 expect(sincGain(0,64)).toBe(1);expect(sincGain(1/64,64)).toBeLessThan(1e-40)
})
it('measures finite correction rather than asserting a perfectly flat passband',()=>{
 for(const ratio of [8,64,128])for(const edge of [.05,.2,.45]){const x=decimation({ratio,edge});expect(x.spanGain).toBeCloseTo(1,12);expect(x.gain(0)).toBe(1);expect(x.actual.complete).toBe(true);expect(x.halfEdgeGain).not.toBe(1)
 const ideal=sincDecimate(x.actual.input,ratio).output,corrected=ideal.map((v,i)=>-x.a*(ideal[i-2]??0)+(1+2*x.a)*(ideal[i-1]??0)-x.a*v)
 corrected.slice(8).forEach((v,i)=>expect(v).toBeCloseTo(x.expected[i+8],10))
 const rms=Math.sqrt(corrected.slice(8).reduce((sum,v,i)=>sum+(x.output[i+8]-v)**2,0)/(corrected.length-8));expect(x.rms).toBeCloseTo(rms,10)
 }
 expect(decimation().nyquistLoss).toBeCloseTo(11.76457641,7);expect(decimation({correct:0}).spanGain).toBeLessThan(1)
})
