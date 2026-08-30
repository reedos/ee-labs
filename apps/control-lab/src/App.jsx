import React, { useMemo, useRef, useState } from 'react'
import { NumField, PoleZeroCanvas, fmt, fmtHz } from '@ee-labs/ui'
import { MathPanel } from '@ee-labs/explain'
import {
  bode,
  evalAtFreq,
  polesZeros,
  isStable,
  rootLocus,
  secondOrderMetrics,
  stepResponse,
  dcGain,
  series,
  closeLoop,
} from '@ee-labs/systems'
import { PLANTS, PLANT_GROUPS, CONTROLLERS, buildLoop, defaultsOf, loopMargins, settlesOnScreen } from './systems.js'
import { loopMath } from './math.js'
import { LESSONS, LESSON_GROUPS, applyLesson } from './lessons.js'
import { termsFor } from './terms.js'
import { nextFrame } from './frame.js'
import { readLocationLink } from '@ee-labs/ui'
import { stateFromLink } from './fromLink.js'
import BodeCanvas from './components/BodeCanvas.jsx'
import StepCanvas from './components/StepCanvas.jsx'
import NyquistCanvas from './components/NyquistCanvas.jsx'
import LoopDiagram from './components/LoopDiagram.jsx'

const POINTS = 900

export default function App() {
  // A loop handed over from another tool, read once at startup.
  const [linked] = useState(() => {
    const { patch, warnings } = readLocationLink()
    const { state, warnings: more } = stateFromLink(patch)
    return { state, warnings: [...warnings, ...more] }
  })

  const [plantId, setPlantId] = useState(linked.state?.plantId ?? 'motor')
  const [plantP, setPlantP] = useState(
    () => linked.state?.plantP ?? defaultsOf(PLANTS.motor),
  )
  const [ctrlId, setCtrlId] = useState(linked.state?.ctrlId ?? 'p')
  const [ctrlP, setCtrlP] = useState(() => linked.state?.ctrlP ?? defaultsOf(CONTROLLERS.p))
  const [lower, setLower] = useState('step')
  // What the step is applied TO: the reference (follow a new setpoint) or the
  // plant input (shrug off a shove). Different questions, one loop.
  const [stepInput, setStepInput] = useState('ref')
  const [showPhase, setShowPhase] = useState(true)
  // Cleared as soon as anything is touched: the note describes one setup.
  const [lesson, setLesson] = useState(null)
  // Which lesson groups are unfolded. The active lesson's group is always open
  // regardless, so collapsing can never hide where you are.
  const [openGroups, setOpenGroups] = useState(() => new Set())
  const [diagram, setDiagram] = useState(false)

  // Scroll a sidebar card into view, for clicks on the diagram's boxes.
  const reveal = (id) => {
    const el = document.getElementById(id)
    if (!el) return
    // CSS scroll-behavior cannot override an explicit 'smooth' argument, so
    // the reduced-motion preference has to be honoured here in the call.
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ block: 'nearest', behavior: still ? 'auto' : 'smooth' })
    el.classList.add('is-flash')
    window.setTimeout(() => el.classList.remove('is-flash'), 600)
  }

  const plant = PLANTS[plantId]
  const ctrl = CONTROLLERS[ctrlId]

  const choosePlant = (id) => {
    setPlantId(id)
    setPlantP(defaultsOf(PLANTS[id]))
    setLesson(null)
  }
  const chooseCtrl = (id) => {
    setCtrlId(id)
    setCtrlP(defaultsOf(CONTROLLERS[id]))
    setLesson(null)
  }
  // A lesson note describes ONE step input, so flipping the toggle clears the
  // note like any other control — a note about following r must not stand
  // over a plot answering d.
  const chooseStepInput = (which) => {
    setStepInput(which)
    setLesson(null)
  }

  const loadLesson = (l) => {
    const n = applyLesson(l)
    setPlantId(n.plantId)
    setPlantP(n.plantP)
    setCtrlId(n.ctrlId)
    setCtrlP(n.ctrlP)
    setLower(n.view)
    setStepInput(n.stepInput)
    setLesson(l.name)
  }

  const active = LESSONS.find((l) => l.name === lesson)

  const loop = useMemo(
    () => buildLoop(plantId, plantP, ctrlId, ctrlP),
    [plantId, plantP, ctrlId, ctrlP],
  )

  const pz = useMemo(() => polesZeros(loop.closed), [loop])
  const openPz = useMemo(() => polesZeros(loop.open), [loop])

  // Centre the sweep on whatever the loop's own timescale turns out to be —
  // but STICKILY: while parameters are tuned the curve moves and the axis
  // holds still, re-framing only on a plant/controller change or when the
  // centre nears the window's edge (see frame.js).
  const frameRef = useRef(null)
  const freqs = useMemo(() => {
    const ws = [...openPz.poles, ...openPz.zeros]
      .map(([re, im]) => Math.hypot(re, im))
      .filter((w) => w > 1e-9)
    const centre = ws.length
      ? Math.exp(ws.reduce((s, w) => s + Math.log(w), 0) / ws.length) / (2 * Math.PI)
      : 1
    const frame = nextFrame(frameRef.current, `${plantId}|${ctrlId}`, centre)
    if (frame === frameRef.current && frame.freqs) return frame.freqs
    frame.freqs = Float64Array.from({ length: POINTS }, (_, i) =>
      Math.pow(10, frame.lo + ((frame.hi - frame.lo) * i) / (POINTS - 1)),
    )
    frameRef.current = frame
    return frame.freqs
  }, [openPz, plantId, ctrlId])

  const open = useMemo(() => bode(loop.open, freqs), [loop, freqs])
  const marg = useMemo(() => loopMargins(loop.open, freqs), [loop, freqs])
  const stable = isStable(loop.closed)
  const second = useMemo(() => secondOrderMetrics(loop.closed), [loop])

  const nyq = useMemo(() => {
    const re = new Float64Array(freqs.length)
    const im = new Float64Array(freqs.length)
    for (let i = 0; i < freqs.length; i++) {
      const h = evalAtFreq(loop.open, freqs[i])
      re[i] = h[0]
      im[i] = h[1]
    }
    return { re, im }
  }, [loop, freqs])

  const stepTf = stepInput === 'dist' ? loop.disturbance : loop.closed

  const step = useMemo(() => {
    // Long enough to see it settle, or to see clearly that it will not.
    const slow = Math.min(
      ...pz.poles.filter(([re]) => Math.abs(re) > 1e-9).map(([re]) => Math.abs(re)),
    )
    const d = Number.isFinite(slow) && slow > 0 ? Math.min(12 / slow, 400) : 20
    return stepResponse(stepTf, { duration: d, points: 900 })
  }, [stepTf, pz])

  // The locus of closed-loop poles as the loop gain is swept, with the poles at
  // the CURRENT gain marked on it.
  const locus = useMemo(() => {
    // Sweep to 100x, not 1000x: the far branches only stretch the frame, and
    // at 1000x the fan the lesson exists to show was a sliver around the
    // origin. Every plant here crosses (or provably never crosses) the axis
    // well inside two decades of extra gain.
    const gains = Array.from({ length: 160 }, (_, i) => Math.pow(10, -2 + (4 * i) / 159))
    const sweep = rootLocus(loop.open, gains)
    const n = Math.max(...sweep.map((s) => s.poles.length))
    const branches = Array.from({ length: n }, () => [])
    for (const s of sweep) {
      // Keep each branch continuous by matching each pole to the nearest one on
      // the previous step, or the branches cross over and draw as spaghetti.
      const sorted = [...s.poles].sort((a, b) => a[0] - b[0] || a[1] - b[1])
      for (let i = 0; i < n; i++) if (sorted[i]) branches[i].push(sorted[i])
    }
    return branches
  }, [loop])

  const math = useMemo(
    () => loopMath(plantId, plantP, ctrlId, ctrlP, loop, marg, freqs),
    [plantId, plantP, ctrlId, ctrlP, loop, marg, freqs],
  )

  const err = 1 - dcGain(loop.closed)

  return (
    <div className="app">
      <aside className="controls">
        <header>
          <h1>Control Lab</h1>
          <p className="sub">
            A plant you are stuck with, a controller you get to choose, and the one point on the
            complex plane that decides whether it works.
          </p>
        </header>

        <section>
          {linked.state ? (
            <p className="hint from-link">
              Loaded from a link — this plant came from another tool in the suite. Pick anything
              below to start over.
            </p>
          ) : null}
          {linked.warnings.length ? (
            <ul className="link-warnings">
              {linked.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          ) : null}
          <h2>Try this</h2>
          {/* Grouped as a curriculum and COLLAPSED to group headers by default,
              the same fold as Signal Lab's presets: twelve buttons were most of
              the sidebar, and the plant and controller a lesson changes sat
              scrolled out of sight at the moment they changed. Only the active
              lesson's group stays open, so where-you-are survives the fold. */}
          {LESSON_GROUPS.map((g) => {
            const inGroup = LESSONS.filter((l) => l.group === g)
            if (!inGroup.length) return null
            const holdsActive = inGroup.some((l) => l.name === lesson)
            return (
              <details
                className="preset-group"
                key={g}
                open={holdsActive || openGroups.has(g)}
                onToggle={(e) => {
                  const next = new Set(openGroups)
                  if (e.target.open) next.add(g)
                  else next.delete(g)
                  setOpenGroups(next)
                }}
              >
                {/* preventDefault, not just a controlled `open`: React skips
                    rewriting an attribute whose prop value has not changed, so
                    a native toggle would stand and the active group WOULD fold
                    away. Blocking the click is the only reliable pin. */}
                <summary onClick={holdsActive ? (e) => e.preventDefault() : undefined}>
                  {g}
                  {holdsActive ? <span className="group-active-dot" aria-hidden="true" /> : null}
                </summary>
                <div className="presets">
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
                </div>
              </details>
            )
          })}
          {active ? <p className="hint">{active.note}</p> : null}
          {/* Definitions on contact: the terms this lesson leans on, defined
              right under the note rather than in a second tab — and folded,
              so they cost nothing to someone who already has them. */}
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

        <section id="plant">
          <h2>Plant</h2>
          {PLANT_GROUPS.map((g) => {
            const inGroup = Object.entries(PLANTS).filter(([, p]) => p.group === g)
            if (!inGroup.length) return null
            return (
              <div className="preset-group" key={g}>
                <h3>{g}</h3>
                <div className="presets">
                  {inGroup.map(([key, p]) => (
                    <button
                      type="button"
                      key={key}
                      className={`preset${key === plantId ? ' is-on' : ''}`}
                      onClick={() => choosePlant(key)}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
          {active ? null : <p className="hint">{plant.hint}</p>}
          {plant.params.map((p) => (
            <NumField
              key={p.key}
              label={p.label}
              unit={p.unit}
              value={plantP[p.key]}
              onChange={(v) => {
                setPlantP((s) => ({ ...s, [p.key]: v }))
                setLesson(null)
              }}
              min={p.min}
              max={p.max}
              scale={p.scale}
              eng
            />
          ))}
        </section>

        <section id="controller">
          <h2>Controller</h2>
          <div className="presets">
            {Object.entries(CONTROLLERS).map(([key, c]) => (
              <button
                type="button"
                key={key}
                className={`preset${key === ctrlId ? ' is-on' : ''}`}
                onClick={() => chooseCtrl(key)}
              >
                {c.name}
              </button>
            ))}
          </div>
          {active ? null : <p className="hint">{ctrl.hint}</p>}
          {ctrl.params.map((p) => (
            <NumField
              key={p.key}
              label={p.label}
              unit={p.unit}
              value={ctrlP[p.key]}
              onChange={(v) => {
                setCtrlP((s) => ({ ...s, [p.key]: v }))
                setLesson(null)
              }}
              min={p.min}
              max={p.max}
              scale={p.scale}
              eng
            />
          ))}
          <MathPanel entry={math} />
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
              Step
            </button>
            <button
              type="button"
              className={lower === 'nyquist' ? 'on' : ''}
              onClick={() => setLower('nyquist')}
            >
              Nyquist
            </button>
            <button
              type="button"
              className={lower === 'locus' ? 'on' : ''}
              onClick={() => setLower('locus')}
            >
              Root locus
            </button>
          </div>
        </section>
      </aside>

      <div className="topbar">
        <nav className="flow" aria-label="Loop">
          <span className="flow-node">
            {ctrl.name}
            <em>C(s)</em>
          </span>
          <span className="flow-arrow" aria-hidden="true">
            →
          </span>
          <span className="flow-node">
            {plant.name}
            <em>P(s)</em>
          </span>
          <span className="flow-arrow" aria-hidden="true">
            ↻
          </span>
          <span className={`flow-node ${stable ? 'is-out' : 'is-off'}`}>
            {stable ? 'stable' : 'UNSTABLE'}
            <em>{stable ? 'closed loop settles' : 'closed loop runs away'}</em>
          </span>
        </nav>
        <button
          type="button"
          className="ghost fd-open"
          aria-expanded={diagram}
          title="The whole loop as a block diagram — the summing junction, where the disturbance gets in, and the feedback wire that closes it"
          onClick={() => setDiagram(true)}
        >
          ⧉ diagram
        </button>
        {diagram ? (
          <LoopDiagram
            plant={plant}
            plantP={plantP}
            ctrl={ctrl}
            ctrlP={ctrlP}
            stepInput={stepInput}
            stable={stable}
            onInject={(which) => {
              // Choosing an entry point IS the step toggle, and the step view
              // is where its effect shows.
              chooseStepInput(which)
              setLower('step')
            }}
            onReveal={(id) => {
              setDiagram(false)
              reveal(id)
            }}
            onClose={() => setDiagram(false)}
          />
        ) : null}
        <div className="topbar-controls">
          <span className="topbar-field">
            <span>phase margin</span>
            <b className={marg.phaseMargin != null && marg.phaseMargin < 30 ? 'warn' : ''}>
              {marg.phaseMargin == null ? '—' : `${marg.phaseMargin.toFixed(1)}°`}
            </b>
          </span>
          <span className="topbar-field">
            <span>gain margin</span>
            <b className={marg.gainMargin != null && marg.gainMargin < 2 ? 'warn' : ''}>
              {marg.gainMargin == null ? '—' : `${marg.gainMarginDb.toFixed(1)} dB`}
            </b>
          </span>
          <span
            className="topbar-field"
            title={
              marg.gainCrossover == null
                ? 'Where the open-loop gain passes 1'
                : `${fmt(2 * Math.PI * marg.gainCrossover, 'rad/s', 3)} — where the open-loop gain passes 1`
            }
          >
            <span>crossover</span>
            <b>{marg.gainCrossover == null ? '—' : `${fmtHz(marg.gainCrossover)}Hz`}</b>
          </span>
          <span className="topbar-field">
            <span>steady error</span>
            <b>{Math.abs(err) < 1e-9 ? 'none' : `${(err * 100).toFixed(1)}%`}</b>
          </span>
        </div>
      </div>

      <main className="views">
        <section className="view">
          <div className="view-head">
            <h2>Open loop L(s) = C(s)·P(s)</h2>
            <div className="readout">
              {marg.phaseMargin == null ? (
                <span className="prov">gain never reaches 1 — no crossover to measure</span>
              ) : (
                <span>
                  crosses 0 dB at <b>{fmtHz(marg.gainCrossover)}Hz</b>
                  {/* Both unit systems, always: the textbook says rad/s. */}
                  <em className="prov"> = {fmt(2 * Math.PI * marg.gainCrossover, 'rad/s', 3)}</em>
                  <em className="prov"> with {marg.phaseMargin.toFixed(1)}° to spare</em>
                </span>
              )}
              {marg.gainMargin == null ? (
                <span className="prov">phase never reaches −180°</span>
              ) : (
                <span>
                  room for <b>{marg.gainMargin.toFixed(2)}×</b> more gain
                </span>
              )}
            </div>
          </div>
          <BodeCanvas
            freqs={freqs}
            mag={open.mag}
            phase={open.phase}
            showPhase={showPhase}
            crossover={marg.gainCrossover}
            phaseCrossover={marg.phaseCrossover}
          />
        </section>

        <section className="view">
          <div className="view-head">
            <h2>
              {lower === 'step'
                ? stepInput === 'dist'
                  ? 'Response to a disturbance at the plant input'
                  : 'Closed-loop step response'
                : lower === 'nyquist'
                  ? 'Nyquist — the loop against −1'
                  : 'Root locus — poles as the gain sweeps'}
            </h2>
            <div className="readout">
              {lower === 'step' ? (
                <>
                  <div className="segmented sm" role="group" aria-label="Where the step is applied">
                    <button
                      type="button"
                      className={stepInput === 'ref' ? 'on' : ''}
                      aria-pressed={stepInput === 'ref'}
                      title="Change the setpoint and watch the loop follow it"
                      onClick={() => chooseStepInput('ref')}
                    >
                      Reference
                    </button>
                    <button
                      type="button"
                      className={stepInput === 'dist' ? 'on' : ''}
                      aria-pressed={stepInput === 'dist'}
                      title="Shove the plant's input and watch the loop fight back — the reason feedback exists"
                      onClick={() => chooseStepInput('dist')}
                    >
                      Disturbance
                    </button>
                  </div>
                  <span>
                    settles to <b>{fmt(dcGain(stepTf), '', 4)}</b>
                  </span>
                  {stable && !settlesOnScreen(step.y, dcGain(stepTf)) ? (
                    <span className="prov">not there yet at the plot&apos;s right edge</span>
                  ) : null}
                  {stepInput === 'ref' && second && second.overshoot > 0 ? (
                    <span>
                      overshoot <b>{(second.overshoot * 100).toFixed(1)}%</b>
                    </span>
                  ) : null}
                  {stepInput === 'dist' && Math.abs(dcGain(stepTf)) < 1e-9 ? (
                    <span className="flag">rejected completely — the integrator erases it</span>
                  ) : null}
                  {!stable ? <span className="flag warn">diverges</span> : null}
                </>
              ) : lower === 'nyquist' ? (
                <span className="prov">
                  stability is a statement about one point: 1 + L = 0
                </span>
              ) : (
                <span className="prov">
                  crosses into the shaded half and the loop oscillates
                </span>
              )}
            </div>
          </div>
          {lower === 'step' ? (
            <StepCanvas t={step.t} y={step.y} final={dcGain(stepTf)} diverges={!stable} />
          ) : lower === 'nyquist' ? (
            <NyquistCanvas
              re={nyq.re}
              im={nyq.im}
              gainMargin={marg.gainMargin}
              phaseMargin={marg.phaseMargin}
            />
          ) : (
            <PoleZeroCanvas
              poles={openPz.poles}
              zeros={openPz.zeros}
              branches={locus}
              highlight={pz.poles}
            />
          )}
        </section>
      </main>
    </div>
  )
}
