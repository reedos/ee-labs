import {it,expect} from 'vitest'
import {complex,solveComplex,returnRatioAt} from '@ee-labs/network'
import {compensated,nested,nativeCompensation,stateTransfer,stateFrom} from './compensation.js'
import {tfAt} from './architectures.js'
const close=(a,b,tol=1e-7)=>expect(Math.hypot(a[0]-b[0],a[1]-b[1])/Math.max(1,Math.hypot(...b))).toBeLessThan(tol)
it('matches exact two-stage polynomial, nodal AC and independently extracted state transfer',()=>{
 for(const cc of [.5e-12,5e-12])for(const rz of [0,2000,6000,10000]){const x=compensated({cc,rz}),state=stateTransfer(x.A,x.B,1);for(const f of [1e3,1e6,x.crossover,1e9]){close(x.at(f),nativeCompensation(x,f));close(tfAt(state,f),x.at(f))}}
 const x=compensated();expect(x.pm).toBeCloseTo(35.6347934358,7);expect(x.zero).toBe(5e8);expect(compensated({rz:2000}).zero).toBeNull();expect(compensated({rz:6000}).zero).toBe(-2.5e8)
})
it('matches the closed-loop state step to its KCL and long-term gain',()=>{
 for(const rz of [0,2000,6000]){const x=compensated({rz}),p=x.response.points;expect(p[0].y).toBe(0);expect(p.at(-1).y).toBeCloseTo(.001*x.dc/(1+x.dc),6)
 const n=x.A.length,z=Array.from({length:n},(_,i)=>(i+1)*.001),u=.0001,dx=x.A.map((row,i)=>row.reduce((a,v,j)=>a+v*z[j],0)+x.B[i]*u)
 x.cap.forEach((row,i)=>expect(row.reduce((a,v,j)=>a+v*dx[j],0)+x.g[i].reduce((a,v,j)=>a+v*z[j],0)).toBeCloseTo(x.drive[i]*u,17))}
 expect(compensated({cc:5e-12}).slew).toBeCloseTo(4e6,5);expect(compensated({cc:5e-12}).crossover).toBeLessThan(compensated().crossover)
})
it('extracts both three-stage transfers without inventing a cancellation',()=>{
 for(const feed of [0,1])for(const cl of [2e-12,10e-12]){const x=nested({feed,cl});for(const f of [1e3,1e6,x.crossover,1e9])close(x.at(f),nativeCompensation(x,f));expect(x.tf.check).toBeLessThan(1e-7);expect(x.zeros.some(z=>z[0]>0)).toBe(true);expect(x.zeros.some(z=>z[0]<0)).toBe(true)}
 expect(nested({feed:1,inner:.1e-12}).tf).toEqual(nested({feed:1,inner:3e-12}).tf)
})
it('checks the conditional inner loop by breaking the native gm3 source',()=>{
 const x=nested(),net={elements:x.net.elements.filter(e=>e.id!=='G1').concat([{type:'V',id:'Clamp',nodes:['a','gnd'],value:0}])}
 for(const f of [1e3,1e6,x.local.crossover,1e9])close(x.innerAt(f),returnRatioAt(net,'G3',2*Math.PI*f))
 expect(x.local.crossings.map(c=>c.direction)).toEqual(['Rising','Falling']);expect(nested({feed:1}).local.crossings).toEqual([])
})
