import React, { useEffect, useState } from 'react'
import { fmt, fmtNum } from '@ee-labs/ui'
import { fromDisplayName } from '../fromLink.js'
import { HEAD_PARTS, CASCADE, DRIVE, FED_BACK, STEP_ENTERS } from '../diagramProse.js'

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
 *
 * Two layouts share this file. WideLoop lays the path left to right at its
 * native size — a fixed 720x156, the same picture since this component's
 * first day. CompactLoop (round-six grading, Layout/Seeing) exists because
 * that 720px picture does not fit a phone: `.fd-scroll`'s overflow-x:auto had
 * no visual cue that 54% of the drawing sat past the edge, on all 13 lessons.
 * The grader's own suggested fix — a responsive viewBox plus width: 100%,
 * the way every other canvas in this suite scales — was tried first and
 * measured: at a 330px dialog it forces a uniform 0.46x shrink, which takes
 * the 12px box label down to about 5.5px, well past reading size. Scaling
 * the whole picture down cannot fix this — the boxes and the text shrink by
 * the same factor no matter what native size is picked, so the only way to
 * keep the text at its native, legible size is to need less WIDTH for it.
 * CompactLoop is that: the same boxes, same font sizes, same interactions,
 * turned so the signal runs top to bottom instead of left to right — r above
 * the first junction, the two boxes stacked, y at the bottom, and the
 * feedback wire returned up a margin beside them rather than under them.
 * Column width comes out at 250px, comfortably inside a 360px phone; column
 * height comes out at under 400px, comfortably inside the dialog's vertical
 * room — so nothing here needs to scroll, in either direction, to be seen.
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

// Two-line parameter summaries where a controller or plant has more than two
// knobs — three lags is four values, and one line would need a smaller font
// than anyone should read.
const chunk = (parts) =>
  parts.length > 2
    ? [parts.slice(0, Math.ceil(parts.length / 2)).join('  ·  '), parts.slice(Math.ceil(parts.length / 2)).join('  ·  ')]
    : [parts.join('  ·  ')]

// CompactLoop's column is 250px, too narrow for the longer decorative notes
// on one line (CASCADE, diagramProse.js, runs
// about 260px at the notes' own 10px). Split at the midpoint word rather
// than drop the sentence — the split is cosmetic, not a content cut.
const twoLine = (text) => {
  const words = text.split(' ')
  const mid = Math.ceil(words.length / 2)
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')]
}

/** True below the breakpoint every phone-specific rule in this app already
 * uses (styles.css). Read at mount and kept live: the dialog can outlive a
 * resize (a laptop window dragged narrow, or a devtools device toggle), and
 * a stale layout choice would reintroduce the same half-invisible drawing
 * this component exists to avoid. */
function useCompactDiagram() {
  const [compact, setCompact] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)')
    const onChange = (e) => setCompact(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return compact
}

export default function LoopDiagram(props) {
  const { onClose } = props
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const compact = useCompactDiagram()

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
            {HEAD_PARTS.map((p, i) => (p.em ? <em key={i}>{p.em}</em> : <React.Fragment key={i}>{p.t}</React.Fragment>))}
          </span>
          <button type="button" className="ghost" onClick={onClose} aria-label="Close diagram">
            ✕
          </button>
        </div>
        <div className="fd-scroll">{compact ? <CompactLoop {...props} /> : <WideLoop {...props} />}</div>
      </div>
    </div>
  )
}

/** The original left-to-right drawing, unchanged: r into a junction, C(s),
 * the disturbance joining at the second junction, P(s), y, and the feedback
 * wire returned underneath. Used at 901px and up, where 92vw always leaves
 * this fixed 720px picture at least 80px of spare room. */
function WideLoop({ plant, plantP, ctrl, ctrlP, ctrlId, from, stepInput, onInject, stable, onReveal }) {
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

  const injectRef = stepInput !== 'dist'

  return (
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
            {STEP_ENTERS}
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
        {CASCADE}
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
            {STEP_ENTERS}
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
          {DRIVE}
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
        {FED_BACK}
      </text>
    </svg>
  )
}

/** The same loop, top to bottom, for a viewport too narrow to give the wide
 * drawing's 720px any room. Same box size, same font sizes as WideLoop — the
 * fix here is a narrower REQUIRED width, not a smaller picture. */
function CompactLoop({ plant, plantP, ctrl, ctrlP, ctrlId, from, stepInput, onInject, stable, onReveal }) {
  // ---- geometry ---------------------------------------------------------
  const BW = 176 // box width — unchanged from WideLoop, so is every font-size rule in styles.css
  const BH = 52 // box height
  const R = 16 // summing-junction radius
  const GX = 36 // vertical gap between stages
  const CX = 112 // the column's shared centre line
  const boxX = CX - BW / 2 // 24 — left edge of both boxes
  const railX = boxX + BW + 26 // 226 — the feedback wire's return column
  const width = railX + 24 // 250

  const rNoteY = 12 // "the step enters here", ABOVE the port — same row as
  // the port itself once ran the two together unreadably close.
  const rY = 30 // the r port's own baseline
  const sum1Y = rY + R + 30 // 76
  const cBoxY = sum1Y + R + GX // 128 — top of C(s)
  const cBoxBottom = cBoxY + BH // 180
  const cOutPlusY = cBoxBottom + 41 // 221 — the "+" where C's output joins sum2
  const sum2Y = cBoxBottom + 71 // 251 — room for the two-line cascade note AND
  // the "+" sign below it with clearance from both
  const pBoxY = sum2Y + R + GX // 303 — top of P(s)
  const pBoxBottom = pBoxY + BH // 355
  const yY = pBoxBottom + 40 // 395
  const outNoteY = yY + 18 // 413
  const height = outNoteY + 16 // 429

  const box = (y, label, subs, reveal, aria) => (
    <g
      className="fd-box"
      transform={`translate(${boxX},${y})`}
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

  const sum = (cy, key) => (
    <g className="fd-sum" key={key} transform={`translate(${CX},${cy})`}>
      <circle r={R} />
      <text textAnchor="middle" dy="5">
        Σ
      </text>
    </g>
  )

  const wire = (d, key, injected = false) => (
    <path key={key} className="fd-wire" d={d} markerEnd={`url(#fd-arrow${injected ? '-on' : ''})`} />
  )

  const injectRef = stepInput !== 'dist'
  const cascade = twoLine(CASCADE)

  return (
    <svg width={width} height={height} className="fd-svg is-compact" aria-hidden="false">
      <defs>
        <marker id="fd-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" className="fd-arrowhead" />
        </marker>
        <marker id="fd-arrow-on" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" className="fd-arrowhead is-on" />
        </marker>
      </defs>

      {/* The reference, entering the first junction from above. */}
      <g
        className={`fd-entry${injectRef ? ' is-inject' : ''}`}
        role="button"
        tabIndex={0}
        aria-label="Inject the step at the reference"
        aria-pressed={injectRef}
        onClick={() => onInject('ref')}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onInject('ref')}
      >
        <rect className="fd-hit" x={CX - 22} y={0} width={44} height={sum1Y - R} />
        <text className="fd-port" x={CX + 12} y={rY}>
          r
        </text>
        {wire(`M ${CX} ${rY + 6} V ${sum1Y - R - 2}`, 'wr', injectRef)}
        {injectRef ? (
          <text className="fd-note" x={CX} y={rNoteY} textAnchor="middle">
            {STEP_ENTERS}
          </text>
        ) : null}
      </g>
      <text className="fd-sign" x={CX + 10} y={sum1Y - R - 6}>
        +
      </text>

      {sum(sum1Y, 'sum1')}

      {/* Error out of the junction, through the controller. */}
      {wire(`M ${CX} ${sum1Y + R} V ${cBoxY - 2}`, 'we')}
      <text className="fd-note" x={CX + 10} y={(sum1Y + R + cBoxY) / 2 + 3}>
        r − y
      </text>
      {box(
        cBoxY,
        `C(s) — ${ctrl.name}`,
        chunk(summarize(ctrl, ctrlP)),
        () => onReveal('controller'),
        'Show the controller in the sidebar',
      )}
      {/* Reed's rule: the view says the name of the thing it enacts — boxes
          in cascade MULTIPLY. Split across two lines: one line at this
          column's width runs past the edge. */}
      <text className="fd-note" x={CX} y={cBoxBottom + 14} textAnchor="middle">
        {cascade[0]}
      </text>
      <text className="fd-note" x={CX} y={cBoxBottom + 27} textAnchor="middle">
        {cascade[1]}
      </text>

      {/* The disturbance, entering the second junction from the side — the
          margin the reference used from above is spent, so this one comes
          in from the left instead. Same information WideLoop draws, same
          size, just turned to fit the column. */}
      <g
        className={`fd-entry${injectRef ? '' : ' is-inject'}`}
        role="button"
        tabIndex={0}
        aria-label="Inject the step at the plant input, as a disturbance"
        aria-pressed={!injectRef}
        onClick={() => onInject('dist')}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onInject('dist')}
      >
        <rect className="fd-hit" x={0} y={sum2Y - 22} width={CX - R} height={44} />
        <text className="fd-port" x={4} y={sum2Y + 4}>
          d
        </text>
        {wire(`M 16 ${sum2Y} H ${CX - R - 2}`, 'wd', !injectRef)}
        {!injectRef ? (
          <text className="fd-note" x={4} y={sum2Y - 26}>
            {STEP_ENTERS}
          </text>
        ) : null}
      </g>
      <text className="fd-sign" x={CX - R - 14} y={sum2Y - 8}>
        +
      </text>
      <text className="fd-sign" x={CX + 10} y={cOutPlusY}>
        +
      </text>

      {sum(sum2Y, 'sum2')}
      {wire(`M ${CX} ${sum2Y + R} V ${pBoxY - 2}`, 'wp')}
      {/* The identity Reed found missing: a plant that arrived from Circuit
          Lab is titled as THE CIRCUIT it is, the named plant demoted to the
          subtitle. */}
      {box(
        pBoxY,
        from ? `P(s) — ${fromDisplayName(from)}` : `P(s) — ${plant.name}`,
        chunk(from ? [plant.name, ...summarize(plant, plantP)] : summarize(plant, plantP)),
        () => onReveal('plant'),
        'Show the plant in the sidebar',
      )}
      {/* The drive is the point: under proportional control the plant is fed
          the scaled ERROR, and this one label is the whole explanation of
          the steady-state error. Fits on one line at this column's width. */}
      {ctrlId === 'p' ? (
        <text className="fd-note" x={CX} y={pBoxBottom + 14} textAnchor="middle">
          {DRIVE}
        </text>
      ) : null}

      {/* The output, and the tap that makes it a loop. */}
      {wire(`M ${CX} ${pBoxBottom} V ${yY - 2}`, 'wy')}
      <circle className="fd-tap" cx={CX} cy={yY} r={3} />
      <text className={`fd-port${stable ? '' : ' is-warn'}`} x={CX + 12} y={yY + 5}>
        y
      </text>
      <text className="fd-note" x={CX} y={outNoteY} textAnchor="middle">
        {FED_BACK}
      </text>

      {/* Feedback: y carried back and SUBTRACTED, up the column's right
          margin — the same rectangular return WideLoop draws underneath,
          turned to run beside the boxes instead of under them. The minus
          sign is the entire mechanism: with a plus the loop would run
          away. */}
      <path
        className="fd-wire"
        d={`M ${CX} ${yY} H ${railX} V ${sum1Y} H ${CX + R + 2}`}
        markerEnd="url(#fd-arrow)"
      />
      <text className="fd-sign" x={CX + R + 6} y={sum1Y - 6}>
        −
      </text>
    </svg>
  )
}
