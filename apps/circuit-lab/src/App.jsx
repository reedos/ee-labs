import React, { useMemo, useRef, useState } from 'react'
import { NumField, PoleZeroCanvas, fmt, fmtHz } from '@ee-labs/ui'
import { MathPanel } from '@ee-labs/explain'
import {
  bode,
  polesZeros,
  secondOrderMetrics,
  stepResponse,
  dcGain,
  isStable,
} from '@ee-labs/systems'
import { CIRCUITS, CIRCUIT_GROUPS, defaultsOf, transferOf } from './circuits.js'
import { circuitMath } from './math.js'
import { LESSONS, LESSON_GROUPS, applyLesson } from './lessons.js'
import { TOLERANCES, toleranceCloud, spreadPct } from './tolerance.js'
import { axisFreqs, stickyCentre } from './axis.js'
import Schematic from './schematics.jsx'
import HandOver from './components/HandOver.jsx'
import BodeCanvas from './components/BodeCanvas.jsx'
import StepCanvas from './components/StepCanvas.jsx'

const POINTS = 600

export default function App() {
  const [id, setId] = useState('rcLow')
  const [params, setParams] = useState(() => defaultsOf('rcLow'))
  const [output, setOutput] = useState(CIRCUITS.rcLow.outputs[0].key)
  // How honest the parts are. Zero means the textbook world of exact values.
  const [tol, setTol] = useState(0)
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
  const chooseTol = (value) => {
    setTol(value)
    setLesson(null)
  }

  const loadLesson = (l) => {
    const next = applyLesson(l)
    setId(next.id)
    setParams(next.params)
    setOutput(next.output || CIRCUITS[next.id].outputs[0].key)
    setLower(next.view)
    setTol(next.tol)
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
    return axisFreqs(centre, POINTS)
  }, [id, output, metrics, pz])

  const response = useMemo(() => bode(tf, freqs), [tf, freqs])

  // Long enough to see it arrive, short enough that the arrival fills the pane.
  const step = useMemo(() => {
    const slowest = Math.min(
      ...pz.poles.filter(([re]) => Math.abs(re) > 1e-9).map(([re, im]) => Math.hypot(re, im)),
    )
    const byPole = Number.isFinite(slowest) && slowest > 0 ? 8 / slowest : 5e-3
    // A lightly damped circuit rings for far longer than its pole radius
    // suggests, and a step response cut off before it settles is the one thing
    // this pane exists to show.
    const bySettling = second && Number.isFinite(second.settling) ? 1.4 * second.settling : 0
    return stepResponse(tf, { duration: Math.max(byPole, bySettling), points: 900 })
  }, [tf, pz, second])

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

  // The scatter from building this circuit 120 times with real parts.
  const wobble = useMemo(
    () => toleranceCloud(id, params, output, tol),
    [id, params, output, tol],
  )
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
          <MathPanel entry={math} />
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
          {circuit.params.map((p) => (
            <NumField
              key={p.key}
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
          ))}

          {/* No part in a drawer is exact. The cloud on the pole view and the
              ranges here are what a drawer of real parts does to this page. */}
          <div className="field">
            <span className="field-label" id="tol-label">
              Part tolerance
            </span>
            <div className="segmented sm" role="group" aria-labelledby="tol-label">
              {TOLERANCES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className={tol === t.value ? 'on' : ''}
                  aria-pressed={tol === t.value}
                  onClick={() => chooseTol(t.value)}
                >
                  {t.label}
                </button>
              ))}
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
        </section>

        <section>
          <h2>The same filter, sampled</h2>
          <HandOver tf={tf} circuitName={circuit.name.toLowerCase()} />
        </section>

        <section>
          <h2>View</h2>
          <label className="check">
            <input
              type="checkbox"
              checked={showPhase}
              onChange={(e) => setShowPhase(e.target.checked)}
            />
            Show phase
          </label>
          <div className="segmented">
            <button
              type="button"
              className={lower === 'step' ? 'on' : ''}
              onClick={() => setLower('step')}
            >
              Step response
            </button>
            <button
              type="button"
              className={lower === 'pz' ? 'on' : ''}
              onClick={() => setLower('pz')}
            >
              Poles &amp; zeros
            </button>
          </div>
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
            markers={markers}
            yUnit={circuit.outputs.find((o) => o.key === output)?.key === 'z' ? 'dBΩ' : 'dB'}
          />
        </section>

        <section className="view">
          <div className="view-head">
            <h2>{lower === 'step' ? 'Step response' : 'Poles and zeros'}</h2>
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
                  <span>
                    poles <b>{pz.poles.length}</b>
                  </span>
                  <span>
                    zeros <b>{pz.zeros.length}</b>
                  </span>
                  <span className={stable ? '' : 'flag warn'}>
                    {stable ? 'all in the left half plane' : 'not all in the left half plane'}
                  </span>
                </>
              )}
            </div>
          </div>
          {lower === 'step' ? (
            <StepCanvas t={step.t} y={step.y} final={gain} />
          ) : (
            <PoleZeroCanvas
              poles={pz.poles}
              zeros={pz.zeros}
              cloud={wobble.any ? wobble.cloud : null}
            />
          )}
        </section>
      </main>
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
