// What the lead network itself contributes, apart from the loop around it.
//
// The lead lesson's try line said "drag the pole toward the zero and the
// added phase shrinks" — and the phase margin, the only number on screen,
// went 63.7° → 48.2° → 45.7° → 50.7° → 67.7° as the pole passed the zero:
// once the pole is below the zero the network is a LAG, and a lag moves the
// crossover down to where the three-lag plant has more phase of its own. The
// margin is the loop's number. The network's own number is monotone, and it
// is the one the try line should quote:
//
//   φmax = asin((p − z)/(p + z))   at   ω = √(z·p)
//
// measured in lead.test.js against the peak of the controller's own phase
// curve.

/**
 * The most phase a lead (or least, for a lag) adds, and where.
 * `{ phiMax, w, f, kind }`, phiMax in degrees, w in rad/s, f in Hz.
 */
export function leadPeak(z, p) {
  if (!(z > 0) || !(p > 0)) return null
  const w = Math.sqrt(z * p)
  const phiMax = (Math.asin((p - z) / (p + z)) * 180) / Math.PI
  return { phiMax, w, f: w / (2 * Math.PI), kind: p > z ? 'lead' : p < z ? 'lag' : 'none' }
}
