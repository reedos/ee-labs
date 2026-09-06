// Group G: multipath, equalisation and fading.
//
// The channel is a tapped delay line, which is exactly rational in z, so its
// response and its zeros come from the shared FIR machinery unchanged. The
// equalisers are exact solutions of the linear systems they state. Fading is
// neither, and G6 prints its three assumptions with its numbers.

export const GROUP_G = 'Multipath and equalisation'

export default [
  {
    id: 'G1',
    group: GROUP_G,
    name: 'Two paths make a notch',
    terms: ['multipath', 'notch', 'coherence'],
    params: { echo: 0.5, echoDelay: 4, beta: 0.35, symbolRate: 1000 },
    view: 'channel',
    views: ['channel'],
    featured: { field: 'echo' },
    claims: [
      {
        label: 'the peak is one plus the echo, which is 3.522 dB',
        path: 'chan.peakDb',
        formula: (p) => 20 * Math.log10(1 + p.echo),
        tol: 1e-6,
      },
      {
        label: 'the notch is one less the echo, which is -6.021 dB',
        path: 'chan.notchDb',
        formula: (p) => 20 * Math.log10(1 - p.echo),
        tol: 1e-3,
      },
      {
        label: 'the notches repeat at the sample rate over the delay',
        path: 'chan.notchSpacing',
        formula: (p) => p.sampleRate / p.echoDelay,
        tol: 1e-9,
      },
      {
        label: 'and the first one sits at half that spacing',
        path: 'chan.firstNotch',
        formula: (p) => p.sampleRate / p.echoDelay / 2,
        tol: 1e-9,
      },
      {
        label: 'the coherence bandwidth is narrower than the signal, so the channel is selective',
        path: 'chan.coherenceBandwidth',
        atMostValue: 1400,
      },
    ],
  },
  {
    id: 'G2',
    group: GROUP_G,
    name: 'The notch closes the eye',
    terms: ['notch', 'isi', 'eye', 'multipath', 'nyquistpulse', 'equaliser'],
    params: { echo: 0.5, echoDelay: 4, beta: 0.35, span: 12, eqTaps: 41 },
    view: 'channel',
    views: ['channel', 'eye'],
    featured: { field: 'echo' },
    claims: [
      {
        label: 'the signal occupies more than the channel treats alike',
        path: 'chan.occupied',
        atLeast: 'chan.coherenceBandwidth',
      },
      {
        label: 'so the channel is frequency selective at these settings',
        path: 'chan.coherenceBandwidth',
        atMostValue: 1400,
      },
      {
        label: 'the shaping alone leaves almost no interference',
        path: 'pulse.isi.near',
        atMostValue: 1e-3,
      },
      {
        label: 'and the echo leaves a great deal, until it is equalised',
        path: 'eq.residual',
        atMostValue: 1e-3,
      },
    ],
  },
  {
    id: 'G3',
    group: GROUP_G,
    name: 'The zero-forcing equaliser inverts the channel',
    terms: ['equaliser', 'multipath', 'isi', 'notch'],
    params: { echo: 0.5, echoDelay: 4, eqTaps: 41 },
    view: 'channel',
    views: ['channel'],
    featured: { field: 'eqTaps' },
    claims: [
      {
        label: 'at 41 taps the residual interference is below a thousandth',
        path: 'eq.residual',
        atMostValue: 1e-3,
      },
      {
        label: 'the delay the design chose is nothing, because the inverse is causal',
        path: 'eq.delay',
        atMostValue: 0,
      },
      {
        label: 'the noise it amplifies is 1.249 dB on this channel',
        path: 'eq.noiseGainDb',
        formula: () => 1.2494,
        tol: 1e-3,
      },
      {
        label: 'and the cascade of channel and equaliser is one at the decision instant',
        path: 'eq.cascade.0',
        formula: () => 1,
        tol: 1e-3,
      },
    ],
  },
  {
    id: 'G4',
    group: GROUP_G,
    name: 'Inverting a notch amplifies noise',
    terms: ['equaliser', 'notch', 'awgn'],
    params: { echo: 0.9, echoDelay: 4, eqTaps: 41 },
    view: 'channel',
    views: ['channel'],
    featured: { field: 'echo' },
    claims: [
      {
        label: 'a deeper echo puts the notch at -20.000 dB',
        path: 'chan.notchDb',
        formula: (p) => 20 * Math.log10(1 - p.echo),
        tol: 1e-2,
      },
      {
        label: 'and the equaliser that inverts it amplifies noise by more',
        path: 'eq.noiseGainDb',
        atLeastValue: 3,
      },
      {
        label: 'the minimum mean-square solution amplifies less',
        path: 'eq.mmseNoiseGainDb',
        atMost: 'eq.noiseGainDb',
      },
      {
        label: 'and leaves more interference for it, which is the trade',
        path: 'eq.mmseResidual',
        atLeast: 'eq.residual',
      },
    ],
  },
  {
    id: 'G5',
    group: GROUP_G,
    name: 'The adaptive equaliser learns the channel',
    terms: ['lms', 'equaliser', 'multipath'],
    params: { echo: 0.5, echoDelay: 4, eqTaps: 21, mu: 0.02, lmsSymbols: 20000, seed: 1 },
    view: 'channel',
    views: ['channel'],
    featured: { field: 'mu' },
    claims: [
      {
        label: 'the recursion converges at this step size',
        path: 'eq.lms.mse',
        atMostValue: 0.05,
      },
      {
        label: 'and its error falls from where it started',
        path: 'eq.lms.history.0',
        atLeastScaled: { path: 'eq.lms.mse', by: 2 },
      },
      {
        label: 'the taps it learns are close to the direct solution',
        path: 'eq.lmsGap',
        atMostValue: 0.15,
      },
      {
        label: 'above two over the taps times the input power it does not converge',
        path: 'eq.lmsBound',
        formula: (p) => 2 / (p.eqTaps * (1 + p.echo * p.echo)),
        tol: 1e-12,
      },
    ],
  },
  {
    id: 'G6',
    group: GROUP_G,
    name: 'Fading is a model, and it is labelled',
    terms: ['fading', 'ber', 'margin'],
    params: { ebN0Db: 10, target: 1e-5, symbols: 20000, seed: 9, kFactor: 0 },
    view: 'ber',
    views: ['ber', 'constellation'],
    featured: { field: 'ebN0Db' },
    claims: [
      {
        label: 'the average rate at 10 dB is 2.3269 in a hundred',
        path: 'fade.closed',
        formula: () => 0.0232687,
        tol: 1e-4,
      },
      {
        label: 'and at 20 dB it is 2.4814 in a thousand',
        path: 'fade.closedAt20',
        formula: () => 2.48140e-3,
        tol: 1e-4,
      },
      {
        label: 'reaching one error in a hundred thousand takes 43.98 dB',
        path: 'fade.threshold',
        formula: () => 43.979,
        tol: 1e-3,
      },
      {
        label: 'against 9.588 dB with no fading, a penalty of 34.39 dB',
        path: 'fade.penaltyDb',
        formula: () => 34.391,
        tol: 1e-3,
      },
      {
        label: 'the gains have unit mean square, so the model changes the fading and not the power',
        path: 'fade.meanSquare',
        formula: () => 1,
        tol: 0.05,
      },
      {
        label: 'and the model states three assumptions with its numbers',
        path: 'fade.assumptions.length',
        formula: () => 3,
        tol: 0,
      },
    ],
  },
]
