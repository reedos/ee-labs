import {it,expect} from 'vitest'
import {VT,translinear,bipolar,mosPair,pairLimits,tone,gilbert,vga} from './translinear.js'
import {TRANSLINEAR_LESSONS} from './translinearLessons.js'
import {defaults,evaluate} from '@ee-labs/lessons/model'
import {buildLink,parseLink} from '../../../packages/ui/src/deeplink.js'
import {stateFromLink} from '../../signal-lab/src/fromLink.js'
import {INITIAL} from '../../signal-lab/src/state.js'
it('solves junction voltage KVL independently over three decades and mismatch',()=>{
 for(const i1 of [1e-6,1e-4,1e-3])for(const i2 of [1e-6,1e-3])for(const i3 of [1e-6,1e-3])for(const mismatch of [-.05,0,.05]){const x=translinear({i1,i2,i3,mismatch}),v4=VT*(Math.log(i1/1e-15)+Math.log(i3/1e-15)-Math.log(i2/1e-15));expect(x.i4/(1e-15*(1+mismatch)*Math.exp(v4/VT))).toBeCloseTo(1,12);expect(Math.abs(x.residual)).toBeLessThan(1e-15)}
 expect(translinear().i4).toBeCloseTo(40e-6,14)
})
it('compares the actual branch laws with their tangents at stated compression',()=>{
 for(const error of [.001,.01,.05,.1])for(const overdrive of [.1,.2,.4]){const x=pairLimits({error,overdrive});expect(1-bipolar(x.bjt)/(x.bjt/(2*VT))).toBeCloseTo(error,12);expect(1-mosPair(x.mos,overdrive)/(x.mos/overdrive)).toBeCloseTo(error,12);expect(mosPair(x.mosFull,overdrive)).toBeCloseTo(1,12);expect(bipolar(x.bjt99)).toBeCloseTo(.99,12)}
 expect(mosPair(-1)).toBe(-1);expect(bipolar(.1)).toBeLessThan(1)
})
it('recovers coherent sidebands, the hard-switch limit and carrier imbalance',()=>{
 const x=gilbert({signal:.0001,mismatch:0}),bad=gilbert({signal:.02,mismatch:0}),smallLO=gilbert({hard:0,lo:.01,mismatch:0}),largeLO=gilbert({hard:0,lo:.5,mismatch:0}),leak=gilbert({mismatch:.01})
 expect(x.conversion).toBeCloseTo(2/Math.PI,5);expect(x.lower/x.upper).toBeCloseTo(1,4);expect(x.feed).toBeLessThan(1e-14);expect(bad.conversion).toBeLessThan(x.conversion);expect(smallLO.conversion).toBeLessThan(largeLO.conversion);expect(leak.feed).toBeCloseTo(4/Math.PI*.01,7)
 // Independent product identity: sin(a)sin(b)=(cos(a-b)-cos(a+b))/2.
 const y=Array.from({length:8192},(_,i)=>{const t=(i+.5)/8192;return .7*Math.sin(2*Math.PI*4*t)*Math.sin(2*Math.PI*40*t)});expect(tone(y,36)).toBeCloseTo(.35,12);expect(tone(y,44)).toBeCloseTo(.35,12);expect(tone(y,40)).toBeLessThan(1e-14)
})
it('limits current before applying the logarithmic display',()=>{expect(vga({control:.0001}).gainDb).toBeCloseTo(-20,12);expect(vga({control:.01}).gainDb).toBeCloseTo(20*Math.log10(5),12);expect(vga({control:.01}).limited).toBe(true);for(const control of [.0001,.001,.01]){const x=vga({control});expect(x.at(x.rawDelta)).toBeCloseTo(x.realized,12)}})
it('labels the Signal Lab sine multiplier as a baseline comparison and preserves its parameters',()=>{const l=TRANSLINEAR_LESSONS[2],x=evaluate(l,defaults(l)),h=x.handover,{state:recv,warnings}=stateFromLink(parseLink(buildLink(h.patch)).patch,INITIAL);expect(warnings).toEqual([]);expect(h.note).toMatch(/does not transfer/);expect(recv.blocks[0].type).toBe('ringmod');expect(recv.blocks[0].params.freq).toBe(10000);expect(recv.sources[0].freq).toBe(1000);expect(recv.sources[0].amp).toBeCloseTo(.001/(2*VT),7)})
