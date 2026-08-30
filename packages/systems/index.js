// Transfer functions: the currency the whole suite trades in.
//
// A circuit produces one, a control loop produces one, and a digital filter is
// one after a change of variable. Frequency response, poles, step response and
// stability are written once here so each tool can describe its own subject and
// hand the analysis over.
//
// ── ADMISSION TEST (Rule 1 of /CORE_SCOPE.md — read it before extending) ──
//
// An object goes into this package only if it is expressible EXACTLY as a
// rational function of s or z: finite poles and zeros, real coefficients.
// No adapter that "mostly" converts an inadmissible object. Padé, averaging
// and linearization do not make an object admissible — they create a NEW,
// labeled approximation governed by Rule 3, never silently substituted for
// the thing it approximates. Unsure whether something is admissible? Then it
// is not, until shown otherwise with a test. Transcendentals (a transmission
// line's e^{−jβl}) and piecewise systems (a switched converter) are refused
// at this boundary by design: the boundary is content, not a limitation.

export {
  evalAt,
  evalAtFreq,
  magnitudeAt,
  phaseAt,
  dcGain,
  bode,
  roots,
  polesZeros,
  isStable,
  toStateSpace,
  simulate,
  stepResponse,
  secondOrderMetrics,
  bilinear,
  polyMul,
  polyAdd,
  series,
  closeLoop,
  errorLoop,
  margins,
  rootLocus,
} from './src/tf.js'
