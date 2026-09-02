import React, { useState } from 'react'
import { buildCircuitLink, fmt, handOverEvent, labUrl, track } from '@ee-labs/ui'

// Circuit Lab's names for the catalog entries this lab can hand over to. Kept
// here rather than imported: the apps are siblings, not dependencies, and the
// link format (packages/ui circuitLink.js) is the only thing they share.
const CIRCUIT_LAB = {
  rcLow: { name: 'RC low-pass', units: ['Ω', 'F'], outputs: { c: 'across C' } },
  rlLow: { name: 'RL low-pass', units: ['Ω', 'H'], outputs: { r: 'across R' } },
  rlcSeries: { name: 'Series RLC', units: ['Ω', 'H', 'F'], outputs: { c: 'across C — low-pass', r: 'across R — band-pass', l: 'across L — high-pass' } },
}

/** What the hand-over carries, as text: the values in the link, with units, four figures. */
export function describeMapping(m) {
  const units = CIRCUIT_LAB[m.id]?.units || []
  return m.values.map((v, i) => fmt(v, units[i] || '', 4)).join(', ')
}

/**
 * The hand-over to Circuit Lab (plan §5, H6): this experiment's circuit as one
 * of Circuit Lab's catalog entries, component values carried exactly. Circuit
 * Lab starts where this lab ends — the steady state, one frequency at a time —
 * so what arrives there is the Bode plot of the circuit on screen here.
 *
 * On the deployed site `labUrl` resolves and this is a link; in dev the apps
 * are on separate ports, so the fragment is offered to copy instead (it is kept
 * on `data-fragment`, never shown: a hash is not for reading). A circuit
 * the catalog cannot take exactly is declined with the reason, never clamped.
 */
export default function HandOver({ exp, params }) {
  const [copied, setCopied] = useState(false)
  if (!exp.circuitLab) return null
  const m = exp.circuitLab(params)
  if (m.decline) {
    return (
      <div className="handover" data-role="handover" data-state="declined">
        <p className="handover-dest">→ Circuit Lab</p>
        <p className="hint">{m.decline}</p>
      </div>
    )
  }
  const cat = CIRCUIT_LAB[m.id]
  const fragment = buildCircuitLink({ id: m.id, values: m.values, output: m.output, from: { app: 'elements', id: exp.id, label: exp.name } })
  const url = labUrl('circuit-lab', fragment)
  const count = (action) => track(handOverEvent({ action, app: 'circuit-lab', tier: 'exact', circuit: m.id }))
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
    <div className="handover" data-role="handover" data-state="ready" data-circuit={m.id} data-fragment={fragment}>
      <p className="handover-dest">→ Circuit Lab</p>
      <p className="hint">
        This circuit is Circuit Lab’s <b>{cat ? cat.name : m.id}</b>, output {cat ? cat.outputs[m.output] : m.output}, with{' '}
        {describeMapping(m)} — the same values to the last digit, so its Bode plot is the steady state you see here, and
        it goes on to poles, step response and part tolerances.
      </p>
      {url ? (
        <a className="preset handover-copy" href={url} target="_blank" rel="noopener" onClick={() => count('open')} data-role="handover-link">
          Open in Circuit Lab →
        </a>
      ) : null}
      <button type="button" className="preset handover-copy" onClick={copy}>
        {copied ? (url ? 'link copied' : 'copied — paste after Circuit Lab’s URL') : url ? 'Copy the link' : 'Copy link for Circuit Lab'}
      </button>
    </div>
  )
}
