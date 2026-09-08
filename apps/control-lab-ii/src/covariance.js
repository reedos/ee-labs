import {rng,sampleMean,chi2Inv} from '@ee-labs/random'
// Discrete two-state constant-velocity model with a fresh constant acceleration
// disturbance per interval. Covariance is [Ppp, Ppv, Pvv]; symmetry is structural.
export function covarianceStep(P,{dt=.1,q=1,r=.04}={}) {
  if(!(dt>0&&q>0&&r>0)||P.length!==3||P.some(v=>!Number.isFinite(v)))throw Error('Use positive sampling interval and noise variances, with a finite covariance.')
  const [a,b,d]=P,prior=[a+2*dt*b+dt*dt*d+q*dt**4/4,b+dt*d+q*dt**3/2,d+q*dt*dt],S=prior[0]+r,K=[prior[0]/S,prior[1]/S],h=1-K[0]
  // Joseph update: (I-KH)P-(I-KH)' + KrK', retaining positivity numerically.
  const posterior=[h*h*prior[0]+K[0]**2*r,h*(prior[1]-K[1]*prior[0])+K[0]*K[1]*r,prior[2]-2*K[1]*prior[1]+K[1]**2*S]
  return {prior,posterior,K,S}
}
export function covarianceHistory(p={}) {
  let P=[p.p0??1,0,p.p0??1]
  const history=[]
  for(let k=1;k<=100;k++){const x=covarianceStep(P,p);history.push({k,...x});P=x.posterior}
  let steady=[1,0,1],iterations=0,residual
  do {const next=covarianceStep(steady,p).posterior;residual=Math.max(...next.map((v,i)=>Math.abs(v-steady[i])));steady=next;iterations++}while(residual>1e-12*Math.max(1,...steady)&&iterations<20000)
  if(iterations===20000)throw Error('Steady covariance has not converged to the stated tolerance.')
  return {history,steady:covarianceStep(steady,p),iterations,residual}
}
export function covarianceEnsemble(p={}) {
  const dt=p.dt??.1,q=p.q??1,r=p.r??.04,p0=p.p0??1,runs=p.runs??500,scale=p.actualScale??1
  const model=covarianceHistory(p),gen=rng(p.seed??42),errors=Array.from({length:100},()=>[]),velocityErrors=[],first=[]
  for(let run=0;run<runs;run++){
    let position=gen.normal(0,Math.sqrt(p0)),velocity=gen.normal(1,Math.sqrt(p0)),estimateP=0,estimateV=1
    for(let i=0;i<100;i++){
      const acceleration=gen.normal(0,Math.sqrt(q)),measurementNoise=gen.normal(0,Math.sqrt(r*scale))
      position+=dt*velocity+dt*dt/2*acceleration;velocity+=dt*acceleration
      const measurement=position+measurementNoise,predictedP=estimateP+dt*estimateV,innovation=measurement-predictedP,K=model.history[i].K
      estimateP=predictedP+K[0]*innovation;estimateV+=K[1]*innovation
      errors[i].push(estimateP-position)
      if(i===99)velocityErrors.push(estimateV-velocity)
      if(run===0)first.push({k:i+1,position,measurement,estimate:estimateP,error:estimateP-position})
    }
  }
  const stats=values=>{
    const bias=sampleMean(values),variance=values.reduce((s,x)=>s+(x-bias.value)**2,0)/(runs-1),df=runs-1
    return {bias,variance,ci:[df*variance/chi2Inv(.975,df),df*variance/chi2Inv(.025,df)]}
  }
  return {...model,first,position:stats(errors[99]),velocity:stats(velocityErrors),variance:errors.map(values=>stats(values).variance),runs}
}
