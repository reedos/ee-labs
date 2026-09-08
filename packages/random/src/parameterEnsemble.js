import {rng} from './prng.js'
import {sampleMean,proportion} from './estimate.js'
// The sampler owns parameter correlations; the evaluator can be any circuit model.
export function parameterEnsemble({sample,evaluate,accept=()=>true,seed=42,count=2048}){
 if(!Number.isInteger(count)||count<2||count>65536)throw Error('Ensemble count must be an integer from 2 to 65536.')
 const random=rng(seed),values=[]
 for(let i=0;i<count;i++){const value=evaluate(sample(random,i));if(!Number.isFinite(value))throw Error('Nonfinite ensemble result; inspect the parameter domain.');values.push(value)}
 return{values,mean:sampleMean(values),yield:proportion(values.filter(accept).length,count),seed,count}
}
