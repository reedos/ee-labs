import { secondOrderMetrics, dcGain, bilinear } from '@ee-labs/systems'
import { isStable as biquadStable } from '@ee-labs/dsp'
import { buildLink } from '@ee-labs/ui'

// Which digital filter this circuit is.
//
// The claim the whole suite rests on is that an RLC network and a biquad are the
// same object in two vocabularies. This is where that stops being a claim: it
// works out the filter mode, cutoff and Q that a sampled version of the circuit
// on screen would need, and builds a link that loads exactly that.
//
// It only offers the mapping where it is honest. A second-order section can be
// a low-pass, a band-pass or a high-pass depending on where its zeros are, and
// a circuit whose response is not one of those shapes does not get a biquad
// claimed for it — it gets the raw discretised coefficients instead, which are
// still true and simply less tidy.

/**
 * Classify a second-order response by counting zeros at the origin.
 *
 * H = 1/D is a low-pass, H = s/D a band-pass, H = s²/D a high-pass. That is the
 * entire distinction, and it is readable straight off the numerator.
 */
function shapeOf(tf) {
  const b = [...tf.b]
  while (b.length && Math.abs(b[0]) < 1e-18) b.shift()
  const order = tf.a.length - 1
  const zerosAtOrigin = b.length ? b.length - 1 - lastNonZero(b) : 0
  if (order !== 2) return null
  if (b.length === 1) return 'lowpass'
  if (b.length === 2 && zerosAtOrigin === 1) return 'bandpass'
  if (b.length === 3 && zerosAtOrigin === 2) return 'highpass'
  return null
}

const lastNonZero = (arr) => {
  for (let i = arr.length - 1; i >= 0; i--) if (Math.abs(arr[i]) > 1e-18) return i
  return -1
}

// The ranges the receiving knobs actually hold, mirrored from Signal Lab's
// block schemas (qParam, the gain block, the cutoff field, the biquad's
// coefficient knobs). The emitter gates every named hand-over against these
// BEFORE building the link, so nothing it emits can arrive clamped — a link
// that loads as a different filter than the panel described is the exact lie
// this file exists to prevent. Checked cross-app by test.
const RECEIVER = {
  qMin: 0.1,
  qMax: 100,
  freqMin: 20,
  freqMax: (rate) => Math.floor(rate * 0.499),
  gainDbMax: 126,
  coeffMax: 3.999,
  zoomMin: 50,
  srcFreqMin: 1,
}

// Gate against the value the LINK will carry (six significant figures), not
// the raw double: a Q of 99.999996 serializes to exactly 100 and must count
// as inside the knob, while 100.0004 serializes above it and must not.
const asCarried = (v) => Number(Number(v).toPrecision(6))

/**
 * What Signal Lab would need to reproduce this circuit, or null.
 *
 * Two tiers, per Reed's full-fidelity rule (NEEDS.md, both directions). A
 * named shape is PREFERRED when its knobs can hold the circuit — f₀ and Q
 * mean something over there. A circuit whose in-band gain is not 1 still
 * crosses by name: the gain rides along as Signal Lab's gain block, which is
 * an exact rational scaling and therefore carries no hedge (CORE_SCOPE
 * counter-rule). When the knobs cannot hold it — no named shape, Q or corner
 * outside the receiving knob, a negative (inverting) gain no dB knob can
 * say — the hand-over does NOT decline: Signal Lab's `biquad` block receives
 * the five raw coefficients bilinear-exactly, which is what carries the
 * twin-T whole. Raw coefficients that would outgrow the ±3.999 knobs are
 * factored: the largest numerator tap is normalized to 1 and the factor
 * crosses as the same gain block, still exact. `raw: true` marks the tier
 * and `rawReason` names why, so the panel presents it honestly.
 *
 * The one reasoned refusal left: a pole exactly at the origin (the op-amp
 * integrator). Its DC gain is unbounded, a sampled copy just counts forever,
 * and every Signal Lab plot would lie — declined, not approximated.
 *
 * The sample rate has to be well above the circuit's own frequency or the
 * discrete version is not the same filter in any useful sense — a corner at
 * half of Nyquist is warped badly enough that the correspondence stops being
 * the point. Twenty times is comfortable.
 */
export function asDigitalFilter(tf, { sampleRate = 48000, from = null } = {}) {
  const strip = (c) => {
    const out = [...c]
    while (out.length > 1 && Math.abs(out[0]) < 1e-18) out.shift()
    return out
  }
  const a = strip(tf.a)
  const bs = strip(tf.b)
  const order = a.length - 1
  if (order > 2) return null
  // Zero constant term in the denominator = a pole at s = 0.
  if (Math.abs(a[a.length - 1]) < 1e-18) return null

  const m = secondOrderMetrics(tf)
  const shape = shapeOf(tf)
  // The first-order named tier (Reed's rule: an RC/RL low-pass must cross BY
  // NAME, not as anonymous coefficients). Signal Lab's order-1 recipe
  // (designFirstOrder) IS the pre-warped bilinear transform of the
  // unity-gain analog prototype - verified coefficient-exact by test - so
  // this mapping is exact and carries no hedge. The shape is read off the
  // numerator alone; whether the GAIN lets it cross by name is the gain
  // check below, shared with the second-order tier.
  const firstShape = (() => {
    if (order !== 1) return null
    if (bs.length === 1) return 'lowpass'
    if (bs.length === 2 && Math.abs(bs[1]) < 1e-18) return 'highpass'
    return null
  })()
  // The frequency the correspondence is anchored to (pre-warp, rate advice):
  // the resonance when there is one, the pole's own corner for first order,
  // nothing for a resistor network — no dynamics, nothing to warp.
  const fRef =
    m && Number.isFinite(m.f0) && m.f0 > 0
      ? m.f0
      : order === 1
        ? a[1] / a[0] / (2 * Math.PI)
        : null

  // The in-band gain of the named candidate, SIGNED, measured where the
  // receiving recipe is exactly 1: DC for a low-pass, the high-frequency
  // asymptote for a high-pass (bilinear maps s = ∞ onto Nyquist, where the
  // RBJ high-pass is exactly 1), and the resonance for a band-pass — where
  // H(jω₀) = b_mid/a_mid is real exactly, so the sign survives.
  const K = (() => {
    if (shape === 'lowpass' || firstShape === 'lowpass') return dcGain(tf)
    if (shape === 'highpass' || firstShape === 'highpass') return bs[0] / a[0]
    if (shape === 'bandpass') return bs[0] / a[1]
    return null
  })()
  const unity = K != null && Math.abs(K - 1) < 1e-9
  const gdb = K != null && K > 0 ? 20 * Math.log10(K) : null

  // Pre-warp only when the anchor is actually below Nyquist: tan(πf/fs) at
  // or past fs/2 flips sign, and a negative warp constant maps the left half
  // plane OUTSIDE the unit circle — the link would carry an unstable copy of
  // a stable circuit. Above Nyquist the correspondence is already gone
  // (tooFast flags it); the un-warped transform at least stays stable.
  const fWarp = fRef && fRef < sampleRate * 0.499 ? fRef : null
  const digital = bilinear(tf, sampleRate, fWarp)

  // Which tier crosses. Named needs every knob it would set to be inside the
  // receiving range AS SERIALIZED, and a positive gain the dB knob can say.
  const freqOk =
    fRef != null &&
    asCarried(fRef) >= RECEIVER.freqMin &&
    asCarried(fRef) <= RECEIVER.freqMax(sampleRate)
  const gainOk = unity || (gdb != null && Math.abs(asCarried(gdb)) <= RECEIVER.gainDbMax)
  const qOk =
    m != null &&
    Number.isFinite(m.q) &&
    asCarried(m.q) >= RECEIVER.qMin &&
    asCarried(m.q) <= RECEIVER.qMax
  const named2 = !!(shape && freqOk && qOk && K > 0 && gainOk)
  const named1 = !!(firstShape && freqOk && K > 0 && gainOk)

  // The raw tier's five numbers; a first-order (or flat) circuit's shorter
  // arrays pad with zeros, which the biquad runs as written.
  const five = (arr) => [...arr, 0, 0].slice(0, 3)
  let [b0, b1, b2] = five(digital.b)
  const [, a1 = 0, a2 = 0] = [...digital.a, 0, 0].slice(0, 3)

  // Coefficients the ±3.999 knobs cannot hold are FACTORED, not flagged: the
  // largest numerator tap is normalized to 1 and the factor crosses as a
  // gain block — an exact rational scaling, so the filter arrives whole. A
  // stable denominator can never clip (|a₁| < 2 and |a₂| < 1 inside the unit
  // circle), which is why only the numerator is factored. The gain block's
  // own knob stops at ±126 dB; past THAT boundary nothing exact remains, and
  // gainOver makes the panel warn before the link is copied (Rule 3).
  let rawGdb = null
  let gainOver = false
  // The scale the factoring WANTED, kept for the warning: when it saturates
  // at ±126 dB the panel must name the true overflow, not the capped value.
  let gainWanted = null
  if (!named2 && !named1) {
    const bmax = Math.max(Math.abs(b0), Math.abs(b1), Math.abs(b2))
    if (bmax > RECEIVER.coeffMax) {
      let g = bmax
      gainWanted = 20 * Math.log10(bmax)
      if (gainWanted > RECEIVER.gainDbMax) {
        g = Math.pow(10, RECEIVER.gainDbMax / 20)
        gainOver = true
      }
      b0 /= g
      b1 /= g
      b2 /= g
      rawGdb = 20 * Math.log10(g)
    }
  }
  // Only the raw tier puts these five numbers in the link; a named crossing
  // carries knobs, and warning "raise the rate" beside an exact named
  // hand-over would hedge a mapping that has nothing wrong with it.
  const clipped =
    !named2 && !named1 && [b0, b1, b2, a1, a2].some((v) => Math.abs(v) > RECEIVER.coeffMax)

  // The mirror of tooFast, at the other end of the rate window: a corner
  // MANY decades below the rate (a thousand-second twin-T at 192 kHz) puts
  // both poles so close to z = 1 that their joint stability margin,
  // (1−p₁)(1−p₂), falls below what float64 resolves in a₁ ≈ −2, a₂ ≈ 1 —
  // the biquad FORM runs out of digits, not the mathematics. The check is
  // the receiver's own isStable on the very numbers the link carries
  // (serialization is exact, so both ends compute the same answer); when it
  // fails, the panel says so and says the fix — LOWER the rate, the
  // opposite remedy from clipped's. Only the raw tier carries these numbers;
  // a named crossing is rebuilt by the receiving recipe, whose corner floor
  // of 20 Hz keeps its poles certifiable at every rate.
  const uncertifiable = !(named2 || named1) && !biquadStable({ a1, a2 })

  // Why the raw tier, when it is the raw tier — the panel names the reason
  // instead of calling a recognized low-pass "no shape".
  const rawReason =
    named2 || named1
      ? null
      : !(shape || firstShape)
        ? 'shape'
        : K != null && K < 0
          ? 'inverted'
          : !freqOk && fRef != null
            ? 'corner'
            : shape && !qOk
              ? 'q'
              : !gainOk
                ? 'gain'
                : 'shape'

  // The gain block the link carries, if any: the named tier's in-band gain
  // when it is not 1, or the raw tier's factored-out scale.
  const carryGdb = named2 || named1 ? (unity ? null : gdb) : rawGdb

  const blocks = [
    named2
      ? { type: shape, params: [fRef, m.q] }
      : named1
        ? // Third slot is the order select (b=lowpass:fc:q:1); the Q slot
          // carries the default - order 1 has no Q, and the receiving
          // block hides the knob.
          { type: firstShape, params: [fRef, Math.SQRT1_2, 1] }
        : { type: 'biquad', params: [b0, b1, b2, a1, a2] },
    ...(carryGdb != null ? [{ type: 'gain', params: [carryGdb] }] : []),
  ]

  // The probing source: a square near a fifth of the corner (Reed's call —
  // its harmonic comb checks the curve at discrete points). Clamped into
  // [1 Hz, fs/20]: below 1 Hz the receiving scope's cycle-counted span asks
  // for hours of buffer, and above fs/20 the square itself is too coarsely
  // sampled to probe anything. Signal Lab guards its own floor too; the
  // emitter simply never leans on it.
  const srcFreq = fRef
    ? Math.min(sampleRate / 20, Math.max(RECEIVER.srcFreqMin, fRef / 5))
    : 250

  return {
    shape: named2 ? shape : named1 ? firstShape : null,
    // 2 for the named RBJ section, 1 for the named first-order recipe,
    // null when it crossed raw - the panel words each tier differently.
    order: named2 ? 2 : named1 ? 1 : null,
    raw: !(named2 || named1),
    rawReason,
    clipped,
    gainOver,
    gainWanted,
    uncertifiable,
    // The dB the link's gain block carries, or null when no gain block rides.
    gainDb: carryGdb,
    // The five numbers the link's biquad holds when raw (post-factoring) —
    // what the panel's table must print to stay true to the link.
    carried: { b: [b0, b1, b2], a: [a1, a2] },
    f0: fRef,
    q: m ? m.q : null,
    zeta: m ? m.zeta : null,
    gain: K,
    sampleRate,
    digital,
    // Below about twenty samples per cycle the bilinear warp starts to matter
    // enough that "the same filter" needs qualifying. A flat network has no
    // cycle to sample; its ratio is honestly infinite and never "too fast".
    ratio: fRef ? sampleRate / fRef : Infinity,
    tooFast: fRef ? sampleRate / fRef < 20 : false,
    // Provenance rides along (from=circuit:<id>:<label>) so the receiving
    // lab can say "your RC low-pass" instead of the anonymous name of
    // whatever block it mapped to. The zoom= of eight corners exists because
    // the exact mapping LOOKED wrong without it (a 1.6 kHz corner crushed
    // into 1.7% of a linear-to-Nyquist axis); it is omitted, not clamped,
    // when eight corners falls under the receiver's 50 Hz floor — a
    // sub-50 Hz spectrum span has nothing to show at these rates.
    link: buildLink({
      rate: sampleRate,
      sources: [{ type: 'square', freq: Number(srcFreq.toPrecision(2)), amp: 0.8 }],
      blocks,
      ...(fRef && 8 * fRef >= RECEIVER.zoomMin
        ? { zoom: Math.min(8 * fRef, sampleRate / 2) }
        : {}),
      ...(from ? { from } : {}),
    }),
  }
}

/** A sample rate that leaves plenty of room above the circuit's own frequency. */
export function suggestRate(f0) {
  if (!(f0 > 0)) return 48000
  const wanted = f0 * 100
  for (const r of [8000, 16000, 22050, 44100, 48000, 96000, 192000]) {
    if (r >= wanted) return r
  }
  return 192000
}

// ------------------------------------------------- and as a thing to control

/**
 * The same circuit, expressed as a plant Control Lab can close a loop around.
 *
 * Control Lab's plants are a fixed set with named parameters rather than
 * arbitrary transfer functions, so this only offers a hand-over where the
 * mapping is exact. A series RLC measured across its capacitor IS
 * K*wn^2/(s^2 + 2*zeta*wn*s + wn^2) with wn = 1/sqrt(LC) and zeta = (R/2)sqrt(C/L)
 * — the same two numbers the filter view already reports as f0 and Q.
 *
 * Measured across R or L the numerator has zeros in it, and Control Lab's
 * second-order plant has none. That is a different system, so it is declined
 * rather than approximated: a plant that is nearly right would produce a loop
 * whose margins are confidently wrong.
 */
// Control Lab's receiving knob ranges, mirrored the way RECEIVER mirrors
// Signal Lab's (apps/control-lab/src/systems.js PLANTS; cross-checked by the
// component-box sweep test). A named plant is offered ONLY when every value
// it would set is inside these — the receiver clamps out-of-range arrivals
// with a warning, and a clamped plant is a different plant with confident
// margins. Everything the knobs cannot hold falls to `custom`, which is
// signed, six-coefficient, and exact.
const CTRL_RECEIVER = {
  k: [0.001, 1e6],
  tau: [1e-7, 100],
  wn: [0.01, 1e8],
  zeta: [0.01, 5],
  coeffMax: 1e12,
}
const ctrlInRange = (v, [lo, hi]) => {
  const t = asCarried(v)
  return t >= lo && t <= hi
}

export function asControlPlant(tf, from = null) {
  const m = secondOrderMetrics(tf)
  const strip = (c) => {
    const out = [...c]
    while (out.length > 1 && Math.abs(out[0]) < 1e-18) out.shift()
    return out
  }
  const link = (type, params) =>
    buildLink({ plant: { type, params }, ctrl: { type: 'p', params: [1] }, ...(from ? { from } : {}) })

  const a = strip(tf.a)
  const bs = strip(tf.b)
  // Why a named-shaped circuit fell to custom, for the panel's sentence.
  let customReason = null

  // Second order with a constant numerator: Control Lab's `secondOrder` —
  // when its k, ωₙ and ζ knobs can actually hold the values AS SERIALIZED
  // (six significant figures, like every named knob). A negative gain has no
  // named carrier: the k knob starts at 0.001, and clamping a −10 to it
  // would be the exact silently-different-plant failure this file exists to
  // prevent. Out-of-knob circuits are not declined — they fall through to
  // the signed, exact `custom` form below.
  if (m && bs.length === 1) {
    const k = dcGain(tf)
    // An infinite k (pole at the origin in a second-order denominator) has
    // no named carrier here, but it is still rational of order 2 — it falls
    // through to `custom` exactly, where a refusal used to sit.
    if (
      Number.isFinite(k) &&
      k > 0 &&
      ctrlInRange(k, CTRL_RECEIVER.k) &&
      ctrlInRange(m.wn, CTRL_RECEIVER.wn) &&
      ctrlInRange(m.zeta, CTRL_RECEIVER.zeta)
    ) {
      return {
        plant: 'secondOrder',
        label: 'a second-order plant',
        params: [k, m.wn, m.zeta],
        detail: { k, wn: m.wn, zeta: m.zeta },
        why:
          `Resonant at ${(m.wn / (2 * Math.PI)).toPrecision(4)} Hz with a damping ratio of ` +
          `${m.zeta.toPrecision(3)} — the same two numbers the filter view calls f₀ and Q.`,
        link: link('secondOrder', [k, m.wn, m.zeta]),
      }
    }
    if (Number.isFinite(k)) customReason = k <= 0 ? 'sign' : 'range'
  }

  // A single pole at the ORIGIN is checked before first-order, because it
  // also looks first-order: an early `return null` once swallowed the
  // integrator entirely (infinite DC gain, division-by-zero time constant).
  // The SIGN is carried, not stripped: this used to hand the op-amp
  // integrator over as +K/s via Math.abs, and closing negative feedback
  // around what is really an INVERTING integrator is positive feedback — the
  // loop the receiver showed was stable in exactly the case the real one is
  // not. A negative k has no named carrier (the knob starts at 0.001), so it
  // crosses as `custom` with the minus in the coefficients.
  if (a.length === 2 && Math.abs(a[1]) < 1e-18) {
    const k = bs[0] / a[0]
    if (Number.isFinite(k)) {
      if (k > 0 && ctrlInRange(k, CTRL_RECEIVER.k)) {
        return {
          plant: 'integrator',
          label: 'an integrator',
          params: [k],
          detail: { k },
          why:
            'A pole exactly at the origin, so proportional control alone already gives zero ' +
            'steady-state error to a step.',
          link: link('integrator', [k]),
        }
      }
      customReason = k <= 0 ? 'sign' : 'range'
    }
  }

  // First order with a constant numerator: `firstOrder`, K/(1 + tau s) —
  // same gate: positive K, and both knobs able to hold their values.
  if (a.length === 2 && Math.abs(a[1]) >= 1e-18 && bs.length === 1) {
    const k = dcGain(tf)
    const tau = a[0] / a[1]
    if (Number.isFinite(k) && tau > 0) {
      if (
        k > 0 &&
        ctrlInRange(k, CTRL_RECEIVER.k) &&
        ctrlInRange(tau, CTRL_RECEIVER.tau)
      ) {
        return {
          plant: 'firstOrder',
          label: 'a first-order lag',
          params: [k, tau],
          detail: { k, tau },
          why:
            `One pole, a time constant of ${tau.toPrecision(4)} s, and no way to be destabilised ` +
            'by any amount of proportional gain.',
          link: link('firstOrder', [k, tau]),
        }
      }
      customReason = customReason ?? (k <= 0 ? 'sign' : 'range')
    }
  }

  // Everything else rational of order <= 2 crosses as Control Lab's `custom`
  // plant: the exact numerator and denominator polynomials, highest power
  // first, no transform and no approximation (Reed's full-fidelity rule).
  // The numerator-zero circuits — an RLC measured across R or L, the twin-T
  // — cross here, and so now do the circuits whose named parameters exist
  // but exceed the receiving knobs (an overdamped RLC at ζ = 158, a
  // millisecond-forever lag at τ = 1000 s) and the ones that invert.
  if (a.length <= 3 && bs.length <= 3) {
    const pad3 = (arr) => [0, 0, ...arr].slice(-3)
    let six = [...pad3(bs), ...pad3(a)]
    // H(s) is a ratio, so one common scale is free — and the receiving
    // fields stop at ±1e12, which a twin-T at τ = 1 ns exceeds (1/τ² = 1e24
    // after a₀-normalization). When any coefficient is out of the field,
    // every coefficient is divided by a power of TWO just above the largest
    // magnitude: division by 2ⁿ is exact in binary floating point, so the
    // six numbers change while H(s) does not, bit for bit.
    const maxAbs = Math.max(...six.map(Math.abs))
    if (maxAbs > CTRL_RECEIVER.coeffMax) {
      const g = Math.pow(2, Math.ceil(Math.log2(maxAbs)))
      six = six.map((v) => v / g)
    }
    const [b2, b1, b0, a2, a1, a0] = six
    return {
      plant: 'custom',
      label: 'a plant with no simpler name',
      params: six,
      detail: { b: [b2, b1, b0], a: [a2, a1, a0] },
      why:
        customReason === 'sign'
          ? 'It inverts — its gain is negative, and no named plant’s gain knob says a sign — ' +
            'so it crosses raw with the minus carried in the coefficients: exact numerator ' +
            'and denominator polynomials, no approximation.'
          : customReason === 'range'
            ? 'It reduces to a named plant whose knobs cannot hold these values, so it crosses ' +
              'raw instead: the exact numerator and denominator polynomials, six ' +
              'coefficients, no approximation — and no knob quietly holding a different number.'
            : bs.length > 1
              ? 'Its numerator carries zeros no named plant has, so it crosses raw: the exact ' +
                'numerator and denominator polynomials, six coefficients, no approximation.'
              : 'It reduces to no named plant, so it crosses raw: the exact numerator and ' +
                'denominator polynomials, six coefficients, no approximation.',
      link: link('custom', six),
    }
  }

  return null
}
