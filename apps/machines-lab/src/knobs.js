// Knob descriptions, one constructor per kind of quantity.
//
// Every knob names its unit, so the field can show engineering notation and a
// note can quote the value with the unit it was set in. `presets` are the chips
// a lesson step tells the reader to press.

const knob = (key, label, unit, def, min, max, scale = 'log', extra = {}) => ({
  key,
  label,
  unit,
  min,
  max,
  scale,
  default: def,
  ...extra,
})

export const Ohm = (key, label, def, min = 0.05, max = 1e5) => knob(key, label, 'Ω', def, min, max)
export const Volt = (key, label, def, min = 1, max = 1000) => knob(key, label, 'V', def, min, max, 'linear')
export const Henry = (key, label, def, min = 1e-5, max = 10) => knob(key, label, 'H', def, min, max)
export const Inertia = (key, label, def, min = 1e-5, max = 10) => knob(key, label, 'kg·m²', def, min, max)
export const Torque = (key, label, def, min = 0, max = 200) => knob(key, label, 'N·m', def, min, max, 'linear')
export const Friction = (key, label, def, min = 0, max = 0.1) => knob(key, label, 'N·m·s/rad', def, min, max, 'linear')
export const Constant = (key, label, def, min = 0.005, max = 5) => knob(key, label, 'V·s/rad', def, min, max)
export const Freq = (key, label, def, min = 1, max = 400) => knob(key, label, 'Hz', def, min, max)
export const Ratio = (key, label, def, min = 0.1, max = 20) => knob(key, label, '', def, min, max)
export const Fraction = (key, label, def, min = 0.01, max = 1.5) => knob(key, label, '', def, min, max, 'linear')
export const Amp = (key, label, def, min = 0, max = 100) => knob(key, label, 'A', def, min, max, 'linear')
export const Watt = (key, label, def, min = 0, max = 1e5) => knob(key, label, 'W', def, min, max)
export const Wb = (key, label, def, min = 0.01, max = 10) => knob(key, label, 'Wb', def, min, max)
export const Kelvin = (key, label, def, min = 0, max = 250) => knob(key, label, '°C', def, min, max, 'linear')
export const Seconds = (key, label, def, min = 1, max = 1e5) => knob(key, label, 's', def, min, max)
/** Degrees, not engineering notation. "500 m°" is nobody's angle. */
export const Deg = (key, label, def, min = 0, max = 180) => knob(key, label, '°', def, min, max, 'linear', { eng: false })
/** A fraction of a window or a sweep, shown as a plain number. */
export const Plain = (key, label, def, min, max) => knob(key, label, '', def, min, max, 'linear', { eng: false })

/** A two-position knob. */
export const Toggle = (key, label, def, on, off, hint) => ({ key, label, kind: 'toggle', default: def, on, off, hint })
/** More than two positions of the same control. */
export const Choice = (key, label, def, options, hint) => ({ key, label, kind: 'choice', default: def, options, hint })

/** Preset chips under a knob, each carrying its own value. */
export const chips = (k, values) => ({ ...k, presets: values.map((v) => ({ value: v })) })
