import {describe,it,expect} from 'vitest'
import {complex as cx} from '@ee-labs/network'
import {DEVICE_SETS,stability,conjugateMatch,unilateral,hybridPi,noiseFactor,noiseCircle,sourceGainCircle,cubicTone,leeson} from './active.js'
import {yToS} from './convert.js'
const {C,cadd,csub,cmul,cdiv,cabs,polar}=cx
describe('active RF models',()=>{
  it('reproduces the two documented stability sets and verifies their gain match',()=>{
    const a=stability(DEVICE_SETS[0]),b=stability(DEVICE_SETS[1]);expect(a.K).toBeCloseTo(.60713235,7);expect(a.mu).toBeCloseTo(.86281547,7);expect(a.stable).toBe(false)
    expect(b.K).toBeCloseTo(1.43317832,7);expect(b.mu).toBeCloseTo(1.13137304,7);expect(b.stable).toBe(true)
    expect(a.loadCircle.center[0]).toBeCloseTo(.93468450,7);expect(a.loadCircle.radius).toBeCloseTo(.49973864,7)
    expect(conjugateMatch(DEVICE_SETS[1]).gain).toBeCloseTo(b.gain,10);expect(()=>conjugateMatch(DEVICE_SETS[0])).toThrow(/unstable/)
    for(const sp of DEVICE_SETS){const z=stability(sp),[[a,b],[c,d]]=sp.s;for(let i=0;i<20;i++){const gl=cadd(z.loadCircle.center,polar(z.loadCircle.radius,i*Math.PI/10)),gin=cadd(a,cdiv(cmul(cmul(b,c),gl),csub(C(1),cmul(d,gl))));expect(cabs(gin)).toBeCloseTo(1,10)}}
  })
  it('hybrid-pi native port solves agree with independently stamped two-port admittance',()=>{
    for(const f of [1e6,1e8,1e9,10e9]){
      const z=hybridPi({f}),w=2*Math.PI*f,cpi=1e-12,cmu=.1e-12
      const y=[[C(1/z.rpi,w*(cpi+cmu)),C(0,-w*cmu)],[C(z.gm,-w*cmu),C(1e-5,w*cmu)]],want=yToS(y,50)
      for(let i=0;i<2;i++)for(let j=0;j<2;j++)expect(cabs(csub(z.sp.s[i][j],want[i][j]))).toBeLessThan(1e-10)
      expect(cabs(hybridPi({f:z.ft}).h21)).toBeCloseTo(1,12)
    }
  })
  it('bounds the measured unilateral error for each supplied device',()=>{
    for(const sp of DEVICE_SETS){const z=unilateral(sp);expect(z.error).toBeGreaterThan(z.lower);expect(z.error).toBeLessThan(z.upper)}
    expect(unilateral(DEVICE_SETS[1]).error).toBeCloseTo(.83356056,7)
  })
  it('noise-circle points really have the requested noise figure',()=>{
    for(const nf of [1,1.5,2]){const c=noiseCircle(nf);for(let i=0;i<24;i++){const g=cadd(c.center,polar(c.radius,i*Math.PI/12)),z=cdiv(cmul(C(50),cadd(C(1),g)),csub(C(1),g));expect(10*Math.log10(noiseFactor(z))).toBeCloseTo(nf,10)}}
    expect(10*Math.log10(noiseFactor(C(50)))).toBeCloseTo(.87265284,7)
  })
  it('source-gain circles satisfy the normalized gain identity',()=>{
    const sp=DEVICE_SETS[1],a=sp.s[0][0]
    for(const target of [.2,.5,.8]){const c=sourceGainCircle(sp,target);for(let i=0;i<20;i++){const g=cadd(c.center,polar(c.radius,i*Math.PI/10)),gain=(1-cabs(g)**2)*(1-cabs(a)**2)/cabs(csub(C(1),cmul(a,g)))**2;expect(gain).toBeCloseTo(target,10)}}
  })
  it('FFT products agree with the cubic expansion and guards stop extrapolation',()=>{
    for(const A of [.05,.2,.4])for(const N of [1024,4096]){const z=cubicTone({amplitude:A,N});expect(z.main).toBeCloseTo(A-.225*A**3,11);expect(z.product).toBeCloseTo(.075*A**3,11)}
    expect(cubicTone().gap).toBeCloseTo(74.53508737,6)
    expect(cubicTone({amplitude:.4}).guard).toBe('warning');expect(cubicTone({amplitude:1.2}).guard).toBe('declined')
  })
  it('Leeson model uses the plan normalization and expected scaling',()=>{
    expect(leeson(1e5)).toBeCloseTo(-116.9957,3)
    expect(leeson(1e5,{powerDbm:3})-leeson(1e5)).toBeCloseTo(-3,12)
    expect(leeson(1e5,{Q:40})-leeson(1e5)).toBeCloseTo(-6.02039,3)
  })
})
