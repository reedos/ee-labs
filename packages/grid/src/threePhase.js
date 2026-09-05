// Three phase, from the circuits side.
//
// Three sources of equal magnitude 120° apart, and three equal loads, is one
// circuit that `packages/network` solves like any other. What is worth putting
// on screen is what balance buys.
//
//   The three phasors add to zero, so the neutral carries nothing and the
//   fourth wire can be thin or absent.
//   One phase carries the whole answer. The per-phase circuit gives the line
//   current and a third of the power, and √3 V_LL I_L cos φ gives the same
//   three-phase power.
//   The instantaneous power is constant. One phase alone pulses at twice the
//   frequency and goes negative twice a cycle. The three together do not, and
//   that is why a three-phase motor has no torque ripple from the supply.
//
// A delta of three impedances draws the same line current as a wye of a third
// of each, and the phase current inside the delta is the line current over √3.

const SQRT3 = Math.sqrt(3)

/** Line-to-neutral from line-to-line, and the ratio between them. */
export const lineToNeutral = (Vll) => ({ Vll, Vln: Vll / SQRT3, ratio: SQRT3 })

/** The three phase voltages as phasors, and the sum a neutral would carry. */
export function phaseVoltages(Vln, angle = 0) {
  const set = [0, (-2 * Math.PI) / 3, (2 * Math.PI) / 3].map((d) => [Vln * Math.cos(angle + d), Vln * Math.sin(angle + d)])
  const sum = set.reduce((s, z) => [s[0] + z[0], s[1] + z[1]], [0, 0])
  return { set, sum, sumMag: Math.hypot(sum[0], sum[1]) }
}

/**
 * A balanced wye load of R + jX per phase, at a line-to-line voltage.
 * Every number is per phase except the three marked three-phase.
 */
export function wyeLoad({ R = 100, X = 50, Vll = 230e3 } = {}) {
  const Vln = Vll / SQRT3
  const Z = Math.hypot(R, X)
  const I = Vln / Z
  const phi = Math.atan2(X, R)
  const pf = R / Z
  return {
    R,
    X,
    Z,
    Vll,
    Vln,
    I,
    phi,
    pf,
    Pphase: I * I * R,
    Qphase: I * I * X,
    P: 3 * I * I * R,
    Q: 3 * I * I * X,
    S: 3 * Vln * I,
    /** The same three-phase power written the way a meter reads it. */
    Pline: SQRT3 * Vll * I * pf,
  }
}

/**
 * The instantaneous power of one phase and of all three, over one cycle.
 *
 * One phase is v(t)i(t) = V I cos φ − V I cos(2ωt − φ) with rms values, so it
 * swings by V I about a mean of V I cos φ. The three together sum to three
 * times the mean, with the pulsating parts cancelling exactly.
 */
export function instantaneousPower(load, { points = 721 } = {}) {
  const { Vln, I, phi } = load
  const t = []
  const one = []
  const three = []
  const mean = Vln * I * Math.cos(phi)
  for (let k = 0; k < points; k++) {
    const wt = (2 * Math.PI * k) / (points - 1)
    let sum = 0
    for (const d of [0, (-2 * Math.PI) / 3, (2 * Math.PI) / 3]) {
      const v = Math.SQRT2 * Vln * Math.cos(wt + d)
      const i = Math.SQRT2 * I * Math.cos(wt + d - phi)
      sum += v * i
      if (d === 0) one.push(v * i)
    }
    t.push(wt)
    three.push(sum)
  }
  // One phase's extremes are the closed form's, not the sample grid's:
  // p(t) = V I cos φ − V I cos(2ωt − φ) reaches V I (cos φ ± 1) exactly.
  const swing = Vln * I
  const min = swing * (Math.cos(phi) - 1)
  const max = swing * (Math.cos(phi) + 1)
  const threeMin = Math.min(...three)
  const threeMax = Math.max(...three)
  const threeMean = three.reduce((s, v) => s + v, 0) / three.length
  return {
    wt: t,
    one,
    three,
    mean,
    min,
    max,
    ripple: (max - min) / mean,
    threeMean,
    rippleThree: (threeMax - threeMin) / threeMean,
    threeMin,
    threeMax,
  }
}

/** A delta of Z is a wye of Z/3, and the two draw the same line current. */
export const deltaToWye = (Z) => Z / 3
export const wyeToDelta = (Z) => Z * 3

/**
 * A delta load at a line-to-line voltage: the current inside a leg, the line
 * current outside it, and the wye that replaces it.
 */
export function deltaLoad({ R = 300, X = 0, Vll = 230e3 } = {}) {
  const Z = Math.hypot(R, X)
  const Iphase = Vll / Z
  const Iline = SQRT3 * Iphase
  const wye = wyeLoad({ R: R / 3, X: X / 3, Vll })
  return { R, X, Z, Vll, Iphase, Iline, ratio: SQRT3, wye, P: 3 * Iphase * Iphase * R, sameLineCurrent: Math.abs(Iline - wye.I) }
}
