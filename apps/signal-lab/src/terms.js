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

export const TERMS = {
  db: {
    name: 'dB (decibel)',
    def:
      'A logarithmic way to state a ratio: 20·log₁₀ of an amplitude ratio, so ×10 in amplitude ' +
      'is +20 dB, ×2 is +6 dB, and half is −6 dB. This tool references everything to 1.0, so a ' +
      'full-scale sine reads 0 dB and −40 dB means 1% of full scale. Logs are used because ' +
      'signals of wildly different sizes — a tone and its −80 dB distortion — fit on one axis.',
  },
  rms: {
    name: 'RMS (root mean square)',
    def:
      'The steady (DC) level that would deliver the same power as the wiggling signal: square ' +
      'every sample, average, square-root. A ±1 sine has RMS 0.707; a ±1 square, 1.0 — it ' +
      'spends all its time at full amplitude. Peak divided by RMS is the crest factor.',
  },
  nyquist: {
    name: 'Nyquist frequency',
    def:
      'Half the sample rate — the boundary of what a sampled system can represent. Everything ' +
      'STRICTLY below it survives sampling; exactly AT it a sine’s amplitude depends on where ' +
      'the samples land in its cycle (the "Exactly at Nyquist" experiment), and above it ' +
      'frequencies fold back as aliases. At 8 kHz sampling, Nyquist is 4 kHz, and it is the ' +
      'right-hand end of every spectrum here.',
  },
  sampled: {
    name: 'Sampled display (and sin(x)/x)',
    def:
      'Everything this lab shows is samples — values taken fₛ times a second — because that ' +
      'is all a computer can hold, and it is what a bench scope holds too: a modern digital ' +
      'storage oscilloscope (DSO) samples first and draws afterwards. Zoomed in far enough to ' +
      'see the dots, the curve through them is the ideal (sin x)/x reconstruction — the one ' +
      'bandlimited signal the samples describe, the same interpolation a real scope’s ' +
      'sin(x)/x mode computes. Below Nyquist that reconstruction IS the continuous original; ' +
      'above it, it is the alias.',
  },
  aliasing: {
    name: 'Aliasing',
    def:
      'What happens to a frequency above Nyquist: its samples are indistinguishable from those ' +
      'of a lower frequency, so it appears AS that lower frequency — folded back into range. ' +
      'The original is not attenuated; it is misread, and nothing downstream can tell.',
  },
  bin: {
    name: 'FFT bin',
    def:
      'One slot of the spectrum. An N-point FFT at sample rate fₛ splits 0…Nyquist into slots ' +
      'fₛ/N apart — 2048 points at 8 kHz gives 3.9 Hz per bin. Two tones closer than a couple ' +
      'of bins read as one peak, which is why frequency resolution is really frame LENGTH.',
  },
  harmonic: {
    name: 'Harmonic',
    def:
      'A component at a whole-number multiple of a fundamental frequency: for 250 Hz that is ' +
      '250 itself (harmonic 1, as the panels count), 500, 750, 1000… Periodic shapes are built ' +
      'entirely from their harmonics, and WHICH ones a shape needs (odd only? falling as 1/k ' +
      'or 1/k²?) is a fingerprint of the shape.',
  },
  window: {
    name: 'Window (analysis window)',
    def:
      'A taper multiplied onto the frame before the FFT so its edges meet zero. Without one, a ' +
      'tone that does not complete whole cycles in the frame has a jump at the seam, and that ' +
      'jump smears energy everywhere (leakage). Hann is the default trade: wider peak, far ' +
      'quieter skirts.',
  },
  leakage: {
    name: 'Spectral leakage',
    def:
      'Energy from a single tone spread across many bins because the frame cut the tone ' +
      'mid-cycle. It is an artifact of analysis, not of the signal — the tone is still pure — ' +
      'and a window is the standard remedy.',
  },
  q: {
    name: 'Q (quality factor)',
    def:
      'How resonant a 2nd-order filter is. For a low-pass it is literally the height of the ' +
      'peak at the cutoff (Q = 10 → peak 10× = +20 dB); for a band-pass it sets the width ' +
      'instead (bandwidth = f₀/Q). High Q also means long ringing in time — the same fact in ' +
      'the other domain.',
  },
  phase: {
    name: 'Phase',
    def:
      'Where in its cycle a component is, in degrees or radians. The FFT magnitude plot throws ' +
      'it away, which is why two signals can share a spectrum yet look different on the scope. ' +
      'Filters shift phase as well as scale amplitude, and the shift depends on frequency.',
  },
  groupdelay: {
    name: 'Group delay',
    def:
      'How long each frequency is held up by the chain, in samples: the slope of phase versus ' +
      'frequency. Flat group delay means every component arrives together — the shape survives, ' +
      'merely late. A peak in it means components near that frequency lag the rest, and the ' +
      'shape smears.',
  },
  kernel: {
    name: 'Impulse response / kernel',
    def:
      'Two names for one sequence. "Impulse response" is how it is measured: feed a single 1, ' +
      'record what comes out. "Kernel" is what it is for: the weights the convolution sum ' +
      'applies to the recent past. That they coincide is a theorem, and LTI is its hypothesis.',
  },
  convolution: {
    name: 'Convolution',
    def:
      'The sum y[n] = Σ h[k]·x[n−k]: each output sample is the kernel times the recent past. ' +
      'It is the only description of filtering that covers FIR and IIR at once, and it is what ' +
      'every LTI system does to its input — nothing more.',
  },
  lti: {
    name: 'LTI (linear, time-invariant)',
    def:
      'The two assumptions under this whole tool. Linear means superposition (responses to ' +
      'added signals add) plus scaling (double the input, double the output). Time-invariant: ' +
      'shift the input, the output shifts identically. Together they force a system to treat ' +
      'each frequency separately — a sine in gives a sine of the SAME frequency out, only ' +
      'scaled and shifted — which is why response curves, spectra and convolution describe ' +
      'filters completely. Clip or quantize and linearity is gone: new frequencies appear, and ' +
      'none of those descriptions hold.',
  },
  superposition: {
    name: 'Superposition',
    def:
      'Half of what "linear" means (the other half is scaling): the response to a sum is the ' +
      'sum of the responses. It is why sources here simply add, why each spectral line can be ' +
      'read independently, and what nonlinear blocks visibly break.',
  },
  zplane: {
    name: 'z-plane',
    def:
      'The complex plane where a digital filter’s poles (×) and zeros (○) live. The unit ' +
      'circle IS the frequency axis — DC at z = 1, Nyquist at z = −1 — and the response at a ' +
      'frequency is proportional to the product of distances to zeros over distances to poles ' +
      'from that point on the circle (an overall gain scales it). Stable means all poles inside.',
  },
  order: {
    name: 'Filter order',
    def:
      'The highest power of delay in the difference equation — the filter’s memory depth. For ' +
      'the IIR blocks here that is the number of poles, and it sets the ultimate slope: ' +
      '6 dB/octave (20 dB/decade) per order. (A 61-tap FIR is order 60 with no poles at all — ' +
      'order counts delays, not poles as such.) One pole cannot resonate; two can; four rolled ' +
      'off as a Butterworth need particular Qs per section.',
  },
}

/** The definitions a preset asked for, in the order it asked. */
export function termsFor(ids = []) {
  return ids.map((id) => ({ id, ...TERMS[id] })).filter((t) => t.name)
}
