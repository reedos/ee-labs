// One fixed-step integrator, and the error it reports.
//
// Every linear machine in this package is solved by @ee-labs/network's
// propagator, which takes no step at all and is exact. One object is not
// linear: the induction machine's run-up, where the torque depends on the
// speed through the slip and the speed is the state. That equation has no
// closed form, so it is integrated, and CORE_SCOPE.md Rule 3 applies in full.
//
// The guard is Richardson's. Run the whole trajectory at step h and again at
// h/2. For a method of order p the difference between them is (2^p − 1) times
// the finer run's error, so the finer run's error is
//
//     ε ≈ |y_h − y_{h/2}| / (2^p − 1)
//
// and that number is returned with the answer, every time, in the state's own
// units. `integrate` refuses rather than returning a trajectory whose relative
// error exceeds `tol`, and the refusal names the step that would be needed.
// A number this package prints from an integration always carries this ε.

/** Classical fourth-order Runge–Kutta, one step. */
export function rk4(f, t, y, h) {
  const add = (a, b, s) => a.map((v, i) => v + s * b[i])
  const k1 = f(t, y)
  const k2 = f(t + h / 2, add(y, k1, h / 2))
  const k3 = f(t + h / 2, add(y, k2, h / 2))
  const k4 = f(t + h, add(y, k3, h))
  return y.map((v, i) => v + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]))
}

/** The default guard: one part in 10⁶ of the trajectory's own scale. */
export const INTEGRATOR_GUARD = 1e-6

/**
 * Integrate y' = f(t, y) from 0 to tEnd, twice, and report the error.
 *
 * @returns {{
 *   t: number[], y: number[][],   the fine trajectory, on the coarse grid
 *   error: number,                the estimated absolute error, Richardson
 *   relative: number,             the same, over the trajectory's range
 *   steps: number, h: number, order: 4,
 *   says: string                  the sentence the app prints beside the plot
 * }}
 * Throws when `relative` exceeds `tol`, naming the step that would meet it.
 */
export function integrate(f, y0, tEnd, { steps = 2000, tol = INTEGRATOR_GUARD } = {}) {
  if (!(tEnd > 0)) throw new Error('integrate: the window must be positive')
  if (!(steps >= 4)) throw new Error('integrate: at least four steps')
  const run = (n) => {
    const h = tEnd / n
    const t = [0]
    const y = [y0.slice()]
    let cur = y0.slice()
    for (let k = 0; k < n; k++) {
      cur = rk4(f, k * h, cur, h)
      t.push((k + 1) * h)
      y.push(cur.slice())
    }
    return { t, y, h }
  }
  const coarse = run(steps)
  const fine = run(2 * steps)
  let err = 0
  let range = 0
  for (let k = 0; k <= steps; k++) {
    for (let j = 0; j < y0.length; j++) {
      err = Math.max(err, Math.abs(coarse.y[k][j] - fine.y[2 * k][j]))
      range = Math.max(range, Math.abs(fine.y[2 * k][j]))
    }
  }
  const error = err / 15 // 2⁴ − 1
  const relative = range > 0 ? error / range : 0
  if (relative > tol) {
    const need = Math.ceil(steps * Math.pow(relative / tol, 1 / 4))
    throw new Error(
      `integrate: the estimated error is ${(relative * 100).toPrecision(3)} % of the range, past the ${(tol * 100).toPrecision(2)} % guard. About ${need} steps would meet it.`,
    )
  }
  return {
    t: coarse.t,
    y: coarse.t.map((_, k) => fine.y[2 * k]),
    error,
    relative,
    steps,
    h: coarse.h,
    order: 4,
    says: `Fourth-order Runge–Kutta, ${steps} steps. Richardson puts the error at ${error.toPrecision(3)}, ${(relative * 100).toPrecision(3)} % of the range.`,
  }
}
