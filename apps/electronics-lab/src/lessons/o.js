// Group O's three registers. Every number here is a reading, checked against
// the solver by experiments.test.js, and every knob move names a setting the
// knob can reach.

import { cornerOf, ktOverC, noiseBandwidth, noiseOf, stageOf, thermalDensity } from '../groups/o.js'

/** A percentage the prose quotes, from a ratio the analysis carries. */
const pct = (f) => (x) => 100 * f(noiseOf(x))
/** The ratio the source resistance's own thermal noise alone would allow. */
const sourceOnly = (p) => 20 * Math.log10(p.vsig / Math.SQRT2 / (thermalDensity(p.Rs, p.T) * Math.sqrt(p.bw - 1)))

/** The junction's own slope at the bias the circuit settled on. */
const slope = (x) => x.point.D1.rd

export const LESSONS_O = {
  o1: {
    see:
      'A hundred frames of a random signal, averaged, give a floor flat at 6.45 µV per root hertz. That is a ' +
      'density and not a spectrum. Its height depends on how wide a slice of frequency each bin holds, so the ' +
      'unit it carries is volts per root hertz rather than volts.',
    seeReads: [['noise.measured', 6.45215859e-6]],
    try: [
      {
        say: 'Set the frames averaged to 1. One frame is spray, and its bins scatter by 85.6 % where a hundred frames scatter by 9.64 %.',
        set: { averages: 1 },
        reads: [
          [pct((n) => n.flatness), 85.6053971],
          [(x, p, again) => 100 * noiseOf(again({ averages: 100 })).flatness, 9.64107739],
        ],
      },
      {
        say: 'Set the frames averaged to 10. The scatter falls as one over the root of the count, to 28.0 %.',
        set: { averages: 10 },
        reads: [[pct((n) => n.flatness), 28.0284657]],
      },
      {
        say: 'Set f_s to 12 kHz. The same 1 mV of rms now sits in a quarter of the band, so the density doubles to 12.9 µV per root hertz.',
        set: { fs: 12000 },
        reads: [['noise.measured', 12.9043172e-6]],
      },
    ],
    why:
      'A random signal has no spectrum in the sense a sine has one. Its power is spread over every frequency, ' +
      'and what it carries instead is a density, power per hertz. One periodogram frame estimates that density ' +
      'with two degrees of freedom per bin, so each bin’s standard deviation equals its own mean and the ' +
      'picture is spray rather than a floor. Averaging M independent frames gives 2M degrees of freedom, and ' +
      'the relative spread falls as one over the root of M. At a hundred frames the estimator predicts 10.0 % ' +
      'and the measurement reads 9.64 %. Integrating the density over the band returns the power the generator ' +
      'was given, 0.997 mV of rms against 1 mV. Volts per root hertz is the unit for the rest of this group.',
    whyReads: [
      [pct((n) => n.relativeSe), 10],
      [pct((n) => n.flatness), 9.64107739],
      ['noise.integral', 9.97413481e-4],
    ],
  },

  o2: {
    see:
      'A kilohm at room temperature makes 4.07 nV per root hertz of thermal noise, and it makes it at every ' +
      'frequency alike. The capacitor rolls that off at 159 kHz. What sits on the capacitor over the whole ' +
      'band is 2.03 µV of rms.',
    seeReads: [
      ['noise.density', 4.07035478e-9],
      ['noise.rms', 2.03446466e-6],
      [(x, p) => cornerOf(p), 159154.943],
    ],
    try: [
      {
        say: 'Set R₁ to 100 kΩ. The density rises tenfold to 40.7 nV per root hertz, and the rms does not move from 2.03 µV.',
        set: { R1: 100000 },
        reads: [
          ['noise.density', 4.07035397e-8],
          ['noise.rms', 2.03446466e-6],
        ],
      },
      {
        say: 'Set R₁ to 100 Ω. The density falls to 1.29 nV per root hertz, and the rms is still 2.03 µV.',
        set: { R1: 100 },
        reads: [
          ['noise.density', 1.2871592e-9],
          ['noise.rms', 2.03446466e-6],
        ],
      },
      {
        say: 'Set C₁ to 10 nF. Ten times the capacitance is √10 less rms, and it reads 643 nV.',
        set: { C1: 10e-9 },
        reads: [['noise.rms', 6.43354216e-7]],
      },
    ],
    why:
      'Nyquist’s result gives every resistance a noise voltage density of √(4kTR), whatever it is made of and ' +
      'whatever current is in it. Raising R raises that density as the root of R. It also narrows the band the ' +
      'capacitor passes, as one over R, and the two moves cancel exactly. What is left is √(kT/C), which is ' +
      '2.04 µV at a nanofarad, and the resistance has gone out of the answer. The band that does the ' +
      'cancelling is the noise bandwidth, (π/2)f_c rather than f_c, which comes to 250 kHz here. Every sampled ' +
      'circuit is measured against this number, because the charge a switch leaves behind on a capacitor ' +
      'carries exactly it.',
    whyReads: [
      [(x, p) => ktOverC(p.C1, p.T), 2.03517739e-6],
      [(x, p) => noiseBandwidth(cornerOf(p)), 250000],
    ],
  },

  o3: {
    see:
      'A milliamp crossing a junction carries 17.9 pA per root hertz of shot noise. Across the junction’s own ' +
      'slope of 25.9 Ω that comes to 0.463 nV per root hertz. The current is a countable number of carriers, ' +
      'and the count in any interval has a spread.',
    seeReads: [
      [(x) => noiseOf(x).shotOf.D1, 1.79007074e-11],
      ['noise.density', 4.62769085e-10],
      [slope, 25.852],
    ],
    try: [
      {
        say: 'Set I to 10 µA. A hundredth of the current is a tenth of the shot noise, 1.79 pA per root hertz.',
        set: { i: 10e-6 },
        reads: [[(x) => noiseOf(x).shotOf.D1, 1.79007074e-12]],
      },
      {
        say: 'Set I to 10 mA. Ten times the current is √10 times the density, 56.6 pA per root hertz.',
        set: { i: 10e-3 },
        reads: [[(x) => noiseOf(x).shotOf.D1, 5.66070072e-11]],
      },
      {
        say: 'Set T to 350 K. The shot noise does not move at all, while the slope grows with T and the voltage rises to 0.540 nV per root hertz.',
        set: { T: 350 },
        reads: [
          ['noise.density', 5.39897266e-10],
          [(x) => noiseOf(x).shotOf.D1, 1.79007074e-11],
        ],
      },
    ],
    why:
      'Thermal noise comes from carriers in motion inside a resistance. Shot noise comes from something else, ' +
      'a current crossing a barrier as separate charges. Its density is √(2qI), it follows the current alone, ' +
      'and it does not follow temperature. The two are worth comparing at the same slope. A junction passing I ' +
      'has a small-signal resistance of V_T/I, and 2qI times that resistance squared is exactly half of 4kT ' +
      'times the resistance. So a junction makes half the noise power of a resistor of the same slope. That ' +
      'factor of one half is why a bipolar transistor’s input noise is what it is, and the two experiments ' +
      'after this one rest on it.',
    whyReads: [[(x, p) => (noiseOf(x).density / thermalDensity(slope(x), p.T)) ** 2, 0.5]],
  },

  o4: {
    see:
      'Three sources arrive at the collector. The source resistance makes 364 nV per root hertz of it, the ' +
      'base current 81.4 nV and the collector current 89.5 nV. Together they come to 383 nV, and the noise ' +
      'figure that works out to is 0.455 dB.',
    seeReads: [
      [(x) => noiseOf(x).stack.Rs, 3.63883626e-7],
      [(x) => noiseOf(x).stack.rpi, 8.13668526e-8],
      [(x) => noiseOf(x).stack.gm, 8.95035372e-8],
      ['noise.density', 3.83461525e-7],
      ['noise.nf', 0.455185629],
    ],
    try: [
      {
        say: 'Set R_s to 25.9 Ω. A tenth of the optimum makes the figure worse, at 1.80 dB.',
        set: { Rs: 25.852 },
        reads: [['noise.nf', 1.80426965]],
      },
      {
        say: 'Set R_s to 2.59 kΩ. Ten times the optimum is worse as well, at 1.82 dB, so 259 Ω sits at a minimum.',
        set: { Rs: 2585.2 },
        reads: [['noise.nf', 1.81843589]],
      },
      {
        say: 'Set β to 400 and R_s to 517 Ω. Four times the current gain moves the optimum out, and the figure falls to 0.222 dB.',
        set: { beta: 400, Rs: 517.04 },
        reads: [['noise.nf', 0.222478932]],
      },
    ],
    why:
      'A noise figure is how much worse the ratio at an output is than the ratio at the source that fed it. ' +
      'Three sources set it here. The source resistance’s own thermal noise is the reference. The base ' +
      'current’s shot noise flows in the source resistance and grows with it. The collector current’s shot ' +
      'noise is referred to the input by dividing by g_m, and shrinks as the source resistance grows. One term ' +
      'rises and the other falls, so there is a source resistance where the sum is least, √β/g_m, which is ' +
      '259 Ω here. The textbook figure there is 1 + 1/√β, or 0.414 dB. The circuit reads 0.455 dB, because ' +
      'r_π sits across the same node and the closed form sends the base current through the source alone.',
    whyReads: [
      [(x, p) => Math.sqrt(p.beta) / stageOf(p).gm, 258.519998],
      [(x, p) => 10 * Math.log10(1 + 1 / Math.sqrt(p.beta)), 0.413926852],
      ['noise.nf', 0.455185629],
    ],
  },

  o5: {
    see:
      'A 1 mV signal in a 20 kHz band. At the first stage’s output the signal-to-noise ratio reads 60.93 dB. ' +
      'At the second stage’s output, after a further gain of 193, it reads 60.93 dB again. The whole second ' +
      'stage cost the ratio 0.00002 dB.',
    seeReads: [
      ['noise.snrdb.c', 60.9277345],
      ['noise.snrdb.d', 60.9277139],
      [(x) => noiseOf(x).snrdb.c - noiseOf(x).snrdb.d, 2.06e-5, 1e-6],
    ],
    try: [
      {
        say: 'Set the band top to 200 kHz. Ten times the band is ten times the noise power, and the ratio falls by ten decibels to 50.93 dB.',
        set: { bw: 200000 },
        reads: [['noise.snrdb.d', 50.9275185]],
      },
      {
        say: 'Set R_s to 10 kΩ. The source resistance makes more noise and passes less of the signal, and the ratio falls to 47.07 dB.',
        set: { Rs: 10000 },
        reads: [['noise.snrdb.d', 47.066208]],
      },
      {
        say: 'Set R_s to 259 Ω. At the first stage’s own optimum the ratio rises to 67.20 dB.',
        set: { Rs: 258.52 },
        reads: [['noise.snrdb.d', 67.2019756]],
      },
    ],
    why:
      'Friis’s formula says a chain’s noise figure is the first stage’s, plus each later stage’s excess ' +
      'divided by all the gain in front of it. The first stage here has a gain of 47.5, so the second stage’s ' +
      'own noise arrives at the output divided by that, and its power by the square of it. What it costs the ' +
      'ratio is 0.00002 dB. The rule that follows is the one every receiver is built on. Put the quietest ' +
      'stage first and give it enough gain, because nothing downstream recovers a ratio the front end has ' +
      'already lost. The source resistance alone would allow 61.78 dB in this band. The chain gives back ' +
      '60.93 dB, and almost all of that 0.855 dB of loss belongs to the first stage.',
    whyReads: [
      ['noise.snrdb.d', 60.9277139],
      [(x) => noiseOf(x).snrdb.c - noiseOf(x).snrdb.d, 2.06e-5, 1e-6],
      [(x, p) => sourceOnly(p), 61.7823],
      [(x, p) => sourceOnly(p) - noiseOf(x).snrdb.d, 0.8546],
    ],
  },
}
