// Long-channel charge-based EKV saturation model. One voltage-charge relation
// determines both current and gm, so numerical differentiation is a real check.
// This is a generic teaching process, not a foundry PDK or a BSIM replacement.
export const PROCESS={n:1.5,vt:.025852,kp:200e-6,cox:8.63e-3,vth:.45,earlyPerUm:10,avt:.004,abeta:.01,esat:5e6,gamma:.4,phi:.6}
export const specific=2*PROCESS.n*PROCESS.kp*PROCESS.vt**2
export function inversion(ic){
  if(!(ic>0))throw Error('Inversion coefficient must be positive.')
  const charge=2*ic/(1+Math.sqrt(1+4*ic)),gmid=1/(PROCESS.n*PROCESS.vt*(1+charge)),vov=PROCESS.n*PROCESS.vt*(2*charge+Math.log(charge))
  return {ic,charge,gmid,vov,jd:specific*ic,region:ic<.1?'weak':ic>10?'strong':'moderate'}
}
export function atOverdrive(vov){let lo=1e-14,hi=1e5;for(let i=0;i<90;i++){const mid=Math.sqrt(lo*hi);if(inversion(mid).vov<vov)lo=mid;else hi=mid}return inversion(Math.sqrt(lo*hi))}
export function sizeFor({gmid=10,gm=500e-6,length=1e-6}={}){
  const ceiling=1/(PROCESS.n*PROCESS.vt)
  if(!(gmid>0&&gmid<ceiling&&gm>0&&length>0))throw Error('Choose positive gm and length, with gm/ID strictly below the weak-inversion ceiling.')
  const charge=ceiling/gmid-1,ic=charge*(charge+1),id=gm/gmid,ratio=id/(specific*ic),width=ratio*length,area=width*length,ro=PROCESS.earlyPerUm*(length*1e6)/id,cgs=2*PROCESS.cox*area/3,ft=gm/(2*Math.PI*cgs)
  return {...inversion(ic),id,ratio,width,area,ro,gain:gm*ro,cgs,ft}
}
export function matching({area=2.5,gmid=10}={}){
  if(area<.25)throw Error('Pelgrom coefficients are declared only for area ≥ 0.25 μm²; the smaller-area prediction is declined.')
  const vth=PROCESS.avt/Math.sqrt(area),beta=PROCESS.abeta/Math.sqrt(area)
  return {vth,beta,offset:Math.hypot(vth,beta/gmid),mirror:Math.hypot(gmid*vth,beta),targetArea:PROCESS.avt**2+PROCESS.abeta**2/gmid**2}
}
export function shortChannel({length=.18e-6,vov=.3,vsb=.5,velocity=1,body=1,clm=0,vds=1}={}){
  const shift=body?PROCESS.gamma*(Math.sqrt(PROCESS.phi+vsb)-Math.sqrt(PROCESS.phi)):0,u=Math.max(0,vov-shift),z=velocity?u/(PROCESS.esat*length):0,ratio=1/(1+z),longId=PROCESS.kp*u*u/2,clmFactor=clm?1+vds/(PROCESS.earlyPerUm*length*1e6):1,id=longId*ratio*clmFactor,gm=PROCESS.kp*u*(1+z/2)/(1+z)**2*clmFactor
  return {shift,u,z,ratio,id,longId,gm,gmRatio:u?gm/(PROCESS.kp*u*clmFactor):0,gmbRatio:body?PROCESS.gamma/(2*Math.sqrt(PROCESS.phi+vsb)):0,clmFactor}
}
