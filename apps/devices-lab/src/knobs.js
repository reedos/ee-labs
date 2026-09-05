// The knobs, shared by every group file.
//
// They live apart from experiments.js because the group files import them and
// experiments.js imports the group files. One direction of import, and no cycle
// to reason about.
//
// Every doping is in m⁻³, which is what the formulas take, so 10¹⁷ cm⁻³ is
// 10²³ here. A doping knob spans six decades, so it is on a log scale and its
// chips carry the values the notes talk about.

import { fmt } from '@ee-labs/ui'

/** A doping, m⁻³. The range runs from below n_i to 10²⁰ cm⁻³, which is every process. */
export const Dope = (key, label, def, hint) => ({ key, label, unit: 'm⁻³', min: 1e16, max: 1e26, scale: 'log', default: def, hint })
/** A thickness, metres: an oxide, a base, an emitter, a junction depth. */
export const Len = (key, label, def, hint) => ({ key, label, unit: 'm', min: 1e-9, max: 1e-4, scale: 'log', default: def, hint })
/** A thin layer, metres: the gate oxide alone, which never reaches a micron. */
export const Thin = (key, label, def, hint) => ({ key, label, unit: 'm', min: 2e-9, max: 200e-9, scale: 'log', default: def, hint })
/** An area, m². 10⁻⁴ cm² is 10⁻⁸ m², the plan's junction. */
export const Area = (key, label, def, hint) => ({ key, label, unit: 'm²', min: 1e-12, max: 1e-2, scale: 'log', default: def, hint })
/** A bias, volts, either way round. */
export const Bias = (key, label, def, hint) => ({ key, label, unit: 'V', min: -20, max: 20, scale: 'linear', default: def, hint })
/** A bias that only goes one way: a gate, a drain, a reverse collector. */
export const Volt = (key, label, def, hint) => ({ key, label, unit: 'V', min: 0, max: 20, scale: 'linear', default: def, hint })
/** A temperature, kelvin. */
export const Temp = (key, label, def, hint) => ({ key, label, unit: 'K', min: 200, max: 600, scale: 'linear', default: def, hint })
/** A current, amps: a photocurrent or a drain current. */
export const Amps = (key, label, def, hint) => ({ key, label, unit: 'A', min: 1e-9, max: 10, scale: 'log', default: def, hint })
/** A saturation current, amps: twelve decades below a bias current. */
export const SatI = (key, label, def, hint) => ({ key, label, unit: 'A', min: 1e-18, max: 1e-6, scale: 'log', default: def, hint })
/** A sheet density, m⁻²: an implant dose or a fixed oxide charge. */
export const Sheet = (key, label, def, hint) => ({ key, label, unit: 'm⁻²', min: 1e12, max: 1e19, scale: 'log', default: def, hint })
/** A field, V/m: the critical field breakdown is defined against. */
export const Field = (key, label, def, hint) => ({ key, label, unit: 'V/m', min: 1e6, max: 1e9, scale: 'log', default: def, hint })
/** A plain ratio with no unit: W/L, or a mobility in m²/V·s. */
export const Ratio = (key, label, def, hint) => ({ key, label, unit: '', min: 0.01, max: 1000, scale: 'log', default: def, hint })
/** A mobility, m²/V·s. 500 cm²/V·s is 0.05 here. */
export const Mob = (key, label, def, hint) => ({ key, label, unit: 'm²/V·s', min: 1e-3, max: 1, scale: 'log', default: def, hint })
/** A diffusion constant, m²/s, from Einstein's relation at the doping. */
export const Diff = (key, label, def, hint) => ({ key, label, unit: 'm²/s', min: 1e-5, max: 1e-1, scale: 'log', default: def, hint })
/** A lifetime, seconds. */
export const Life = (key, label, def, hint) => ({ key, label, unit: 's', min: 1e-9, max: 1e-3, scale: 'log', default: def, hint })
/** An irradiance, W/m². One sun is 1000. */
export const Sun = (key, label, def, hint) => ({ key, label, unit: 'W/m²', min: 10, max: 20000, scale: 'log', default: def, hint })
/** A resistance, ohms. */
export const Res = (key, label, def, hint) => ({ key, label, unit: 'Ω', min: 0, max: 100, scale: 'linear', default: def, hint })
/** An energy in electron volts: a band gap. */
export const Gap = (key, label, def, hint) => ({ key, label, unit: 'eV', min: 0.1, max: 6, scale: 'linear', default: def, hint })
/** A channel-length modulation coefficient, 1/V. */
export const Lam = (key, label, def, hint) => ({ key, label, unit: '1/V', min: 0, max: 0.5, scale: 'linear', default: def, hint })

/** A two-position knob: `on` and `off` are the texts of the two positions. */
export const Toggle = (key, label, def, on, off, hint) => ({ key, label, kind: 'toggle', default: def, on, off, hint })
/** More than two positions of the same control. */
export const Choice = (key, label, def, options, hint) => ({ key, label, kind: 'choice', default: def, options, hint })
/** Values the note talks about, offered as chips under the knob. */
export const chips = (knob, presets) => ({ ...knob, presets: presets.map((v) => ({ value: v, label: fmt(v, knob.unit, 3) })) })

/** The gate material, as a choice knob. Each is a stated work-function difference. */
export const GATE = (def = 'n+ poly', hint) =>
  Choice(
    'gate',
    'Gate material',
    def,
    [
      { value: 'n+ poly', label: 'n⁺ poly' },
      { value: 'p+ poly', label: 'p⁺ poly' },
      { value: 'aluminium', label: 'aluminium' },
    ],
    hint,
  )

/** Which of the two C–V curves the pane reads. */
export const FREQ = (def = 'high', hint) =>
  Choice(
    'freq',
    'Measurement frequency',
    def,
    [
      { value: 'high', label: 'high' },
      { value: 'low', label: 'low' },
    ],
    hint,
  )

/** The four LED materials, as band gaps taken from data. */
export const MATERIAL = (def = 'gallium nitride', hint) =>
  Choice(
    'material',
    'LED material',
    def,
    [
      { value: 'silicon', label: 'silicon' },
      { value: 'gallium arsenide', label: 'GaAs' },
      { value: 'gallium phosphide', label: 'GaP' },
      { value: 'gallium nitride', label: 'GaN' },
    ],
    hint,
  )
