import {it,expect} from 'vitest'
import {astable,monostable,lockin,biasCurrent,classB} from './timingAudio.js'
it('finds astable threshold events independently of the plotting grid and preserves capacitor voltage',()=>{
 for(const ra of [1000,1e4,1e5])for(const rb of [1000,1e5])for(const supply of [3,15])for(const start of [0,1]){const x=astable({ra,rb,supply,start});expect(x.events[0].time).toBeCloseTo(x.first,12);expect(x.events[2].time-x.events[0].time).toBeCloseTo(x.period,12);for(let i=0;i<8;i++){expect(x.events[i].v).toBeCloseTo(supply*(i%2?1:2)/3,12);if(i<7){expect(x.points[(i+1)*51-1].y).toBeCloseTo(x.points[(i+1)*51].y,12);expect(x.points[(i+1)*51-1].x).toBeCloseTo(x.points[(i+1)*51].x,9)}}}
 const x=astable();expect(x.frequency).toBeCloseTo(4808.98346963,7);expect(x.first/x.tHigh).toBeCloseTo(Math.log(3)/Math.log(2),12);expect(astable({supply:15}).period).toBe(x.period)
})
it('checks monostable timeout against independent RK4 propagation including nonzero initial charge',()=>{
 for(const initial of [0,.1,.3]){const x=monostable({initial});let v=x.v0;const dt=x.duration/1000,f=v=>(5-v)/x.tau;for(let i=0;i<1000;i++){const a=f(v),b=f(v+dt*a/2),c=f(v+dt*b/2),d=f(v+dt*c);v+=dt*(a+2*b+2*c+d)/6}expect(v).toBeCloseTo(10/3,11);expect(x.at(x.duration)).toBeCloseTo(v,11)}
 expect(monostable().duration*1000).toBeCloseTo(1.09861228866811,12);expect(monostable({initial:.3}).duration).toBeLessThan(monostable().duration)
})
it('recovers RMS-calibrated lock-in output and integrates the actual mixed noise bands',()=>{
 for(const phase of [-80,0,60]){const a=lockin({phase});let sum=0;for(let n=0;n<8192;n++){const t=2*Math.PI*(n+.5)/8192;sum+=Math.SQRT2*1e-6*Math.cos(t+a.angle)*Math.SQRT2*Math.cos(t)/8192}expect(sum).toBeCloseTo(a.X,17);expect(Math.hypot(a.X,a.Y)).toBeCloseTo(1e-6,17)}
 for(const enbw of [.1,1,10,1000]){const a=lockin({enbw}),n=200000,end=Math.atan((a.bandwidth+a.carrier)/a.corner);let integral=0;for(let k=0;k<n;k++){const angle=(k+.5)*end/n,f=a.corner*Math.tan(angle),bands=(Math.abs(f-a.carrier)<a.bandwidth?1:0)+(f+a.carrier<a.bandwidth?1:0);integral+=.5*bands*a.corner*end/n}expect(integral/a.effective).toBeCloseTo(1,5)}
 expect(lockin().snrIn).toBeCloseTo(-10,12);expect(lockin().snrOut).toBeCloseTo(40,4);expect(lockin().corner).toBeCloseTo(2/Math.PI,12);expect(lockin({enbw:10}).tau/lockin().tau).toBeCloseTo(.1,12)
})
it('checks bias-current KVL, emitter degeneration and the full temperature derivative',()=>{
 for(const rise of [0,30,60])for(const tracking of [0,.5,1])for(const emitter of [0,.22,1]){const p={rise,tracking,emitter},x=biasCurrent(p),dh=.0001,num=(biasCurrent({...p,rise:rise+dh}).current-biasCurrent({...p,rise:rise-dh}).current)/(2*dh);expect(Math.abs(x.residual)).toBeLessThan(1e-12);expect(x.slope).toBeCloseTo(num,8);if(tracking===1)expect(x.current).toBeCloseTo(.05,12)}
 expect(biasCurrent({tracking:0,emitter:0}).current).toBeGreaterThan(biasCurrent({tracking:0,emitter:1}).current);expect(biasCurrent({rise:60,tracking:0,emitter:0}).loop).toBeGreaterThan(1);expect(biasCurrent({tracking:1}).loop).toBeCloseTo(0,12)
})
it('integrates class-B transistor power and locates maximum heat at 50% efficiency',()=>{
 for(const fraction of [.2,2/Math.PI,Math.sqrt(.8),1]){const x=classB({fraction});let heat=0,out=0,dc=0;for(let n=0;n<20000;n++){const v=x.peak*Math.sin(2*Math.PI*(n+.5)/20000),i=Math.max(v/8,0);heat+=(20-v)*i/20000;out+=v*v/8/20000;dc+=20*Math.abs(v/8)/20000}expect(heat).toBeCloseTo(x.device,6);expect(out).toBeCloseTo(x.power,9);expect(dc).toBeCloseTo(x.dc,6)}
 const x=classB({fraction:2/Math.PI});expect(x.device).toBeCloseTo(x.worst,12);expect(x.efficiency).toBeCloseTo(.5,12);expect(x.worst).toBeCloseTo(5.06605918211689,12);expect(classB().meets).toBe(true);expect(classB({theta:20}).meets).toBe(false);expect(classB({supply:30,load:4,fraction:1}).electricalOK).toBe(false)
})
