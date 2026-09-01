import React, { useMemo, useState } from 'react'
import { NumField, fmt, fmtHz, siblingUrl, track, handOverEvent } from '@ee-labs/ui'
import { asDigitalFilter, suggestRate, asControlPlant } from '../toSignalLab.js'

// "This circuit IS that filter", made into a button.
//
// The suite's whole argument is that a network of components and a digital
// biquad are one object described twice. Leaving that as a sentence in a README
// asks the reader to take it on trust; handing the circuit over and letting them
// watch it filter a signal does not.
//
// The sample rate is exposed rather than assumed because it is the one thing
// that makes the correspondence approximate. Sampling warps the frequency axis,
// and how much depends entirely on how much room there is above the circuit.

const SHAPE_LABEL = {
  lowpass: 'low-pass',
  bandpass: 'band-pass',
  highpass: 'high-pass',
}

// A carried gain, said both ways: "+80.0 dB (×10000)". The sign is printed
// explicitly because "gain 6 dB" and "gain −6 dB" are opposite claims that
// differ by one thin glyph.
const fmtDbSigned = (db) => `${db >= 0 ? '+' : '−'}${Math.abs(db).toFixed(1)} dB`
const fmtTimes = (db) => {
  const k = Math.pow(10, db / 20)
  return k >= 100 ? Math.round(k).toLocaleString('en-US') : Number(k.toPrecision(3))
}

export default function HandOver({ tf, circuitName, from = null }) {
  // Provenance (from=circuit:<id>:<label>) rides every emitted link, so the
  // receiving lab can greet the arrival by the circuit's own name.
  const natural = useMemo(() => asDigitalFilter(tf, { from }), [tf, from])
  const plant = useMemo(() => asControlPlant(tf, from), [tf, from])

  // Null means "follow the circuit". A useState initializer runs once, so
  // holding the rate in state directly left it stuck at whatever the first
  // circuit needed — a 5 kHz resonance then got sampled at 48 kHz, nine
  // samples a cycle, and the panel warned about a problem it had created
  // itself. Derived by default, sticky only once someone sets it.
  const [chosen, setChosen] = useState(null)

  const rate = chosen ?? suggestRate(natural ? natural.f0 : 0)
  const d = useMemo(() => asDigitalFilter(tf, { sampleRate: rate, from }), [tf, rate, from])

  // The one reasoned refusal: a pole exactly at the origin (the integrator).
  // Everything else crosses — as a named shape when one is exact, or as raw
  // coefficients when none is (Reed's full-fidelity rule; the twin-T is the
  // showcase of the second tier).
  if (!d) {
    return (
      <>
        <h3 className="handover-dest">→ Signal Lab · the same filter, sampled</h3>
        <p className="hint">
          Declined. This circuit’s DC gain is unbounded — its pole sits exactly at the origin —
          so a sampled copy would just count without limit, and every plot in Signal Lab would
          lie about it. Refused rather than approximated; every other circuit here crosses.
        </p>
        <AsPlant plant={plant} circuitName={circuitName} tf={tf} from={from} />
      </>
    )
  }

  const c = d.carried
  // The gain block's sentence, shared by both named tiers: an exact rational
  // scaling, so it is stated without a hedge (CORE_SCOPE counter-rule).
  const gainClause =
    d.gainDb != null
      ? ` Its in-band gain of ${fmtDbSigned(d.gainDb)} (×${fmtTimes(d.gainDb)}) rides along as a gain block — carried, not normalized away.`
      : ''

  return (
    <div className="handover">
      <h3 className="handover-dest">→ Signal Lab · the same filter, sampled</h3>
      {d.order === 2 ? (
        <p className="hint">
          Sampled at {fmtHz(rate)}Hz, {circuitName} is a {SHAPE_LABEL[d.shape]} biquad with a
          cutoff of {fmtHz(d.f0)}Hz and Q of {d.q.toPrecision(4)}. It crosses by name — Signal
          Lab rebuilds it from (shape, f₀, Q). Not similar to one; the same one.{gainClause}
        </p>
      ) : d.order === 1 ? (
        <p className="hint">
          Sampled at {fmtHz(rate)}Hz, {circuitName} is a 1st-order {SHAPE_LABEL[d.shape]} with
          its corner at {fmtHz(d.f0)}Hz — one pole, no Q to send. It crosses by name: Signal
          Lab’s own 1st-order recipe is the same bilinear transform, so the corner lands
          exactly, and the Q knob stays hidden there because one pole cannot resonate.
          {gainClause}
        </p>
      ) : (
        <p className="hint">
          {d.rawReason === 'q' ? (
            <>
              At Q {d.q.toPrecision(4)} this resonance is beyond the 0.1–100 the named block’s
              knob reaches, so {circuitName} crosses as the five raw coefficients instead —
              bilinear-exact at {fmtHz(rate)}Hz, the same filter with no knob pretending to
              hold it.
            </>
          ) : d.rawReason === 'corner' ? (
            <>
              Its corner at {fmtHz(d.f0)}Hz sits outside the 20 Hz–0.499·fs window the named
              block’s cutoff knob reaches at this rate, so {circuitName} crosses as the five
              raw coefficients — bilinear-exact, with the corner exactly where the circuit
              put it.
            </>
          ) : d.rawReason === 'inverted' ? (
            <>
              {circuitName} inverts — its gain is negative, and no dB knob says a sign — so it
              crosses as the five raw coefficients with the inversion carried in them,
              bilinear-exact at {fmtHz(rate)}Hz.
            </>
          ) : (
            <>
              The named hand-over speaks in (shape, f₀, Q) or a 1st-order corner, and{' '}
              {circuitName} is neither — so it crosses as the five raw coefficients every
              digital biquad reduces to, bilinear-exact at {fmtHz(rate)}Hz. Not a shape with
              knobs; the coefficients themselves.
            </>
          )}
          {d.gainDb != null ? (
            <>
              {' '}
              The coefficients cross scaled to fit the ±3.999 knobs; the factor,{' '}
              {fmtDbSigned(d.gainDb)}, rides along as a gain block — still the same filter,
              said in two blocks.
            </>
          ) : null}
        </p>
      )}

      <NumField
        label="Sample rate"
        unit="Hz"
        value={rate}
        onChange={setChosen}
        min={8000}
        max={192000}
        scale="log"
        eng
        hint={
          !Number.isFinite(d.ratio)
            ? 'no corner to sample — a flat network is flat at any rate'
            : chosen == null
              ? `chosen for this circuit — ${(rate / d.f0).toPrecision(3)} samples per cycle`
              : `${(rate / d.f0).toPrecision(3)} samples per cycle at the corner`
        }
      />

      {d.tooFast ? (
        <p className="hint warn">
          Fewer than twenty samples per cycle at the corner. The bilinear transform pre-warps the
          cutoff so it still lands in the right place, but the shape either side of it is
          noticeably squeezed — the two are no longer the same filter in any useful sense. Raise
          the rate.
        </p>
      ) : null}

      {d.uncertifiable ? (
        <p className="hint warn">
          At this rate the corner sits so many decades below the sample rate that the sampled
          copy’s poles land closer to the unit circle than double precision can tell apart from
          ON it — Signal Lab would read the arriving coefficients as unstable and pass the
          signal through untouched. The mathematics is fine; the digits ran out. Lower the rate
          to bring the circuit back into range.
        </p>
      ) : null}

      {d.gainOver ? (
        <p className="hint warn">
          The scale factored out of the coefficients, {fmtDbSigned(d.gainWanted)}, exceeds the
          ±126 dB the gain block reaches — the one boundary no exact carrier crosses. The link
          carries the closest thing the knobs hold; reduce the gain-setting component before
          copying if the exact scale matters.
        </p>
      ) : null}

      {d.clipped ? (
        <p className="hint warn">
          At this rate the coefficients exceed the ±3.999 the biquad’s knobs reach, and Signal
          Lab would clamp them on arrival. Coefficients shrink as the rate rises above the
          corner — raise the rate before copying the link.
        </p>
      ) : null}

      <table className="math-values">
        <caption>as a difference equation</caption>
        <tbody>
          <tr>
            <th scope="row">b₀, b₁, b₂</th>
            <td>
              {/* The five slots exactly as the link carries them (post-
                  factoring, when a scale was split off into the gain block) —
                  a first-order circuit's third tap is a real zero, not a
                  blank. */}
              {c.b.map((v) => Number(v.toPrecision(5))).join(', ')}
            </td>
          </tr>
          <tr>
            <th scope="row">a₁, a₂</th>
            <td>{c.a.map((v) => Number(v.toPrecision(5))).join(', ')}</td>
          </tr>
          {d.gainDb != null ? (
            <tr>
              <th scope="row">gain block</th>
              <td>
                {fmtDbSigned(d.gainDb)} (×{fmtTimes(d.gainDb)})
              </td>
            </tr>
          ) : null}
          <tr>
            <th scope="row">samples per cycle</th>
            <td>{Number.isFinite(d.ratio) ? Number(d.ratio.toPrecision(4)) : '—'}</td>
          </tr>
        </tbody>
      </table>

      <HandOverLink
        app="signal-lab"
        appName="Signal Lab"
        fragment={d.link}
        tier={d.raw ? 'raw' : d.shape}
        circuit={from?.id}
      />

      <AsPlant plant={plant} circuitName={circuitName} tf={tf} from={from} />
    </div>
  )
}

/**
 * The hand-over itself: a real link when the sibling app is reachable, the
 * copy-a-fragment flow when it is not.
 *
 * On the deployed site the apps sit side by side, so siblingUrl resolves and
 * this is simply a link that opens the other tool loaded with this circuit. In
 * dev the apps are on separate ports, siblingUrl returns null, and the old
 * paste flow remains — deliberately, because a link pointing at a page that is
 * not there would be worse than the paste it replaced.
 */
function HandOverLink({ app, appName, fragment, tier, circuit }) {
  const [copied, setCopied] = useState(false)
  const url = siblingUrl(app, fragment)

  // Which bridge, which tier, which circuit — the three numbers that say
  // whether the hand-overs are used and whether the named tiers earn their
  // keep. Counted BEFORE the navigation and never allowed to interfere with
  // it: the link opens a new tab and the button's copy proceeds regardless.
  const count = (action) => track(handOverEvent({ action, app, tier, circuit }))

  const copy = async () => {
    count('copy')
    try {
      await navigator.clipboard.writeText(url || fragment)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <>
      {url ? (
        <a
          className="preset handover-copy"
          href={url}
          target="_blank"
          rel="noopener"
          onClick={() => count('open')}
        >
          Open in {appName} →
        </a>
      ) : null}
      <button type="button" className="preset handover-copy" onClick={copy}>
        {copied
          ? url
            ? 'link copied'
            : `copied — paste after ${appName}’s URL`
          : url
            ? 'Copy the link'
            : `Copy link for ${appName}`}
      </button>
      <code className="handover-link">#{fragment}</code>
    </>
  )
}

/**
 * The third corner of the triangle.
 *
 * The same network is also something you could close a loop around, and that is
 * a different subject with different questions — not "what does it do to a
 * signal" but "how much gain can I put around it before it sings". Offered only
 * where Control Lab can express the plant exactly.
 */
function AsPlant({ plant, circuitName, tf, from }) {
  // A refused bridge is a finished feature (CORE_SCOPE rule 2): when nothing
  // fits, this section STAYS and says why — it used to vanish silently. The
  // refusal is rarer now: circuits with numerator zeros cross via the raw
  // `custom` plant, so only order > 2 (beyond even the raw form) declines.
  if (!plant) {
    const order = tf ? stripLeading(tf.a).length - 1 : 0
    return (
      <div className="handover as-plant">
        <h3 className="handover-dest">→ Control Lab · the same network, as a plant</h3>
        <p className="hint">
          Declined. At order {order}, {circuitName} exceeds even Control Lab’s raw
          six-coefficient plant, which stops at second order. Refused rather than squeezed.
        </p>
      </div>
    )
  }

  return (
    <div className="handover as-plant">
      <h3 className="handover-dest">→ Control Lab · the same network, as a plant</h3>
      <p className="hint">
        The same {circuitName} is {plant.label}. {plant.why} It crosses exactly — no transform
        involved — and the question changes from what it does to a signal to how much gain you
        can close around it.
      </p>
      <HandOverLink
        app="control-lab"
        appName="Control Lab"
        fragment={plant.link}
        tier={plant.plant}
        circuit={from?.id}
      />
    </div>
  )
}

// The same leading-zero strip the emitters use, for naming a refusal's reason.
function stripLeading(c) {
  const out = [...c]
  while (out.length > 1 && Math.abs(out[0]) < 1e-18) out.shift()
  return out
}
