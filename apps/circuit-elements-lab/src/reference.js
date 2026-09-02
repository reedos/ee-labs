/**
 * The schematic answers back (student review, Phase 8): a node tapped becomes
 * the reference, a switch tapped is thrown.
 */

/**
 * The analysis with node `ref` as the zero of voltage. The solver measures
 * every node from ground; a meter's black lead can go anywhere, and moving it
 * shifts every node voltage by the same amount while every element's voltage,
 * current and power — differences, all of them — stay exactly where they were.
 * Ground itself then reads minus what the new reference used to. Returns `x`
 * untouched when there is no solution or no such node.
 */
export function rereference(x, ref) {
  if (!ref || !x.sol || !(ref in x.sol.v)) return x
  const shift = x.sol.v[ref]
  if (!Number.isFinite(shift) || shift === 0) return x
  const v = {}
  for (const [n, val] of Object.entries(x.sol.v)) v[n] = val - shift
  return { ...x, sol: { ...x.sol, v } }
}

/**
 * The toggle knob that throws switch `id`, found by asking the circuit: flip
 * each toggle and see whether the switch changes state. Null when no knob does
 * — the switch is a time switch, thrown at t = 0, and tapping it replays that.
 */
export function switchKnob(exp, params, id) {
  const state = (p) => {
    const e = exp.net(p).elements.find((el) => el.id === id)
    return e && e.type === 'SW' ? e.closed !== false : null
  }
  const now = state(params)
  if (now === null) return null
  for (const k of exp.params) {
    if (k.kind !== 'toggle') continue
    if (state({ ...params, [k.key]: !params[k.key] }) !== now) return k.key
  }
  return null
}
