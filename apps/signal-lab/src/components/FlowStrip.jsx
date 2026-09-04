import React from 'react'
import { fmtHz } from '@ee-labs/ui'

/**
 * The signal chain as a row of nodes, with the RMS after each stage.
 *
 * The numbers are free — runChain already produces every intermediate buffer — and
 * they answer "what did that block actually do to the level" without needing a
 * third plot. Clicking a node scrolls its card into view.
 */
export default function FlowStrip({ stages, sourceCount, sampleRate, onReveal }) {
  const node = (key, label, value, opts = {}) => (
    <React.Fragment key={key}>
      {opts.first ? null : (
        <span className="flow-arrow" aria-hidden="true">
          →
        </span>
      )}
      {opts.onClick ? (
        <button
          type="button"
          className={`flow-node${opts.off ? ' is-off' : ''}`}
          onClick={opts.onClick}
          title={opts.title}
        >
          {label}
          <em>{value}</em>
        </button>
      ) : (
        <span className={`flow-node${opts.out ? ' is-out' : ''}`} title={opts.title}>
          {label}
          <em>{value}</em>
        </span>
      )}
    </React.Fragment>
  )

  const rmsOf = (s) => {
    let acc = 0
    for (let i = 0; i < s.buf.length; i++) acc += s.buf[i] * s.buf[i]
    return Math.sqrt(acc / (s.buf.length || 1)).toFixed(3)
  }

  const sum = stages[0]
  const rest = stages.slice(1)

  return (
    <nav className="flow" aria-label="Signal chain">
      {/* The bare Σ names how the sources combine, without a word next to it
          anywhere in the strip — a deliberate choice for this audience, not
          an oversight, so it still gets a hover title rather than nothing. */}
      {node('src', `${sourceCount} source${sourceCount === 1 ? '' : 's'}`, 'Σ', {
        first: true,
        onClick: () => onReveal('sources'),
        title: 'Σ: the enabled sources add together here',
      })}
      {node('sum', 'sum', sum ? rmsOf(sum) : '0.000')}
      {node('adc', fmtHz(sampleRate), 'Hz')}
      {rest.map((s) =>
        node(s.id, s.label, s.bypassed ? 'bypassed' : rmsOf(s), {
          off: s.bypassed,
          onClick: () => onReveal(`block-${s.id}`),
        }),
      )}
      {node('out', 'scope + FFT', '', { out: true })}
    </nav>
  )
}
