// The knob shapes every group builds from. One place, so a wavelength is
// entered the same way in Group A as in Group F and a lesson can name it once.
//
// Each knob is `{ key, label, unit, min, max, scale, default, hint }`, which is
// what `NumField` in @ee-labs/ui takes. A toggle carries `kind: 'toggle'` with
// the text of its two positions.
//
// Every knob here is in base SI units, because the engine is. A wavelength is
// metres and a length of fibre is metres, and `NumField` writes them back as
// nanometres and kilometres because engineering notation does that for free.
// Two quantities keep the unit a datasheet quotes them in, and both say so:
// attenuation is decibels a kilometre and dispersion is picoseconds per
// nanometre per kilometre, because nobody has ever written either any other way.

/** A wavelength in metres. The three windows are 850, 1310 and 1550 nm. */
export const Lambda = (key, label, def, hint) => ({ key, label, unit: 'm', min: 400e-9, max: 2000e-9, scale: 'log', default: def, hint })

/** An optical power in watts, which a lesson reads in microwatts and milliwatts. */
export const OptPower = (key, label, def, hint) => ({ key, label, unit: 'W', min: 1e-12, max: 1e-1, scale: 'log', default: def, hint })

/** A current in amps. */
export const Amp = (key, label, def, hint) => ({ key, label, unit: 'A', min: 1e-15, max: 1e-3, scale: 'log', default: def, hint })

/** A voltage. */
export const Volt = (key, label, def, hint, min = 0, max = 30) => ({ key, label, unit: 'V', min, max, scale: 'linear', default: def, hint })

/** A resistance. */
export const Ohms = (key, label, def, hint) => ({ key, label, unit: 'Ω', min: 10, max: 1e6, scale: 'log', default: def, hint })

/** A quantum efficiency, or any other fraction of one. */
export const Fraction = (key, label, def, hint) => ({ key, label, unit: '', min: 0, max: 1, scale: 'linear', default: def, hint, eng: false })

/** A bandgap in electronvolts. */
export const Bandgap = (key, label, def, hint) => ({ key, label, unit: 'eV', min: 0.3, max: 3.5, scale: 'linear', default: def, hint, eng: false })

/** A detector diameter in metres, read in micrometres. */
export const Diameter = (key, label, def, hint) => ({ key, label, unit: 'm', min: 5e-6, max: 1e-3, scale: 'log', default: def, hint })

/** An irradiance in watts a square metre. */
export const Irradiance = (key, label, def, hint) => ({ key, label, unit: 'W/m²', min: 1e-3, max: 1e4, scale: 'log', default: def, hint })

/** A length of fibre in metres, read in kilometres. */
export const Span = (key, label, def, hint) => ({ key, label, unit: 'm', min: 0, max: 500e3, scale: 'linear', default: def, hint })

/** Attenuation in decibels a kilometre, the unit a fibre is sold in. */
export const Alpha = (key, label, def, hint) => ({ key, label, unit: 'dB/km', min: 0, max: 10, scale: 'linear', default: def, hint, eng: false })

/**
 * A dispersion parameter in picoseconds per nanometre per kilometre, the unit a
 * fibre is sold in. The engine takes seconds per square metre, and `math.js`
 * multiplies by 1e-6 in one place.
 */
export const Dispersion = (key, label, def, hint) => ({ key, label, unit: 'ps/(nm·km)', min: -30, max: 30, scale: 'linear', default: def, hint, eng: false })

/** A spectral width in metres, read in nanometres. */
export const Width = (key, label, def, hint) => ({ key, label, unit: 'm', min: 1e-13, max: 1e-7, scale: 'log', default: def, hint })

/** A bit rate. */
export const Rate = (key, label, def, hint) => ({ key, label, unit: 'bit/s', min: 1e6, max: 1e12, scale: 'log', default: def, hint })

/** A refractive index. */
export const Index = (key, label, def, hint, min = 1, max = 4) => ({ key, label, unit: '', min, max, scale: 'linear', default: def, hint, eng: false })

/** A core radius in metres, read in micrometres. */
export const Radius = (key, label, def, hint) => ({ key, label, unit: 'm', min: 1e-6, max: 1e-4, scale: 'log', default: def, hint })

/** A power reflectance, which is a fraction that may not quite reach one. */
export const Reflectance = (key, label, def, hint) => ({ key, label, unit: '', min: 0.01, max: 0.999, scale: 'linear', default: def, hint, eng: false })

/** A cavity length in metres, read in micrometres or millimetres. */
export const CavityLength = (key, label, def, hint) => ({ key, label, unit: 'm', min: 10e-6, max: 0.1, scale: 'log', default: def, hint })

/** A frequency. */
export const Freq = (key, label, def, hint, min = 1e9, max = 1e13) => ({ key, label, unit: 'Hz', min, max, scale: 'log', default: def, hint })

/** A power level in dBm, which is how every level in a link budget is quoted. */
export const Dbm = (key, label, def, hint) => ({ key, label, unit: 'dBm', min: -60, max: 20, scale: 'linear', default: def, hint, eng: false })

/** A loss in decibels, for one line of a budget. */
export const Loss = (key, label, def, hint, max = 20) => ({ key, label, unit: 'dB', min: 0, max, scale: 'linear', default: def, hint, eng: false })

/** A plain count with no unit. */
export const Count = (key, label, def, hint, min = 0, max = 100) => ({ key, label, unit: '', min, max, scale: 'linear', default: def, hint, integer: true, eng: false })

/** A two-position toggle. */
export const Toggle = (key, label, def, on, off, hint) => ({ key, label, kind: 'toggle', default: def, on, off, hint })
