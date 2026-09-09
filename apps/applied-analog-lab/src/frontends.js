// Sensor front ends: each error is referred to the physical input before comparison.
export function highSide({current=1,shunt=.1,common=12,gain=1,tolerance=.001,cmrr=100}={}) {
  const a=gain*(1+tolerance)/(1-tolerance),b=gain*(1-tolerance)/(1+tolerance)
  const ac=(b-a)/(1+b),ad=((1+a)*b/(1+b)+a)/2,signal=current*shunt
  const commonError=ac*common/gain,gainError=(ad/gain-1)*signal,integratedError=common/10**(cmrr/20)
  return {a,b,ac,ad,signal,power:current*current*shunt,commonError,gainError,integratedError,output:ad*signal+ac*common,error:commonError+gainError}
}
export function lowSide({current=1,shunt=.1,trace=.01,kelvin=1}={}) {
  const signal=current*shunt,ground=current*(shunt+trace),traceDrop=current*trace,measured=signal+(kelvin?0:traceDrop)
  return {signal,ground,traceDrop,measured,inferred:measured/shunt,power:current*ground,error:measured/shunt-current}
}
// Local linear Pt100 law, deliberately distinguished from the full IEC CVD law.
export function rtd({temp=0,current=.001,lead=.5,theta=500}={}) {
  const r0=100,slope=.3851,cth=.002,ambient=r0+slope*temp,feedback=theta*current**2*slope
  const resistance=ambient/(1-feedback),rise=theta*current**2*resistance,tau=theta*cth/(1-feedback)
  return {r0,slope,cth,ambient,feedback,resistance,rise,tau,power:current**2*resistance,sensitivity:current*slope,leadError:2*lead/slope,twoWire:temp+rise+2*lead/slope,fourWire:temp+rise,at:t=>rise*(-Math.expm1(-t/tau))}
}
// ITS-90 type K direct reference function, 0..1372 °C, output converted mV -> V.
export const K_COEFFICIENTS=[-.176004136860e-1,.389212049750e-1,.185587700320e-4,-.994575928740e-7,.318409457190e-9,-.560728448890e-12,.560750590590e-15,-.320207200030e-18,.971511471520e-22,-.121047212750e-25]
export function typeK(t) {return (K_COEFFICIENTS.reduceRight((a,c)=>a*t+c,0)+.1185976*Math.exp(-.1183432e-3*(t-126.9686)**2))/1000}
export function inverseK(v) {if(v<typeK(0)||v>typeK(1372))return null;let lo=0,hi=1372;for(let i=0;i<55;i++){const m=(lo+hi)/2;if(typeK(m)<v)lo=m;else hi=m}return (lo+hi)/2}
export function thermocouple({hot=500,cold=25,coldError=1,offset=.001,gain=200}={}) {
  const hotV=typeK(hot),coldV=typeK(cold),signal=hotV-coldV,measured=signal+offset,corrected=measured+typeK(cold+coldError),estimate=inverseK(corrected)
  const sensitivity=(typeK(hot+.001)-typeK(hot-.001))/.002,coldSensitivity=(typeK(cold+.001)-typeK(cold-.001))/.002
  return {hotV,coldV,signal,measured,corrected,estimate,error:estimate===null?null:estimate-hot,output:gain*measured,sensitivity,coldSensitivity,offsetEstimate:offset/sensitivity,coldEstimate:coldError*coldSensitivity/sensitivity,linearEstimate:measured/41e-6+cold+coldError,gainFor10:10/typeK(1000)}
}
export function antiAlias({clock=1e6,band=1e5,rejection=74,ripple=.1,order=5,corner=150e3}={}) {
  const stop=clock-band,ep=Math.expm1(ripple*Math.LN10/10),es=Math.expm1(rejection*Math.LN10/10)
  const exact=Math.log(es/ep)/(2*Math.log(stop/band)),required=Math.ceil(exact),minimum=band/ep**(1/(2*order)),maximum=stop/es**(1/(2*order))
  const loss=f=>10*Math.log10(1+(f/corner)**(2*order)),pass=loss(band),attenuation=loss(stop)
  return {stop,ep,es,exact,required,minimum,maximum,loss,pass,attenuation,feasible:minimum<=maximum,meets:pass<=ripple&&attenuation>=rejection,alias:f=>Math.abs(((f+clock/2)%clock+clock)%clock-clock/2)}
}
