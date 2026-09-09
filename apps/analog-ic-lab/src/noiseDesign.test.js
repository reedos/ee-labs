import {it,expect} from 'vitest'
import {noiseDensity,solveAC} from '@ee-labs/network'
import {pairNoise,noiseNet,flicker,budget,KB,GAMMA} from './noiseDesign.js'
import {sizeFor,matching} from './models.js'
it('sums independent physical drain noises through the native differential circuit',()=>{
 for(const gm of [100e-6,200e-6,800e-6])for(const ratio of [.05,.5,1])for(const gain of [10,100]){
  const p={gm,ratio,gain},x=pairNoise(p),net=noiseNet(p),ac=solveAC(net,2*Math.PI*1000,{sources:{V1:1}}),a=ac.v.p[0]-ac.v.n[0];expect(a).toBeCloseTo(gain,10)
  const n=noiseDensity(net,{output:{across:['p','n']},sources:net.sources},1000)
  expect(n.total/a**2/(x.input+x.load)).toBeCloseTo(1,12)
  expect((n.byId.M1+n.byId.M2)/a**2/x.input).toBeCloseTo(1,12)
  expect((n.byId.M3+n.byId.M4)/a**2/x.load).toBeCloseTo(1,12)
  expect(x.shares.reduce((a,b)=>a+b,0)).toBeCloseTo(1,14)
 }
 expect(pairNoise().first*1e9).toBeCloseTo(12.871591976,6)
})
it('distinguishes fixed efficiency scaling from fixed geometry square-law scaling',()=>{
 const x=pairNoise(),y=pairNoise({gm:800e-6});expect(y.first/x.first).toBeCloseTo(.5,12)
 const a=sizeFor({gm:200e-6,gmid:10}),b=sizeFor({gm:800e-6,gmid:10});expect(b.id/a.id).toBeCloseTo(4,12);expect(b.ratio/a.ratio).toBeCloseTo(4,12)
 const beta=1e-3,id0=(200e-6)**2/(2*beta),id1=(800e-6)**2/(2*beta);expect(id1/id0).toBeCloseTo(16,12)
 expect(pairNoise({gain:10}).second/pairNoise({gain:100}).second).toBeCloseTo(100,12)
})
it('integrates the flicker spectrum independently over log frequency and obeys area scaling',()=>{
 for(const low of [.1,1,100]){const x=flicker({low}),N=20000,h=Math.log(1e6/low)/N;let integral=0
  for(let i=0;i<N;i++){const f=low*Math.exp((i+.5)*h);integral+=x.density(f)**2*f*h}
  expect(integral/x.rms**2).toBeCloseTo(1,7)
  expect(x.density(x.corner)**2/x.white).toBeCloseTo(2,12)
 }
 const a=flicker(),b=flicker({width:40,length:2});expect(a.corner/b.corner).toBeCloseTo(8,12);expect(a.corner).toBeGreaterThan(20900);expect(a.corner).toBeLessThan(21000)
 expect(flicker({low:.1}).rms).toBeGreaterThan(flicker({low:100}).rms)
})
it('sizes to thermal target, checks mismatch separately, and retains geometry constraints',()=>{
 for(const target of [3e-9,5e-9,20e-9])for(const ratio of [.05,1])for(const temp of [250,400])for(const gmid of [5,24])for(const length of [1e-6,5e-6]){
  const x=budget({target,ratio,temp,gmid,length});expect(pairNoise({gm:x.gm,ratio,temp}).first/target).toBeCloseTo(1,12);expect(x.device.id*gmid/x.gm).toBeCloseTo(1,12);expect(x.match).not.toBeNull();expect(x.match.offset).toBe(matching({area:x.area,gmid}).offset)
 }
 const a=budget({gmid:10,offsetLimit:.2e-3}),b=budget({gmid:10,length:5e-6,offsetLimit:.2e-3});expect(a.passes).toBe(false);expect(b.passes).toBe(true);expect(b.match.offset/a.match.offset).toBeCloseTo(.2,12)
 expect(budget().gm).toBeCloseTo(8*KB*300*GAMMA*1.5/(5e-9)**2,14)
})
