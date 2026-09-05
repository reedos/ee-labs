// The knobs, and the names every group shares.
//
// A knob is a handle on one number in the netlist. Every delay is a whole
// number of picoseconds (the plan's Decision 2), so a delay knob steps by one
// picosecond and never offers a fraction.

export const GROUPS = [
  'A · Gates and truth tables',
  'B · Boolean algebra and the map',
  'C · The blocks a datapath is made of',
  'D · Delay, glitches and hazards',
]

/** A one-bit knob, drawn as a two-position switch. */
export const Bit = (key, label, def, hint) => ({ key, label, kind: 'bit', default: def, hint, on: '1', off: '0' })

/** A delay in picoseconds. Whole numbers only. */
export const Delay = (key, label, def, min = 1, max = 400, hint) => ({ key, label, unit: 'ps', min, max, step: 1, scale: 'linear', decimals: 0, default: def, hint })

/** A count of bits or of stages. */
export const Count = (key, label, def, min = 1, max = 8, hint) => ({ key, label, unit: '', min, max, step: 1, scale: 'linear', decimals: 0, default: def, hint })

/** More than two positions of the same control. */
export const Choice = (key, label, def, options, hint) => ({ key, label, kind: 'choice', default: def, options, hint })

/** A whole word, as the number its bits stand for. */
export const Word = (key, label, def, bits = 4, hint) => ({ key, label, unit: '', min: 0, max: 2 ** bits - 1, step: 1, scale: 'linear', decimals: 0, default: def, hint })

/** The same netlist with one input turned into a step at `at`. */
export function stepped(net, id, { at = 200, from, to }) {
  return {
    ...net,
    sources: net.sources.map((s) => (s.id === id ? { id, kind: 'step', at, from: from ?? s.value, to: to ?? (s.value ^ 1) } : s)),
  }
}

/** The delay model as a knob, in the two words the engine uses. */
export const MODE = (def = 'transport') =>
  Choice('mode', 'Delay model', def, [
    { value: 'transport', label: 'transport' },
    { value: 'inertial', label: 'inertial' },
  ])
