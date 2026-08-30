// Transfer functions: the currency the whole suite trades in.
//
// A circuit produces one, a control loop produces one, and a digital filter is
// one after a change of variable. Frequency response, poles, step response and
// stability are written once here so each tool can describe its own subject and
// hand the analysis over.

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
} from './src/tf.js'
