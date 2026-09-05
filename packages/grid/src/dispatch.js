// Economic dispatch: equal incremental cost, with limits.
//
// Each unit's cost is a quadratic in its output, C_i = a_i + b_i P + c_i P²,
// so its incremental cost dC/dP = b_i + 2 c_i P is a straight line. Minimising
// the total cost subject to the outputs summing to the demand puts every free
// unit at the same incremental cost λ. That is the Lagrangian's first-order
// condition, and it is exact.
//
//     P_i = (λ − b_i) / (2 c_i),      Σ P_i = D
//
// A limit clamps a unit and takes it out of the balance, and λ then follows
// the units that are still free. A bisection on λ closes the balance in every
// case, including the one where every unit is at a limit and the demand cannot
// be met, which is reported rather than approximated.
//
// The marginal cost of the next megawatt is the exact cost difference
// C(D + 1) − C(D), and λ is its prediction. J2 puts the two side by side.

/** One unit's output at an incremental cost, clamped to its limits. */
export const outputAt = (u, lambda) => Math.min(u.max, Math.max(u.min, (lambda - u.b) / (2 * u.c)))

/** One unit's cost at an output. */
export const costOf = (u, P) => u.a + u.b * P + u.c * P * P

/** One unit's incremental cost at an output. */
export const incrementalOf = (u, P) => u.b + 2 * u.c * P

/**
 * The cheapest split of `demand` between the units, by bisection on λ.
 * Returns each unit's output, whether it is at a limit, the total cost, and
 * the equal-shares cost the saving is measured against.
 */
export function dispatch(units, demand, { tol = 1e-12 } = {}) {
  if (!units.length) throw new Error('dispatch needs at least one unit')
  for (const u of units) {
    if (!(u.c > 0)) throw new Error(`${u.id}: a quadratic cost needs a positive second coefficient`)
    if (!(u.max > u.min)) throw new Error(`${u.id}: the maximum output must exceed the minimum`)
  }
  const capacity = units.reduce((s, u) => s + u.max, 0)
  const floor = units.reduce((s, u) => s + u.min, 0)
  if (demand > capacity + tol)
    throw new Error(`These units total ${capacity} MW and the demand is ${demand} MW, so there is no split that meets it.`)
  if (demand < floor - tol)
    throw new Error(`These units cannot run below ${floor} MW together, and the demand is ${demand} MW.`)
  const total = (lambda) => units.reduce((s, u) => s + outputAt(u, lambda), 0)
  let lo = Math.min(...units.map((u) => u.b))
  let hi = Math.max(...units.map((u) => u.b + 2 * u.c * u.max)) + 1
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2
    if (total(mid) < demand) lo = mid
    else hi = mid
  }
  const lambda = (lo + hi) / 2
  const out = units.map((u) => {
    const P = outputAt(u, lambda)
    const atMax = P >= u.max - 1e-9
    const atMin = P <= u.min + 1e-9
    return {
      ...u,
      P,
      cost: costOf(u, P),
      incremental: incrementalOf(u, P),
      limited: atMax || atMin,
      at: atMax ? 'max' : atMin ? 'min' : null,
    }
  })
  const cost = out.reduce((s, u) => s + u.cost, 0)
  const share = demand / units.length
  const equalCost = units.reduce((s, u) => s + costOf(u, share), 0)
  return {
    demand,
    lambda,
    units: out,
    cost,
    equalShare: share,
    equalCost,
    saving: equalCost - cost,
    served: out.reduce((s, u) => s + u.P, 0),
    free: out.filter((u) => !u.limited).map((u) => u.id),
  }
}

/**
 * What the next megawatt costs, exactly: the difference between two dispatches
 * one megawatt apart. λ predicts it, and the two agree to a fraction of a cent
 * because the cost is quadratic and λ is its slope at one end of the step.
 */
export function marginalCost(units, demand, step = 1) {
  const a = dispatch(units, demand)
  const b = dispatch(units, demand + step)
  return (b.cost - a.cost) / step
}

/** The incremental-cost curves, for the plot. */
export function costCurves(units, { points = 60 } = {}) {
  return units.map((u) => {
    const P = []
    const inc = []
    const cost = []
    for (let k = 0; k < points; k++) {
      const x = u.min + ((u.max - u.min) * k) / (points - 1)
      P.push(x)
      inc.push(incrementalOf(u, x))
      cost.push(costOf(u, x))
    }
    return { id: u.id, name: u.name, P, incremental: inc, cost }
  })
}
