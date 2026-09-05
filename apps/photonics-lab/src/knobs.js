// The knob shapes every group builds from. One place, so a wavelength is
// entered the same way in group A as in group F and a lesson can name it once.
//
// Each knob is `{ key, label, unit, min, max, scale, default, hint }`, which is
// what `NumField` in @ee-labs/ui takes.
//
// Every length here is in metres, including the fibre's. The engine takes fibre
// lengths in kilometres, because that is how a fibre is specified, and
// `math.js` divides by a thousand at the one place it calls in. So a knob a
// lesson quotes and a value the reader types are the same number in the same
// unit everywhere on screen.

/** A wavelength, entered in nanometres by the field's own prefix. */
export const Wave = (key, label, def, hint) => ({ key, label, unit: 'm', min: 400e-9, max: 2000e-9, scale: 'log', default: def, hint })

/** An optical power in watts, which spans nine decades between a source and a receiver. */
export const Power = (key, label, def, hint) => ({ key, label, unit: 'W', min: 1e-12, max: 1, scale: 'log', default: def, hint })

/** A power in dBm, which is how a transmitter and a sensitivity are both quoted. */
export const Dbm = (key, label, def, hint) => ({ key, label, unit: 'dBm', min: -60, max: 20, scale: 'linear', default: def, hint })

/** A loss in decibels. */
export const Db = (key, label, def, hint, max = 60) => ({ key, label, unit: 'dB', min: 0, max, scale: 'linear', default: def, hint })

/** A fibre attenuation in dB/km. */
export const Alpha = (key, label, def, hint) => ({ key, label, unit: 'dB/km', min: 0.15, max: 5, scale: 'log', default: def, hint })

/** A fibre length in metres, from a patch cord to a submarine span. */
export const Span = (key, label, def, hint) => ({ key, label, unit: 'm', min: 1, max: 5e5, scale: 'log', default: def, hint })

/** A dispersion parameter. Written without brackets so a lesson can quote its unit. */
export const Disp = (key, label, def, hint) => ({ key, label, unit: 'ps/nm/km', min: -30, max: 30, scale: 'linear', default: def, hint, eng: false })

/** A refractive index. Nothing guiding light is below one. */
export const Index = (key, label, def, hint, max = 4) => ({ key, label, unit: '', min: 1, max, scale: 'linear', default: def, hint, eng: false })

/** A small length: a core radius, a cavity. */
export const Small = (key, label, def, hint) => ({ key, label, unit: 'm', min: 1e-7, max: 1e-3, scale: 'log', default: def, hint })

/** A current, in amps, which a detector lesson reads in nano and micro. */
export const Amp = (key, label, def, hint) => ({ key, label, unit: 'A', min: 0, max: 1e-3, scale: 'log', default: def, hint })

/** A voltage. */
export const Volt = (key, label, def, hint, max = 30) => ({ key, label, unit: 'V', min: 0, max, scale: 'linear', default: def, hint })

/** A resistance. */
export const Ohms = (key, label, def, hint) => ({ key, label, unit: 'Ω', min: 10, max: 1e6, scale: 'log', default: def, hint })

/** An area in square metres. */
export const Area = (key, label, def, hint) => ({ key, label, unit: 'm²', min: 1e-10, max: 1e-4, scale: 'log', default: def, hint })

/** A capacitance per unit area, farads per square metre. */
export const CapDensity = (key, label, def, hint) => ({ key, label, unit: 'F/m²', min: 1e-5, max: 1e-2, scale: 'log', default: def, hint })

/** An irradiance, watts per square metre. */
export const Irradiance = (key, label, def, hint) => ({ key, label, unit: 'W/m²', min: 1e-3, max: 1e3, scale: 'log', default: def, hint })

/** A frequency, for a channel grid or a bit rate. */
export const Freq = (key, label, def, hint, min = 1e6, max = 1e13) => ({ key, label, unit: 'Hz', min, max, scale: 'log', default: def, hint })

/** A bit rate. */
export const Rate = (key, label, def, hint) => ({ key, label, unit: 'bit/s', min: 1e6, max: 1e12, scale: 'log', default: def, hint })

/** An energy in electronvolts, for a bandgap. */
export const Bandgap = (key, label, def, hint) => ({ key, label, unit: 'eV', min: 0.2, max: 3.5, scale: 'linear', default: def, hint, eng: false })

/** A plain fraction from zero to one: a quantum efficiency, a reflectance. */
export const Fraction = (key, label, def, hint, max = 1) => ({ key, label, unit: '', min: 0, max, scale: 'linear', default: def, hint, eng: false })

/** A plain ratio or criterion with no unit and no prefix. */
export const Ratio = (key, label, def, hint, min = 0, max = 10) => ({ key, label, unit: '', min, max, scale: 'linear', default: def, hint, eng: false })

/** A loss per metre inside a cavity, which is zero for a clean one. */
export const Loss = (key, label, def, hint) => ({ key, label, unit: '1/m', min: 0, max: 5000, scale: 'linear', default: def, hint })

/** A two-position toggle. */
export const Toggle = (key, label, def, on, off, hint) => ({ key, label, kind: 'toggle', default: def, on, off, hint })
