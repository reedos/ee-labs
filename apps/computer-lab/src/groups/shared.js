// The knobs, and the names every group shares.
//
// A knob is a handle on one number in the machine. Every time in this lab is a
// whole number of the model card's 10 fs grid, so no knob offers a fraction of
// one, and a width or a way count is a whole number by the same rule.

export const GROUPS = [
  'A · Arithmetic, where the delay is',
  'B · The register file and the memory',
  'C · One instruction, one clock',
  'D · Control',
  'E · Pipelining',
  'F · The memory hierarchy',
  'G · The machine and the world',
]

/** A count of bits, ways, cycles or gates. */
export const Count = (key, label, def, min = 1, max = 32, hint) => ({ key, label, unit: '', min, max, step: 1, scale: 'linear', decimals: 0, default: def, hint })

/** More than two positions of the same control. */
export const Choice = (key, label, def, options, hint) => ({ key, label, kind: 'choice', default: def, options, hint })

/** A two-position switch, on or off. */
export const Switch = (key, label, def, on = 'on', off = 'off', hint) => ({ key, label, kind: 'bit', default: def, on, off, hint })

/** A size in bytes, on a power-of-two field. */
export const Bytes = (key, label, def, min, max, hint) => ({ key, label, unit: 'B', min, max, step: 1, scale: 'log', decimals: 0, default: def, hint })

/** A plain number a reader turns, such as a miss penalty in cycles. */
export const Number_ = (key, label, def, min, max, step = 1, hint) => ({ key, label, unit: '', min, max, step, scale: 'linear', decimals: step < 1 ? 2 : 0, default: def, hint })

/** The forwarding switch, in the one wording every group uses. */
export const FORWARDING = (def = 1) => Switch('forwarding', 'Forwarding', def, 'on', 'off')

/** Where a branch is decided, which is E5's knob. */
export const RESOLVE = (def = 'execute') =>
  Choice('resolve', 'Branch decided in', def, [
    { value: 'execute', label: 'execute' },
    { value: 'decode', label: 'decode' },
  ])

/** The two operand patterns Group A's adders are measured on. */
export const OPERANDS = (def = 'propagate') =>
  Choice('operands', 'Operands', def, [
    { value: 'propagate', label: 'all propagate' },
    { value: 'generate', label: 'all generate' },
    { value: 'small', label: 'small numbers' },
  ])

/** The operand pair one of those settings stands for. */
export const operandsOf = (which) => (which === 'generate' ? { a: -1, b: -1 } : which === 'small' ? { a: 5, b: 9 } : { a: -1, b: 0 })

/**
 * A quantity entry, so a group file reads as a list of readings.
 *
 * `scale` is for the reading whose kind does not say how it moves when the
 * model card moves. A share of the machine's time is a share, and it doubles
 * with the clock period, so it says `time` and the card test expects that.
 */
export const q = (label, value, scale) => ({ label, value, ...(scale ? { scale } : {}) })
