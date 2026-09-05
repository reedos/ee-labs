// Protection: a characteristic, and a comparison against a solved network.
//
// A relay is a curve and a comparison, and both sides of the comparison come
// from a solve this package already does. Nothing here is approximate. The
// curve is a definition and the apparent impedance is a ratio of two exact
// phasors.
//
// The inverse-time overcurrent curve is
//
//     t = TDS · K / (M^α − 1),      M = I_fault / I_pickup
//
// with the IEC constants below. A bigger fault clears sooner, which is what
// the word inverse names. Coordination is a margin in seconds: an upstream
// relay operates a fixed time after the downstream one at the same current, so
// the downstream relay gets its chance first.
//
// A distance relay divides its voltage by its current, which gives the
// impedance to the fault. Zone 1 reaches 80 % of the line and trips at once,
// because a reach of 100 % would overreach into the next line on a measurement
// error. Zone 2 reaches 120 % and waits, so it covers the rest of the line and
// backs up the next one.

/** The IEC characteristics, each `K` and `α` in `t = TDS·K/(M^α − 1)`. */
export const IEC_CURVES = {
  standardInverse: { K: 0.14, alpha: 0.02, label: 'IEC standard inverse' },
  veryInverse: { K: 13.5, alpha: 1, label: 'IEC very inverse' },
  extremelyInverse: { K: 80, alpha: 2, label: 'IEC extremely inverse' },
  longTimeInverse: { K: 120, alpha: 1, label: 'IEC long-time inverse' },
}

/** The IEEE characteristics, which add a constant term to the same shape. */
export const IEEE_CURVES = {
  moderatelyInverse: { A: 0.0515, B: 0.114, p: 0.02, label: 'IEEE moderately inverse' },
  veryInverse: { A: 19.61, B: 0.491, p: 2, label: 'IEEE very inverse' },
  extremelyInverse: { A: 28.2, B: 0.1217, p: 2, label: 'IEEE extremely inverse' },
}

/** The multiple of pickup at a fault current. */
export const multiple = ({ pickup }, I) => Math.abs(I) / pickup

/**
 * The operating time of an IEC inverse-time relay.
 * A current at or below pickup never operates, and the function says so with
 * Infinity rather than with a negative time.
 */
export function iecTime({ pickup = 400, tds = 0.1, curve = 'veryInverse' }, I) {
  const c = IEC_CURVES[curve]
  if (!c) throw new Error(`unknown IEC curve "${curve}"`)
  const M = multiple({ pickup }, I)
  if (M <= 1) return Infinity
  return (tds * c.K) / (Math.pow(M, c.alpha) - 1)
}

/** The same for the IEEE curves, whose time dial multiplies the whole expression. */
export function ieeeTime({ pickup = 400, tds = 0.1, curve = 'veryInverse' }, I) {
  const c = IEEE_CURVES[curve]
  if (!c) throw new Error(`unknown IEEE curve "${curve}"`)
  const M = multiple({ pickup }, I)
  if (M <= 1) return Infinity
  return tds * (c.A / (Math.pow(M, c.p) - 1) + c.B)
}

/** A definite-time relay: one time, whatever the current, above pickup. */
export const definiteTime = ({ pickup = 400, time = 0.5 }, I) => (Math.abs(I) > pickup ? time : Infinity)

/**
 * The curve as points on log axes, for the relay plane.
 * The multiples run from just above pickup to the largest fault on the system.
 */
export function curvePoints(setting, { from = 1.05, to = 20, points = 120 } = {}) {
  const out = []
  for (let k = 0; k < points; k++) {
    const M = from * Math.pow(to / from, k / (points - 1))
    const I = M * setting.pickup
    out.push({ M, I, t: setting.family === 'ieee' ? ieeeTime(setting, I) : iecTime(setting, I) })
  }
  return out
}

/**
 * The time dial an upstream relay needs to sit `margin` seconds above a
 * downstream relay at the same current. The relation is linear in the dial, so
 * the answer is one division rather than a search.
 */
export function coordinate({ pickup = 400, curve = 'veryInverse' }, I, downstreamTime, margin = 0.3) {
  const unit = iecTime({ pickup, tds: 1, curve }, I)
  const want = downstreamTime + margin
  const tds = want / unit
  return { tds, time: iecTime({ pickup, tds, curve }, I), margin, downstreamTime }
}

/** Zone 1 at 80 % of the line and zone 2 at 120 %, with the reason for each. */
export function distanceZones({ Zline = 40, zone1 = 0.8, zone2 = 1.2, t2 = 0.4 } = {}) {
  return {
    Zline,
    zone1: zone1 * Zline,
    zone2: zone2 * Zline,
    zone1Fraction: zone1,
    zone2Fraction: zone2,
    t1: 0,
    t2,
  }
}

/**
 * The impedance a distance relay sees, with and without a remote infeed.
 *
 * With no infeed the relay sees the impedance of the line up to the fault. A
 * second source connected at a tapped bus feeds the fault without passing
 * through the relay, so the drop past the tap is made by more current than the
 * relay measures, and the relay reads the section past the tap as though it
 * were longer:
 *
 *     Z_apparent = Z(0 → tap) + (1 + k) Z(tap → fault),   k = I_tap / I_relay
 *
 * The relay then waits on a fault its zone 1 was set to clear at once, and
 * `infeedForReach` gives the infeed fraction at which that starts.
 */
export function apparentZ({ ohmPerKm = 0.4, km = 60, tapKm = null, infeed = 0 } = {}) {
  const total = ohmPerKm * km
  const tap = tapKm === null ? 0 : Math.min(tapKm, km)
  const near = ohmPerKm * tap
  const far = total - near
  return {
    km,
    tapKm,
    infeed,
    line: total,
    near,
    far,
    Z: near + (1 + infeed) * far,
    noInfeed: total,
    /** The infeed at which the apparent impedance first exceeds a reach. */
    infeedForReach: (reach) => (far > 0 ? (reach - near) / far - 1 : Infinity),
  }
}

/**
 * The apparent impedance from one solved fault: the relay's voltage over its
 * current. Both are phasors from the same solve, so this is a ratio and not a
 * model.
 */
export function measuredZ(V, I) {
  const den = I[0] * I[0] + I[1] * I[1]
  if (!(den > 0)) return { R: Infinity, X: Infinity, mag: Infinity }
  const R = (V[0] * I[0] + V[1] * I[1]) / den
  const X = (V[1] * I[0] - V[0] * I[1]) / den
  return { R, X, mag: Math.hypot(R, X), angle: Math.atan2(X, R) }
}

/** Which zone an impedance falls in, and how long the relay waits there. */
export function zoneOf(zones, Z) {
  if (Z <= zones.zone1) return { zone: 1, time: zones.t1, says: 'inside zone 1, so the relay trips at once' }
  if (Z <= zones.zone2) return { zone: 2, time: zones.t2, says: `inside zone 2, so the relay waits ${zones.t2} s` }
  return { zone: null, time: Infinity, says: 'outside both zones, so this relay does not trip on it' }
}
