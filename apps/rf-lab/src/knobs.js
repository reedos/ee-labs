// The knob shapes every group builds from. One place, so a load resistance is
// entered the same way in group A as in group C and a lesson can name it once.
//
// Each knob is `{ key, label, unit, min, max, scale, default, hint }`, which is
// what `NumField` in @ee-labs/ui takes. A toggle carries `kind: 'toggle'` with
// the text of its two positions, and a choice carries `kind: 'choice'` with its
// options.

/** A resistance in ohms. Zero is a short, which is a real setting here. */
export const Ohms = (key, label, def, hint, min = 0, max = 5000) => ({ key, label, unit: 'Ω', min, max, scale: 'linear', default: def, hint })

/** A reference impedance, which is never zero and is usually 50 ohms. */
export const Ref = (key, label, def, hint) => ({ key, label, unit: 'Ω', min: 5, max: 600, scale: 'linear', default: def, hint })

/** A reactance in ohms, signed, because a capacitor and an inductor differ by the sign. */
export const React_ = (key, label, def, hint, span = 500) => ({ key, label, unit: 'Ω', min: -span, max: span, scale: 'linear', default: def, hint })

/** A normalised resistance or reactance, which is what the chart is drawn in. */
export const Norm = (key, label, def, hint, min = -20, max = 20) => ({ key, label, unit: '', min, max, scale: 'linear', default: def, hint })

/** A positive normalised quantity, for a constant-resistance or constant-conductance circle. */
export const NormPos = (key, label, def, hint) => ({ key, label, unit: '', min: 0, max: 20, scale: 'linear', default: def, hint })

/** A frequency in hertz. This lab runs from 10 MHz to 20 GHz. */
export const Freq = (key, label, def, hint, min = 1e7, max = 2e10) => ({ key, label, unit: 'Hz', min, max, scale: 'log', default: def, hint })

/** A length of line in metres, entered on a logarithmic slider. */
export const Len = (key, label, def, hint) => ({ key, label, unit: 'm', min: 1e-4, max: 10, scale: 'log', default: def, hint })

/** A relative dielectric constant. Air is 1 and PTFE is 2.1. */
export const Eps = (key, label, def, hint) => ({ key, label, unit: '', min: 1, max: 12, scale: 'linear', default: def, hint })

/** An attenuation in nepers per metre. Zero is a lossless line, and it is the default. */
export const Alpha = (key, label, def, hint, max = 2) => ({ key, label, unit: 'Np/m', min: 0, max, scale: 'linear', default: def, hint })

/** A count of points in a sweep. */
export const Count = (key, label, def, hint, min = 21, max = 961) => ({ key, label, unit: '', min, max, scale: 'linear', default: def, hint, integer: true })

/** A plain ratio with no unit. */
export const Ratio = (key, label, def, hint, min = 0, max = 100) => ({ key, label, unit: '', min, max, scale: 'linear', default: def, hint })

/** A two-position toggle. */
export const Toggle = (key, label, def, on, off, hint) => ({ key, label, kind: 'toggle', default: def, on, off, hint })

/** A choice among named positions. */
export const Choice = (key, label, def, options, hint) => ({ key, label, kind: 'choice', default: def, options, hint })
