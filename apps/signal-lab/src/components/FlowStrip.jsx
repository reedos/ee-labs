import React from 'react'
import { fmtHz } from '@ee-labs/ui'

/**
 * The signal chain as a row of nodes, with the RMS after each stage.
 *
 * The numbers are free — runChain already produces every intermediate buffer — and
 * they answer "what did that block actually do to the level" without needing a
 * third plot. Clicking a node scrolls its card into view.
 */
/**
 * Whether the strip has more chain than it can show.
 *
 * Pulled out so the rule can be read and tested without a layout: the strip is
 * clipped when its content is wider than its box, with a pixel of slack for
 * sub-pixel rounding.
 */
export function isClipped(scrollWidth, clientWidth) {
  return scrollWidth > clientWidth + 1
}

export default function FlowStrip({ stages, sourceCount, sampleRate, onReveal }) {
  // The strip is a horizontal scroller inside a 44 px bar, and at 1280x900 it
  // overflows on twenty of the thirty-five lessons. The node it cuts is always
  // the last one, the output, and it cut it mid-word: "scope + FFT" read
  // "scop" against a hard edge, which looks like a rendering fault rather than
  // like more chain to the right. A fade, applied only when the content really
  // is wider than the box, says what the edge means.
  const ref = React.useRef(null)
  React.useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const sync = () => el.classList.toggle('is-clipped', isClipped(el.scrollWidth, el.clientWidth))
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => ro.disconnect()
  })

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
    <nav className="flow" aria-label="Signal chain" ref={ref}>
      {/* The bare Σ names how the sources combine, without a word next to it
          anywhere in the strip — a deliberate choice for this audience, not
          an oversight, so it still gets a hover title rather than nothing. */}
      {node('src', `${sourceCount} source${sourceCount === 1 ? '' : 's'}`, 'Σ', {
        first: true,
        onClick: () => onReveal('sources'),
        title: 'Σ: the enabled sources add together here',
      })}
      {/* "sum" is the first word past the enabled-sources button, and it is
          on screen the moment a student loads "Single tone" — the suite's own
          terms-on-contact rule applies here as much as it does to a note. A
          hover title, not a terms.js registry entry, matching Σ's own choice
          just above: it names the same combined signal, read as an RMS
          number rather than left as a symbol. */}
      {node('sum', 'sum', sum ? rmsOf(sum) : '0.000', {
        title: 'sum: the RMS level here, after the sources add together.',
      })}
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
