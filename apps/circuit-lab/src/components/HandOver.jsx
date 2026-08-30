import React, { useMemo, useState } from 'react'
import { NumField, fmt, fmtHz } from '@ee-labs/ui'
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

export default function HandOver({ tf, circuitName }) {
  const natural = useMemo(() => asDigitalFilter(tf), [tf])
  const plant = useMemo(() => asControlPlant(tf), [tf])

  // Null means "follow the circuit". A useState initializer runs once, so
  // holding the rate in state directly left it stuck at whatever the first
  // circuit needed — a 5 kHz resonance then got sampled at 48 kHz, nine
  // samples a cycle, and the panel warned about a problem it had created
  // itself. Derived by default, sticky only once someone sets it.
  const [chosen, setChosen] = useState(null)
  const [copied, setCopied] = useState(false)

  const rate = chosen ?? suggestRate(natural ? natural.f0 : 0)
  const d = useMemo(() => asDigitalFilter(tf, { sampleRate: rate }), [tf, rate])

  if (!d || !d.shape) {
    return (
      <>
        <p className="hint">
          This circuit is not a second-order section of a shape a biquad can express, so there is
          no filter to hand over. The series RLC, the tank and the Sallen–Key all can be.
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
      <p className="hint">
        Sampled at {fmtHz(rate)}Hz, {circuitName} is a {SHAPE_LABEL[d.shape]} biquad with a
        cutoff of {fmtHz(d.f0)}Hz and Q of {d.q.toPrecision(4)}. Not similar to one — the same
        one.
      </p>

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
          chosen == null
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

      <table className="math-values">
        <caption>as a difference equation</caption>
        <tbody>
          <tr>
            <th scope="row">b₀, b₁, b₂</th>
            <td>
              {c.b.map((v) => Number(v.toPrecision(5))).join(', ')}
            </td>
          </tr>
          <tr>
            <th scope="row">a₁, a₂</th>
            <td>{c.a.slice(1).map((v) => Number(v.toPrecision(5))).join(', ')}</td>
          </tr>
          <tr>
            <th scope="row">samples per cycle</th>
            <td>{Number(d.ratio.toPrecision(4))}</td>
          </tr>
        </tbody>
      </table>

      <button type="button" className="preset handover-copy" onClick={copy}>
        {copied ? 'copied — paste after Signal Lab’s URL' : 'Copy link for Signal Lab'}
      </button>
      <code className="handover-link">#{d.link}</code>

      <AsPlant plant={plant} circuitName={circuitName} />
    </div>
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
  const [copied, setCopied] = useState(false)
  if (!plant) return null

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(plant.link)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="handover as-plant">
      <h3>...and as something to control</h3>
      <p className="hint">
        The same {circuitName} is {plant.label}. {plant.why} Hand it to Control Lab and the
        question changes from what it does to a signal to how much gain you can close around it.
      </p>
      <button type="button" className="preset handover-copy" onClick={copy}>
        {copied ? 'copied — paste after Control Lab’s URL' : 'Copy link for Control Lab'}
      </button>
      <code className="handover-link">#{plant.link}</code>
    </div>
  )
}
