import {solve} from './linalg.js'
/** Instantaneous ideal-switch projection. Each previous[id] is Va-Vb just
 * before switching, with the same physical plate orientation as the new
 * capacitor. Driven conductors supply charge; all other conductors conserve
 * it unless listed as actuators (e.g. an ideal op-amp output). Linear voltage
 * constraints represent the settled feedback condition, not a charge source.
 */
export function chargeStep({capacitors,previous,driven={gnd:0},actuators=[],constraints=[]}){
 const nodes=[...new Set(capacitors.flatMap(c=>[c.a,c.b]))],unknown=nodes.filter(n=>!(n in driven)),floating=unknown.filter(n=>!actuators.includes(n)),old={},C={}
 if(new Set(capacitors.map(c=>c.id)).size!==capacitors.length)throw Error('Capacitor ids must be unique.')
 for(const n of nodes){old[n]=0;C[n]=Object.fromEntries(nodes.map(m=>[m,0]))}
 for(const {id,a,b,c} of capacitors){if(!(c>0&&Number.isFinite(c)&&Number.isFinite(previous[id])))throw Error('Positive capacitance and finite prior voltage required.');old[a]+=c*previous[id];old[b]-=c*previous[id];C[a][a]+=c;C[b][b]+=c;C[a][b]-=c;C[b][a]-=c}
 const A=[],rhs=[]
 for(const n of floating){A.push(unknown.map(m=>C[n][m]));rhs.push(old[n]-Object.entries(driven).reduce((v,[m,x])=>v+(C[n][m]??0)*x,0))}
 for(const {terms,value=0} of constraints){A.push(unknown.map(n=>terms[n]??0));rhs.push(value-Object.entries(driven).reduce((v,[n,x])=>v+(terms[n]??0)*x,0))}
 if(A.length!==unknown.length)throw Error('Charge projection needs one independent equation per unknown node.')
 // Scale rows: physical charge equations can be femtocoulombs while voltage
 // constraints are volts. This leaves the exact linear equations unchanged.
 for(let i=0;i<A.length;i++){const scale=Math.max(...A[i].map(Math.abs));if(!(scale>0))throw Error('Undetermined floating conductor.');A[i]=A[i].map(v=>v/scale);rhs[i]/=scale}
 const solution=solve(A,rhs),voltages={...driven,...Object.fromEntries(unknown.map((n,i)=>[n,solution[i]]))}
 if(Object.values(voltages).some(v=>!Number.isFinite(v)))throw Error('Nonfinite charge projection.')
 const voltage=Object.fromEntries(capacitors.map(c=>[c.id,voltages[c.a]-voltages[c.b]])),injected=Object.fromEntries(nodes.map(n=>[n,nodes.reduce((q,m)=>q+C[n][m]*voltages[m],-old[n])]))
 return{voltages,voltage,injected,energy:capacitors.reduce((e,c)=>e+.5*c.c*voltage[c.id]**2,0)}
}
