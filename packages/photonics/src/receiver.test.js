import {it,expect} from 'vitest'
import {receiverNoise,ookSensitivity,photonCountingLimit} from './receiver.js'
it('reproduces independent shot/thermal noise reference values and scaling',()=>{
  const n=receiverNoise()
  expect(n.shotDensity*1e12).toBeCloseTo(.566070072340872,12)
  expect(n.thermalDensity*1e12).toBeCloseTo(4.0703548,6)
  expect(n.crossoverCurrent*1e6).toBeCloseTo(51.70399957,6)
  const doubled=receiverNoise({bandwidth:2e9})
  expect(doubled.thermalRms/n.thermalRms).toBeCloseTo(Math.sqrt(2),12)
  expect(()=>receiverNoise({resistance:0})).toThrow()
})
it('matches an independent midpoint integral through the RC noise filter',()=>{
  const n=receiverNoise({resistance:10000,capacitance:.1e-12}),N=100000,B=1e9
  let sum=0
  for(let i=0;i<N;i++){const f=(i+.5)*B/N;sum+=1/(1+(f/n.fc)**2)*B/N}
  expect(Math.abs(sum/n.effectiveBandwidth-1)).toBeLessThan(1e-9)
  expect(n.filteredThermalRms).toBeLessThan(n.thermalRms)
})
it('solves the unequal-noise OOK criterion and retains the plan thermal approximation',()=>{
  for(const Q of [3,6,8])for(const resistance of [50,1000,5000]){
    const x=ookSensitivity({Q,resistance,dark:1e-9})
    expect(x.oneCurrent/(x.sigma0+x.sigma1)).toBeCloseTo(Q,12)
    expect(x.power).toBeGreaterThan(x.thermalPower)
  }
  expect(ookSensitivity().thermalDbm).toBeCloseTo(-31.12225,3)
  expect(ookSensitivity({resistance:5000}).thermalDbm-ookSensitivity().thermalDbm).toBeCloseTo(-5*Math.log10(5),10)
})
it('counts equally probable bits and states the actual Poisson error probability',()=>{
  const p=photonCountingLimit()
  expect(p.averagePhotons).toBe(10)
  expect(p.ber).toBeCloseTo(1.030576811e-9,17)
  expect(p.dbm).toBeCloseTo(-58.923,3)
  expect(photonCountingLimit({rate:2e9}).dbm-p.dbm).toBeCloseTo(10*Math.log10(2),12)
})
