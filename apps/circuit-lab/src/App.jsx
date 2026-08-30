import React, { useMemo, useRef, useState } from 'react'
import { COLORS, NumField, PoleZeroCanvas, fmt, fmtHz } from '@ee-labs/ui'
import { MathPanel } from '@ee-labs/explain'
import {
  bode,
  magnitudeAt,
  polesZeros,
  secondOrderMetrics,
  stepResponse,
  dcGain,
  isStable,
} from '@ee-labs/systems'
import { CIRCUITS, CIRCUIT_GROUPS, defaultsOf, transferOf } from './circuits.js'
import { circuitMath } from './math.js'
import { LESSONS, LESSON_GROUPS, applyLesson } from './lessons.js'
import { TOLERANCES, responseBand, stepBand, toleranceCloud, tolsOf, spreadPct } from './tolerance.js'
import { termsFor } from './terms.js'
import {
  axisFreqs,
  ensureSampled,
  stickyCentre,
  stickyDuration,
  stickyRange,
  stickySpan,
} from './axis.js'
import { describeRoots } from './pzText.js'
import Schematic from './schematics.jsx'
import HandOver from './components/HandOver.jsx'
import BodeCanvas from './components/BodeCanvas.jsx'
import StepCanvas from './components/StepCanvas.jsx'

const POINTS = 600

export default function App() {
  const [id, setId] = useState('rcLow')
  const [params, setParams] = useState(() => defaultsOf('rcLow'))
  const [output, setOutput] = useState(CIRCUITS.rcLow.outputs[0].key)
  // How honest the parts are, PER PART: { paramKey: ±fraction }. Empty means
  // the textbook world of exact values; a board is never all one grade, and
  // which spec suffers depends on which part wobbles.
  const [tols, setTols] = useState({})
  const [showPhase, setShowPhase] = useState(true)
  const [lower, setLower] = useState('step')
  // Which lesson is loaded, cleared as soon as anything is changed by hand: the
  // note describes one particular setup and stops being true once you move away
  // from it.
  const [lesson, setLesson] = useState(null)
  // Which sidebar groups are unfolded, keyed "section:group" since lessons and
  // circuits both fold. The active item's group is always open regardless, so
  // collapsing is never able to hide where you are — same pattern as Signal
  // Lab's preset groups.
  const [openGroups, setOpenGroups] = useState(() => new Set())

  const circuit = CIRCUITS[id]

  const choose = (next) => {
    setId(next)
    setParams(defaultsOf(next))
    setOutput(CIRCUITS[next].outputs[0].key)
    setTols({})
    setLesson(null)
  }
  const setParam = (key, value) => {
    setParams((p) => ({ ...p, [key]: value }))
    setLesson(null)
  }
  // The output probe and the part tolerance are part of the setup a note
  // describes, every bit as much as a component value: "this RLC is a low-pass
  // biquad" is false the moment the probe moves to L, and "±5% parts" is false
  // at 1%. So changing either by hand retires the note too. The view toggles
  // stay exempt — they change which pane is shown, not what the circuit is.
  const chooseOutput = (key) => {
    setOutput(key)
    setLesson(null)
  }
  const chooseTol = (key, value) => {
    setTols((t) => ({ ...t, [key]: value }))
    setLesson(null)
  }
  const chooseAllTol = (value) => {
    const next = {}
    for (const p of circuit.params) next[p.key] = value
    setTols(next)
    setLesson(null)
  }

  const loadLesson = (l) => {
    const next = applyLesson(l)
    setId(next.id)
    setParams(next.params)
    setOutput(next.output || CIRCUITS[next.id].outputs[0].key)
    setLower(next.view)
    setTols(tolsOf(next.id, next.tols))
    setLesson(l.name)
  }

  const active = LESSONS.find((l) => l.name === lesson)

  const tf = useMemo(() => transferOf(id, params, output), [id, params, output])
  const metrics = useMemo(() => (circuit.metrics ? circuit.metrics(params) : null), [circuit, params])
  const second = useMemo(() => secondOrderMetrics(tf), [tf])
  const pz = useMemo(() => polesZeros(tf), [tf])

  // A ±3-decade span around the circuit's own scale — but STICKY while
  // components are tuned, so the response visibly moves across a fixed axis
  // instead of the axis re-labelling itself under a stationary curve. It
  // re-centres on a circuit or output change, or when the corner drifts
  // within a decade of the edge. See axis.js.
  const axisRef = useRef({ key: '', centre: 0 })
  const freqs = useMemo(() => {
    const scale = metrics ? metrics.w0 / (2 * Math.PI) : naturalScale(pz.poles)
    const key = `${id}/${output}`
    const centre = stickyCentre(
      axisRef.current.key === key ? axisRef.current.centre : 0,
      scale,
    )
    axisRef.current = { key, centre }
    const grid = axisFreqs(centre, POINTS)
    // A high-Q peak is narrower than the grid spacing, so the exact resonance
    // is spliced in — the drawn peak must be the peak the topbar claims. Not
    // for a frequency the circuit removes entirely (the twin-T's notch): one
    // zero-magnitude sample would stretch the dB axis until nothing else on
    // it could be read, and no finite sample draws "no bottom" anyway.
    const f0 = metrics ? metrics.w0 / (2 * Math.PI) : second ? second.f0 : 0
    return f0 > 0 && magnitudeAt(tf, f0) > 1e-9 ? ensureSampled(grid, f0) : grid
  }, [id, output, metrics, second, pz, tf])

  const response = useMemo(() => bode(tf, freqs), [tf, freqs])

  // Long enough to see it arrive, short enough that the arrival fills the
  // pane. Its own memo because the tolerance band must ride the SAME span —
  // an envelope on a different time grid would be two plots pretending to
  // be one.
  const naturalDuration = useMemo(() => {
    const slowest = Math.min(
      ...pz.poles.filter(([re]) => Math.abs(re) > 1e-9).map(([re, im]) => Math.hypot(re, im)),
    )
    const byPole = Number.isFinite(slowest) && slowest > 0 ? 8 / slowest : 5e-3
    // A lightly damped circuit rings for far longer than its pole radius
    // suggests, and a step response cut off before it settles is the one thing
    // this pane exists to show.
    const bySettling = second && Number.isFinite(second.settling) ? 1.4 * second.settling : 0
    return Math.max(byPole, bySettling)
  }, [pz, second])
  // ...and STICKY, like the frequency axis: tuning a component moves the
  // arrival across a held time axis instead of the axis rescaling to pin the
  // curve in place. Same for the y-range below, so growing overshoot grows
  // on screen. Both snap on a circuit or output change.
  const stepAxisRef = useRef({ key: '', duration: 0, range: null })
  const stepDuration = useMemo(() => {
    const key = `${id}/${output}`
    const held = stepAxisRef.current.key === key ? stepAxisRef.current.duration : 0
    const d = stickyDuration(held, naturalDuration)
    stepAxisRef.current.key = key
    stepAxisRef.current.duration = d
    return d
  }, [id, output, naturalDuration])
  const step = useMemo(
    () => stepResponse(tf, { duration: stepDuration, points: 900 }),
    [tf, stepDuration],
  )

  const markers = useMemo(() => {
    const out = []
    if (metrics) out.push({ f: metrics.w0 / (2 * Math.PI), label: 'f₀' })
    else if (second) out.push({ f: second.f0, label: 'f₀' })
    else {
      for (const [re, im] of pz.poles) {
        const w = Math.hypot(re, im)
        if (w > 1e-9) out.push({ f: w / (2 * Math.PI), label: 'pole' })
      }
    }
    return out
  }, [metrics, second, pz])

  const math = useMemo(() => circuitMath(id, tf, params, output), [id, tf, params, output])

  // The scatter from building this circuit 120 times with real parts — and
  // the same builds as an envelope on each plot: shaded regions for where the
  // response and the step could land, the pole cloud for where the poles do.
  const tolsN = useMemo(() => tolsOf(id, tols), [id, tols])
  const wobble = useMemo(
    () => toleranceCloud(id, params, output, tolsN),
    [id, params, output, tolsN],
  )
  const band = useMemo(
    () => responseBand(id, params, output, tolsN, freqs),
    [id, params, output, tolsN, freqs],
  )
  const stepEnvelope = useMemo(
    () => stepBand(id, params, output, tolsN, stepDuration),
    [id, params, output, tolsN, stepDuration],
  )
  // The step pane's y-range, held sticky over trace AND band so neither can
  // be clipped and shrinking overshoot visibly shrinks.
  const stepRange = useMemo(() => {
    let lo = 0
    let hi = 0
    for (let i = 0; i < step.y.length; i++) {
      if (step.y[i] < lo) lo = step.y[i]
      if (step.y[i] > hi) hi = step.y[i]
    }
    if (stepEnvelope) {
      for (let i = 0; i < stepEnvelope.lo.length; i++) {
        if (stepEnvelope.lo[i] < lo) lo = stepEnvelope.lo[i]
        if (stepEnvelope.hi[i] > hi) hi = stepEnvelope.hi[i]
      }
    }
    const key = `${id}/${output}`
    const prev = stepAxisRef.current.rangeKey === key ? stepAxisRef.current.range : null
    const r = stickyRange(prev, lo, hi)
    stepAxisRef.current.rangeKey = key
    stepAxisRef.current.range = r
    return r
  }, [id, output, step, stepEnvelope])
  // The pole view's frame, sticky the same way — tuning C slides the poles
  // along their radius across a held axis. Delivered through PoleZeroCanvas's
  // `span` prop; until the packages agent adds it (NEEDS.md) the prop is
  // ignored and the view keeps its per-render auto-fit.
  const pzSpanRef = useRef({ key: '', span: 0 })
  const pzSpan = useMemo(() => {
    let m = 1
    const all = [...pz.poles, ...pz.zeros, ...(wobble.any ? wobble.cloud : [])]
    for (const [re, im] of all) m = Math.max(m, Math.abs(re) * 1.4, Math.abs(im) * 1.4)
    const key = `${id}/${output}`
    const prev = pzSpanRef.current.key === key ? pzSpanRef.current.span : 0
    const s = stickySpan(prev, m)
    pzSpanRef.current = { key, span: s }
    return s
  }, [id, output, pz, wobble])
  const f0Nominal = metrics ? metrics.w0 / (2 * Math.PI) : second ? second.f0 : null
  const f0Spread = wobble.any && f0Nominal ? spreadPct(wobble.f0, f0Nominal) : null
  const qNominal = metrics && Number.isFinite(metrics.q) ? metrics.q : second ? second.q : null
  const qSpread = wobble.any && qNominal ? spreadPct(wobble.q, qNominal) : null

  const gain = dcGain(tf)
  const stable = isStable(tf)

  return (
    <div className="app">
      <aside className="controls">
        <header>
          <h1>Circuit Lab</h1>
          <p className="sub">
            A circuit, the transfer function it has, and the same thing seen in frequency, in
            time, and as poles.
          </p>
        </header>

        <section>
          <h2>Try this</h2>
          {/* Both lists fold to their group headers — thirteen lessons and
              eight circuits were a wall of buttons that pushed the components
              and the schematic below the fold. Only the active item's group
              stays open, so where-you-are survives any amount of tidying. */}
          {LESSON_GROUPS.map((g) => {
            const inGroup = LESSONS.filter((l) => l.group === g)
            if (!inGroup.length) return null
            return (
              <FoldGroup
                key={g}
                sectionKey={`try:${g}`}
                label={g}
                holdsActive={inGroup.some((l) => l.name === lesson)}
                openGroups={openGroups}
                setOpenGroups={setOpenGroups}
              >
                {inGroup.map((l) => (
                  <button
                    type="button"
                    key={l.name}
                    className={`preset${l.name === lesson ? ' is-on' : ''}`}
                    onClick={() => loadLesson(l)}
                  >
                    {l.name}
                  </button>
                ))}
              </FoldGroup>
            )
          })}
          {active ? <p className="hint">{active.note}</p> : null}
          {/* The vocabulary this lesson leans on, defined where it is used —
              Signal Lab's pattern. A student meeting "Q" or "pole" mid-note
              should not need a second tab, and folded, the definitions cost
              nothing to someone who already has them. */}
          {active && termsFor(active.terms).length ? (
            <details className="terms">
              <summary>Terms used here</summary>
              <dl>
                {termsFor(active.terms).map((t) => (
                  <React.Fragment key={t.id}>
                    <dt>{t.name}</dt>
                    <dd>{t.def}</dd>
                  </React.Fragment>
                ))}
              </dl>
            </details>
          ) : null}
        </section>

        <section>
          <h2>Circuits</h2>
          {CIRCUIT_GROUPS.map((g) => {
            const inGroup = Object.entries(CIRCUITS).filter(([, c]) => c.group === g)
            if (!inGroup.length) return null
            return (
              <FoldGroup
                key={g}
                sectionKey={`circuits:${g}`}
                label={g}
                holdsActive={inGroup.some(([key]) => key === id)}
                openGroups={openGroups}
                setOpenGroups={setOpenGroups}
              >
                {inGroup.map(([key, c]) => (
                  <button
                    type="button"
                    key={key}
                    className={`preset${key === id ? ' is-on' : ''}`}
                    onClick={() => choose(key)}
                  >
                    {c.name}
                  </button>
                ))}
              </FoldGroup>
            )
          })}
          {active ? null : <p className="hint">{circuit.hint}</p>}
        </section>

        <section>
          <h2>Schematic</h2>
          <Schematic id={id} params={params} output={output} />
          {circuit.outputs.length > 1 ? (
            <label className="field">
              <span className="field-label">Output measured</span>
              <select value={output} onChange={(e) => chooseOutput(e.target.value)}>
                {circuit.outputs.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </section>

        <section>
          <h2>Components</h2>
          {/* No part in a drawer is exact, and no board is all one grade —
              so each part carries its own tolerance, right under its value.
              The shaded bands on the plots, the ranges below and the cloud on
              the pole view are all the same 120 builds from these bands. */}
          {circuit.params.map((p) => (
            <React.Fragment key={p.key}>
              <NumField
                label={p.label}
                unit={p.unit}
                value={params[p.key]}
                onChange={(v) => setParam(p.key, v)}
                min={p.min}
                max={p.max}
                scale={p.scale}
                hint={p.hint}
                eng
              />
              <div className="field-tol" role="group" aria-label={`${p.label} tolerance`}>
                <span className="tol-tag">tol</span>
                <div className="segmented sm">
                  {TOLERANCES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      className={(tols[p.key] || 0) === t.value ? 'on' : ''}
                      aria-pressed={(tols[p.key] || 0) === t.value}
                      onClick={() => chooseTol(p.key, t.value)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </React.Fragment>
          ))}

          {/* One row to grade the whole drawer at once — it reads as "on"
              only when every part agrees with it. */}
          <div className="field">
            <span className="field-label" id="tol-all-label">
              Every part at once
            </span>
            <div
              className="segmented sm"
              role="group"
              aria-labelledby="tol-all-label"
              data-role="tol-all"
            >
              {TOLERANCES.map((t) => {
                const allAt = circuit.params.every((p) => (tols[p.key] || 0) === t.value)
                return (
                  <button
                    key={t.value}
                    type="button"
                    className={allAt ? 'on' : ''}
                    aria-pressed={allAt}
                    onClick={() => chooseAllTol(t.value)}
                  >
                    {t.label}
                  </button>
                )
              })}
            </div>
          </div>
          {wobble.any && f0Spread != null ? (
            <p className="hint" data-role="tolerance-spread">
              With these parts f₀ lands anywhere in {fmt(wobble.f0.lo, 'Hz', 3)} to{' '}
              {fmt(wobble.f0.hi, 'Hz', 3)} (±{f0Spread.toFixed(1)}%)
              {qSpread != null
                ? ` and Q in ${wobble.q.lo.toPrecision(3)} to ${wobble.q.hi.toPrecision(3)} (±${qSpread.toFixed(1)}%). The square root in f₀ halves each part's error; nothing does that for Q.`
                : '.'}{' '}
              The poles view shows the scatter.
            </p>
          ) : null}

          {/* The math BELOW the values it explains, so the reading order is the
              working order: set the components, then unfold what they mean.
              It sat above the schematic and the fields before, which asked the
              reader to study consequences before they could see the causes. */}
          <MathPanel entry={math} />
        </section>

        <section>
          <h2>The same filter, sampled</h2>
          <HandOver tf={tf} circuitName={circuit.name.toLowerCase()} />
        </section>

      </aside>

      <div className="topbar">
        <nav className="flow" aria-label="Circuit summary">
          <span className="flow-node">
            {circuit.name}
            <em>{(circuit.outputs.find((o) => o.key === output)?.label ?? '').split(' — ')[0]}</em>
          </span>
          <span className="flow-arrow" aria-hidden="true">
            →
          </span>
          <span className="flow-node">
            H(s)
            <em>
              {pz.poles.length} pole{pz.poles.length === 1 ? '' : 's'}, {pz.zeros.length} zero
              {pz.zeros.length === 1 ? '' : 's'}
            </em>
          </span>
          <span className="flow-arrow" aria-hidden="true">
            →
          </span>
          <span className={`flow-node ${stable ? 'is-out' : 'is-off'}`}>
            {stable ? 'stable' : 'not stable'}
            <em>{stable ? 'left half plane' : 'on or right of the axis'}</em>
          </span>
        </nav>
        <div className="topbar-controls">
          <span className="topbar-field">
            <span>DC gain</span>
            <b>{Number.isFinite(gain) ? fmt(gain, '', 4) : '∞'}</b>
          </span>
          {metrics || second ? (
            <>
              <span className="topbar-field">
                <span>f₀</span>
                <b>{fmtHz(metrics ? metrics.w0 / (2 * Math.PI) : second.f0)}Hz</b>
              </span>
              <span className="topbar-field">
                <span>Q</span>
                <b>{(metrics ? metrics.q : second.q).toFixed(3)}</b>
              </span>
              {second ? (
                <span className="topbar-field">
                  <span>ζ</span>
                  <b>{second.zeta.toFixed(3)}</b>
                </span>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      <main className="views">
        <section className="view">
          <div className="view-head">
            <h2>Frequency response</h2>
            {/* Governs THIS plot, so it lives here — the sidebar's View
                section is gone. Reed's proximity rule from Signal Lab: a
                control that changes one pane sits in that pane's header,
                not a screen-width (or on a phone, a screenful) away. */}
            <div className="segmented sm" role="group" aria-label="Overlay on the response">
              <button
                type="button"
                className={showPhase ? '' : 'on'}
                aria-pressed={!showPhase}
                title="Magnitude only"
                onClick={() => setShowPhase(false)}
              >
                magnitude
              </button>
              <button
                type="button"
                className={showPhase ? 'on' : ''}
                aria-pressed={showPhase}
                title="Magnitude with the phase curve on its own right-hand axis"
                onClick={() => setShowPhase(true)}
              >
                + phase
              </button>
            </div>
            <div className="readout">
              <span>
                span <b>{fmtHz(freqs[0])}Hz – {fmtHz(freqs[freqs.length - 1])}Hz</b>
              </span>
              {second ? (
                <span>
                  {second.zeta < 1 ? 'underdamped' : 'no overshoot'}
                  <em className="prov"> ζ = {second.zeta.toFixed(3)}</em>
                </span>
              ) : null}
            </div>
          </div>
          <BodeCanvas
            freqs={freqs}
            mag={response.mag}
            phase={response.phase}
            showPhase={showPhase}
            band={band}
            markers={markers}
            yUnit={circuit.outputs.find((o) => o.key === output)?.key === 'z' ? 'dBΩ' : 'dB'}
          />
        </section>

        <section className="view">
          <div className="view-head">
            <h2>In time, and as poles</h2>
            <ViewSwitch
              value={lower}
              onChange={setLower}
              options={[
                {
                  id: 'step',
                  label: 'Step response',
                  title: 'What the circuit does to a sudden change',
                },
                {
                  id: 'pz',
                  label: 'Poles & zeros',
                  title: 'The same dynamics as roots on the s-plane',
                },
              ]}
            />
            <div className="readout">
              {lower === 'step' ? (
                <>
                  <span>
                    final <b>{Number.isFinite(gain) ? fmt(gain, '', 4) : 'never settles'}</b>
                  </span>
                  {second && second.overshoot > 0 ? (
                    <span>
                      overshoot <b>{(second.overshoot * 100).toFixed(1)}%</b>
                    </span>
                  ) : null}
                  {second ? (
                    <span>
                      settles in <b>{fmt(second.settling, 's', 3)}</b>
                      <em className="prov"> to within 2%</em>
                    </span>
                  ) : null}
                </>
              ) : (
                <>
                  {/* The legend and the numbers in one stroke: × is a pole,
                      ○ a zero, in the marks' own colours — and the VALUES,
                      because a position on a plot is not a number a reader
                      can write down. Conjugate pairs print once as ±j. */}
                  <span>
                    <b style={{ color: COLORS.trace }}>×</b> poles{' '}
                    <b>{describeRoots(pz.poles)}</b>
                    {pz.poles.length ? <em className="prov"> s⁻¹</em> : null}
                  </span>
                  <span>
                    <b style={{ color: COLORS.response }}>○</b> zeros{' '}
                    <b>{describeRoots(pz.zeros)}</b>
                    {pz.zeros.length ? <em className="prov"> s⁻¹</em> : null}
                  </span>
                  <span className={stable ? '' : 'flag warn'}>
                    {stable ? 'all in the left half plane' : 'not all in the left half plane'}
                  </span>
                </>
              )}
            </div>
          </div>
          {lower === 'step' ? (
            <StepCanvas
              t={step.t}
              y={step.y}
              final={gain}
              band={stepEnvelope}
              range={stepRange}
            />
          ) : (
            <PoleZeroCanvas
              poles={pz.poles}
              zeros={pz.zeros}
              cloud={wobble.any ? wobble.cloud : null}
              span={pzSpan}
            />
          )}
        </section>
      </main>
    </div>
  )
}

/**
 * Which view a pane is showing — Signal Lab's ViewSwitch, copied.
 *
 * Sits in the pane's own header rather than in the sidebar because it changes
 * that pane and nothing else — and because the two panes stay two panes, which
 * is the constraint the whole layout is built around.
 */
function ViewSwitch({ value, onChange, options }) {
  return (
    <div className="segmented sm view-switch" role="group" aria-label="View shown in this pane">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={value === o.id ? 'on' : ''}
          aria-pressed={value === o.id}
          title={o.title}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/**
 * One foldable sidebar group: a <details> whose summary is the group header.
 *
 * The open state is the union of "the user unfolded it" and "it holds the
 * active item" — the second half is not stored, so no sequence of clicks can
 * ever fold the group that shows where you are.
 *
 * The refusal has to happen on the summary CLICK, not in render: the browser
 * folds a <details> natively before React hears about it, and React will not
 * re-write an `open` prop that did not change between renders — so a fold of
 * the active group would stick even though the prop still says open. (The
 * harness clicks the active groups' summaries and expects to get nowhere.)
 */
function FoldGroup({ sectionKey, label, holdsActive, openGroups, setOpenGroups, children }) {
  return (
    <details
      className="preset-group"
      open={holdsActive || openGroups.has(sectionKey)}
      onToggle={(e) => {
        const next = new Set(openGroups)
        if (e.target.open) next.add(sectionKey)
        else next.delete(sectionKey)
        setOpenGroups(next)
      }}
    >
      <summary onClick={(e) => holdsActive && e.preventDefault()}>
        {label}
        {holdsActive ? <span className="group-active-dot" aria-hidden="true" /> : null}
      </summary>
      <div className="presets">{children}</div>
    </details>
  )
}

/** A frequency scale to centre the plot on, when there is no stated resonance. */
function naturalScale(poles) {
  const ws = poles.map(([re, im]) => Math.hypot(re, im)).filter((w) => w > 1e-9)
  if (!ws.length) return 1000
  const geo = Math.exp(ws.reduce((s, w) => s + Math.log(w), 0) / ws.length)
  return geo / (2 * Math.PI)
}
