// Group A's three registers. Every number here was measured by
// scripts/readings.mjs before it was written, and experiments.test.js
// recomputes each one at the setting its step names.

export const LESSONS_A = {
  a1: {
    see:
      'A 100 Ω load on a 50 Ω line reflects a third of what arrives. The reflection coefficient reads 0.3333 at ' +
      'an angle of 0.00°, so the returning wave is in step with the incident one. The reference impedance is part ' +
      'of that answer, and the numbers pane prints it beside every reading.',
    seeReads: [['gamma.mag', 0.333333], ['gamma.deg', 0]],
    try: [
      {
        say: 'Set the load resistance to 25 Ω. The magnitude reads 0.3333 again, now at 180.00°, because a load below the reference reflects with the sign reversed.',
        set: { RL: 25 },
        reads: [['gamma.mag', 0.333333], ['gamma.deg', 180]],
      },
      {
        say: 'Set the load resistance to 50 Ω. The reflection falls to zero, because the load and the reference are the same impedance.',
        set: { RL: 50 },
        reads: [['gamma.mag', 0]],
      },
      {
        say: 'Set the load to 30 Ω with −40 Ω of reactance. The magnitude reads 0.5000 at −90.00°, so the wave comes back a quarter cycle behind.',
        set: { RL: 30, XL: -40 },
        reads: [['gamma.mag', 0.5], ['gamma.deg', -90]],
      },
    ],
    why:
      'The reflection coefficient is (Z_L − Z_0)/(Z_L + Z_0), and it is the whole of what a one-port does to a ' +
      'wave. A load equal to the reference makes the numerator zero, so nothing comes back. A load at twice the ' +
      'reference reflects a third, and a load at half the reference reflects the same third with the sign ' +
      'reversed. That symmetry is why the chart in Group B is a disc rather than a half plane. The reference ' +
      'impedance is part of the answer rather than a convention. Against 75 Ω the same 100 Ω load reflects ' +
      '0.1429, not 0.3333. An open circuit reflects everything in step with the incident wave, and a short ' +
      'reflects everything with the sign reversed.',
    whyAt: { z0: 75 },
    whyReads: [['p.z0', 75], ['gamma.mag', 0.142857]],
  },

  a2: {
    see:
      'One 100 Ω load reads four ways. The standing-wave ratio is 2.000, the return loss is 9.542 dB, the ' +
      'mismatch loss is 0.5115 dB, and the load accepts 88.89 per cent of the power sent to it. All four follow ' +
      'from a reflection magnitude of 0.3333, and none of them carries its angle.',
    seeReads: [['vswr', 2], ['returnLoss', 9.54243], ['mismatchLoss', 0.511525], ['accepted', 0.888889], ['gamma.mag', 0.333333]],
    try: [
      {
        say: 'Set the load resistance to 25 Ω. The ratio still reads 2.000, because it does not say which side of the reference the load is on.',
        set: { RL: 25 },
        reads: [['vswr', 2], ['returnLoss', 9.54243]],
      },
      {
        say: 'Set the load to 30 Ω with −40 Ω of reactance. The ratio rises to 3.000, the return loss falls to 6.021 dB, and 75.00 per cent of the power gets in.',
        set: { RL: 30, XL: -40 },
        reads: [['vswr', 3], ['returnLoss', 6.0206], ['accepted', 0.75]],
      },
      {
        say: 'Set the load resistance to 200 Ω. The ratio reads 4.000, the return loss 4.437 dB and the mismatch loss 1.938 dB.',
        set: { RL: 200 },
        reads: [['vswr', 4], ['returnLoss', 4.43697], ['mismatchLoss', 1.9382]],
      },
    ],
    why:
      'A standing wave forms because the reflected wave adds to the incident one in some places along the line ' +
      'and subtracts in others. The ratio of the largest voltage to the smallest is (1 + |Γ|)/(1 − |Γ|), which is ' +
      '2.000 at a magnitude of 0.3333. Return loss is the same magnitude in decibels, and it is quoted positive ' +
      'because a bench instrument reads it that way. Mismatch loss is the power the load did not accept, which is ' +
      '0.5115 dB here. Each of the four throws the angle away, so none of them says what the load is. Two ' +
      'different loads share every one of these numbers whenever they share a magnitude. The chart in Group B ' +
      'keeps the angle, which is why it holds more than these four numbers do.',
  },

  a3: {
    see:
      'A quarter wave of 50 Ω line turns a 100 Ω load into 25.00 Ω. The wave travels at 69.01 per cent of the ' +
      'speed of light on this dielectric, so the wavelength at 1.000 GHz is 20.69 cm. The section is 5.172 cm ' +
      'long, which is an electrical length of 90.00°.',
    seeReads: [['zin.re', 25], ['line.fraction', 0.690066], ['line.lambda', 0.206876], ['line.degrees', 90]],
    try: [
      {
        say: 'Set the frequency to 500 MHz. The same copper is 45.00° of line now, and the input impedance reads 40.00 − j30.00 Ω.',
        set: { f: 5e8 },
        reads: [['line.degrees', 45], ['zin.re', 40], ['zin.im', -30]],
      },
      {
        say: 'Set the frequency to 2.000 GHz. The section is a half wave there, so it presents the load unchanged at 100.0 Ω.',
        set: { f: 2e9 },
        reads: [['line.degrees', 180], ['zin.re', 100]],
      },
      {
        say: 'Set the load resistance to 25 Ω. The quarter wave reads 100.0 Ω, because it inverts about the line’s own impedance.',
        set: { RL: 25 },
        reads: [['zin.re', 100]],
      },
    ],
    why:
      'The impedance looking into a loaded line is Z_0 (Z_L + j Z_0 tan βl)/(Z_0 + j Z_L tan βl), and every term ' +
      'in it is exact. At a quarter wave the tangent runs to infinity, the expression reduces to Z_0² over Z_L, ' +
      'and that is 25.00 Ω here. At a half wave the tangent is zero and the load arrives untouched. Between the ' +
      'two the impedance is complex, so at half the frequency the same section reads 40.00 − j30.00 Ω. The ' +
      'magnitude of the reflection does not move at any frequency, because a lossless line dissipates nothing. ' +
      'Only the angle changes, and that rotation is what Group B draws. Where Z_0 and the propagation constant ' +
      'come from is the electromagnetics course. This lab takes them as given and evaluates.',
    whyAt: { f: 5e8 },
    whyReads: [['zin.re', 40], ['zin.im', -30], ['p.f', 5e8]],
  },

  a4: {
    see:
      'An attenuation of 0.05 Np/m is 0.4343 dB/m. It moves the quarter wave’s input resistance from 25.00 Ω to ' +
      '25.10 Ω. The reflection at the load is still 0.3333, and what arrives back at the source is 0.3316, ' +
      'because the reflected wave crosses the line a second time.',
    seeReads: [['loss.alphaDb', 0.434294], ['zin.re', 25.0968], ['gamma.mag', 0.333333], ['source.mag', 0.331614]],
    try: [
      {
        say: 'Set the attenuation to zero. The input resistance returns to 25.00 Ω and the source sees the load’s own 0.3333.',
        set: { alpha: 0 },
        reads: [['zin.re', 25], ['source.mag', 0.333333]],
      },
      {
        say: 'Set the attenuation to 1 Np/m, which is 8.686 dB/m. The round trip now costs 0.8985 dB and the source sees 0.3006.',
        set: { alpha: 1 },
        reads: [['loss.alphaDb', 8.68589], ['loss.roundTrip', 0.898453], ['source.mag', 0.300577]],
      },
      {
        say: 'Set the length to 51.72 cm, which is ten quarter waves. The one-way loss is 0.2246 dB and the source sees 0.3165.',
        set: { len: 0.517191 },
        reads: [['loss.oneWay', 0.224613], ['source.mag', 0.316532]],
      },
    ],
    why:
      'A neper is to the natural logarithm what the decibel is to the base-ten one. One neper of attenuation ' +
      'divides an amplitude by e, and 0.4343 dB/m is the same 0.05 Np/m written the other way. The reflected ' +
      'wave crosses the line twice before anything at the source sees it, so what returns is smaller by exp(−2αl) ' +
      'rather than by exp(−αl). A long enough cable therefore reads as a good match whatever is on the far end. ' +
      'The instrument is right and the load has not changed. The two-port stays exact through all of this, ' +
      'because cosh and sinh take a complex argument and the propagation constant is α + jβ. Nothing here is a ' +
      'series expansion. The attenuation set here is the same at every frequency, and a real conductor’s rises ' +
      'with the square root of frequency.',
  },

  a5: {
    see:
      'The sweep is exact at 241 frequencies, and nothing is computed between them. The response repeats every ' +
      '2.000 GHz, which is the phase velocity over twice the length. A ratio of polynomials that is not constant ' +
      'cannot repeat for ever, so this line has no transfer function. The pane under the plot gives the reason.',
    seeReads: [['sweep.points', 241], ['line.repeat', 2e9], ['handOver.ok', false]],
    try: [
      {
        say: 'Set the points to 481. The spacing halves to 8.333 MHz, and each of the 481 answers is a separate exact solve.',
        set: { points: 481 },
        reads: [['sweep.points', 481], ['sweep.spacing', 8.33333e6]],
      },
      {
        say: 'Set the length to 10.34 cm, which is a half wave at 1.000 GHz. The repeat spacing halves to 1.000 GHz.',
        set: { len: 0.10343822510819459 },
        reads: [['line.repeat', 1e9], ['line.degrees', 180]],
      },
      {
        say: 'Set the attenuation to 0.05 Np/m. The hand-over is still declined, and the response still repeats every 2.000 GHz.',
        set: { alpha: 0.05 },
        refuses: true,
        reads: [['handOver.ok', false], ['line.repeat', 2e9]],
      },
    ],
    why:
      'A rational function is a ratio of two polynomials, fixed by a finite list of poles and zeros. A length of ' +
      'line contributes the factor exp(−γl), which is transcendental. It has no zero anywhere in the finite plane ' +
      'and no pole anywhere in it either, so no ratio of polynomials equals it at any order. The picture carries ' +
      'the second half of that argument. The response repeats every 2.000 GHz for ever, and a ratio of ' +
      'polynomials that is not constant takes each of its values a finite number of times. Such a function cannot ' +
      'repeat for ever. What exists instead is this sweep, exact at every point and computed point by point. Ask ' +
      'for 241 frequencies and you get 241 exact answers. Ask for a pole and you get the reason there is not one.',
  },
}
