import React, { useMemo, useState } from 'react'
import { NumField, fmt, fmtHz, siblingUrl } from '@ee-labs/ui'
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
  const [copied, setCopied] = useState(false)

  const rate = chosen ?? suggestRate(natural ? natural.f0 : 0)
  const d = useMemo(() => asDigitalFilter(tf, { sampleRate: rate, from }), [tf, rate, from])

  // The one reasoned refusal: a pole exactly at the origin (the integrator).
  // Everything else crosses — as a named shape when one is exact, or as raw
  // coefficients when none is (Reed's full-fidelity rule; the twin-T is the
  // showcase of the second tier).
  if (!d) {
    return (
      <>
        <p className="hint">
          This circuit’s DC gain is unbounded — its pole sits exactly at the origin — so a
          sampled copy would just count without limit and every plot over there would lie about
          it. Declined rather than approximated; every other circuit here crosses.
        </p>
        <AsPlant plant={plant} circuitName={circuitName} />
      </>
    )
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(d.link)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  const c = d.digital

  return (
    <div className="handover">
      {d.shape ? (
        <p className="hint">
          Sampled at {fmtHz(rate)}Hz, {circuitName} is a {SHAPE_LABEL[d.shape]} biquad with a
          cutoff of {fmtHz(d.f0)}Hz and Q of {d.q.toPrecision(4)}. Not similar to one — the same
          one.
        </p>
      ) : (
        <p className="hint">
          No named filter recipe over there fits {circuitName}
          {d.f0 ? ` (${fmtHz(d.f0)}Hz is its own kind of feature)` : ''} — so it crosses as the
          five raw numbers every second-order digital filter reduces to, bilinear-exact at{' '}
          {fmtHz(rate)}Hz. Not a shape with knobs; the coefficients themselves.
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
              {/* Padded to the biquad's five slots, exactly as the link
                  carries them — a first-order circuit's third tap is a real
                  zero, not a blank. */}
              {[...c.b, 0, 0].slice(0, 3).map((v) => Number(v.toPrecision(5))).join(', ')}
            </td>
          </tr>
          <tr>
            <th scope="row">a₁, a₂</th>
            <td>
              {[...c.a.slice(1), 0, 0].slice(0, 2).map((v) => Number(v.toPrecision(5))).join(', ')}
            </td>
          </tr>
          <tr>
            <th scope="row">samples per cycle</th>
            <td>{Number.isFinite(d.ratio) ? Number(d.ratio.toPrecision(4)) : '—'}</td>
          </tr>
        </tbody>
      </table>

      <HandOverLink app="signal-lab" appName="Signal Lab" fragment={d.link} />

      <AsPlant plant={plant} circuitName={circuitName} />
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
function HandOverLink({ app, appName, fragment }) {
  const [copied, setCopied] = useState(false)
  const url = siblingUrl(app, fragment)

  const copy = async () => {
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
        <a className="preset handover-copy" href={url} target="_blank" rel="noopener">
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
function AsPlant({ plant, circuitName }) {
  if (!plant) return null

  return (
    <div className="handover as-plant">
      <h3>...and as something to control</h3>
      <p className="hint">
        The same {circuitName} is {plant.label}. {plant.why} Hand it to Control Lab and the
        question changes from what it does to a signal to how much gain you can close around it.
      </p>
      <HandOverLink app="control-lab" appName="Control Lab" fragment={plant.link} />
    </div>
  )
}
