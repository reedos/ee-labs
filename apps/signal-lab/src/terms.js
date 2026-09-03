// Definitions, delivered where the term first does work.
//
// A student meeting "dB" or "bin" mid-lesson should not need a second tab.
// Each preset declares the terms it leans on (`terms: [...]` in presets.js),
// and the sidebar offers those definitions right under the note — folded, so
// they cost nothing to someone who already knows them.
//
// House rules for a definition: two or three sentences; the first says what
// the thing IS, the rest why it is used here; concrete numbers over
// abstraction; no term defined using an undefined term.
//
// TERM_WORDS is the other half of the contract: the words in a note, try line
// or chip that mean a student has just met the term. presets.test.js scans
// every preset's text with these and fails when a word appears in a lesson
// that does not list its term — the cold walk found nine experiments with no
// terms at all and forty-odd words that were never defined anywhere.
//
// CHROME_TERMS are the words the top bar and the readouts use on EVERY
// screen (FFT, bin, the window names, crest factor, span). They live in a
// second folded block, "what the top bar means", and count as defined on
// every lesson.

export const TERMS = {
  db: {
    name: 'dB (decibel)',
    short: 'dB',
    def:
      'A logarithmic way to state a ratio: 20·log₁₀ of an amplitude ratio. So ×10 in amplitude is +20 dB, ×2 is ' +
    '+6 dB, and half is −6 dB. This tool references everything to 1.0, so a full-scale sine reads 0 dB and ' +
    '−40 dB means 1% of full scale. Logs let a tone and its −80 dB distortion fit on one axis.',
  },
  rms: {
    name: 'RMS (root mean square)',
    short: 'RMS',
    def:
      'The steady (DC) level that would deliver the same power as the wiggling signal: square every sample, ' +
    'average, square-root. A ±1 sine has RMS 0.707. A ±1 square has 1.0, because it spends all its time at ' +
    'full amplitude. Peak divided by RMS is the crest factor.',
  },
  crest: {
    name: 'Crest factor',
    short: 'crest factor',
    def:
      'Peak divided by RMS, how far the highest sample stands above the signal’s effective level. A sine reads ' +
    '1.41, a square 1.00 (it is always at its peak), uniform noise 1.73. The readout above the scope prints ' +
    'it beside RMS and peak.',
  },
  span: {
    name: 'Span (cycles)',
    short: 'span',
    def:
      'How much time the scope shows, counted in cycles of source 1 rather than in ' +
      'milliseconds, so "five periods" stays five periods when the frequency moves. With ' +
      'only noise playing there are no cycles to count and the field switches to ms.',
  },
  nyquist: {
    name: 'Nyquist frequency',
    short: 'Nyquist',
    def:
      'Half the sample rate, the boundary of what a sampled system can represent. Everything strictly below it ' +
    'survives sampling. Exactly at it, a sine’s amplitude depends on where the samples land in its cycle, ' +
    'which is the "Exactly at Nyquist" experiment. Above it, frequencies fold back as aliases. At 8 kHz ' +
    'sampling, Nyquist is 4 kHz.',
  },
  fold: {
    name: 'The fold',
    short: 'fold',
    def:
      'Nyquist seen as a mirror. A frequency f above it does not vanish, but reappears at |f − fₛ| below it, as ' +
    'if the axis were folded back at fₛ/2. At 8 kHz a 6000 Hz tone folds to 2000 Hz, and nothing in the ' +
    'samples records which one it was.',
  },
  sampled: {
    name: 'Sampled display (and sin(x)/x)',
    short: 'sampled',
    def:
      'Everything this lab shows is samples, values taken fₛ times a second. A bench scope holds the same ' +
    'thing, since a digital storage oscilloscope samples first and draws afterwards. Zoomed in far enough to ' +
    'see the dots, the curve through them is the ideal (sin x)/x reconstruction, the one bandlimited signal ' +
    'they describe. Below Nyquist that is the continuous original, and above it, the alias.',
  },
  sinc: {
    name: 'sinc, or sin(x)/x',
    short: 'sinc',
    def:
      'The curve sin(πx)/(πx): 1 at x = 0, zero at every other whole number, ringing away on both sides. It is ' +
    'what a sampled system puts between samples, one sinc per sample. Each is 1 at its own instant and 0 at ' +
    'every other, so the sum passes through every dot.',
  },
  reconstruction: {
    name: 'The reconstruction formula (Whittaker–Shannon)',
    short: 'reconstruction formula',
    def:
      'x(t) = Σ x[n]·sinc((t − nT)/T): the continuous signal rebuilt from its samples by ' +
      'placing one sinc at each sample, scaled by that sample’s value. For a signal with ' +
      'nothing above Nyquist the formula gives the original exactly, not an approximation.',
  },
  bandlimited: {
    name: 'Bandlimited',
    short: 'bandlimited',
    def:
      'A signal with a highest frequency, nothing at all above some fₘₐₓ. Only such a signal can be sampled ' +
    'without loss, and the sampling theorem asks for a rate strictly above 2·fₘₐₓ. A square wave, with ' +
    'harmonics without limit, is never bandlimited.',
  },
  interpolation: {
    name: 'Interpolation',
    short: 'interpolation',
    def:
      'Filling in values between the samples you have. Joining the dots with straight lines is one ' +
    'interpolation and a poor one for a sine. The (sin x)/x curve is the one that reproduces the original ' +
    'bandlimited signal, which is why the scope draws it.',
  },
  aliasing: {
    name: 'Aliasing',
    short: 'aliasing',
    def:
      'What happens to a frequency above Nyquist: its samples are indistinguishable from those of a lower ' +
    'frequency, so it appears AS that lower frequency, folded back into range. The original is not ' +
    'attenuated. It is misread, and nothing downstream can tell.',
  },
  fft: {
    name: 'FFT (fast Fourier transform)',
    short: 'FFT',
    def:
      'The algorithm that turns a frame of N samples into the spectrum, showing how much of each frequency is ' +
    'present in N/2 bins from 0 to Nyquist. The top-bar FFT field is that N. A longer frame gives finer bins, ' +
    'but describes a longer stretch of time.',
  },
  dft: {
    name: 'DFT (discrete Fourier transform)',
    short: 'DFT',
    def:
      'The mathematics the FFT computes: the spectrum of a finite frame of samples, which treats the frame as ' +
    'if it repeated forever. That assumption is why a tone that does not fit whole cycles into the frame ' +
    'leaks. The repeat has a jump at the seam.',
  },
  bin: {
    name: 'FFT bin',
    short: 'bin',
    def:
      'One slot of the spectrum. An N-point FFT at sample rate fₛ splits 0…Nyquist into slots fₛ/N apart, 2048 ' +
    'points at 8 kHz gives 3.9 Hz per bin. Two tones closer than a couple of bins read as one peak, which is ' +
    'why frequency resolution is really frame LENGTH.',
  },
  frame: {
    name: 'Frame',
    short: 'frame',
    def:
      'The stretch of N consecutive samples the FFT analyses. At 8 kHz, 2048 samples is a 256 ms frame. Its ' +
    'length sets the bin width (fₛ/N), so resolving two close tones is a question of frame length, not of the ' +
    'algorithm.',
  },
  harmonic: {
    name: 'Harmonic',
    short: 'harmonic',
    def:
      'A component at a whole-number multiple of a fundamental frequency. For 250 Hz that is 250 itself ' +
    '(harmonic 1, as the panels count), then 500, 750, 1000 and so on. Periodic shapes are built entirely ' +
    'from their harmonics, and the set a shape needs, odd only or falling as 1/k or 1/k², is its fingerprint.',
  },
  window: {
    name: 'Window (analysis window)',
    short: 'window',
    def:
      'A taper multiplied onto the frame before the FFT so its edges meet zero. Without one, a ' +
      'tone that does not complete whole cycles in the frame has a jump at the seam, and that ' +
      'jump smears energy everywhere (leakage). Hann is the default trade: wider peak, far ' +
      'quieter skirts.',
  },
  windownames: {
    name: 'hann, hamming, blackman, none',
    short: 'hann / hamming / blackman',
    def:
      'The tapers on offer in the top bar, each a different bell shape over the frame. "None" is no taper, with ' +
    'the sharpest peak and sidelobes only 13 dB down. Hann is the everyday choice (−31 dB). Hamming trades a ' +
    'little floor for a narrower peak, and Blackman buys the quietest floor (−58 dB) with the widest peak.',
  },
  leakage: {
    name: 'Spectral leakage',
    short: 'leakage',
    def:
      'Energy from a single tone spread across many bins because the frame cut the tone mid-cycle. It is an ' +
    'artifact of analysis, not of the signal, the tone is still pure, and a window is the standard remedy.',
  },
  scalloping: {
    name: 'Scalloping loss',
    short: 'scalloping',
    def:
      'A tone that falls between two bin centres shares its height between them, so the tallest bin reads low. ' +
    'With a Hann window that is up to 1.4 dB (15%), at exactly half a bin off, and the readout flags it. ' +
    'Retune to a bin centre, or lengthen the frame, and the peak reads its true amplitude.',
  },
  sidelobe: {
    name: 'Main lobe and sidelobes',
    short: 'sidelobes',
    def:
      'What one pure tone looks like after windowing: a central peak (the main lobe, a few bins wide) with a ' +
    'skirt of smaller ripples either side (the sidelobes). The window choice trades one against the other, a ' +
    'narrower main lobe means taller sidelobes.',
  },
  envelope: {
    name: 'Envelope',
    short: 'envelope',
    def:
      'The slow outline that a fast waveform fills in, the curve drawn through its peaks. Two tones 5 Hz apart ' +
    'make one tone whose envelope pulses 5 times a second. That pulsing is beating, and it is the same signal ' +
    'the spectrum shows as two lines.',
  },
  q: {
    name: 'Q (quality factor)',
    short: 'Q',
    def:
      'How resonant a 2nd-order filter is. For a low-pass it is the height of the peak at the cutoff, so Q = 10 ' +
    'gives a peak of 10×, or +20 dB. For a band-pass it sets the width instead, at bandwidth = f₀/Q. High Q ' +
    'also means long ringing in time, the same fact in the other domain.',
  },
  cutoff: {
    name: 'Cutoff (corner frequency)',
    short: 'cutoff',
    def:
      'The frequency where a filter changes from passing to stopping, f_c in the block’s card, the corner of ' +
    'its response curve. For the biquads here it is where the curve sits at −3 dB (Q = 0.707) or peaks (high ' +
    'Q). A windowed-sinc FIR puts it at −6 dB.',
  },
  passband: {
    name: 'Passband and stopband',
    short: 'passband',
    def:
      'The range of frequencies a filter lets through (passband, near 0 dB) and the range it suppresses ' +
    '(stopband, far down the curve). The transition between them is the skirt. A filter’s order sets how ' +
    'steep that skirt can be.',
  },
  butterworth: {
    name: 'Butterworth (maximally flat)',
    short: 'Butterworth',
    def:
      'The filter design whose passband is as flat as an all-pole response can be, no ripple, no resonant bump, ' +
    'reaching −3 dB exactly at the cutoff whatever its order. Second order needs Q = 0.707. Fourth order ' +
    'needs two sections at Q = 0.541 and 1.307.',
  },
  octave: {
    name: 'Octave and decade',
    short: 'octave / decade',
    def:
      'Two ways of stepping along a frequency axis: an octave is ×2 (250 → 500 Hz), a decade is ×10 (250 → 2500 ' +
    'Hz). Filter slopes are quoted per step, 6 dB/octave is the same slope as 20 dB/decade, one first-order ' +
    'pole’s worth.',
  },
  allpass: {
    name: 'All-pass filter',
    short: 'all-pass',
    def:
      'A filter with |H| = 1 at every frequency: it changes nothing about the spectrum’s magnitude and ' +
    'everything about its phase. It exists to shift timing, the waveform changes shape while its FFT does not ' +
    'move, which is the point of the experiment.',
  },
  phase: {
    name: 'Phase',
    short: 'phase',
    def:
      'Where in its cycle a component is, in degrees or radians. The FFT magnitude plot throws ' +
      'it away, which is why two signals can share a spectrum yet look different on the scope. ' +
      'Filters shift phase as well as scale amplitude, and the shift depends on frequency.',
  },
  groupdelay: {
    name: 'Group delay',
    short: 'group delay',
    def:
      'How long each frequency is held up by the chain, in samples: the slope of phase versus frequency. Flat ' +
    'group delay means every component arrives together, the shape survives, merely late. A peak in it means ' +
    'components near that frequency lag the rest, and the shape smears.',
  },
  order: {
    name: 'Filter order',
    short: 'order',
    def:
      'The highest power of delay in the difference equation, the filter’s memory depth. For the IIR blocks ' +
    'here that is the number of poles, and it sets the ultimate slope at 6 dB/octave (20 dB/decade) per ' +
    'order. Order counts delays, so a 61-tap FIR is order 60 with no poles. One pole cannot resonate, two ' +
    'can, and four as a Butterworth need particular Qs.',
  },
  cascade: {
    name: 'Cascade',
    short: 'cascade',
    def:
      'Blocks in series, the output of one feeding the next. For linear blocks the responses ' +
      'multiply (and the dB values add), so two identical sections square the response and ' +
      'double every attenuation figure.',
  },
  attenuation: {
    name: 'Attenuation',
    short: 'attenuation',
    def:
      'How much a filter reduces a frequency, quoted as a positive number of dB below the passband. So −39 dB ' +
    'on the curve is 39 dB of attenuation, an amplitude of about 1%. Two identical sections in series double ' +
    'it.',
  },
  bypass: {
    name: 'Bypass',
    short: 'bypass',
    def:
      'The power button on a block card. A bypassed block passes the signal through untouched but stays in the ' +
    'chain, so with and without it is one click apart. The card goes dashed and the flow strip shows the ' +
    'block dimmed.',
  },
  impulse: {
    name: 'Impulse',
    short: 'impulse',
    def:
      'One sample of 1 followed by silence, the shortest possible signal. Its spectrum is perfectly flat, ' +
    'holding every frequency in equal measure. So whatever comes out of a filter fed an impulse is that ' +
    'filter’s own description, in time and in frequency at once.',
  },
  delta: {
    name: 'δ[n] (the unit impulse)',
    short: 'δ[n]',
    def:
      'The symbol for the impulse as a sequence: δ[n] is 1 at n = 0 and 0 everywhere else. Any signal is a ' +
    'train of scaled, shifted deltas, x[0]·δ[n] + x[1]·δ[n−1] and so on. That is the step that turns the ' +
    'impulse response into a recipe for every other input.',
  },
  hH: {
    name: 'h(t) and H(f)',
    short: 'h(t) / H(f)',
    def:
      'Two descriptions of one filter. h is its impulse response, what comes out over time when an impulse goes ' +
    'in. H is its frequency response, how much of each frequency passes. Each is the Fourier transform of the ' +
    'other, which is why the two panes agree.',
  },
  kernel: {
    name: 'Impulse response / kernel',
    short: 'kernel',
    def:
      'Two names for one sequence. "Impulse response" is how it is measured. Feed a single 1, record what comes ' +
    'out. "Kernel" is what it is for: the weights the convolution sum applies to the recent past. That they ' +
    'coincide is a theorem, and LTI is its hypothesis.',
  },
  settling: {
    name: 'Settling',
    short: 'settling',
    def:
      'A filter’s output arriving at its final value after a sudden change and staying there. A resonant filter ' +
    'overshoots and rings on its way. The ringing dies as rⁿ, where r is the pole radius, so high Q means ' +
    'slow settling.',
  },
  damping: {
    name: 'Damping ratio ζ, and critical damping',
    short: 'ζ / critical damping',
    def:
      'The same knob as Q seen from the time side: ζ = 1/(2Q). Below ζ = 1 (Q above 0.5) a step response ' +
    'overshoots and rings. At ζ = 1, critical damping, Q = 0.5, it reaches the final value as fast as ' +
    'possible with no overshoot at all.',
  },
  taps: {
    name: 'Taps',
    short: 'taps',
    def:
      'The coefficients of an FIR filter, one per delayed sample it looks back at, an 8-tap moving average ' +
    'multiplies the last 8 samples by 1/8 each and adds. More taps mean a longer memory, sharper frequency ' +
    'shape, and more delay: (N − 1)/2 samples.',
  },
  fir: {
    name: 'FIR and IIR',
    short: 'FIR / IIR',
    def:
      'Finite impulse response: a filter made only of delayed copies of the input. Its response to an impulse ' +
    'ends after N taps, so it can never be unstable. Infinite impulse response: one with feedback from its ' +
    'own output, the biquads here, whose ringing decays but never strictly stops.',
  },
  windowedsinc: {
    name: 'Windowed sinc',
    short: 'windowed sinc',
    def:
      'The standard recipe for an FIR low-pass. Take the ideal sinc kernel, which runs without end, keep N taps ' +
    'of it, and taper the ends with a window so the cut is not abrupt. The taper sets how deep and how wide ' +
    'the transition is.',
  },
  brickwall: {
    name: 'Brick-wall filter',
    short: 'brick-wall',
    def:
      'The ideal low-pass: everything below the cutoff passes at exactly 1 and everything above at exactly 0, a ' +
    'rectangle in frequency. Its impulse response is a sinc that never ends, so no real filter can be one. ' +
    'Every real design is a compromise with it.',
  },
  ripple: {
    name: 'Ripple',
    short: 'ripple',
    def:
      'Wobble in a response curve where an ideal one would be flat, the bumps beside a sharp corner. On a ' +
    'linear amplitude axis 8% ripple is plainly visible. On the dB axis it is 0.7 dB, two pixels, which is ' +
    'why that experiment loads in linear.',
  },
  gibbs: {
    name: 'Gibbs phenomenon',
    short: 'Gibbs',
    def:
      'The overshoot that appears whenever something with a jump is built from a finite number of smooth ' +
    'pieces. About 9% of the jump, and adding more pieces makes it narrower but never smaller. A truncated ' +
    'Fourier series shows it in time. A truncated sinc kernel shows it in frequency.',
  },
  zplane: {
    name: 'z-plane',
    short: 'z-plane',
    def:
      'The complex plane where a digital filter’s poles (×) and zeros (○) live. The unit circle is the ' +
    'frequency axis, DC at z = 1 and Nyquist at z = −1. The response at a frequency is proportional to the ' +
    'distances to the zeros over the distances to the poles, measured from that point on the circle. Stable ' +
    'means all poles inside.',
  },
  poles: {
    name: 'Poles and zeros',
    short: 'poles / zeros',
    def:
      'The roots of a filter’s transfer function. Zeros are the points on the z-plane where the numerator ' +
    'vanishes and the response dips, poles where the denominator vanishes and it peaks. A zero on the unit ' +
    'circle is an exact null. A pole near it is a resonance, and a pole outside it is instability.',
  },
  rootsofunity: {
    name: 'Roots of unity',
    short: 'roots of unity',
    def:
      'The N solutions of zᴺ = 1: N points evenly spaced around the unit circle, 360°/N ' +
      'apart, starting at z = 1. A moving average’s zeros are these points with z = 1 ' +
      'removed, which is why its nulls are evenly spaced in frequency.',
  },
  comb: {
    name: 'Comb filter',
    short: 'comb',
    def:
      'A signal added to a delayed copy of itself. The response has evenly spaced teeth, notches every 1/τ ' +
    'hertz for a delay of τ seconds, like a comb. With the delayed copy fed back instead, the teeth point up ' +
    'as peaks.',
  },
  feedback: {
    name: 'Feedforward and feedback',
    short: 'feedforward / feedback',
    def:
      'Feedforward means the block combines delayed copies of its input, which makes an FIR and the comb’s ' +
    'notches. Feedback means it combines delayed copies of its own output, so the signal recirculates. That ' +
    'makes an IIR, the comb’s peaks, and every biquad here.',
  },
  notch: {
    name: 'Notch',
    short: 'notch',
    def:
      'A narrow dip in a response curve, one frequency cut hard while its neighbours pass. A zero on the unit ' +
    'circle makes an exact one. The comb makes a whole row of them at once, one every 1/τ hertz.',
  },
  convolution: {
    name: 'Convolution',
    short: 'convolution',
    def:
      'The sum y[n] = Σ h[k]·x[n−k]: each output sample is the kernel times the recent past. It is the only ' +
    'description of filtering that covers FIR and IIR at once, and it is what every LTI system does to its ' +
    'input, nothing more.',
  },
  lti: {
    name: 'LTI (linear, time-invariant)',
    short: 'LTI',
    def:
      'The two assumptions under this whole tool. Linear means superposition, so responses to added signals ' +
    'add, plus scaling, so double the input doubles the output. Time-invariant means shifting the input ' +
    'shifts the output identically. Together they make a system treat each frequency separately, so a sine in ' +
    'gives a sine of the same frequency out, scaled and shifted. Clip or quantize and linearity is gone.',
  },
  superposition: {
    name: 'Superposition',
    short: 'superposition',
    def:
      'Half of what "linear" means (the other half is scaling). The response to a sum is the sum of the ' +
    'responses. It is why sources here simply add, why each spectral line can be read independently, and what ' +
    'nonlinear blocks visibly break.',
  },
  transfer: {
    name: 'Transfer function',
    short: 'transfer function',
    def:
      'H(f), or H(z): the one curve that says what a linear block does to every frequency, multiply in by |H|, ' +
    'shift by its phase. It is drawn in blue over the spectrum. A nonlinear block has none, and the curve ' +
    'goes dashed to say so.',
  },
  memoryless: {
    name: 'Memoryless',
    short: 'memoryless',
    def:
      'A block whose output right now depends only on the input right now, a clipper, a rectifier, a quantizer, ' +
    'with no delayed samples inside. Memoryless blocks cannot filter (no memory, no frequency preference) but ' +
    'can be violently nonlinear.',
  },
  operatingpoint: {
    name: 'Operating point',
    short: 'operating point',
    def:
      'The steady level a signal sits around while it wiggles, its DC offset. A curve that is symmetric about ' +
    'zero is not symmetric about 0.3, so shifting the operating point changes which distortion products a ' +
    'nonlinearity makes.',
  },
  intermod: {
    name: 'Intermodulation',
    short: 'intermodulation',
    def:
      'New frequencies a nonlinearity makes from TWO inputs at once: sums and differences of ' +
      'their multiples, m·f₁ ± n·f₂. The third-order ones, 2f₁ − f₂ and 2f₂ − f₁, land ' +
      'close to the originals, where no filter can remove them.',
  },
  carrier: {
    name: 'Carrier',
    short: 'carrier',
    def:
      'The high, fixed-frequency sine a signal is multiplied onto so it can be moved up the spectrum, 1000 Hz ' +
    'here, a station’s dial frequency in radio. The information rides beside it as sidebands. The carrier ' +
    'itself carries none.',
  },
  sidebands: {
    name: 'Sidebands',
    short: 'sidebands',
    def:
      'The copies of a signal that multiplication by a carrier produces, one above at f_c + f and one below at ' +
    'f_c − f. A 250 Hz tone on a 1000 Hz carrier makes 750 and 1250 Hz. Both hold the same information.',
  },
  dsbsc: {
    name: 'DSB-SC (double-sideband, suppressed carrier)',
    short: 'DSB-SC',
    def:
      'Plain multiplication by the carrier: both sidebands are sent and the carrier itself is ' +
      'absent, since nothing constant was multiplied in. Broadcast AM adds the carrier back ' +
      'on purpose so a simple receiver can recover the envelope.',
  },
  modindex: {
    name: 'Modulation index',
    short: 'modulation index',
    def:
      'How deeply the signal sways the carrier in AM: the ratio of the signal’s swing to the constant added ' +
    'before the multiplier. At index 1 the envelope just touches zero. The DC offset control here sets it.',
  },
  quantize: {
    name: 'Quantize',
    short: 'quantize',
    def:
      'Round every sample to the nearest of 2ᴺ allowed levels, what an N-bit converter does. The rounding error ' +
    'is at most half a step, and for a periodic signal it repeats with the signal, which is why it shows as ' +
    'spurs instead of hiss.',
  },
  spurs: {
    name: 'Spurs',
    short: 'spurs',
    def:
      'Narrow unwanted lines in a spectrum at frequencies the input did not contain, here the harmonics of the ' +
    'quantization error. Discrete spurs are worse than the same power as a flat floor because each one is a ' +
    'tone you can hear or measure.',
  },
  dither: {
    name: 'Dither',
    short: 'dither',
    def:
      'A tiny random offset added before rounding, so the rounding error no longer repeats with the signal. It ' +
    'trades correlated spurs for an even, slightly higher noise floor, the floor the SNR formula assumed all ' +
    'along.',
  },
  snr: {
    name: 'SNR (signal-to-noise ratio)',
    short: 'SNR',
    def:
      'Signal power over noise power, in dB. For a full-scale sine rounded to N bits with dither, the classic ' +
    'figure is 6.02·N + 1.76 dB. That is 25.8 dB at 4 bits and 98 dB at 16, with each extra bit buying 6 dB.',
  },
  fullscale: {
    name: 'Full scale',
    short: 'full scale',
    def:
      'The largest amplitude the system represents: 1.0 here, ±1 on the scope and 0 dB on ' +
      'the spectrum. A quantizer’s step is 2/2ᴺ of that range, and its SNR figure assumes a ' +
      'sine that uses all of it.',
  },
}

/**
 * The words that mean a term is in play, per term id. Scanned over each
 * preset's note, try line and chips by presets.test.js; a hit demands the id
 * in that preset's `terms` (chrome terms excepted — they are on every screen).
 */
export const TERM_WORDS = {
  db: /\bdB\b/,
  rms: /\bRMS\b/,
  crest: /\bcrest\b/i,
  span: /\bspan\b/i,
  nyquist: /\bNyquist\b/i,
  fold: /\bfold/i,
  sinc: /\bsinc\b|sin\(x\)\/x|\(sin x\)\/x/i,
  reconstruction: /Whittaker|reconstruction formula/i,
  bandlimited: /band-?limited/i,
  interpolation: /interpolat/i,
  aliasing: /\balias/i,
  fft: /\bFFT\b/,
  dft: /\bDFT\b/,
  bin: /\bbins?\b/i,
  frame: /\bframe\b/i,
  harmonic: /\bharmonic/i,
  window: /\bwindow\b/i,
  windownames: /\b(hann|hamming|blackman)\b/i,
  leakage: /\bleak/i,
  scalloping: /scallop/i,
  sidelobe: /(side|main)[- ]?lobe/i,
  envelope: /\benvelope/i,
  q: /\bQs?\b/,
  cutoff: /\bcutoff\b/i,
  passband: /pass-?band|stop-?band/i,
  butterworth: /butterworth/i,
  octave: /\boctave|\bdecade/i,
  allpass: /all-pass/i,
  phase: /\bphase\b/i,
  groupdelay: /group[- ]delay/i,
  order: /\b\d+(st|nd|rd|th)[- ]order\b|\bOrder\b/,
  cascade: /cascad/i,
  attenuation: /attenuat/i,
  bypass: /\bbypass/i,
  impulse: /\bimpulse\b/i,
  delta: /δ\[n\]/,
  hH: /\bh\(t\)|\bH\(f\)/,
  kernel: /\bkernel/i,
  settling: /\bsettl/i,
  damping: /damping|ζ/i,
  taps: /\btaps?\b/i,
  fir: /\bFIR\b|\bIIR\b/,
  windowedsinc: /windowed sinc/i,
  brickwall: /brick[- ]wall/i,
  ripple: /\bripple/i,
  gibbs: /\bGibbs\b/,
  zplane: /z-plane/i,
  poles: /\bpoles?\b|\bzeros\b/i,
  rootsofunity: /roots of unity/i,
  comb: /\bcomb\b/i,
  feedback: /feed-?forward|feed-?back/i,
  notch: /\bnotch/i,
  convolution: /\bconvol/i,
  lti: /\bLTI\b|\bLINEAR\b|\blinearity\b|\blinear (block|system|chain)\b/,
  superposition: /superposition/i,
  transfer: /transfer function/i,
  memoryless: /memoryless/i,
  operatingpoint: /operating point/i,
  intermod: /intermodulation/i,
  carrier: /\bcarrier/i,
  sidebands: /sideband/i,
  dsbsc: /DSB-SC|suppressed-carrier/i,
  modindex: /modulation index/i,
  quantize: /quantiz/i,
  spurs: /\bspurs?\b/i,
  dither: /\bdither/i,
  snr: /\bSNR\b/,
  fullscale: /full[- ]scale/i,
}

/**
 * The words the chrome uses on every screen — the top bar's fields and the
 * readouts above the plots. Defined once in the "what the top bar means"
 * block, so a note may use them without listing them.
 */
export const CHROME_TERMS = ['fft', 'bin', 'frame', 'window', 'windownames', 'rms', 'crest', 'span']

/** The definitions a preset asked for, in the order it asked. */
export function termsFor(ids = []) {
  return ids.map((id) => ({ id, ...TERMS[id] })).filter((t) => t.name)
}

/**
 * The folded summary's text: which terms wait behind it. A student who knows
 * "aliasing" and "Nyquist" can leave it shut; one who does not sees the word
 * that stopped them before deciding to open it. Opening it by default was
 * the other option, and that pushes the knobs down the sidebar.
 */
export function termsSummary(ids = []) {
  const shorts = termsFor(ids).map((t) => t.short || t.name)
  return shorts.length ? `Terms used here: ${shorts.join(', ')}` : 'Terms used here'
}

/**
 * Which terms a piece of lesson text touches, by TERM_WORDS. Chrome terms are
 * left out: they are defined on every screen already.
 */
export function termsInText(text) {
  const out = []
  for (const [id, re] of Object.entries(TERM_WORDS)) {
    if (CHROME_TERMS.includes(id)) continue
    if (re.test(text)) out.push(id)
  }
  return out
}
