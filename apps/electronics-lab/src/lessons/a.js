// Group A's three registers. Every number here is a reading, checked against
// the solver by experiments.test.js, and every knob move names a setting the
// knob can reach.

export const LESSONS_A = {
  a1: {
    see:
      'A one-millivolt battery sits in series with the + input. Nothing outside the amplifier can tell it ' +
      'from a signal, so the output reads 11.0 mV with nothing applied. The closed-loop gain is 1 + R_f/R_g, ' +
      'which is 11 here, and the offset arrives at the output multiplied by exactly that.',
    seeReads: [['v.out', 0.01099879]],
    try: [
      {
        say: 'Set R_f to 100 kΩ. The gain becomes 101 and the same millivolt of offset now reads 100.9 mV at the output.',
        set: { Rf: 100000 },
        reads: [['v.out', 0.10089809]],
      },
      {
        say: 'Turn V_OS down to 100 µV. The output falls by the same factor, to 1.10 mV.',
        set: { vos: 1e-4 },
        reads: [['v.out', 0.001099879]],
      },
      {
        say: 'Set V₁ to 1 mV. The output reads 22.0 mV, the signal and the offset amplified together.',
        set: { E: 0.001 },
        reads: [['v.out', 0.02199758]],
      },
    ],
    why:
      'An offset voltage is a mismatch inside the input stage, and from outside it looks like a battery of a ' +
      'millivolt or so in series with one input. The output therefore carries A₀V_OS/(1 + A₀β), which for any ' +
      'useful loop gain is the closed-loop gain times V_OS. Two consequences follow. A stage with a large gain ' +
      'has a large output offset, so the offset sets a floor under the smallest signal that stage can measure. ' +
      'And an integrator has infinite gain at DC, so its output ramps away on its own until it meets a rail. ' +
      'The cure is not a better amplifier. It is to null the offset with a trim, or to build the circuit so ' +
      'that DC gain is finite.',
  },

  a2: {
    see:
      'Each input draws a bias current of 100 nA. At the inverting input the only path that current has is ' +
      'the feedback resistor, so it makes 10.0 mV at the output with nothing applied. R_p sits in the other ' +
      'input at 1 Ω and cancels almost none of it.',
    seeReads: [['v.out', 0.0099978]],
    try: [
      {
        say: 'Set R_p to 9.09 kΩ, which is R_f in parallel with R_g. Both inputs now sit at the same voltage and the output falls to zero.',
        set: { Rp: (100000 * 10000) / 110000 },
        reads: [['v.out', 0, 1e-12]],
      },
      {
        say: 'Turn I_B down to 1 nA. The output falls a hundredfold with it, to 100 µV.',
        set: { ib: 1e-9 },
        reads: [['v.out', 9.9978e-5]],
      },
      {
        say: 'Raise R_f to 1 MΩ. The same 100 nA now makes 99.9 mV, because it has ten times the resistance to flow through.',
        set: { Rf: 1000000 },
        reads: [['v.out', 0.099889]],
      },
    ],
    why:
      'The inputs of a bipolar op-amp are the bases of two transistors, and a base draws current. That ' +
      'current has to flow through whatever the input is connected to, and the voltage it makes there is ' +
      'indistinguishable from a signal. Making the two inputs see the same resistance makes them see the same ' +
      'voltage, and a difference amplifier ignores what its two inputs share. The cancellation is exact only ' +
      'when the two bias currents match. The difference between them is the input offset current, and it is ' +
      'about a tenth of the bias current in a real part, so the balancing resistor buys about a factor of ten ' +
      'rather than a clean zero.',
  },

  a3: {
    see:
      'The open-loop gain does not hold to every frequency. It has one pole, at f_t/A₀, and the closed loop ' +
      'inherits it moved out by the loop gain. At a gain of 11.0 the response is flat to 90.9 kHz and falls ' +
      'beyond it at twenty decibels per decade.',
    seeReads: [
      ['gain', 10.99879],
      ['corner.high', 90919.09],
    ],
    try: [
      {
        say: 'Set R_f to 100 kΩ. The gain rises to 100.9 and the corner comes in to 9.91 kHz, so the product of the two hardly moves.',
        set: { Rf: 100000 },
        reads: [
          ['gain', 100.89809],
          ['corner.high', 9910.99],
        ],
      },
      {
        say: 'Set R_f to 1 kΩ. At a gain of 2.00 the corner is out at 500 kHz.',
        set: { Rf: 1000 },
        reads: [
          ['gain', 1.99996],
          ['corner.high', 500010],
        ],
      },
      {
        say: 'Raise f_t to 10 MHz. Every corner moves out tenfold with it, and this one reads 909 kHz.',
        set: { gbw: 1e7 },
        reads: [['corner.high', 909190.91]],
      },
    ],
    why:
      'One pole in the open-loop gain gives the closed loop one pole of its own, at f_p(1 + A₀β). Since β is ' +
      'the reciprocal of the closed-loop gain, the corner is inversely proportional to that gain, and the ' +
      'product of the two is nearly constant. It is not exactly constant. The product is f_t + Gf_p, and the ' +
      'second term is what the textbook drops. Two readings of the same fact are worth keeping apart. The ' +
      'open-loop gain and the closed-loop gain cross at f_t, which is where the loop gain reaches one. And a ' +
      'stage with a corner at 90.9 kHz has no loop gain left above it, so every benefit feedback was bought ' +
      'for is gone there too.',
    whyReads: [['corner.high', 90919.09]],
  },

  a4: {
    see:
      'A ten-volt step at the output cannot arrive at once. The transconductance stage has a current limit, ' +
      'and the capacitor behind it charges at that current alone, so the output climbs at 0.500 V/µs. It ' +
      'arrives after 18.3 µs and settles the last few millivolts.',
    seeReads: [
      ['slope', 499764.44],
      [(x) => x.tr.events[0].t, 18.26e-6],
    ],
    try: [
      {
        say: 'Set the slew rate to 2 V/µs. The ramp is four times as steep and it arrives after 3.25 µs.',
        set: { slewv: 2 },
        reads: [
          ['slope', 1999764.4],
          [(x) => x.tr.events[0].t, 3.25e-6],
        ],
      },
      {
        say: 'Set the step to 1 V. The limit still bites, but the output reaches 0.942 V and the last part of the rise is ordinary.',
        set: { step: 1 },
        reads: [['peak.out', 0.94188048]],
      },
      {
        say: 'Drag the cursor to 10 µs. The output reads 4.78 V, halfway up a ramp that started at nothing.',
        at: 10e-6,
        reads: [['v.out', 4.7797]],
      },
    ],
    why:
      'Slew rate and bandwidth are different limits and they are often confused. The small-signal bandwidth ' +
      'is a property of the tangent, and it holds for signals too small to reach the current limit. The slew ' +
      'rate is a large-signal limit, and it does not depend on the frequency at all. Where they meet is the ' +
      'full-power bandwidth, the frequency at which a sine of the full output swing needs exactly the ' +
      'available slew rate. Above it the sine becomes a triangle however wide the small-signal response is. ' +
      'The ramp here is not quite straight. The resistor that sets the DC gain drains a small part of the ' +
      'limited current, which costs four hundredths of one per cent across the travel.',
  },

  a5: {
    see:
      'Two ceilings sit above the output and the lower one decides. The rails are at 12 V and the resistors ' +
      'ask for 11.0 V. The output current limit gets there first, and 25 mA into what the output sees stops ' +
      'it at 2.48 V.',
    seeReads: [['v.out', 2.4774775]],
    try: [
      {
        say: 'Raise R_L to 10 kΩ. The same 25 mA is now more current than the load needs, and the output reaches 11.0 V.',
        set: { RL: 10000 },
        reads: [['v.out', 10.999138]],
      },
      {
        say: 'Put R_L back and raise the limit to 100 mA. Four times the current makes four times the voltage, 9.91 V.',
        set: { imax: 0.1 },
        reads: [['v.out', 9.9099099]],
      },
      {
        say: 'Set V₁ to 5 V with R_L at 10 kΩ. Now the rail is the lower ceiling, and the output stops at 12.0 V.',
        set: { E: 5, RL: 10000 },
        reads: [['v.out', 12]],
      },
    ],
    why:
      'An output stage can be stopped by either of two things. Its transistors run out of voltage headroom, ' +
      'which is the rail, or they run out of current, which is the short-circuit protection. Into a light ' +
      'load the rail is what the reader meets. Into a heavy one the current limit arrives long before the ' +
      'rail does, and the output clips at a level that depends on the load rather than on the supply. ' +
      'Common-mode rejection is the third number on the same datasheet page. A voltage applied to both ' +
      'inputs at once should do nothing, and at 90 dB of rejection five volts of it looks like 158 µV of ' +
      'signal. That error is referred to the input, so a stage with a gain of 11 shows eleven times as much ' +
      'of it at the output.',
  },

  a6: {
    see:
      'A ten-millivolt sine drives a diode that sits inside the feedback loop. The amplifier adds the 0.710 V ' +
      'the diode needs, so the output follows the positive half to 9.99 mV. The negative half is blocked, and ' +
      'the amplifier goes to its rail while it waits.',
    seeReads: [
      ['peak.out', 0.0099929001],
      ['v.x', 0.7099929],
    ],
    try: [
      {
        say: 'Move the diode out of the loop. The amplifier now follows its own output, the diode has only 10 mV to work with, and nothing gets through.',
        set: { loop: false },
        reads: [['peak.out', 0, 1e-12]],
      },
      {
        say: 'Put it back and raise the amplitude to 100 mV. The output peak reads 100.0 mV, and the error has not grown with the signal.',
        set: { amp: 0.1 },
        reads: [['peak.out', 0.099992]],
      },
      {
        say: 'Drag the cursor to 1.25 ms, in the blocked half. The output reads 0 V and the amplifier sits at −12.0 V.',
        at: 1.25e-3,
        reads: [
          ['v.out', 0, 1e-9],
          ['v.x', -12],
        ],
      },
    ],
    why:
      'A diode on its own passes nothing below its forward drop, so a signal of a few millivolts never ' +
      'reaches the load. Inside a feedback loop the diode is part of what the amplifier has to overcome, and ' +
      'the amplifier has gain to spare. It raises its own output by the forward drop and holds the load at ' +
      'the input voltage, with an error of the drop divided by the open-loop gain. The price is speed. While ' +
      'the diode blocks, the loop is open and the amplifier runs to a rail, and coming back from a rail takes ' +
      'time that the slew rate sets. That is why a precision rectifier for fast signals uses a second diode ' +
      'to keep the amplifier out of saturation.',
  },
}
