import {solveDC} from '@ee-labs/network'
import {n} from './derivationMath.js'
const el=(type,id,a,b,value)=>({type,id,nodes:[a,b],value})
const step=(title,text,...latex)=>({title,text,latex:latex.map(s=>`&${s}`)})
export function completionDependent(base,groups){
  const dependent=p=>({type:'VCVS',id:'V2',nodes:['b','gnd'],ctrl:['A','gnd'],gain:p.mu})
  const exp={id:'e10',name:'Dependent sources stay active during a resistance test',group:groups[4],prerequisites:['e1','d8'],terms:['dependent','thevenin','kcl'],show:'v',view:'equations',views:['reading','equations','power'],claim:{},
    params:[{key:'I1',label:'Source I₁',unit:'A',default:.002,min:-.01,max:.01,scale:'linear'},{key:'mu',label:'Voltage gain μ',unit:'',default:.5,min:0,max:.9,scale:'linear'},...['R1','RL'].map(key=>({key,label:key==='R1'?'R₁':'Load R_L',unit:'Ω',default:2000,min:100,max:20000,scale:'log'}))],
    net:p=>({elements:[el('I','I1','gnd','A',p.I1),el('R','R1','A','b',p.R1),dependent(p),el('R','RL','A','gnd',p.RL)]}),
    layout:{w:600,h:260,items:[{el:'I1',x:60,y:140,dir:'v',flip:true},{el:'RL',x:220,y:140,dir:'v'},{el:'V2',x:470,y:140,dir:'v'},{el:'R1',x:350,y:50,dir:'h'},...[[60,120],[220,120],[470,120]].map(([xx,yy])=>({wire:[xx,50,xx,yy]})),...[60,220,470].map(xx=>({wire:[xx,160,xx,220]})),{wire:[60,50,330,50]},{wire:[370,50,470,50]},{wire:[60,220,470,220]},{gnd:[220,220]},{node:'A',x:220,y:50,side:'t'},{node:'b',x:470,y:50,side:'t'}]},
    headline:{label:'the voltage at the load port',tag:'v_A',unit:'V',where:null,value:x=>x.sol.v.A},closedHeadline:p=>p.I1/(1/p.RL+(1-p.mu)/p.R1),
    lesson:{see:'The diamond source holds v_b = μv_A. Its controlling voltage is the port voltage itself, so a test at that port changes the dependent source as well.',why:'Only independent sources are deactivated when finding the resistance seen at a port. The controlled source is a circuit law and must remain in the equations. The displayed gain is below one so this example has positive port resistance.',try:[{say:'Set μ to zero and compare the test resistance with R₁.',set:{mu:0},reads:[]},{say:'Set μ to 0.5 and explain why the measured resistance is twice R₁.',set:{mu:.5},reads:[]}]},
    study:(id,p,x)=>{
      const r=p.R1/(1-p.mu),voc=p.I1*r,v=p.I1/(1/p.RL+1/r)
      const test=solveDC({elements:[dependent(p),el('R','R1','A','b',p.R1),el('V','Vt','A','gnd',1)]})
      return {title:'Measure Thévenin resistance with the controlled source active',intro:'The port is A to ground. I₁ injects current into A. R₁ joins A to b, and the controlled voltage source imposes v_b = μv_A. The dimensionless gain μ remains fixed throughout a test.',steps:[
        step('Open the load and apply KCL','Remove only RL. The source current flows through R₁, whose voltage is vA − μvA. Solve for the open-circuit voltage.',String.raw`I_1=\frac{v_A-\mu v_A}{R_1},\qquad V_{\mathrm{Th}}=\frac{I_1R_1}{1-\mu}=${n(voc)}\,\mathrm V`),
        step('Deactivate the independent current source','Replace I₁ by an open circuit. Keep the diamond source and its control law. Attach a 1 V test source at A relative to ground, with test current entering the network.',String.raw`V_t=1\,\mathrm V,\quad v_b=\mu V_t,\quad I_t=\frac{V_t-v_b}{R_1}=\frac{1-\mu}{R_1}V_t`),
        step('Divide test voltage by entering test current','The solver current of Vt points into the test source, opposite the current entering the network. Use its negative when forming the measured resistance.',String.raw`R_{\mathrm{Th}}=\frac{V_t}{I_t}=\frac{R_1}{1-\mu}=\frac{${n(p.R1)}}{1-${n(p.mu)}}=${n(r)}\,\Omega`,String.raw`I_t=-i_{Vt}=${n(-test.i.Vt)}\,\mathrm A`),
        step('Restore the source and load','Use the equivalent divider and compare with KCL in the original circuit. The Norton current is VTh/RTh = I₁ in this particular network.',String.raw`v_L=V_{\mathrm{Th}}\frac{R_L}{R_{\mathrm{Th}}+R_L}=${n(v)}\,\mathrm V`,String.raw`I_1=\frac{v_L}{R_L}+\frac{(1-\mu)v_L}{R_1}`),
      ],advantage:'A test source works when passive series/parallel reduction fails because controlled sources remain in the network.',limitation:'At μ = 1 this port has no finite resistance; above one it has negative incremental resistance. Those active cases need additional stability analysis and are outside this lesson’s knob range.',checks:[{label:'test resistance',predicted:r,measured:1/(-test.i.Vt),unit:'Ω',tol:1e-8,abs:1e-8},{label:'loaded port voltage',predicted:v,measured:x.sol.v.A,unit:'V',tol:1e-8,abs:1e-9}],practice:{prompt:'Apply a 2 V test instead of 1 V, with I₁ deactivated and RL removed. Calculate current entering the network.',target:2/r,unit:'A',hint:'Use It = (1 − μ)Vt/R₁. Doubling the test voltage doubles current, leaving resistance unchanged.'}}
    }}
  return exp
}
