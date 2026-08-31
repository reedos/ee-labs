import React, { useMemo, useRef, useState } from 'react'
import { LabNav, NumField, PoleZeroCanvas, fmt, fmtHz, fmtNum } from '@ee-labs/ui'
import { Formula, MathPanel } from '@ee-labs/explain'
import {
  bode,
  evalAtFreq,
  polesZeros,
  isStable,
  margins,
  rootLocus,
  secondOrderMetrics,
  stepResponse,
  dcGain,
  series,
  closeLoop,
} from '@ee-labs/systems'
import { PLANTS, PLANT_GROUPS, CONTROLLERS, buildLoop, defaultsOf, settlesOnScreen } from './systems.js'
import { loopMath } from './math.js'
import { LESSONS, LESSON_GROUPS, applyLesson } from './lessons.js'
import { stickyDuration } from './stepAxis.js'
import { termsFor } from './terms.js'
import { nextFrame } from './frame.js'
import { readLocationLink } from '@ee-labs/ui'
import { stateFromLink } from './fromLink.js'
import BodeCanvas from './components/BodeCanvas.jsx'
import StepCanvas from './components/StepCanvas.jsx'
import NyquistCanvas from './components/NyquistCanvas.jsx'
import LoopDiagram from './components/LoopDiagram.jsx'
import WatchCanvas, { useWatchPosition, WATCH_SPEEDS } from './components/WatchCanvas.jsx'
import { watchSignals } from './watch.js'

const POINTS = 900
// The watch view's time grid. Fixed, so the scrubber's range never shifts
// under the reader while gains are dragged mid-scrub.
const WATCH_POINTS = 600

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
  // The plant groups fold the same way — Reed asked for the sidebar to match
  // the other labs: hideable choice groups everywhere, active group pinned.
  const [openPlantGroups, setOpenPlantGroups] = useState(() => new Set())
  const [diagram, setDiagram] = useState(false)
  // The circuit this plant arrived AS ("circuit:rlc:My RLC"), kept while the
  // plant is still that arrival — tuning its params keeps the identity,
  // choosing a different plant sheds it.
  const [fromInfo, setFromInfo] = useState(linked.state?.from ?? null)

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
    setFromInfo(null)
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
  // Margins are measured on a far WIDER grid than the plot. The display
  // window frames the loop's own corners, but gain moves the crossover and
  // not the window — at Kp = 1000 on a one-pole plant the true crossover sat
  // two decades past the right edge, and a crossover the grid could not see
  // was reported as "gain never reaches 1" against correct physics.
  const wideFreqs = useMemo(() => {
    const centre = Math.sqrt(freqs[0] * freqs[freqs.length - 1])
    const lo = Math.log10(centre) - 8
    return Float64Array.from({ length: 1600 }, (_, i) => Math.pow(10, lo + (16 * i) / 1599))
  }, [freqs])
  const marg = useMemo(() => margins(loop.open, wideFreqs), [loop, wideFreqs])
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

  // Long enough to see it settle — and STICKY while gains are tuned, so the
  // curve moves across a held time axis instead of the axis chasing the
  // curve (Reed's report; the rules and their tests live in stepAxis.js).
  // It reframes for a new plant/controller/step-input, for a response that
  // would settle off screen, or for one shrunk into the left sixth.
  const durRef = useRef({ key: '', dur: 0 })
  const duration = useMemo(() => {
    const slow = Math.min(
      ...pz.poles.filter(([re]) => Math.abs(re) > 1e-9).map(([re]) => Math.abs(re)),
    )
    let natural = Number.isFinite(slow) && slow > 0 ? Math.min(12 / slow, 400) : 20
    // An unstable loop keyed to its SLOWEST pole overflowed float range
    // eleven samples into a 400 s window — the trace just stopped, and the
    // "axis zooming out with the runaway" story never got to happen. Key the
    // window to the runaway instead: ~25 growth constants fills the pane
    // with the divergence this view exists to show, at e^25 ≈ 7e10 — big,
    // and finite.
    const grow = Math.max(0, ...pz.poles.map(([re]) => re))
    if (grow > 1e-9) natural = Math.min(natural, 25 / grow)
    const key = `${plantId}|${ctrlId}|${stepInput}|${grow > 1e-9 ? 'runaway' : 'settling'}`
    const dur = stickyDuration(
      durRef.current.key === key ? durRef.current.dur : NaN,
      natural,
    )
    durRef.current = { key, dur }
    return dur
  }, [pz, plantId, ctrlId, stepInput])

  // The reasons a time simulation is declined, shared by step and watch.
  // Affordability: RK4 sub-steps scale as duration × the fastest closed
  // pole, and the two ends of that product are set independently — a slow
  // pole stretches the window while a fast one shrinks the sub-step, and
  // slider-interior values reached 6.4 s per keystroke (extremes: hours).
  // Degeneracy: a custom plant with an all-zero denominator is not a system,
  // and simulating it painted NaN strips. The frequency panes are exact
  // regardless; only the time simulations need declining, with the reason.
  const simBlocked = useMemo(() => {
    if (!loop.open.a.length || !loop.open.a.some((v) => v !== 0)) {
      return 'This H(s) has an all-zero denominator — not a system yet. Give a₂, a₁ or a₀ a value.'
    }
    const fastest = Math.max(0, ...pz.poles.map(([re, im]) => Math.hypot(re, im)))
    if ((duration * fastest) / 0.08 + 900 > 2.5e6) {
      return (
        'Too stiff to simulate: this loop mixes a pole fast enough to set the integration ' +
        'step with one slow enough to set the window, and the product is millions of steps ' +
        'per frame. The frequency views above are exact regardless — they need no integration.'
      )
    }
    return null
  }, [loop, pz, duration])
  const simAffordable = simBlocked == null

  const step = useMemo(
    // Computed only for the pane that shows it — this ran on every keystroke
    // in every view once, which is what made the freeze universal.
    () => (lower === 'step' && simAffordable ? stepResponse(stepTf, { duration, points: 900 }) : null),
    [lower, simAffordable, stepTf, duration],
  )

  // The loop's internal signals, for the watch view: the error the controller
  // sees and the effort it answers with, part by part. Only computed while
  // that view is on screen — it is several extra simulations.
  const watch = useMemo(
    () =>
      lower === 'watch' && simAffordable
        ? watchSignals(loop, ctrlId, ctrlP, stepInput, { duration, points: WATCH_POINTS })
        : null,
    [lower, simAffordable, loop, ctrlId, ctrlP, stepInput, duration],
  )
  const scrub = useWatchPosition(WATCH_POINTS, lesson)

  // The locus of closed-loop poles as the loop gain is swept, with the poles at
  // the CURRENT gain marked on it.
  const locus = useMemo(() => {
    if (lower !== 'locus') return []
    // Sweep to 100x, not 1000x: the far branches only stretch the frame, and
    // at 1000x the fan the lesson exists to show was a sliver around the
    // origin. Every plant here crosses (or provably never crosses) the axis
    // well inside two decades of extra gain.
    const gains = Array.from({ length: 160 }, (_, i) => Math.pow(10, -2 + (4 * i) / 159))
    const sweep = rootLocus(loop.open, gains)
    const n = Math.max(...sweep.map((s) => s.poles.length))
    const branches = Array.from({ length: n }, () => [])
    // Keep each branch continuous by ACTUALLY matching each pole to the
    // nearest one on the previous step. The first cut said it did this and
    // sorted by value instead, which swaps branch identity wherever a real
    // pair meets and splits into a complex one — spaghetti at exactly the
    // breakaway points the plot exists to show.
    let prev = null
    for (const s of sweep) {
      const cur = [...s.poles]
      let order
      if (!prev) {
        order = cur.sort((a, b) => a[0] - b[0] || a[1] - b[1])
      } else {
        order = new Array(n)
        const used = new Set()
        for (let i = 0; i < n; i++) {
          if (!prev[i]) continue
          let best = -1
          let bd = Infinity
          for (let j = 0; j < cur.length; j++) {
            if (used.has(j)) continue
            const d = Math.hypot(cur[j][0] - prev[i][0], cur[j][1] - prev[i][1])
            if (d < bd) {
              bd = d
              best = j
            }
          }
          if (best >= 0) {
            order[i] = cur[best]
            used.add(best)
          }
        }
      }
      for (let i = 0; i < n; i++) if (order[i]) branches[i].push(order[i])
      prev = order
    }
    return branches
  }, [lower, loop])

  const math = useMemo(
    () => loopMath(plantId, plantP, ctrlId, ctrlP, loop, marg, freqs),
    [plantId, plantP, ctrlId, ctrlP, loop, marg, freqs],
  )

  const err = 1 - dcGain(loop.closed)

  return (
    <div className="app">
      <aside className="controls">
        <header>
          <LabNav current="control-lab" />
          <h1>Control Lab</h1>
          <p className="sub">
            A plant you are stuck with, a controller you get to choose, and the one point on the
            complex plane that decides whether it works.
          </p>
        </header>

        <section id="lessons">
          {linked.state ? (
            <p className="hint from-link">
              Loaded from a link —{' '}
              {fromInfo?.label
                ? `your “${fromInfo.label}” arrived from ${fromInfo.app === 'circuit' ? 'Circuit Lab' : 'another tool'} as the plant.`
                : 'this plant came from another tool in the suite.'}{' '}
              Pick anything below to start over.
            </p>
          ) : null}
          {/* The arrival orientation Reed asked for after reading his RC's
              closed-loop step as a bug: whose step this is, and where the
              steady error he is looking at comes from. The number printed is
              the measured one from the top bar; the math panel's check row
              measures it against 1/(1+L(0)). */}
          {linked.state && stable ? (
            <p className="hint from-link">
              What the step view shows is the CLOSED LOOP — your circuit alone would settle at
              its own DC gain with nothing left over. Here the plant is driven by C(s) × the
              error, so{' '}
              {Math.abs(err) < 1e-9
                ? 'with an integrator in the loop the error is erased exactly: steady error none.'
                : `the ${(err * 100).toFixed(1)}% steady error in the top bar is the loop's doing — e_ss = 1/(1+L(0)) — not the circuit's. Switch to PI to erase it.`}
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
          {active ? (
            <>
              <h3 className="note-title">{active.name}</h3>
              <p className="hint">{active.note}</p>
            </>
          ) : null}
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

        {/* The section names carry the loop's symbols: the topbar strip, the
            block diagram and the math panel all speak C(s) and P(s), and the
            sidebar should say which card is which. */}
        <section id="plant">
          <h2>Plant — P(s)</h2>
          {PLANT_GROUPS.map((g) => {
            const inGroup = Object.entries(PLANTS).filter(([, p]) => p.group === g)
            if (!inGroup.length) return null
            const holdsActive = inGroup.some(([key]) => key === plantId)
            return (
              <details
                className="preset-group"
                key={g}
                open={holdsActive || openPlantGroups.has(g)}
                onToggle={(e) => {
                  const next = new Set(openPlantGroups)
                  if (e.target.open) next.add(g)
                  else next.delete(g)
                  setOpenPlantGroups(next)
                }}
              >
                {/* preventDefault while active, same as the lesson groups:
                    React skips rewriting an unchanged open attribute, so the
                    native toggle would fold the active plant away. */}
                <summary onClick={holdsActive ? (e) => e.preventDefault() : undefined}>
                  {g}
                  {holdsActive ? <span className="group-active-dot" aria-hidden="true" /> : null}
                </summary>
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
              </details>
            )
          })}
          {active ? null : (
            <>
              <h3 className="note-title">{plant.name}</h3>
              <p className="hint">{plant.hint}</p>
            </>
          )}
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
              // Linear-scale fields snap TYPED values to their step, and the
              // default step of 1 silently turned a coefficient of 1e-4 into
              // 0 — caught in the first screenshot of the live formula. The
              // custom plant's params carry a 1e-12 step for this reason.
              step={p.step}
              compact={!!p.compact}
              eng
            />
          ))}
          {/* A plant whose formula is built from its live values (the custom
              plant) shows the equation being defined RIGHT HERE, as the
              coefficients are typed — not two folds away in the math panel. */}
          {typeof plant.tex === 'function' ? (
            <div className="live-tf" aria-label="The transfer function these coefficients define">
              <Formula>{plant.tex(plantP)}</Formula>
            </div>
          ) : null}
        </section>

        <section id="controller">
          <h2>Controller — C(s)</h2>
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
          {active ? null : (
            <>
              <h3 className="note-title">{ctrl.name}</h3>
              <p className="hint">{ctrl.hint}</p>
            </>
          )}
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

        {/* No View section: the view controls live in the headers of the
            panes they govern, same proximity rule Reed asked of Signal Lab —
            on a phone the sidebar is a full screen away from the plots. */}
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
            ctrlId={ctrlId}
            from={fromInfo}
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
            {/* This pane's one control, next to the pane it changes. */}
            <div className="segmented sm" role="group" aria-label="Phase overlay">
              <button
                type="button"
                className={showPhase ? '' : 'on'}
                aria-pressed={!showPhase}
                onClick={() => setShowPhase(false)}
              >
                no phase
              </button>
              <button
                type="button"
                className={showPhase ? 'on' : ''}
                aria-pressed={showPhase}
                title="The half of the response the magnitude curve cannot show"
                onClick={() => setShowPhase(true)}
              >
                phase
              </button>
            </div>
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
              ) : marg.gainMargin >= 1 ? (
                <span>
                  room for <b>{marg.gainMargin.toFixed(2)}×</b> more gain
                </span>
              ) : (
                // "Room for 0.14× more gain" read as an invitation. Below 1
                // the margin is a debt, and the sentence must point DOWN.
                <span>
                  past the boundary — it sits at <b>{marg.gainMargin.toFixed(2)}×</b> this gain
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
                : lower === 'watch'
                  ? stepInput === 'dist'
                    ? 'The loop fighting a shove, watched'
                    : 'The loop closing the gap, watched'
                  : lower === 'nyquist'
                    ? 'Nyquist — the loop against −1'
                    : 'Root locus — the closed-loop poles, as the gain K sweeps'}
            </h2>
            {/* The view switch lives on the pane it switches — the same
                proximity rule as Signal Lab's spectrum controls. */}
            <div className="segmented sm" role="group" aria-label="Lower view">
              {[
                { id: 'step', label: 'Step' },
                { id: 'watch', label: 'Watch', title: 'Scrub or play through the step and watch the error drive the controller' },
                { id: 'nyquist', label: 'Nyquist' },
                { id: 'locus', label: 'Root locus' },
              ].map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={lower === v.id ? 'on' : ''}
                  aria-pressed={lower === v.id}
                  title={v.title}
                  onClick={() => setLower(v.id)}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <div className="readout">
              {lower === 'step' || lower === 'watch' ? (
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
              ) : null}
              {lower === 'watch' && watch ? (
                <>
                  <span>
                    e now <b>{fmtNum(watch.e[Math.min(scrub.pos, watch.e.length - 1)], 3)}</b>
                  </span>
                  <span>
                    u now <b>{fmtNum(watch.u[Math.min(scrub.pos, watch.u.length - 1)], 3)}</b>
                  </span>
                  {!stable ? <span className="flag warn">never settles</span> : null}
                </>
              ) : null}
              {lower === 'step' ? (
                <>
                  {/* A destination only exists for a loop that is going
                      somewhere: "settles to 1" beside a "diverges" flag was
                      the readout arguing with itself. */}
                  {stable ? (
                    <span>
                      settles to <b>{fmtNum(dcGain(stepTf), 4)}</b>
                    </span>
                  ) : null}
                  {stable && step && !settlesOnScreen(step.y, dcGain(stepTf)) ? (
                    <span className="prov">not there yet at the plot&apos;s right edge</span>
                  ) : null}
                  {/* Overshoot MEASURED off the trace being drawn, so the
                      number and the picture cannot disagree. The ζ-only
                      closed form ignored closed-loop zeros: a PI loop drew a
                      29.8% peak beside a readout claiming 16.3%. */}
                  {stepInput === 'ref' && stable && step
                    ? (() => {
                        const final = dcGain(stepTf)
                        if (!(Math.abs(final) > 1e-12)) return null
                        let pk = -Infinity
                        for (let i = 0; i < step.y.length; i++) if (step.y[i] > pk) pk = step.y[i]
                        const over = (pk - final) / Math.abs(final)
                        return over > 0.005 ? (
                          <span>
                            overshoot <b>{(over * 100).toFixed(1)}%</b>
                          </span>
                        ) : null
                      })()
                    : null}
                  {stepInput === 'dist' && Math.abs(dcGain(stepTf)) < 1e-9 ? (
                    <span className="flag">rejected completely — the integrator erases it</span>
                  ) : null}
                  {!stable ? <span className="flag warn">never settles</span> : null}
                </>
              ) : lower === 'nyquist' ? (
                <span className="prov">
                  stability is a statement about one point: 1 + L = 0
                </span>
              ) : lower === 'locus' ? (
                <span className="prov">
                  crosses into the shaded half and the loop oscillates
                </span>
              ) : null}
            </div>
          </div>
          {lower === 'watch' && !watch ? (
            <p className="hint" data-role="sim-too-stiff">
              {simBlocked}
            </p>
          ) : lower === 'watch' && watch ? (
            <>
              <div className="conv-bar">
                <button type="button" className="ghost" onClick={scrub.play}>
                  {scrub.playing ? '⏸ pause' : '▶ play'}
                </button>
                <input
                  type="range"
                  min={0}
                  max={WATCH_POINTS - 1}
                  value={Math.min(WATCH_POINTS - 1, scrub.pos)}
                  aria-label="Moment in the response"
                  onChange={(e) => {
                    scrub.setPlaying(false)
                    scrub.setPos(Number(e.target.value))
                  }}
                />
                <div className="segmented sm conv-speed" role="group" aria-label="Playback speed">
                  {WATCH_SPEEDS.map((v) => (
                    <button
                      key={v}
                      type="button"
                      className={scrub.speed === v ? 'on' : ''}
                      aria-pressed={scrub.speed === v}
                      onClick={() => scrub.setSpeed(v)}
                    >
                      {v < 1 ? `${v}×`.replace('0.25', '¼').replace('0.5', '½') : `${v}×`}
                    </button>
                  ))}
                </div>
              </div>
              <WatchCanvas
                t={watch.t}
                input={watch.input}
                y={watch.y}
                e={watch.e}
                u={watch.u}
                parts={watch.parts}
                kick={watch.kick}
                pos={scrub.pos}
                dist={stepInput === 'dist'}
                diverges={!stable}
              />
            </>
          ) : lower === 'step' ? (
            step ? (
              <StepCanvas
                t={step.t}
                y={step.y}
                final={dcGain(stepTf)}
                diverges={!stable}
                resetKey={`${plantId}|${ctrlId}|${stepInput}`}
              />
            ) : (
              <p className="hint" data-role="sim-too-stiff">
                {simBlocked}
              </p>
            )
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
