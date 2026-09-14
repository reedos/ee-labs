// Shared first-order bandgap law; both analog labs use the same junction model.
import {thermalVoltage} from './diode.js'
import {vbeSlope} from './junction.js'
export const BG={t0:300,eg:1.206,vbe0:.650,eta:3}
export function bandgap({temperature=300,n=8,m}={}){
 const {t0,eg,vbe0,eta}=BG,ut=thermalVoltage(temperature),vbe=eg+(vbe0-eg)*temperature/t0-eta*ut*Math.log(temperature/t0),ptat=ut*Math.log(n),slopePTAT=thermalVoltage(1)*Math.log(n),slopeCTAT=vbeSlope({vbe,eg,xti:eta},temperature),optimum=-vbeSlope({vbe:vbe0,eg,xti:eta},t0)/slopePTAT,weight=m??optimum
 const stationaryTemperature=t0*Math.exp(((vbe0-eg)/t0+weight*thermalVoltage(1)*Math.log(n))/(eta*thermalVoltage(1))-1)
 return{vbe,ptat,weight,optimum,stationaryTemperature,reference:vbe+weight*ptat,slopePTAT,slopeCTAT,slope:slopeCTAT+weight*slopePTAT}
}
