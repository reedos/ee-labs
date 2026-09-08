// The knob shapes every group builds from. One place, so a gain is entered the
// same way in group A as in group F and a lesson can name it once.
//
// Each knob is `{ key, label, unit, min, max, scale, default, hint }`, which is
// what `NumField` in @ee-labs/ui takes. A choice carries `kind: 'choice'` with
// its options.

/** A gain in decibels, signed, because a filter's gain is negative. */
export const Gain = (key, label, def, hint, min = -40, max = 40) => ({ key, label, unit: 'dB', min, max, scale: 'linear', default: def, hint, eng: false })

/** A loss in decibels, quoted positive, which is how a filter's insertion loss is written. */
export const Loss = (key, label, def, hint, min = 0, max = 30) => ({ key, label, unit: 'dB', min, max, scale: 'linear', default: def, hint, eng: false })

/** A noise figure in decibels. Zero is the ideal block, and no block is below it. */
export const NoiseFigure = (key, label, def, hint, max = 25) => ({ key, label, unit: 'dB', min: 0, max, scale: 'linear', default: def, hint, eng: false })

/** A power level in dBm, which is what every level in this lab is quoted in. */
export const Dbm = (key, label, def, hint, min = -140, max = 50) => ({ key, label, unit: 'dBm', min, max, scale: 'linear', default: def, hint, eng: false })

/** A DC power in milliwatts. */
export const Milliwatt = (key, label, def, hint, max = 2000) => ({ key, label, unit: 'mW', min: 0, max, scale: 'linear', default: def, hint })

/** A bandwidth in hertz, on a logarithmic slider, because a channel and a band differ by a hundred. */
export const Bandwidth = (key, label, def, hint, min = 1e3, max = 1e9) => ({ key, label, unit: 'Hz', min, max, scale: 'log', default: def, hint })

/** A physical temperature in kelvin. Liquid helium is 4 K and a warm rack is 320 K. */
export const Kelvin = (key, label, def, hint, min = 4, max = 400) => ({ key, label, unit: 'K', min, max, scale: 'linear', default: def, hint, eng: false })

/** A choice among named positions, such as which block to bypass. */
export const Choice = (key, label, def, options, hint) => ({ key, label, kind: 'choice', default: def, options, hint })
