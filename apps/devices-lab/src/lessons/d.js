// Group D's three registers.
//
// The capacitor of Group C with a source and a drain added, and the threshold
// implant of C5 already in it, so every current here belongs to a device with
// a 700 mV threshold. That is the device the Electronics Lab was handed.

export const LESSONS_D = {
  d1: {
    see:
      'Above the threshold the gate holds C_ox(V_GS − V_T) of electrons at the surface, and that thin sheet is ' +
      'the channel. At half a volt of overdrive it holds 172.7 nC/cm². A drain voltage drags that charge along, ' +
      'and the current here reads 215.8 µA.',
    seeReads: [
      ['fet.charge', 1.7265662e-3],
      ['fet.vov', 0.49999989],
      ['fet.id', 2.1582073e-4],
    ],
    try: [
      {
        say: 'Drop the gate to 0.9 V. The overdrive falls to 200 mV, the charge to 69.06 nC/cm², and the current to 34.53 µA.',
        set: { vgs: 0.9 },
        reads: [
          ['fet.vov', 0.19999989],
          ['fet.charge', 6.9062626e-4],
          ['fet.id', 3.4531293e-5],
        ],
      },
      {
        say: 'Raise it to 1.7 V. The overdrive is 1.000 V, the charge 345.3 nC/cm², and the current 863.3 µA.',
        set: { vgs: 1.7 },
        reads: [
          ['fet.vov', 0.99999989],
          ['fet.charge', 3.4531329e-3],
          ['fet.id', 8.6328312e-4],
        ],
      },
      {
        say: 'Return the gate and halve the oxide to 5 nm. The threshold falls to 273.1 mV as well, so the charge more than doubles, to 640.1 nC/cm².',
        set: { tox: 5e-9 },
        reads: [
          ['fet.vt', 0.27310152],
          ['fet.charge', 6.4014079e-3],
        ],
      },
    ],
    why:
      'The gate and the substrate are a capacitor. Above the threshold every further volt on the gate puts ' +
      'C_ox of charge into the channel rather than into the depletion layer. So the channel charge is C_ox ' +
      'times the overdrive, and that product carries the next four experiments. Two things follow at once. A ' +
      'thinner oxide holds more charge for the same overdrive, which is one reason processes thin it. And the ' +
      'threshold is not a separate fact. It is the voltage at which this expression starts being true, so a ' +
      'change in the oxide moves the threshold and the charge together, and the current has to be read rather ' +
      'than guessed.',
  },

  d2: {
    see:
      'The channel charge falls along the channel, because the voltage between the gate and the channel falls ' +
      'toward the drain. Integrating what is left gives k_n[V_OV V_DS − V_DS²/2]. At 250 mV of drain voltage ' +
      'that is 161.9 µA, and the quadrature over the same integral gives the same number.',
    seeReads: [
      ['fet.id', 1.6186557e-4],
      ['fet.integral', 1.6186557e-4],
      ['fet.region', 'triode'],
    ],
    try: [
      {
        say: 'Drop the drain to 100 mV. The current falls to 77.70 µA, close to proportional, because the square term is still small.',
        set: { vds: 0.1 },
        reads: [['fet.id', 7.7695478e-5]],
      },
      {
        say: 'Raise it to 500 mV, which is the overdrive. The current reads 215.8 µA and the device has just left triode.',
        set: { vds: 0.5 },
        reads: [
          ['fet.id', 2.1582073e-4],
          ['fet.region', 'saturation'],
        ],
      },
      {
        say: 'Raise it to 1 V. The current stays at 215.8 µA, because past the overdrive the expression stops depending on the drain.',
        set: { vds: 1 },
        reads: [['fet.id', 2.1582073e-4]],
      },
    ],
    why:
      'The gradual-channel model is labelled, and inside it the square law is an integral rather than a fit. ' +
      'At a point along the channel the gate holds C_ox(V_OV − V(y)) of charge. V(y) is how far the channel ' +
      'has risen above the source. The same current flows at every point, so integrating along the channel ' +
      'gives k_n[V_OV V_DS − V_DS²/2] with no approximation beyond the one named. The pane prints the closed ' +
      'form and the quadrature side by side. A test compares them at every setting, because two numbers shown ' +
      'as equal should be measured rather than asserted. What the model leaves out is the field along the ' +
      'channel growing to match the field across the oxide, which is D5.',
  },

  d3: {
    see:
      'At a drain voltage equal to the overdrive the channel charge reaches zero at the drain end. That is ' +
      'pinch-off, and past it the current holds at half k_n V_OV², or 215.8 µA. The two expressions agree in ' +
      'value and in slope at that boundary of 500 mV.',
    seeReads: [
      ['fet.id', 2.1582073e-4],
      ['fet.saturation', 2.1582073e-4],
      ['fet.boundary', 0.49999989],
    ],
    try: [
      {
        say: 'Set the drain to 250 mV, below the boundary. The device is in triode at 161.9 µA, and the curve is still climbing.',
        set: { vds: 0.25 },
        reads: [
          ['fet.id', 1.6186557e-4],
          ['fet.region', 'triode'],
        ],
      },
      {
        say: 'Add a channel-length modulation of 0.05 per volt. The current at 1 V rises to 221.2 µA, and the output resistance reads 92.67 kΩ.',
        set: { lambda: 0.05 },
        reads: [
          ['fet.id', 2.2121625e-4],
          ['fet.ro', 92669.504],
        ],
      },
      {
        say: 'Take the drain to 2 V with that modulation on. The current is 232.0 µA, so the curve in saturation has a slope after all.',
        set: { lambda: 0.05, vds: 2 },
        reads: [['fet.id', 2.3200729e-4]],
      },
    ],
    why:
      'Pinch-off is not the channel disappearing. It is the charge at the drain end reaching zero while the ' +
      'current through it stays finite, which the carriers manage by moving faster there. Past that point the ' +
      'part of the channel that carries charge ends before the drain, and adding drain voltage lengthens the ' +
      'depleted gap rather than the current. So the current holds, and the two expressions meet smoothly ' +
      'because the derivative of the triode form against the drain voltage is k_n(V_OV − V_DS), which is zero ' +
      'exactly at the boundary. Channel-length modulation is the one term in this group that is a fit. It says ' +
      'the useful channel shortens as the gap grows, and λ is measured rather than derived.',
  },

  d4: {
    see:
      'How much current a volt of gate buys is the transconductance, and in saturation it is k_n V_OV. Here it ' +
      'reads 863.3 µA/V. A finite difference of the current against the gate voltage gives the same number, ' +
      'and the ratio to the drain current is 4.000 per volt.',
    seeReads: [
      ['fet.gm', 8.6328312e-4],
      ['fet.gmMeasured', 8.6328312e-4],
      [(x) => x.fet.gm / x.fet.id, 4],
    ],
    try: [
      {
        say: 'Bias the body 1 V below the source. The threshold rises 234.8 mV, the overdrive falls to 265.2 mV, and the transconductance falls to 458.0 µA/V.',
        set: { vsb: 1 },
        reads: [
          ['fet.shift', 0.2347506],
          ['fet.vov', 0.26524929],
          ['fet.gm', 4.5797057e-4],
        ],
      },
      {
        say: 'Take the body to 2 V below. The threshold has risen 409.3 mV now, and the current has fallen to 7.106 µA.',
        set: { vsb: 2 },
        reads: [
          ['fet.shift', 0.40927088],
          ['fet.id', 7.1063344e-6],
        ],
      },
      {
        say: 'Clear the body bias and raise the gate to 1.7 V. The transconductance doubles with the overdrive, to 1.727 mA/V.',
        set: { vgs: 1.7 },
        reads: [['fet.gm', 1.7265664e-3]],
      },
    ],
    why:
      'Two things are worth carrying out of this experiment. The first is that g_m is 2I_D/V_OV in saturation, ' +
      'so a designer chooses between current and gain by choosing the overdrive, and nothing else in the model ' +
      'lets that be avoided. The second is the body effect. The threshold is not a constant of the device. ' +
      'Biasing the substrate below the source gives the depletion layer more charge to hold, the gate pays for ' +
      'it at Q/C_ox, and the threshold climbs by γ(√(2φ_F + V_SB) − √(2φ_F)). Here γ is 0.5276, so a volt of ' +
      'body bias costs 234.8 mV of threshold. That is why two transistors stacked between the same rails are ' +
      'not the same transistor.',
    whyReads: [
      ['fet.gamma', 0.52762353],
      [(x, p, again) => again({ vsb: 1 }).fet.shift, 0.2347506],
    ],
  },

  d5: {
    see:
      'The square law has a boundary at each end. Below the threshold the current is exponential and falls one ' +
      'decade every 76.95 mV, so getting from 215.8 µA down to a nanoamp costs 410.5 mV of gate. Above it, ' +
      'velocity saturation flattens the law, and in this 1 µm channel that takes 2.000 V of overdrive.',
    seeReads: [
      ['fet.swing', 0.07694921],
      ['fet.id', 2.1582073e-4],
      ['fet.dv', 0.41045425],
      ['fet.decades', 5.3340932],
      ['fet.vsat', 2],
    ],
    try: [
      {
        say: 'Ask for a picoamp instead. Three more decades are three more steps of 76.95 mV, so the gate has to fall 641.3 mV in total.',
        set: { floor: 1e-12 },
        reads: [
          ['fet.dv', 0.64130189],
          ['fet.decades', 8.3340932],
          ['fet.swing', 0.07694921],
        ],
      },
      {
        say: 'Set the channel length to 0.1 µm. The overdrive at which the carriers stop going faster falls to 200 mV, which is below the working point.',
        set: { length: 1e-7 },
        reads: [['fet.vsat', 0.2]],
      },
      {
        say: 'Take the length to 10 µm instead. Velocity saturation needs 20.0 V of overdrive there, which no gate on this device reaches.',
        set: { length: 1e-5 },
        reads: [['fet.vsat', 20]],
      },
    ],
    why:
      'Neither boundary is a failure of the arithmetic. Subthreshold conduction is a real inversion layer, ' +
      'just an exponentially small one, and its current follows a Boltzmann factor rather than a square. The ' +
      'swing S is (kT/q)ln10(1 + C_dmin/C_ox), which cannot fall below 59.5 mV per decade at 300 K whatever a ' +
      'process does. That floor is why a chip with a billion transistors leaks. At the other end the carriers ' +
      'reach a speed the crystal will not let them exceed, at a field this pane takes as data. A long device ' +
      'never gets there, and a short one is there at ordinary voltages, which is why a modern transistor reads nearer ' +
      'to a straight line than to a parabola.',
    whyReads: [
      // The floor the swing cannot go below: the same kT ln 10, with the
      // capacitance ratio that raises it divided back out.
      [(x) => x.fet.swing / (1 + x.mos.cdmin / x.mos.cox), 0.059525754],
      ['fet.vsat', 2],
    ],
  },
}
