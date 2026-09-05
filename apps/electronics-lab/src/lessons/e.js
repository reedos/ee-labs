// Group E's three registers. Every number here is a reading, checked against
// the solver by experiments.test.js. The four bias circuits are the course's
// four, and each step names the one knob that moves the point.

export const LESSONS_E = {
  e1: {
    see:
      'The capacitor between the source and the base passes the signal and blocks the bias. At DC it carries ' +
      'no current at all, so the divider alone holds the base at 1.700 V while the source node sits at zero. ' +
      'At 1.00 kHz the base receives 0.99999 of what the source offers.',
    seeReads: [
      ['v.b', 1.6996383],
      ['i.CC', 0],
      ['H.mag', 0.99999847],
    ],
    try: [
      {
        say: 'Drop the signal frequency to 1.75 Hz. The capacitor’s impedance has climbed to match what it drives, and the base receives 0.707 of the source.',
        set: { f: 1.7476 },
        reads: [['H.mag', 0.70710776]],
      },
      {
        say: 'Set it to 10.0 Hz, well above that corner. The base receives 0.985 of the source, and by 1.00 kHz the loss is a part in a million.',
        set: { f: 10 },
        reads: [['H.mag', 0.98507067]],
      },
      {
        say: 'Cut the capacitor to 0.100 µF. Its corner climbs a hundredfold, to 174.8 Hz, and the loss at 1.00 kHz is back to 0.985.',
        set: { CC: 1e-7 },
        reads: [
          ['pole.1.hz', 174.75952],
          ['H.mag', 0.98507067],
        ],
      },
      {
        say: 'Raise the source amplitude to 10.0 mV. The base still sits at 1.700 V, because no DC crosses the capacitor whatever the source does.',
        set: { amp: 0.01 },
        reads: [
          ['v.b', 1.6996383],
          ['i.CC', 0],
        ],
      },
    ],
    why:
      'Two circuits share one drawing here. Circuit Elements Lab’s Group F showed a capacitor as an open at ' +
      'DC, and its Group H showed the impedance falling as 1/ωC. Put both together and the same part does ' +
      'two jobs. The bias circuit sees an open, so the divider sets the base on its own and the source ' +
      'cannot pull it about. The signal sees a small impedance in series with the stage’s input resistance, ' +
      'and the two make a high-pass corner at 1/(2πR_in C_C). Above that corner the loss is negligible and ' +
      'below it the signal is lost. That is why a coupling capacitor is chosen large: not for the signal it ' +
      'passes, but for the lowest frequency it must not lose. The schematic’s two overlays show the DC values ' +
      'and the signal amplitudes on the same picture.',
  },

  e2: {
    see:
      'One resistor from the supply to the base sets 11.00 µA of base current, and β turns that into ' +
      '1.100 mA at the collector. The collector then sits at 4.000 V. Nothing in this circuit limits what β ' +
      'does to the answer, which is what makes fixed bias the arrangement a textbook warns about.',
    seeReads: [
      ['op.Q1.ib', 1.1e-5],
      ['op.Q1.ic', 1.1e-3],
      ['op.Q1.vce', 4],
    ],
    try: [
      {
        say: 'Set β to 50. The base current does not move, and the collector current halves to 550.0 µA. The collector rises to 9.500 V.',
        set: { beta: 50 },
        reads: [
          ['op.Q1.ib', 1.1e-5],
          ['op.Q1.ic', 5.5e-4],
          ['op.Q1.vce', 9.5],
        ],
      },
      {
        say: 'Set β to 200. The formula asks for 2.200 mA, more than the load can pass, so the device saturates at 1.480 mA and 200.0 mV.',
        set: { beta: 200 },
        reads: [
          ['op.Q1.ic', 1.48e-3],
          ['op.Q1.vce', 0.2],
          [(x, p) => (p.beta * (p.vcc - 0.7)) / p.RB, 2.2e-3],
        ],
      },
      {
        say: 'Double R_B to 2.60 MΩ. The base current halves to 5.500 µA, and the collector current halves with it, to 550.0 µA.',
        set: { RB: 2.6e6 },
        reads: [
          ['op.Q1.ib', 5.5e-6],
          ['op.Q1.ic', 5.5e-4],
        ],
      },
    ],
    why:
      'The base current here is set by the supply and one resistor, so it is the same in every device ever ' +
      'fitted. The collector current is β times it. β is the least controlled number a transistor has, ' +
      'running two to one either side of its nominal value across a batch and drifting with temperature on ' +
      'top of that. So a bias point built this way is a bias point nobody chose. At the low end of the range ' +
      'the stage runs at half the current it was designed for. At the high end the point has slid off the ' +
      'load line into saturation, and the stage has no output swing left at all. The rest of this group is ' +
      'three ways of taking β out of the answer.',
  },

  e3: {
    see:
      'The divider holds the base at 1.700 V, and the emitter resistor takes what is left after the ' +
      'junction’s drop. The emitter sits at 1.000 V, so the current is 990.4 µA. β now enters only through ' +
      'R_B/(β + 1), which the divider keeps small beside R_E.',
    seeReads: [
      ['v.b', 1.7003215],
      ['v.e', 1.0003215],
      ['op.Q1.ic', 9.9041737e-4],
    ],
    try: [
      {
        say: 'Set β to 50. The collector current falls only to 901.1 µA, where fixed bias halved on the same change.',
        set: { beta: 50 },
        reads: [['op.Q1.ic', 9.0108604e-4]],
      },
      {
        say: 'Set β to 200. It rises to 1.042 mA. Over the whole four-to-one range of β the point moves by a seventh, against a factor of four without the emitter resistor.',
        set: { beta: 200 },
        reads: [['op.Q1.ic', 1.0420715e-3]],
      },
      {
        say: 'Cut R_E to 100 Ω. The loop is now too weak to hold anything, and the point runs down the load line into saturation at 1.920 mA.',
        set: { RE: 100 },
        reads: [
          ['op.Q1.ic', 1.9198078e-3],
          ['op.Q1.region', 'saturation'],
        ],
      },
      {
        say: 'Raise R_E to 4.00 kΩ instead. The same volt above the junction drop now drives four times the resistance, so the current falls to 265.6 µA.',
        set: { RE: 4000 },
        reads: [['op.Q1.ic', 2.6555495e-4]],
      },
    ],
    why:
      'Emitter degeneration turns the bias into a feedback loop. More collector current means more emitter ' +
      'current, which raises the emitter voltage, which leaves less across the junction, which cuts the ' +
      'current back. What the loop compares against is the base voltage the divider sets, and a divider is ' +
      'made of resistors that a manufacturer controls to a percent. The base current still has to flow back ' +
      'through R_B, which is where β survives at all, and the standard rule R_B ≤ 0.1(β + 1)R_E keeps that ' +
      'term to a tenth of R_E. Set R_E too small and there is nothing to compare against. Set it too large ' +
      'and the current falls away, because R_E and the voltage above the junction drop set it between them.',
  },

  e4: {
    see:
      'A junction needs less voltage as it warms, and a bias circuit turns that into current. At 300 K the ' +
      'transistor sits at 1.035 mA with 654.7 mV across its emitter junction. How much of a warming reaches ' +
      'the collector current is decided by the emitter resistor and nothing else.',
    seeReads: [
      ['op.Q1.ic', 1.0349463e-3],
      ['op.Q1.vbe', 0.65471945],
    ],
    try: [
      {
        say: 'Raise the temperature to 350 K. V_BE falls to 565.6 mV and the collector current rises to 1.115 mA, 80.07 µA more than it was.',
        set: { T: 350 },
        reads: [
          ['op.Q1.vbe', 0.56561246],
          ['op.Q1.ic', 1.1150125e-3],
          [(x, p, again) => x.point.Q1.ic - again({ T: 300 }).point.Q1.ic, 8.0066179e-5],
        ],
      },
      {
        say: 'Raise R_E to 4.00 kΩ as well. The same warming moves the current by 22.93 µA now, a quarter as much, because that shift divides by R_E.',
        set: { RE: 4000, T: 350 },
        reads: [[(x, p, again) => x.point.Q1.ic - again({ T: 300 }).point.Q1.ic, 2.2934119e-5]],
      },
      {
        say: 'Cut R_E to 10.0 Ω and R₂ to 4.20 kΩ, which puts the point back at 1.020 mA at 300 K with almost no resistor under the emitter.',
        set: { RE: 10, R2: 4200 },
        reads: [['op.Q1.ic', 1.0200138e-3]],
      },
      {
        say: 'Now raise the temperature to 350 K with those two settings. The current nearly doubles, to 1.961 mA, and the collector collapses to 176.8 mV.',
        set: { RE: 10, R2: 4200, T: 350 },
        reads: [
          ['op.Q1.ic', 1.9606701e-3],
          ['op.Q1.vce', 0.17678984],
          ['op.Q1.region', 'saturation'],
        ],
      },
    ],
    why:
      'Temperature enters through the saturation current alone, by the law Group C measured. At a fixed ' +
      'current the junction gives up about 1.8 mV for every kelvin, and here that is 89.11 mV over the ' +
      'warming applied. Whatever V_BE gives up appears across the emitter resistor instead, so the extra ' +
      'current is that voltage divided by R_E + R_B/(β + 1). Two different things follow. The size of the ' +
      'shift in amps is set by the resistance under the emitter, so a larger R_E holds the point tighter. ' +
      'The size of it as a fraction is set by how much voltage sits above the junction drop, so a bias built ' +
      'with very little headroom drifts by a large fraction of itself. Take the emitter resistor away and ' +
      'the point runs off the load line entirely.',
    whyReads: [
      [(x, p, again) => Math.abs(again({ T: 350 }).point.Q1.vbe - x.point.Q1.vbe), 0.089106989],
      [(x, p, again) => Math.abs(again({ T: 350 }).point.Q1.vbe - x.point.Q1.vbe) / 50, 0.0017821398],
    ],
  },

  e5: {
    see:
      'The gate draws nothing at all, so the divider holds it at 1.900 V and the source resistor sets what ' +
      'is left. The drain passes 400.0 µA with 200.0 mV of overdrive, and sits at 3.000 V. The source ' +
      'resistor is what makes that current stable against the part in hand.',
    seeReads: [
      ['op.M1.id_', 4e-4],
      ['op.M1.vov', 0.2],
      ['v.d', 3],
    ],
    try: [
      {
        say: 'Raise the threshold to 0.800 V, a part from the other end of its spread. The current falls only to 363.7 µA, nine parts in a hundred.',
        set: { vt: 0.8 },
        reads: [['op.M1.id_', 3.6371477e-4]],
      },
      {
        say: 'Take the source resistor down to 1.00 Ω and the gate to 0.900 V, which restores almost the same 398.4 µA at the original threshold.',
        set: { RS: 1, vg: 0.9 },
        reads: [['op.M1.id_', 3.9840796e-4]],
      },
      {
        say: 'Now raise the threshold to 0.800 V again. With nothing pushing back, the overdrive halves to 99.90 mV and the current falls to 99.80 µA.',
        set: { RS: 1, vg: 0.9, vt: 0.8 },
        reads: [
          ['op.M1.id_', 9.9800499e-5],
          ['op.M1.vov', 0.0999002],
        ],
      },
    ],
    why:
      'A MOSFET has threshold spread where a BJT has β spread, and the square law is harsher about it. The ' +
      'current goes as the square of the overdrive, so a shift that takes half the overdrive away takes ' +
      'three quarters of the current. The source resistor stops that from happening, by the same argument ' +
      'the emitter resistor used. A higher threshold means less current, less current means less drop across ' +
      'the source resistor, and that returns most of the overdrive the threshold took. What is left after ' +
      'the loop has settled is a ninth of what the bare device would have shown. The price is the voltage ' +
      'the resistor uses up, which is a real cost on a five volt supply.',
  },

  e6: {
    see:
      'A source in the emitter sets the emitter current at 1.000 mA, and the collector takes α of it, ' +
      '990.6 µA. Nothing about the device enters the answer except α, which is β/(β + 1). The collector sits ' +
      'at 5.047 V, and it stays there.',
    seeReads: [
      ['op.Q1.ic', 9.9063614e-4],
      ['v.c', 5.0468193],
    ],
    try: [
      {
        say: 'Set β to 50. The collector current falls only to 981.5 µA, because α has moved from 0.990 to 0.980 and nothing else has moved at all.',
        set: { beta: 50 },
        reads: [['op.Q1.ic', 9.814696e-4]],
      },
      {
        say: 'Set β to 200. It rises to 995.3 µA. Over the whole four-to-one range of β the point moves by less than a part in seventy.',
        set: { beta: 200 },
        reads: [['op.Q1.ic', 9.9529296e-4]],
      },
      {
        say: 'Raise the temperature to 350 K. The current reads 990.6 µA, unmoved to five figures, because α carries no temperature in it.',
        set: { T: 350 },
        reads: [['op.Q1.ic', 9.9062811e-4]],
      },
    ],
    why:
      'Current-source bias is the last step of the argument this group has been making. Fixed bias makes the ' +
      'answer proportional to β. Degeneration divides β out down to a term in R_B/(β + 1). A source in the ' +
      'emitter removes it altogether, leaving only α, which is 0.990 at β = 100 and 0.980 at β = 50. ' +
      'Temperature does not appear at all, because the source holds its current whatever V_BE does. The ' +
      'catch is that an ideal current source is not a component anyone stocks. It is built out of ' +
      'transistors, and building it is the work of a later group in this lab. What that group starts from is ' +
      'the fact this experiment measures, that a current set once can be copied.',
  },
}
