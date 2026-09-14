// Closed forms for stated receiver models, not a universal optical sensitivity.
// White independent shot/thermal current noise, rectangular noise bandwidth,
// Gaussian OOK decision criterion, and an ideal Poisson photon-counting limit.
import {Q_E,positive,nonNegative} from './const.js'
import {photonEnergy} from './photon.js'
const KB=1.380649e-23
export function receiverNoise({current=1e-6,dark=0,resistance=1000,temperature=300,bandwidth=1e9,capacitance=.1e-12}={}){
  nonNegative(current,'current');nonNegative(dark,'dark');positive(resistance,'resistance');positive(temperature,'temperature');positive(bandwidth,'bandwidth');positive(capacitance,'capacitance')
  const shotPSD=2*Q_E*(current+dark),thermalPSD=4*KB*temperature/resistance,fc=1/(2*Math.PI*resistance*capacitance),effectiveBandwidth=fc*Math.atan(bandwidth/fc)
  return {shotPSD,thermalPSD,shotDensity:Math.sqrt(shotPSD),thermalDensity:Math.sqrt(thermalPSD),shotRms:Math.sqrt(shotPSD*bandwidth),thermalRms:Math.sqrt(thermalPSD*bandwidth),totalRms:Math.sqrt((shotPSD+thermalPSD)*bandwidth),crossoverCurrent:2*KB*temperature/(Q_E*resistance),fc,effectiveBandwidth,filteredThermalRms:Math.sqrt(thermalPSD*effectiveBandwidth)}
}
export function ookSensitivity({Q=6,responsivity=1,...noise}={}){
  positive(Q,'Q');positive(responsivity,'responsivity')
  const x=receiverNoise({...noise,current:0}),B=noise.bandwidth??1e9,sigma0=x.totalRms,b=2*Q_E*B
  // I1 = Q(sqrt(sigma0² + b I1) + sigma0); positive root.
  const oneCurrent=2*Q*sigma0+b*Q*Q,sigma1=Math.sqrt(sigma0*sigma0+b*oneCurrent),thermalPower=Q*x.thermalRms/responsivity,power=oneCurrent/(2*responsivity)
  return {Q,sigma0,sigma1,oneCurrent,power,dbm:10*Math.log10(power/.001),thermalPower,thermalDbm:10*Math.log10(thermalPower/.001),checkQ:oneCurrent/(sigma0+sigma1)}
}
export function photonCountingLimit({onePhotons=20,lambda=1550e-9,rate=1e9}={}){
  positive(onePhotons,'onePhotons');positive(rate,'rate')
  const energy=photonEnergy(lambda).joules,power=onePhotons*.5*energy*rate
  return {energy,power,dbm:10*Math.log10(power/.001),averagePhotons:onePhotons/2,ber:.5*Math.exp(-onePhotons)}
}
