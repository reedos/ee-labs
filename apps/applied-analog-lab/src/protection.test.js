import {it,expect} from 'vitest'
import {complex} from '@ee-labs/network'
import {clamp,inputStage,groundLoop,shield,shieldLink} from './protection.js'
import {buildLink,parseLink} from '../../../packages/ui/src/deeplink.js'
const {cadd,csub,cmul,cdiv,cabs}=complex
it('checks both diode regions against native PWL and conserves fault power',()=>{
 for(const input of [-100,-12.3,-5,0,12.3,100])for(const resistance of [100,1000,8770,20000]){const x=clamp({input,resistance});expect(x.native.sol.v.pin).toBeCloseTo(x.pin,8);expect(x.native.sol.i.DH-x.native.sol.i.DL).toBeCloseTo(x.current,9);expect(input*x.current).toBeCloseTo(x.power+x.pin*x.current,9);expect(x.energy).toBeCloseTo(x.power*1e-4,14)}
 expect(clamp().required).toBeCloseTo(8770,9);expect(clamp().current).toBeCloseTo(.0877,12);expect(clamp({resistance:8770}).current).toBeCloseTo(.01,12)
 expect(inputStage({input:5.2}).current).toBe(0);expect(inputStage({input:5.2}).linear).toBe(false);expect(inputStage({input:4.4}).linear).toBe(true)
})
it('separates common-mode rejection from the actual return voltage',()=>{const a=groundLoop(),b=groundLoop({cmrr:120});expect(a.ground).toBe(.001);expect(a.error).toBeCloseTo(1e-8,18);expect(b.error/a.error).toBeCloseTo(.1,14);expect(b.single).toBe(a.single)})
it('matches the driven-shield transfer to a direct two-node complex solve',()=>{
 for(const length of [.2,1,5])for(const ro of [10,50,200])for(const resistance of [1000,10000,100000]){
 const p={length,ro,resistance},x=shield(p),gc=1/resistance,go=1/ro
 for(const f of [1000,1e5,1e6,1e8]){const yc=[0,2*Math.PI*f*x.cable],yl=[0,2*Math.PI*f*x.load],A=[0,-x.wt/(2*Math.PI*f)],m11=cadd([gc,0],yc),m12=cmul([-1,0],yc),m21=cmul([-1,0],cadd(cmul([go,0],A),yc)),m22=cadd(cadd([go,0],cmul([go,0],A)),cadd(yl,yc)),det=csub(cmul(m11,m22),cmul(m12,m21)),v=cdiv(cmul([gc,0],m22),det),w=cdiv(cmul([-gc,0],m21),det);expect(cabs(csub(v,x.at(f)))/Math.max(1,cabs(v))).toBeLessThan(1e-11);expect(cabs(csub(cdiv(w,v),x.tracking(f)))).toBeLessThan(1e-10)}
 expect(x.stable).toBe(x.routh>0);if(x.stable)expect(cabs(x.at(x.corner))).toBeCloseTo(Math.SQRT1_2,10);else expect(x.corner).toBeNull()
 }
 expect(shield().stable).toBe(true);expect(shield({length:5,ro:200,gbw:20e6}).stable).toBe(false)
})
it('exports every coefficient of the full return ratio, including source coupling',()=>{const x=shield(),link=shieldLink(x),{patch:parsed}=parseLink(buildLink(link.patch));expect(parsed.plant.type).toBe('custom3');expect(parsed.plant.params).toEqual([0,0,0,x.wt,...x.loop.a]);expect(link.note).toMatch(/not the source-to-signal/);expect(parsed.ctrl.params).toEqual([1])})
