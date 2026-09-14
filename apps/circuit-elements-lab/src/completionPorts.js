import {solveDC} from '@ee-labs/network'
import {n} from './derivationMath.js'

const el = (type,id,a,b,value) => ({type,id,nodes:[a,b],value})
const step = (title,text,...latex) => ({title,text,latex:latex.map(s=>`&${s}`)})
const check = (label,predicted,measured,unit) => ({label,predicted,measured,unit,tol:1e-8,abs:1e-9})
const resistor = (key,value) => ({key,label:key.replace(/\d/g,d=>'₀₁₂₃₄₅₆₇₈₉'[d]),unit:'Ω',default:value,min:100,max:10000,scale:'log'})
export const chain = (a,b,c) => [1+a/b,a+c+a*c/b,1/b,1+c/b]
export const multiplyChain = (x,y) => [x[0]*y[0]+x[1]*y[2],x[0]*y[1]+x[1]*y[3],x[2]*y[0]+x[3]*y[2],x[2]*y[1]+x[3]*y[3]]
const matrix = a => String.raw`\begin{bmatrix}${n(a[0])}&${n(a[1])}\\${n(a[2])}&${n(a[3])}\end{bmatrix}`
const passiveT = p => [el('R','R1','in','A',p.R1),el('R','R2','A','gnd',p.R2),el('R','R3','A','n2',p.R3)]

export function portStudy(id,p,x) {
  if (id === 'm3') {
    const first=chain(p.R1,p.R2,p.R3), second=chain(p.R4,p.R5,p.R6), total=multiplyChain(first,second)
    const out=p.V1/(total[0]+total[1]/p.RL), current=out/p.RL, input=(total[2]*p.RL+total[3])*current
    return {title:'Cascade networks while keeping the load in the calculation',
      intro:'Port voltages are measured from the upper terminal to ground. I₁ and I₂ enter each two-port. The chain convention uses −I₂, which leaves the output port and becomes the next network’s entering current.',
      steps:[
        step('Fix the chain convention before multiplying', 'For this orientation the state at the left of a network equals its ABCD matrix times the state at the right. A and D are dimensionless; B has ohms and C has siemens.',String.raw`\begin{bmatrix}V_1\\I_1\end{bmatrix}=\begin{bmatrix}A&B\\C&D\end{bmatrix}\begin{bmatrix}V_2\\-I_2\end{bmatrix}`),
        step('Build one T network from three simpler blocks','A series resistor has voltage drop RI and a shunt resistor has current V/R. Multiply the series, shunt and series blocks in their physical left-to-right order.',String.raw`T=\begin{bmatrix}1&R_a\\0&1\end{bmatrix}\begin{bmatrix}1&0\\1/R_b&1\end{bmatrix}\begin{bmatrix}1&R_c\\0&1\end{bmatrix}=\begin{bmatrix}1+R_a/R_b&R_a+R_c+R_aR_c/R_b\\1/R_b&1+R_c/R_b\end{bmatrix}`,String.raw`T_1=${matrix(first)},\qquad T_2=${matrix(second)}`),
        step('Multiply in the actual signal-path order','The first output voltage and leaving current equal the second input voltage and entering current. Substitute the second equation into the first; this is why the order is T₁T₂.',String.raw`T_{\mathrm{total}}=T_1T_2=${matrix(total)}`),
        step('Apply the load boundary condition','The load current leaves the final two-port, so −I₂ = Vout/RL. The ideal input source holds Vin = V₁. Substitute into the first chain row and solve for Vout.',String.raw`V_{\mathrm{in}}=A V_{\mathrm{out}}+B\frac{V_{\mathrm{out}}}{R_L}`,String.raw`V_{\mathrm{out}}=\frac{V_1}{A+B/R_L}=\frac{${n(p.V1)}}{${n(total[0])}+${n(total[1])}/${n(p.RL)}}=${n(out)}\,\mathrm V`),
        step('Recover currents and check the complete circuit','Use the second chain row for input current. The original six-resistor network is solved independently. Multiplying unloaded voltage gains would miss the current drawn by the second stage.',String.raw`I_L=V_{\mathrm{out}}/R_L=${n(current)}\,\mathrm A`,String.raw`I_{\mathrm{in}}=C V_{\mathrm{out}}+D I_L=${n(input)}\,\mathrm A`),
      ],advantage:'ABCD parameters make cascaded linear networks easy to combine while retaining input and output loading.',limitation:'Matrix order and output-current sign are essential. These are ideal resistor networks; frequency-dependent impedances can replace resistances only within the corresponding linear AC model.',
      checks:[check('loaded output voltage',out,x.sol.v.out,'V'),check('input current',input,-x.sol.i.V1,'A')],
      practice:{prompt:'Disconnect the load in your calculation. What is the open-circuit output voltage?',target:p.V1/total[0],unit:'V',hint:'An open output has zero leaving current. The first row becomes Vin = A Vout.'}}
  }
  const Z=[p.R1+p.R2,p.R2,p.R2,p.R2+p.R3], det=Z[0]*Z[3]-Z[1]*Z[2]
  const Y=[Z[3]/det,-Z[1]/det,-Z[2]/det,Z[0]/det]
  const h=[Z[0]-Z[1]*Z[2]/Z[3],Z[1]/Z[3],-Z[2]/Z[3],1/Z[3]]
  const I=[Y[0]*p.V1+Y[1]*p.V2,Y[2]*p.V1+Y[3]*p.V2]
  const tests=[0,1].map(k=>solveDC({elements:[...passiveT(p),el('I','It','gnd',k?'n2':'in',1)]}))
  const shortTests=[0,1].map(k=>solveDC({elements:[...passiveT(p),el('V','T1','in','gnd',k?0:1),el('V','T2','n2','gnd',k?1:0)]}))
  return {title:id==='m1'?'Measure a two-port with open-circuit tests':'Convert between impedance, admittance and hybrid descriptions',
    intro:'Port 1 is node in to ground; port 2 is n2 to ground. V₁ and V₂ are the port voltages. Both port currents enter the resistor network: I₁ = −iV1 and I₂ = −iV2. R₁ and R₃ are the series arms; R₂ is the shared shunt.',
    steps:[
      step('Write the terminal relation','At the center node, the shunt current is I₁ + I₂. Each port voltage is its own series drop plus the common shunt drop.',String.raw`V_1=R_1 I_1+R_2(I_1+I_2),\qquad V_2=R_3 I_2+R_2(I_1+I_2)`,String.raw`\begin{bmatrix}V_1\\V_2\end{bmatrix}=\underbrace{\begin{bmatrix}R_1+R_2&R_2\\R_2&R_2+R_3\end{bmatrix}}_Z\begin{bmatrix}I_1\\I_2\end{bmatrix}`),
      step('Open one port and excite the other','Open means zero external port current, not zero voltage. Inject a 1 A test current into port 1 with port 2 open to obtain the first Z column; reverse the test for the second column. Each coefficient is volts divided by amperes.',String.raw`Z_{11}=\left.\frac{V_1}{I_1}\right|_{I_2=0},\quad Z_{21}=\left.\frac{V_2}{I_1}\right|_{I_2=0}`,String.raw`Z=${matrix(Z)}\;\Omega`),
      step('Invert Z to obtain the short-circuit description','Y maps voltages to entering currents. A 1 V test at one port while the other is held at zero volts gives one column of Y. A shorted port can carry current.',String.raw`Y=Z^{-1}=\frac1{\Delta}\begin{bmatrix}Z_{22}&-Z_{12}\\-Z_{21}&Z_{11}\end{bmatrix},\quad\Delta=Z_{11}Z_{22}-Z_{12}Z_{21}=${n(det)}\;\Omega^2`,String.raw`Y=${matrix(Y)}\;\mathrm S`),
      ...(id==='m2'?[step('Choose mixed independent variables for a hybrid model','Solve the second Z row for I₂, then substitute into the first. Hybrid means V₁ and I₂ are outputs, while I₁ and V₂ are inputs. h₁₁ has ohms, h₂₂ siemens, and the cross terms are dimensionless.',String.raw`I_2=\frac{V_2-Z_{21}I_1}{Z_{22}}`,String.raw`\begin{bmatrix}V_1\\I_2\end{bmatrix}=\underbrace{\begin{bmatrix}Z_{11}-Z_{12}Z_{21}/Z_{22}&Z_{12}/Z_{22}\\-Z_{21}/Z_{22}&1/Z_{22}\end{bmatrix}}_h\begin{bmatrix}I_1\\V_2\end{bmatrix}`,String.raw`h=${matrix(h)}`)]:[]),
      step('Solve the simultaneously driven network','Restore both displayed voltage sources and use I = YV. A negative port current means the resistor network delivers current into that source. The two independent open/short tests are checked below as well.',String.raw`I_1=(${n(Y[0])})(${n(p.V1)})+(${n(Y[1])})(${n(p.V2)})=${n(I[0])}\,\mathrm A`,String.raw`I_2=(${n(Y[2])})(${n(p.V1)})+(${n(Y[3])})(${n(p.V2)})=${n(I[1])}\,\mathrm A`),
    ],advantage:'Terminal parameters reuse a linear network without resolving every internal node. Choose Z for current/open-circuit tests, Y for voltage/short-circuit tests, and h when the external variables are mixed.',limitation:'The port references and test conditions are part of the model. A parameter conversion requires the relevant inverse or denominator to exist. Terminal equivalence does not expose every internal component power.',
    checks:[check('entering port 1 current',I[0],-x.sol.i.V1,'A'),check('entering port 2 current',I[1],-x.sol.i.V2,'A'),...Z.map((v,i)=>check(`Z${Math.floor(i/2)+1}${i%2+1}: independent open test`,v,tests[i%2].v[i<2?'in':'n2'],'Ω')),...(id==='m2'?Y.map((v,i)=>check(`Y${Math.floor(i/2)+1}${i%2+1}: independent short test`,v,-shortTests[i%2].i[i<2?'T1':'T2'],'S')):[])],
    practice:{prompt:id==='m1'?'Inject 2 mA at port 1 with port 2 open. Calculate the voltage at port 2.':'Hold port 1 at 1 V and short port 2. Calculate current entering port 2.',target:id==='m1'?.002*Z[2]:Y[2],unit:id==='m1'?'V':'A',hint:id==='m1'?'Use V₂ = Z₂₁ I₁, because I₂ = 0.':'Use I₂ = Y₂₁ V₁ + Y₂₂ V₂ with V₂ = 0; the result can be negative.'}}
}

export function completionPorts(base,groups) {
  const template=base.find(e=>e.id==='d3')
  const make=(id,name,params,net,layout,prerequisites)=>({id,name,group:groups[12],params,net,layout,prerequisites,study:portStudy,terms:['kcl','kvl','linear'],show:'v',view:'equations',views:['reading','equations','power'],claim:{},
    headline:{label:id==='m3'?'the loaded cascade output':'current entering port 1',tag:id==='m3'?'v_out':'I_1',unit:id==='m3'?'V':'A',where:null,value:x=>id==='m3'?x.sol.v.out:-x.sol.i.V1},
    closedHeadline:p=>{if(id==='m3'){const t=multiplyChain(chain(p.R1,p.R2,p.R3),chain(p.R4,p.R5,p.R6));return p.V1/(t[0]+t[1]/p.RL)}return ((p.R2+p.R3)*p.V1-p.R2*p.V2)/((p.R1+p.R2)*(p.R2+p.R3)-p.R2*p.R2)},
    lesson:{see:id==='m3'?'The second resistor network draws current from the first. Follow the connection along the top row and back along the bottom, then calculate the output with the complete cascade matrix.':'Describe the same resistor network through its terminals. Define entering current at both ports, perform open and short tests, then predict the simultaneously driven circuit.',why:'A parameter matrix is a measured or derived terminal relation. It only becomes useful after its variables, units, reference directions and load constraints are explicit. The independent circuit solve checks the relation under the displayed settings.',try:[{say:'Change the output load or source, predict its effect, then compare the derived and circuit results.',reads:[]},{say:'Enter your own answer in Equations before revealing the practice result.',reads:[]}]}})
  const voltage=(key,value)=>({key,label:key==='V1'?'V₁':'V₂',unit:'V',default:value,min:-20,max:20,scale:'linear'})
  const ports=['m1','m2'].map((id,i)=>make(id,i?'Two-port conversions: Y and hybrid parameters':'Two-port Z parameters: define and test the ports',[voltage('V1',i?6:10),voltage('V2',i?-2:3),resistor('R1',1000),resistor('R2',2000),resistor('R3',1500)],p=>({elements:[...passiveT(p),el('V','V1','in','gnd',p.V1),el('V','V2','n2','gnd',p.V2)]}),template.layout,i?['m1']:['d10','h9']))
  const cascade=make('m3','ABCD parameters: cascades and loading',[voltage('V1',12),...['R1','R2','R3','R4','R5','R6'].map((id,i)=>resistor(id,i%3===1?4000:1000)),resistor('RL',3000)],p=>({elements:[el('V','V1','in','gnd',p.V1),...passiveT(p),el('R','R4','n2','B',p.R4),el('R','R5','B','gnd',p.R5),el('R','R6','B','out',p.R6),el('R','RL','out','gnd',p.RL)]}),{w:660,h:440,items:[
    {el:'V1',x:50,y:135,dir:'v'},{wire:[50,60,50,115]},{wire:[50,155,50,180]},{gnd:[50,180]},
    {el:'R1',x:170,y:60,dir:'h'},{wire:[50,60,150,60]},{wire:[190,60,350,60]},
    {el:'R2',x:280,y:135,dir:'v'},{wire:[280,60,280,115]},{wire:[280,155,280,200]},{gnd:[280,200]},
    {el:'R3',x:370,y:60,dir:'h'},{wire:[390,60,550,60]},{wire:[550,60,550,230]},
    {el:'R4',x:450,y:230,dir:'h',flip:true},{wire:[470,230,550,230]},{wire:[220,230,430,230]},
    {el:'R5',x:340,y:310,dir:'v'},{wire:[340,230,340,290]},{wire:[340,330,340,390]},{gnd:[340,390]},
    {el:'R6',x:200,y:230,dir:'h',flip:true},{wire:[80,230,180,230]},
    {el:'RL',x:80,y:310,dir:'v'},{wire:[80,230,80,290]},{wire:[80,330,80,390]},{gnd:[80,390]},
    {node:'in',x:50,y:60,side:'t'},{node:'A',x:280,y:60,side:'t'},{node:'n2',x:550,y:160,side:'r'},{node:'B',x:340,y:230,side:'t'},{node:'out',x:80,y:230,side:'t'},
  ]},['m2','k2'])
  return [...ports,cascade]
}
