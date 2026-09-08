import {knob as k,step as s,reading as r,curve,samples,texnum as N,fmt} from '@ee-labs/lessons/model'
import {CU,RU} from './model.js'
import {flipFlop,characterizeFlipFlop} from './networks.js'
export const CLOCK_LESSON={
  id:'f1',name:'A flip-flop, taken apart',group:'F. Clocking',
  question:'How do two transparent latches become one edge-triggered register?',
  intro:'While the clock is low, the master follows D and the slave holds Q. At the rising clock edge, the master closes and the slave opens. Charge on six internal nodes determines whether the new bit is captured.',
  knobs:[k('setup','Data lead before clock',100e-12,0,400e-12,'s'),k('hold','Data persistence after clock',100e-12,0,600e-12,'s')],
  symbols:[['D,Q','External data input and registered output voltages (V).'],['m_x,m_q,m_f','Master storage, inverter output and feedback node voltages (V).'],['s_x,s_q,s_f','Slave storage, inverter output and feedback node voltages (V).'],['t_{cq}','Rising-clock to half-supply Q crossing (s).'],['t_{su}','Data lead required to capture with no more than 10% clock-to-Q degradation.'],['t_h','Required persistence after the rising edge; zero for the ideal simultaneous switch model used here.']],
  route:'Follow the clock phases first, then write KCL at every stored node. The native piecewise-linear circuit solve advances all six states and locates transistor threshold events. A separate search measures the setup criterion.',
  limits:'Each transmission gate is represented by its parallel on-resistance. Inverters use the existing switch-model MOSFETs. The main inverter in each latch is four times unit strength to tolerate charge sharing. Ideal complementary clocks exclude overlap, skew and charge injection. The model can settle at a midrail equilibrium near failed capture; this is not a quantitative metastability-lifetime prediction.',
  try:'Reduce the data lead from 100 ps toward 20 ps. Compare the internal master node with Q, then change data persistence after the clock edge.',
  flow:['Clock low: master follows D','Rising edge: master holds','Clock high: slave transfers the stored bit'],
  solve(p){
    const z=flipFlop(p),timing=characterizeFlipFlop(),accepted=z.captured&&z.clkQ<=timing.limit
    const steps=[
      s('Set the clock phases and initial state','The master starts with a stored zero; the inverted master output makes the slave’s final output zero.',String.raw`x=[m_x,m_q,m_f,s_x,s_q,s_f]^T,\quad x(0)=[0,1.8,0,1.8,0,1.8]^T`),
      s('Write each storage-node balance','Enabled transmission gates carry (va − vb)/RTG. Each inverter contributes its actual on/off drain currents. Capacitor voltages remain continuous at the clock edge.',String.raw`C_i\dot x_i=\sum_{j\to i}\frac{x_j-x_i}{R_{ji}}+I_{p,i}-I_{n,i},\quad x(t_c^+)=x(t_c^-)`,String.raw`R_{TG}=${N(RU/2)}\,\Omega,\quad C_x=${N(4*CU*1e15)}\,\mathrm{fF}`),
      s('Measure clock-to-Q on the connected circuit','The reference run gives D 400 ps of lead. The crossing is measured after the rising clock, not after the data edge.',String.raw`Q(t_c+t_{cq})=V_{DD}/2`,String.raw`t_{cq,reference}=${N(timing.reference.clkQ*1e12)}\,\mathrm{ps}`),
      s('Search the setup criterion','Bisect the lead time until capture succeeds and clock-to-Q is at most 1.1 times its settled reference. Report the search resolution.',String.raw`t_{su}=\min\{t_{lead}:Q_{final}>0.75V_{DD},\ t_{cq}\le1.1t_{cq,reference}\}`,String.raw`t_{su}=${N(timing.setup*1e12)}\,\mathrm{ps},\quad\Delta t=${N(timing.setupResolution*1e12)}\,\mathrm{ps}`),
      s('State what the hold result means','The master input disconnects exactly at the rising edge, so later changes of D have no conductive path into the master. Real clock overlap invalidates this zero-hold result.',String.raw`t_{h,ideal}=0`),
    ]
    return {steps,readings:[r('Required lead for criterion',timing.setup*1e12,'ps'),r('Reference clock-to-Q',timing.reference.clkQ*1e12,'ps'),...(z.clkQ===null?[]:[r('Selected clock-to-Q',z.clkQ*1e12,'ps')]),r('Final Q',z.final[4],'V')],
      plots:[curve('Registered output Q','Time relative to rising clock (ps)','Q (V)',samples(t=>z.wave((t+500)*1e-12),-150,300,451)),curve('Master storage voltage','Time relative to rising clock (ps)','Master storage (V)',samples(t=>z.at((t+500)*1e-12).sol.v.mx,-150,300,451))],
      plotNote:`Clock rises at zero on these axes. D rises ${fmt(p.setup*1e12)} ps before the clock and falls ${fmt(p.hold*1e12)} ps after it.`,
      conclusion:accepted?'The selected timing captures a high and meets the stated 10% clock-to-Q degradation criterion.':z.captured?'The bit is captured, but clock-to-Q exceeds the declared timing criterion.':'The selected data lead fails to capture a resolved high in the observation window.',
      practice:{question:'What is the largest allowed clock-to-Q delay under the 10% degradation criterion?',answer:timing.limit*1e12,unit:'ps',hint:'Multiply the settled reference delay by 1.1.',reason:'Setup depends on a stated timing criterion, not simply whether Q eventually crosses half supply.'},
      table:{headers:['Clock level','Master input','Master feedback','Slave input','Slave feedback'],rows:[['Low','Connected','Open','Open','Connected'],['High','Open','Connected','Connected','Open']]},
    }
  }
}
