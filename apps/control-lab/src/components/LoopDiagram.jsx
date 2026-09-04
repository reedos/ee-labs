import React, { useEffect } from 'react'
import { fmt, fmtNum } from '@ee-labs/ui'
import { fromDisplayName } from '../fromLink.js'

/**
 * The classic feedback loop as a block diagram, on demand.
 *
 * This is THE picture of the subject — every controls course opens with it —
 * and until now the app never drew it: the topbar strip shows C → P but not
 * the wire that makes it a loop, and nothing showed WHERE a disturbance gets
 * in. So: r into a summing junction, the error through C(s), the disturbance
 * adding at the plant's input, through P(s) to y, and y carried back to the
 * junction with the minus sign that makes the whole thing work.
 *
 * The r and d entry points are live: the one the step toggle currently
 * injects is marked, and clicking either sets the toggle — the diagram is the
 * explanation of what that toggle does. C and P carry their current parameter
 * values, and clicking either box reveals its sidebar card.
 */

// The one-letter symbols the boxes annotate parameters with. Labels like
// "Time constant τ" are sidebar-sized; in a box only the symbol fits.
const SYMBOLS = {
  k: 'K',
  tau: 'τ',
  wn: 'ωₙ',
  zeta: 'ζ',
  t1: 'τ₁',
  t2: 'τ₂',
  t3: 'τ₃',
  p: 'p',
  z: 'z',
  kp: 'Kp',
  ki: 'Ki',
  kd: 'Kd',
}

const summarize = (defs, values) =>
  defs.params.map(
    (p) =>
      // Engineering prefixes only where a UNIT exists (τ in seconds, poles in
      // rad/s). A dimensionless Kd = 0.2 printed as "Kd 200 m" reads as two
      // hundred, which is a thousand-fold lie in a box meant to be glanced at.
      // A param carrying its own `symbol` (the lead's gain, Kc — distinct
      // from the plant's K, the "two things called K" the student review
      // found) wins over the generic SYMBOLS table.
      //
      // Four significant figures, not three: the sidebar field beside this
      // same live value rounds to four (packages/ui's NumField, snap() —
      // NEEDS.md), and this box once quoted three, printing 11.3 for a gain
      // the sidebar showed as 11.25 — one live number, two readings.
      `${p.symbol || SYMBOLS[p.key] || p.label} ${p.unit ? fmt(values[p.key], p.unit, 4) : fmtNum(values[p.key], 4)}`,
  )

export default function LoopDiagram({
  plant,
  plantP,
  ctrl,
  ctrlP,
  ctrlId,
  from,
  stepInput,
  onInject,
  stable,
  onReveal,
  onClose,
}) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // ---- geometry ---------------------------------------------------------
  const BW = 176 // box width
  const BH = 52 // box height
  const GX = 44 // horizontal gap (arrow length)
  const R = 16 // summing-junction radius
  const midY = 76 // the forward path
  const railY = midY + 52 // the feedback return
  const sum1 = 88 // first junction: r and −y meet
  const cX = sum1 + R + GX
  const sum2 = cX + BW + GX + R // second junction: C's output and d meet
  const pX = sum2 + R + GX
  const tapX = pX + BW + GX // where the feedback wire taps the output
  const width = tapX + 56
  const height = railY + 28

  const box = (x, label, subs, reveal, aria) => (
    <g
      className="fd-box"
      transform={`translate(${x},${midY - BH / 2})`}
      onClick={reveal}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && reveal()}
      aria-label={aria}
    >
      <rect width={BW} height={BH} rx={7} />
      <text className="fd-label" x={BW / 2} y={18} textAnchor="middle">
        {label}
      </text>
      {subs.map((s, i) => (
        <text key={i} className="fd-sub" x={BW / 2} y={32 + i * 13} textAnchor="middle">
          {s}
        </text>
      ))}
    </g>
  )

  const sum = (cx, key) => (
    <g className="fd-sum" key={key} transform={`translate(${cx},${midY})`}>
      <circle r={R} />
      <text textAnchor="middle" dy="5">
        Σ
      </text>
    </g>
  )

  // The marker is a def, out of reach of the group's CSS, so an injected wire
  // points its markerEnd at an accent-coloured twin instead.
  const wire = (d, key, injected = false) => (
    <path
      key={key}
      className="fd-wire"
      d={d}
      markerEnd={`url(#fd-arrow${injected ? '-on' : ''})`}
    />
  )

  // Two-line parameter summaries where a controller or plant has more than two
  // knobs — three lags is four values, and one line would need a smaller font
  // than anyone should read.
  const chunk = (parts) =>
    parts.length > 2
      ? [parts.slice(0, Math.ceil(parts.length / 2)).join('  ·  '), parts.slice(Math.ceil(parts.length / 2)).join('  ·  ')]
      : [parts.join('  ·  ')]

  const injectRef = stepInput !== 'dist'

  return (
    <div className="fd-backdrop" onClick={onClose}>
      <div
        className="fd-panel"
        role="dialog"
        aria-label="Feedback loop diagram"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="fd-head">
          <b>The loop</b>
          <span>
            the error <em>r − y</em> drives C; a disturbance <em>d</em> adds at the plant&apos;s
            input; click <em>r</em> or <em>d</em> to choose which step the plot answers
          </span>
          <button type="button" className="ghost" onClick={onClose} aria-label="Close diagram">
            ✕
          </button>
        </div>
        <div className="fd-scroll">
          <svg width={width} height={height} className="fd-svg" aria-hidden="false">
            <defs>
              <marker id="fd-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                <path d="M0,0 L8,4 L0,8 z" className="fd-arrowhead" />
              </marker>
              <marker id="fd-arrow-on" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                <path d="M0,0 L8,4 L0,8 z" className="fd-arrowhead is-on" />
              </marker>
            </defs>

            {/* The reference: what the loop is asked to do. */}
            <g
              className={`fd-entry${injectRef ? ' is-inject' : ''}`}
              role="button"
              tabIndex={0}
              aria-label="Inject the step at the reference"
              aria-pressed={injectRef}
              onClick={() => onInject('ref')}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onInject('ref')}
            >
              {/* A fat invisible hit area: the visible target is a letter and
                  a hairline wire, which is nothing to aim at. */}
              <rect className="fd-hit" x={2} y={midY - 26} width={sum1 - R - 6} height={44} />
              <text className="fd-port" x={10} y={midY + 4}>
                r
              </text>
              {wire(`M 22 ${midY} H ${sum1 - R - 2}`, 'wr', injectRef)}
              {injectRef ? (
                <text className="fd-note" x={2} y={midY - 32}>
                  the step enters here
                </text>
              ) : null}
            </g>
            <text className="fd-sign" x={sum1 - R - 8} y={midY - 8}>
              +
            </text>

            {sum(sum1, 'sum1')}

            {/* Error out of the junction, through the controller. */}
            {wire(`M ${sum1 + R} ${midY} H ${cX - 2}`, 'we')}
            <text className="fd-note" x={sum1 + R + 4} y={midY - 8}>
              r − y
            </text>
            {box(
              cX,
              `C(s) — ${ctrl.name}`,
              chunk(summarize(ctrl, ctrlP)),
              () => onReveal('controller'),
              'Show the controller in the sidebar',
            )}
            {/* The view says the name of the thing it enacts (Reed's rule,
                from the convolution review): boxes in cascade MULTIPLY. */}
            <text className="fd-note" x={cX + 4} y={midY + BH / 2 + 12} textAnchor="start">
              in cascade: transfer functions multiply — L = C·P
            </text>

            {/* The disturbance: what the world does to the plant, entering at
                its INPUT — after the controller has had its say. */}
            <g
              className={`fd-entry${injectRef ? '' : ' is-inject'}`}
              role="button"
              tabIndex={0}
              aria-label="Inject the step at the plant input, as a disturbance"
              aria-pressed={!injectRef}
              onClick={() => onInject('dist')}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onInject('dist')}
            >
              <rect className="fd-hit" x={sum2 - 18} y={6} width={36} height={midY - R - 8} />
              <text className="fd-port" x={sum2 - 4} y={20}>
                d
              </text>
              {wire(`M ${sum2} 26 V ${midY - R - 2}`, 'wd', !injectRef)}
              {!injectRef ? (
                <text className="fd-note" x={sum2 + 12} y={20}>
                  the step enters here
                </text>
              ) : null}
            </g>
            <text className="fd-sign" x={sum2 + R - 6} y={midY - R - 6}>
              +
            </text>

            {wire(`M ${cX + BW} ${midY} H ${sum2 - R - 2}`, 'wc')}
            <text className="fd-sign" x={sum2 - R - 12} y={midY - 8}>
              +
            </text>
            {sum(sum2, 'sum2')}
            {wire(`M ${sum2 + R} ${midY} H ${pX - 2}`, 'wp')}
            {/* The identity Reed found missing: a plant that arrived from
                Circuit Lab is titled as THE CIRCUIT it is ("your RC
                low-pass"), the named plant demoted to the subtitle. */}
            {box(
              pX,
              from ? `P(s) — ${fromDisplayName(from)}` : `P(s) — ${plant.name}`,
              chunk(from ? [plant.name, ...summarize(plant, plantP)] : summarize(plant, plantP)),
              () => onReveal('plant'),
              'Show the plant in the sidebar',
            )}
            {/* The drive is the point: under proportional control the plant
                is fed the scaled ERROR, and this one label is the whole
                explanation of the steady-state error. */}
            {ctrlId === 'p' ? (
              <text className="fd-note" x={pX + 4} y={midY + BH / 2 + 12} textAnchor="start">
                driven by Kp·(r − y), not by r
              </text>
            ) : null}

            {/* The output, and the tap that makes it a loop. */}
            <path className="fd-wire" d={`M ${pX + BW} ${midY} H ${width - 26}`} markerEnd="url(#fd-arrow)" />
            <circle className="fd-tap" cx={tapX} cy={midY} r={3} />
            <text className={`fd-port${stable ? '' : ' is-warn'}`} x={width - 18} y={midY + 4}>
              y
            </text>

            {/* Feedback: y carried back and SUBTRACTED. The minus sign is the
                entire mechanism — with a plus the loop would run away. */}
            <path
              className="fd-wire"
              d={`M ${tapX} ${midY} V ${railY} H ${sum1} V ${midY + R + 2}`}
              markerEnd="url(#fd-arrow)"
            />
            <text className="fd-sign" x={sum1 + 8} y={midY + R + 12}>
              −
            </text>
            <text className="fd-note" x={(sum1 + tapX) / 2} y={railY + 14} textAnchor="middle">
              the output, measured and fed back
            </text>
          </svg>
        </div>
      </div>
    </div>
  )
}
