// The knob shapes every group builds from. One place, so a radius is entered
// the same way in group B as in group I and a lesson can name it once.
//
// Each knob is `{ key, label, unit, min, max, scale, default, hint }`, which is
// what `NumField` in @ee-labs/ui takes. A toggle carries `kind: 'toggle'` with
// the text of its two positions, and a choice carries `kind: 'choice'` with its
// options.

/** A length in metres, entered on a logarithmic slider. */
export const Len = (key, label, def, hint) => ({ key, label, unit: 'm', min: 1e-6, max: 1, scale: 'log', default: def, hint })

/**
 * A position on an axis, signed, on a linear scale. A length is a size and
 * cannot be zero or negative; a probe's height above a loop is a coordinate and
 * is usually zero, so the two are different knobs.
 */
export const Pos = (key, label, def, hint, min = -1, max = 1) => ({ key, label, unit: 'm', min, max, scale: 'linear', default: def, hint })

/** A larger length, for a line or a link. */
export const Dist = (key, label, def, hint) => ({ key, label, unit: 'm', min: 1e-3, max: 1e5, scale: 'log', default: def, hint })

/**
 * A gap, which is a length that may be closed. Zero is a real setting here and
 * not a degenerate one: an ungapped core is the case E5 measures the gapped one
 * against, so the knob's range starts at it.
 */
export const Gap = (key, label, def, hint, max = 0.02) => ({ key, label, unit: 'm', min: 0, max, scale: 'linear', default: def, hint })

/** An area in square metres. */
export const Area = (key, label, def, hint) => ({ key, label, unit: 'm²', min: 1e-9, max: 1, scale: 'log', default: def, hint })

/** A relative permittivity. Air is 1 and nothing useful is below it. */
export const Eps = (key, label, def, hint) => ({ key, label, unit: '', min: 1, max: 100, scale: 'log', default: def, hint })

/** A relative permeability. */
export const Mu = (key, label, def, hint) => ({ key, label, unit: '', min: 1, max: 1e5, scale: 'log', default: def, hint })

/** A conductivity in siemens per metre, which spans twenty decades in this lab. */
export const Sigma = (key, label, def, hint) => ({ key, label, unit: 'S/m', min: 1e-16, max: 1e8, scale: 'log', default: def, hint })

/** A resistivity in ohm metres. */
export const Rho = (key, label, def, hint) => ({ key, label, unit: 'Ω·m', min: 1e-9, max: 1e6, scale: 'log', default: def, hint })

/** A voltage. */
export const Volt = (key, label, def, hint) => ({ key, label, unit: 'V', min: -1000, max: 1000, scale: 'linear', default: def, hint })

/** A current. */
export const Amp = (key, label, def, hint) => ({ key, label, unit: 'A', min: -100, max: 100, scale: 'linear', default: def, hint })

/** A charge, in coulombs, which a lesson always reads in nano or pico. */
export const Charge = (key, label, def, hint) => ({ key, label, unit: 'C', min: -1e-6, max: 1e-6, scale: 'linear', default: def, hint })

/** A frequency. */
export const Freq = (key, label, def, hint, min = 1, max = 1e12) => ({ key, label, unit: 'Hz', min, max, scale: 'log', default: def, hint })

/** A whole number of turns. */
export const Turns = (key, label, def, hint) => ({ key, label, unit: '', min: 1, max: 5000, scale: 'log', default: def, hint, integer: true })

/** A resistance. */
export const Ohms = (key, label, def, hint) => ({ key, label, unit: 'Ω', min: 0, max: 1e5, scale: 'linear', default: def, hint })

/** A flux density in tesla. */
export const Tesla = (key, label, def, hint) => ({ key, label, unit: 'T', min: 0, max: 3, scale: 'linear', default: def, hint })

/** A speed in metres a second. */
export const Speed = (key, label, def, hint) => ({ key, label, unit: 'm/s', min: -100, max: 100, scale: 'linear', default: def, hint })

/** An angle in degrees. Engineering notation makes nonsense of a small angle, so it is off. */
export const Deg = (key, label, def, hint, min = 0, max = 180) => ({ key, label, unit: '°', min, max, scale: 'linear', default: def, hint, eng: false })

/** A plain ratio or count with no unit. */
export const Ratio = (key, label, def, hint, min = 0, max = 100) => ({ key, label, unit: '', min, max, scale: 'linear', default: def, hint })

/** A count of grid cells across the domain. */
export const Cells = (key, label, def, hint) => ({ key, label, unit: '', min: 8, max: 120, scale: 'linear', default: def, hint, integer: true })

/** A two-position toggle. */
export const Toggle = (key, label, def, on, off, hint) => ({ key, label, kind: 'toggle', default: def, on, off, hint })

/** A choice among named positions. */
export const Choice = (key, label, def, options, hint) => ({ key, label, kind: 'choice', default: def, options, hint })
