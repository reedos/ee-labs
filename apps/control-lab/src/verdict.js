import { polesZeros, isStable, dcGain } from '@ee-labs/systems'
import { UNDEFINED_PLANT_REASON } from './systems.js'

// The one-word judgement the top bar prints, and the numbers that must agree
// with it.
//
// isStable() answers a yes/no question, and a pole sitting ON the imaginary
// axis is a "no" — so the crossing chip that puts the poles exactly on the
// axis was judged UNSTABLE beside a phase margin of 0.0°, a gain margin of
// 1.00× and a locus readout saying the axis had been "crossed". The student
// review filed all four from one screen. A loop on the boundary is its own
// state: a sustained oscillation that neither settles nor runs away, and
// every pane should call it that.
//
// A fourth state sits beside those three, not among them: 'undefined'. A
// closed-loop denominator that is identically zero has no characteristic
// equation to have roots of, so it is not "unstable" — a claim about roots
// in the right half plane — it is not a system at all. buildLoop's own
// refusal (systems.js: an all-zero plant denominator) hands verdictOf
// exactly this shape, and the check below is the same "degenerate
// denominator" test isStable() already makes, read as its own verdict
// instead of folded into "unstable".

/** A pole this close to the axis, relative to its own scale, is on it. */
export const MARGINAL_REL = 1e-6
/** …or a gain margin this close to 1×: the loop gain sits at the boundary. */
export const MARGINAL_GM = 1e-3

/**
 * 'stable' | 'marginal' | 'unstable' for a closed loop, with the margins as a
 * second witness: a gain margin within 0.1% of 1× is the boundary too.
 */
export function verdictOf(closed, marg = null) {
  if (!closed.a.length || !closed.a.some((v) => v !== 0)) return 'undefined'
  const { poles } = polesZeros(closed)
  if (!poles.length) return isStable(closed) ? 'stable' : 'unstable'
  const scale = Math.max(...poles.map(([re, im]) => Math.hypot(re, im)), Number.MIN_VALUE)
  let onAxis = false
  let strictlyRight = false
  for (const [re, im] of poles) {
    const tol = MARGINAL_REL * Math.max(Math.abs(im), scale)
    if (Math.abs(re) <= tol) onAxis = true
    else if (re > 0) strictlyRight = true
  }
  const gmAtOne = marg && marg.gainMargin != null && Math.abs(marg.gainMargin - 1) < MARGINAL_GM
  if (onAxis || gmAtOne) return 'marginal'
  if (strictlyRight) return 'unstable'
  return isStable(closed) ? 'stable' : 'unstable'
}

/**
 * Does this PLANT alone, with the loop cut, already carry a pole in the
 * right half plane?
 *
 * That one structural fact flips which direction of the gain margin is
 * dangerous (TERMS.rhp). For an ordinary plant more gain is what eventually
 * destabilises it, so a margin below 1x means the loop is already past the
 * edge. For a plant like this, feedback is the only reason it holds at all,
 * so LESS gain is the failure mode and a margin below 1x is the expected,
 * safe reading — the round-three grading found exactly this plant (unstable,
 * under PI or PID at Kp = 5) reading "past the boundary, 0.20x this gain"
 * beside a badge saying stable, with nothing on screen resolving it.
 * Checked on `loop.plant` alone, never `loop.open` or `loop.closed`: a
 * controller cannot move the PLANT's own poles, only the loop's, so this
 * stays true regardless of which controller or gain is dialled in.
 */
export function plantInverted(loop) {
  return polesZeros(loop.plant).poles.some(([re]) => re > 1e-9)
}

/** The rad/s of the pole pair nearest the axis — the frequency a marginal loop sings at. */
export function oscillationOf(closed) {
  const { poles } = polesZeros(closed)
  let best = null
  for (const [re, im] of poles) {
    if (Math.abs(im) < 1e-12) continue
    if (!best || Math.abs(re) < Math.abs(best[0])) best = [re, im]
  }
  return best ? Math.abs(best[1]) : 0
}

/**
 * The margins as the panes should print them.
 *
 * margins() bisects |L| = 1 on a grid eight decades wide, and a loop whose
 * gain is exactly 1 at DC (a lead whose zero cancels the plant's only pole)
 * hands it a float-noise crossing at nanohertz — "crossover 8.215 nHz, phase
 * margin 180.0°". A crossover below the plotted band with |L(0)| = 1 is not
 * a crossover; it is the gain sitting at 1 forever. Printed as — with the
 * reason, the way a missing margin already is.
 */
export function presentMargins(marg, open, lowestPlotted) {
  const out = { ...marg, crossoverNote: null }
  if (marg.gainCrossover == null) {
    out.crossoverNote = 'gain never reaches 1 — no crossover to measure'
    return out
  }
  const atDc = dcGain(open)
  if (marg.gainCrossover < lowestPlotted && Number.isFinite(atDc) && Math.abs(atDc - 1) < 1e-3) {
    out.gainCrossover = null
    out.phaseMargin = null
    out.crossoverNote = 'gain is 1 at DC — no crossover to measure'
  }
  return out
}

/**
 * The topbar's one-word verdict and its two on-screen sentences — the badge
 * word ('stable' / 'ON THE BOUNDARY' / 'UNSTABLE'), the full sentence a wide
 * screen shows, and the short one phone width falls back to. One source for
 * the JSX (App.jsx) AND for chrome.js's scan, so "ON THE BOUNDARY" and the
 * "boundary" cue it must bring with it can never drift the way three
 * hand-copied instances of this sentence just did.
 */
export function verdictBadge(verdict) {
  if (verdict === 'stable') return { badge: 'stable', full: 'closed loop settles', short: 'settles' }
  if (verdict === 'marginal')
    return {
      badge: 'ON THE BOUNDARY',
      full: 'sustained oscillation — neither settles nor runs away',
      short: 'oscillates',
    }
  if (verdict === 'undefined')
    return { badge: 'NOT A SYSTEM', full: UNDEFINED_PLANT_REASON, short: 'not a system' }
  return { badge: 'UNSTABLE', full: 'closed loop runs away', short: 'runs away' }
}

/**
 * A readout sentence as prose mixed with a live number: an ordered list of
 * `{ t: text }` (plain) and `{ b: text }` (bolded) segments. Every function
 * below that builds a sentence with a number in it returns this shape
 * instead of JSX directly, so App.jsx can render the segments (wrapping the
 * `b` ones in `<b>`) while chrome.js's scan flattens the SAME segments back
 * to plain text with `joinParts` — one sentence, read two ways, never two
 * sentences that can drift apart.
 */
export function joinParts(parts) {
  return parts.map((p) => (p.t != null ? p.t : p.b != null ? p.b : '')).join('')
}

/**
 * The Bode pane's margin readout, directly under the crossover line — the
 * one sentence that names the boundary from whichever side applies: a
 * marginal loop sitting AT it (gain margin exactly 0 dB), a loop whose phase
 * never reaches −180° so there is no boundary to measure, room to spare
 * above it, or already past it, or — the fourth verdict, ahead of all of
 * those — no loop to measure at all. `gainMargin` must be the RAW value from
 * margins() — presentMargins() only ever rewrites gainCrossover/phaseMargin,
 * never gainMargin, so the raw number is exactly what every caller (the
 * topbar's verdict aside) already reads. chrome.js calls this with the
 * picker's own default-state numbers, so "boundary" and "−180°" can never
 * appear on screen with no definition reachable — the defect was that this
 * sentence used to exist in ONE place (here) and get scanned in NONE.
 *
 * `inverted` (plantInverted, above) is the round-three fix: a gain margin
 * below 1x reads as a warning ("past the boundary") for an ordinary plant,
 * and as the SAFE reading for a plant whose own pole is already in the right
 * half plane, where feedback is what holds it and too little gain is the
 * failure mode. Same number either way — only the sentence around it changes.
 */
export function bodeMarginNote(verdict, gainMargin, inverted = false) {
  if (verdict === 'undefined') return { prov: true, parts: [{ t: UNDEFINED_PLANT_REASON }] }
  if (verdict === 'marginal') return { prov: true, parts: [{ t: 'gain margin 0 dB, this gain is the boundary' }] }
  if (gainMargin == null) return { prov: true, parts: [{ t: 'phase never reaches −180°' }] }
  if (gainMargin >= 1) {
    return { prov: false, parts: [{ t: 'room for ' }, { b: `${gainMargin.toFixed(2)}×` }, { t: ' more gain' }] }
  }
  if (inverted) {
    return {
      prov: false,
      parts: [
        { t: 'safe here — this plant fails on too little gain, and the boundary sits at ' },
        { b: `${gainMargin.toFixed(2)}×` },
        { t: ' the current gain, not above it' },
      ],
    }
  }
  return {
    prov: false,
    parts: [{ t: 'past the boundary — it sits at ' }, { b: `${gainMargin.toFixed(2)}×` }, { t: ' this gain' }],
  }
}

/**
 * The arrival banner's variable tail (App.jsx, the "Loaded from a link"
 * orientation notice) — the one piece of that sentence that depends on the
 * live loop rather than being fixed prose. Hoisted out of the JSX ternary it
 * used to be so chrome.js's picker-fold scan can see the exact text a
 * hand-over arrival renders: the third of the three consequences the cold
 * walk found was that this sentence can print "with an integrator in the
 * loop the error is erased exactly" for a plant/controller pair reachable
 * ONLY through a link (e.g. an integrator plant paired with a lead
 * controller), with neither hint anywhere near the word "integrator" —
 * chromeTermIds had no way to know this banner was even on screen, because
 * it never modelled the arrival state at all.
 */
export function arrivalErrorNote(err) {
  return Math.abs(err) < 1e-9
    ? 'with an integrator in the loop the error is erased exactly: steady error none.'
    : `the ${(err * 100).toFixed(1)}% steady error in the top bar is the loop's doing — e_ss = 1/(1+L(0)) — not the circuit's. Switch to PI to erase it.`
}

/**
 * How many gain-doublings away the boundary sits, in whichever direction
 * actually gets there — the number the "thin margin" warning should key off.
 *
 * gainMargin is unsigned: it is the factor between the CURRENT gain and the
 * gain at the boundary, crossing = current x gainMargin. Above 1 the
 * boundary sits ABOVE the current gain, the ordinary case, where MORE gain
 * is what breaks the loop. Below 1 the boundary sits BELOW the current
 * gain — the unstable plant's loop, where LESS gain is what breaks it — and
 * a small gainMargin there (0.20x, say) is the SAFE direction: the boundary
 * is a fifth of the current gain away, not a fifth of a step from it. A
 * raw "below 2" test read that safe 0.20x as thin, the wrong half of the
 * plants' loudest signal pointing the wrong way. The room in whichever
 * direction is the destabilising one is gainMargin itself when it is at
 * least 1, and its reciprocal when it is below 1 — the two are the same
 * distance from the boundary read from either side of it.
 */
export function gainMarginRoom(gm) {
  if (gm == null || !(gm > 0)) return null
  return gm >= 1 ? gm : 1 / gm
}

/** Does the gain margin deserve the topbar's warn styling? Below 2 doublings of room in the destabilising direction. */
export function gainMarginWarn(gm) {
  const room = gainMarginRoom(gm)
  return room != null && room < 2
}

/**
 * What the top bar's "steady error" field shows.
 *
 * Round four found the topbar reading the REFERENCE closed loop no matter
 * which step the Step pane itself was showing: with Disturbance selected the
 * pane's own "settles to" already switches to `stepTf` (loop.disturbance),
 * so the topbar must read the SAME transfer function, not always
 * `loop.closed` — otherwise the two numbers describe two different
 * questions and only look like they disagree. `tf` is now whichever
 * transfer function the caller (App.jsx's `stepTf`) is showing, and `mode`
 * says which ideal it is being measured against: a reference step asks the
 * output to reach 1, a disturbance step asks it to stay at 0.
 *
 * e_ss = target − G(0): positive when the output falls short of the ideal,
 * NEGATIVE when it sits above it (the unstable plant under P settles at
 * 1.25 against a target of 1, so its error is −25%). A loop that never
 * settles has no steady state, and the field printed "200.0%", "1000.0%"
 * and "−Infinity%" for those before it learned to say so.
 *
 * The clause naming what a negative reading means used to say the output
 * "overshoots its destination and stays there" — but overshoot is a
 * transient peak that comes back down (TERMS.overshoot), and a loop that
 * settles above its setpoint forever never comes back down at all. That
 * sentence borrowed a defined term for a different idea instead of saying
 * the plain thing: it sits past the target and stays there.
 */
export function steadyErrorOf(tf, verdict, mode = 'ref') {
  if (verdict !== 'stable') {
    return {
      text: '—',
      value: null,
      title:
        verdict === 'marginal'
          ? 'does not settle — the loop oscillates forever at this gain, so it has no steady state'
          : verdict === 'undefined'
            ? UNDEFINED_PLANT_REASON
            : 'does not settle — the loop runs away, so it has no steady state',
    }
  }
  const dist = mode === 'dist'
  const target = dist ? 0 : 1
  const err = target - dcGain(tf)
  if (Math.abs(err) < 1e-9) {
    return dist
      ? {
          text: 'none',
          value: 0,
          title: 'e_ss = 0 − Gd(0) = 0: an integrator in the loop erases the disturbance exactly',
        }
      : { text: 'none', value: 0, title: 'e_ss = 1 − T(0) = 0: an integrator in the loop erases the error exactly' }
  }
  if (dist) {
    const sign =
      err > 0 ? 'the output settles below its undisturbed value' : 'the output settles ABOVE its undisturbed value'
    return {
      text: `${(err * 100).toFixed(1)}%`,
      value: err,
      title: `e_ss = 0 − Gd(0) = ${(err * 100).toFixed(1)}% of the disturbance step — ${sign}; a negative steady error means the output settles past its undisturbed value and stays there`,
    }
  }
  const sign = err > 0 ? 'the output falls short of what was asked' : 'the output settles ABOVE what was asked'
  return {
    text: `${(err * 100).toFixed(1)}%`,
    value: err,
    title: `e_ss = 1 − T(0) = ${(err * 100).toFixed(1)}% of the step — ${sign}; a negative steady error means the output settles past its destination and stays there`,
  }
}
