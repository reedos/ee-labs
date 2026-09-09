import {byId} from './experiments.js'
// A narrow, validated incoming operating point. Never silently clamp a circuit.
export function buckFromLink(patch){
 if(!patch)return null
 const b=patch.blocks?.[0],keys=['Vin','D','L','C','R','fs']
 if(patch.blocks?.length!==1||b?.type!=='buck'||b.params?.length!==keys.length||patch.plant||patch.ctrl||patch.sources?.length||patch.rate||patch.zoom)return{error:'This link is not a supported buck operating point.'}
 const initialParams=Object.fromEntries(keys.map((key,i)=>[key,b.params[i]]))
 for(const knob of byId.b3.params){const v=initialParams[knob.key];if(!Number.isFinite(v)||v<knob.min||v>knob.max)return{error:`The linked ${knob.key} value is outside this buck model’s range.`}}
 return{initialId:'b3',initialView:'measures',initialParams}
}
