import {it,expect} from 'vitest'
import {solveAC,solveDC,complex} from '@ee-labs/network'
import {extraElement,trimCode,trimPopulation,calibration} from './extraElement.js'
import {EXTRA_ELEMENT_LESSONS} from './extraElementLessons.js'
import {EXTENDED as MIXED} from '../../mixed-signal-lab/src/extended.js'
it('matches the extra-element transfer and both driving-point resistances to native nodal solves',()=>{
 for(const gm of [100e-6,200e-6,800e-6])for(const rd of [5000,20000,50000])for(const rs of [2000,10000,50000]){
  const x=extraElement({gm,rd,rs})
  for(const f of [x.pole/10,x.pole,x.zero,10*x.zero]){const y=solveAC(x.net,2*Math.PI*f,{sources:{V1:1}}).v.out,z=x.at(f);expect(complex.cabs(complex.csub(y,z))).toBeLessThan(1e-10*Math.max(1,complex.cabs(z)));expect(Math.cos(x.phase(f)*Math.PI/180)).toBeCloseTo(y[0]/complex.cabs(y),10)}
  const port={elements:x.net.elements.filter(e=>e.type!=='C').map(e=>e.id==='V1'?{...e,value:0}:e)};port.elements.push({type:'I',id:'test',nodes:['out','gate'],value:1e-6});const d=solveDC(port);expect((d.v.gate-d.v.out)/1e-6).toBeCloseTo(x.zd,6)
  port.elements=port.elements.map(e=>e.id==='V1'?{...e,value:-1e-6*(rs+1/gm)}:e);const n=solveDC(port);expect(n.v.out).toBeCloseTo(0,12);expect((n.v.gate-n.v.out)/1e-6).toBeCloseTo(x.zn,7)
 }
 expect(extraElement().pole/1e6).toBeCloseTo(113.6821022085,8)
})
it('recovers the capacitor initial state and step through independent held-voltage nodal integration',()=>{
 for(const rs of [2000,10000,50000]){
  const x=extraElement({rs}),input=.001,held=state=>solveDC({elements:x.net.elements.map(e=>e.id==='V1'?{...e,value:input}:e.id==='Cgd'?{type:'V',id:'held',nodes:['gate','out'],value:state}:e)}),derivative=state=>held(state).i.held/x.cap
  expect(held(0).v.out).toBeCloseTo(x.feedthrough*input,12)
  let state=0;const dt=6*x.tau/400;for(let i=0;i<400;i++){const a=derivative(state),b=derivative(state+dt*a/2),c=derivative(state+dt*b/2),d=derivative(state+dt*c);state+=dt*(a+2*b+2*c+d)/6}
  expect(state).toBeCloseTo(x.step(6*x.tau,input).state,10);expect(held(state).v.out).toBeCloseTo(x.step(6*x.tau,input).output,10)
 }
})
it('checks the Miller threshold, omitted zero and existence of the actual half-power crossing',()=>{
 expect(extraElement().error).toBeCloseTo(.4,12);expect(extraElement().millerOK).toBe(false);expect(extraElement({rs:50000}).millerOK).toBe(true)
 const no=extraElement({gm:100e-6,rd:5000,rs:2000});expect(no.cutoff).toBeNull();expect(complex.cabs(no.relative(no.pole*1e6))).toBeGreaterThan(1/Math.SQRT2)
 const x=extraElement();expect(complex.cabs(x.relative(x.cutoff))).toBeCloseTo(1/Math.SQRT2,12);expect(x.cutoff).not.toBe(x.pole)
})
it('defines the midrise endpoints, central code tie and half-step in-range bound',()=>{
 for(const bits of [3,5,8]){const range=.008,L=2**bits,d=2*range/L;expect(trimCode(-range,{bits,range}).correction).toBeCloseTo(-range+d/2,14);expect(trimCode(range,{bits,range}).correction).toBeCloseTo(range-d/2,14);expect(trimCode(0,{bits,range}).code).toBe(L/2);expect(trimCode(0,{bits,range}).residual).toBeCloseTo(-d/2,14)
  for(let i=0;i<=200;i++)expect(Math.abs(trimCode(-range+2*range*i/200,{bits,range}).residual)).toBeLessThanOrEqual(d/2+1e-15)
  expect(trimCode(1,{bits,range}).outside).toBe(true);expect(trimCode(1,{bits,range}).code).toBe(L-1)
 }
})
it('integrates total Gaussian trim error independently over every code region including clipped tails',()=>{
 for(const p of [{},{bits:6},{area:100,bits:3,range:.016},{area:.25,bits:8,range:.001}]){
  const x=trimPopulation(p),R=p.range??.008,L=2**(p.bits??5),delta=2*R/L,sigma=x.sigma;let total=0,inside=0,mass=0
  for(let k=0;k<L;k++){const lo=k===0?-10*sigma:Math.max(-10*sigma,-R+k*delta),hi=k===L-1?10*sigma:Math.min(10*sigma,-R+(k+1)*delta),level=-R+(k+.5)*delta;if(hi<=lo)continue
   const integrate=(a,b)=>{if(b<=a)return 0;const n=1000,h=(b-a)/n;let s=0;for(let j=0;j<=n;j++){const u=a+j*h,w=j===0||j===n?1:j%2?4:2;s+=w*(u-level)**2*Math.exp(-u*u/(2*sigma*sigma))/(sigma*Math.sqrt(2*Math.PI))}return s*h/3};total+=integrate(lo,hi);inside+=integrate(Math.max(lo,-R),Math.min(hi,R));mass+=x.cells[k].prob
  }
  expect(total/x.power).toBeCloseTo(1,6);expect(inside/x.insidePower).toBeCloseTo(1,6);expect(mass).toBeCloseTo(1,10)
 }
 expect(trimPopulation().rms*1e6).toBeCloseTo(154.418458,5);expect(trimPopulation({bits:6}).rms).toBeLessThan(trimPopulation().rms)
})
it('guards the uniform approximation and keeps quantization and range overload separate',()=>{
 expect(trimPopulation().approxOK).toBe(true);expect(trimPopulation({area:100,bits:3,range:.016}).approxOK).toBe(false)
 const x=trimPopulation(),tight=trimPopulation({range:.001});expect(tight.delta).toBeLessThan(x.delta);expect(tight.outside).toBeGreaterThan(x.outside);expect(tight.rms).toBeGreaterThan(x.rms)
 expect(x.outside*100).toBeCloseTo(.21559763,7)
})
it('holds the trim code fixed, bounds affine drift at endpoints and handles measurement/range errors',()=>{
 const x=calibration();expect(x.trim.code).toBe(21);expect(x.selected.after*1e6).toBeCloseTo(133.5,9);expect(x.slope*1e6).toBeCloseTo(4.725,12);expect(x.passes).toBe(true);expect(calibration({drift:20e-6}).passes).toBe(false)
 for(let T=-40;T<=125;T+=.5)expect(Math.abs(x.at(T).after)).toBeLessThanOrEqual(x.worst+1e-15)
 const flat=calibration({drift:0,tempco:0});expect(flat.at(-40).after).toBe(flat.at(125).after)
 expect(calibration({measurement:.001}).trim.code).not.toBe(x.trim.code);expect(calibration({offset:.012}).trim.outside).toBe(true)
 expect(calibration({offset:0,measurement:0,drift:0,tempco:0}).baseline.after).not.toBe(0)
 const related=EXTRA_ELEMENT_LESSONS[3].solve(Object.fromEntries(EXTRA_ELEMENT_LESSONS[3].knobs.map(k=>[k.key,k.value]))).related;expect(MIXED.some(l=>l.id===related.id&&/Calibrate/.test(l.name))).toBe(true)
})
