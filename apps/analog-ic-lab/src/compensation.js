import {solve,solveAC,solveComplex,complex,loopCrossings,expm,matVecMul,transferOf,rootsOf} from '@ee-labs/network'
import {tfAt} from './architectures.js'
const {cabs,cadd,cdiv}=complex
const R=(id,a,b,value)=>({type:'R',id,nodes:[a,b],value}),C=(id,a,b,value)=>({type:'C',id,nodes:[a,b],value}),G=(id,a,b,p,m,gain)=>({type:'VCCS',id,nodes:[a,b],ctrl:[p,m],gain})
const V={type:'V',id:'V1',nodes:['in','gnd'],value:1}
const transpose=a=>a[0].map((_,i)=>a.map(r=>r[i]))
export function stateFrom(cap,conductance,drive){return {A:transpose(transpose(conductance).map(col=>solve(cap,col.map(x=>-x)))),B:solve(cap,drive)}}
export function stateTransfer(A,B,output){
 // A normalized-time RC realization avoids dependent capacitor states in the
 // original nodal circuit. Every capacitor here is 1 F; q=s/scale.
 const scale=1e8,elements=[V]
 for(let i=0;i<A.length;i++){elements.push(C('C'+i,'x'+i,'gnd',1));for(let j=0;j<A.length;j++)if(A[i][j])elements.push(G(`G${i}_${j}`,'gnd','x'+i,'x'+j,'gnd',A[i][j]/scale));if(B[i])elements.push(G('B'+i,'gnd','x'+i,'in','gnd',B[i]/scale))}
 const raw=transferOf({elements},{input:'V1',output:'x'+output,band:[1e-7,1e3],points:51,tol:1e-7})
 return {b:raw.b.map((v,i)=>v*scale**(raw.a.length-raw.b.length+i)),a:raw.a.map((v,i)=>v*scale**i),check:raw.check}
}
export function stateResponse(A,B,output,feedback=1,end=300e-9,n=301){
 const closed=A.map((row,i)=>row.map((v,j)=>v-(j===output?feedback*B[i]:0))),aug=closed.map((row,i)=>[...row,B[i]*.001]);aug.push(Array(A.length+1).fill(0))
 const step=expm(aug.map(row=>row.map(v=>v*end/(n-1))));let state=[...Array(A.length).fill(0),1]
 const points=[];for(let i=0;i<n;i++){points.push({x:i*end/(n-1),y:state[output]});state=matVecMul(step,state)}return {points,closed}
}
export function compensated({cc=1e-12,rz=0,gm2=500e-6,cl=2e-12}={}){
 const gm1=200e-6,c1=.1e-12,g1=2e-6,g2=10e-6
 const tf={b:[gm1*cc*(gm2*rz-1),gm1*gm2],a:[rz*cc*c1*cl,c1*cl+rz*cc*(g1*cl+g2*c1)+cc*(c1+cl),g1*cl+g2*c1+rz*cc*g1*g2+cc*(g1+g2+gm2),g1*g2]};while(tf.a[0]===0)tf.a.shift();if(tf.b[0]===0)tf.b.shift()
 const cap=rz?[[c1,0,0],[0,cl,0],[0,0,cc]]:[[c1+cc,-cc],[-cc,cl+cc]]
 // x=[va,vo,vc], vc across Cc from a to the resistor junction. For rz=0 use [va,vo].
 const g=rz?[[g1+1/rz,-1/rz,-1/rz],[gm2-1/rz,g2+1/rz,1/rz],[-1/rz,1/rz,1/rz]]:[[g1,0],[gm2,g2]],drive=rz?[-gm1,0,0]:[-gm1,0]
 const {A,B}=stateFrom(cap,g,drive),at=f=>tfAt(tf,f),margin=loopCrossings(at),end=4/margin.crossover,response=stateResponse(A,B,1,1,end)
 const closedTF={a:tf.a.map((v,i)=>v+(tf.b[i-(tf.a.length-tf.b.length)]??0))},closedPoles=rootsOf(closedTF.a),zero=Math.abs(gm2*rz-1)<1e-12?null:gm2/(cc*(1-gm2*rz))
 const net={elements:[V,G('G1','a','gnd','in','gnd',gm1),G('G2','out','gnd','a','gnd',gm2),R('R1','a','gnd',1/g1),R('R2','out','gnd',1/g2),C('C1','a','gnd',c1),C('CL','out','gnd',cl),C('Cc','a',rz?'z':'out',cc),...(rz?[R('Rz','z','out',rz)]:[])]}
 return {cc,rz,gm1,gm2,cl,c1,g1,g2,tf,A,B,cap,g,drive,at,net,...margin,response,closedPoles,stable:closedPoles.every(p=>p[0]<0),poles:rootsOf(tf.a),zero,nulling:1/gm2,approxCancel:(1+cl/cc)/gm2,estimate:gm1/(2*Math.PI*cc),slew:20e-6/cc,dc:gm1*gm2/(g1*g2)}
}
export function nested({outer=2e-12,inner=1e-12,feed=0,gm3=2e-3,cl=5e-12}={}){
 const gm1=100e-6,gm2=500e-6,g1=5e-6,g2=20e-6,g3=50e-6,c1=.2e-12,c2=.5e-12,ci=feed?0:inner,gff=feed?500e-6:0
 const cap=[[c1+outer,0,-outer],[0,c2+ci,-ci],[-outer,-ci,cl+outer+ci]],g=[[g1,0,0],[-gm2,g2,0],[gff,gm3,g3]],drive=[-gm1,0,0]
 const {A,B}=stateFrom(cap,g,drive),tf=stateTransfer(A,B,2),at=f=>tfAt(tf,f),margin=loopCrossings(at)
 // Conditional inner-loop test: clamp first-stage node a to AC ground.
 // Co still loads the output. Break gm3 and retain the inner capacitor.
 const innerAt=f=>{const w=2*Math.PI*f,mat=[[[g2,w*(c2+ci)],[0,-w*ci]],[[0,-w*ci],[g3,w*(cl+outer+ci)]]],v=solveComplex(mat,[[0,0],[-gm3,0]]);return v[0].map(z=>-z)},local=loopCrossings(innerAt)
 const response=stateResponse(A,B,2,1,4/margin.crossover),closedTF={a:tf.a.map((v,i)=>v+(tf.b[i-(tf.a.length-tf.b.length)]??0))},closedPoles=rootsOf(closedTF.a)
 const net={elements:[V,G('G1','a','gnd','in','gnd',gm1),G('G2','gnd','b','a','gnd',gm2),G('G3','out','gnd','b','gnd',gm3),R('R1','a','gnd',1/g1),R('R2','b','gnd',1/g2),R('R3','out','gnd',1/g3),C('C1','a','gnd',c1),C('C2','b','gnd',c2),C('CL','out','gnd',cl),C('Co','a','out',outer),...(ci?[C('Ci','b','out',ci)]:[]),...(gff?[G('Gff','out','gnd','a','gnd',gff)]:[])]}
 return {outer,inner:ci,feed,gm1,gm2,gm3,g1,g2,g3,c1,c2,cl,gff,cap,g,drive,A,B,tf,at,innerAt,local,...margin,response,net,poles:rootsOf(tf.a),zeros:rootsOf(tf.b),closedPoles,stable:closedPoles.every(p=>p[0]<0)}
}
export const nativeCompensation=(x,f)=>solveAC(x.net,2*Math.PI*f,{sources:{V1:[1,0]},anyFreq:true}).v.out
export const gainDb=z=>20*Math.log10(Math.max(1e-30,cabs(z)))
export const closedAt=(x,f)=>cdiv(x.at(f),cadd([1,0],x.at(f)))
