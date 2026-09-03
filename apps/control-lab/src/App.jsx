import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  LabNav,
  LessonNav,
  NumField,
  PoleZeroCanvas,
  ReportIssue,
  TryLine,
  arrivalEvent,
  fmt,
  fmtHz,
  fmtNum,
  track,
} from '@ee-labs/ui'
import { Formula, MathBody } from '@ee-labs/explain'
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
import {
  LESSONS,
  LESSON_GROUPS,
  applyLesson,
  applyChip,
  activeChipOf,
  chipsFor,
  crossingGain,
  isDirty,
} from './lessons.js'
import { initialState } from './boot.js'
import { circuitFor, circuitUrl } from './toCircuitLab.js'
import { stickyDuration } from './stepAxis.js'
import { termsFor } from './terms.js'
import { reportSummary } from './report.js'
import pkg from '../package.json'
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

  // The other half of the hand-over count: the sender counts the click, this
  // counts the arrival. Once per load, and only for a load that came from a link.
  useEffect(() => {
    if (linked.state) track(arrivalEvent('control-lab', linked.state.from))
  }, [linked])

  // A bare visit opens on the first lesson, exactly as clicking it would; a
  // link keeps its own behaviour (boot.js).
  const [boot] = useState(() =>
    initialState(linked.state, typeof window === 'undefined' ? '' : window.location.hash),
  )
  const [plantId, setPlantId] = useState(boot.plantId)
  const [plantP, setPlantP] = useState(boot.plantP)
  const [ctrlId, setCtrlId] = useState(boot.ctrlId)
  const [ctrlP, setCtrlP] = useState(boot.ctrlP)
  const [lower, setLower] = useState(boot.view)
  // What the step is applied TO: the reference (follow a new setpoint) or the
  // plant input (shrug off a shove). Different questions, one loop.
  const [stepInput, setStepInput] = useState(boot.stepInput)
  const [showPhase, setShowPhase] = useState(true)
  // The lesson stays loaded while its knobs are moved — the chip keeps its
  // highlight and a reset appears (LessonNav) once the setup has drifted from
  // the note's. It used to clear on the first touch, which un-highlighted the
  // chip and left no way back but finding it in the list again.
  const [lesson, setLesson] = useState(boot.lesson)
  // Counts lesson loads, so a reset to the SAME lesson still rewinds the
  // watch transport.
  const [loads, setLoads] = useState(0)
  const [termsOpen, setTermsOpen] = useState(false)
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
    setFromInfo(null)
  }
  const chooseCtrl = (id) => {
    setCtrlId(id)
    setCtrlP(defaultsOf(CONTROLLERS[id]))
  }
  // A lesson note describes ONE step input; flipping the toggle marks the
  // lesson dirty like any other control, and the note dims until reset.
  const chooseStepInput = (which) => {
    setStepInput(which)
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
    setLoads((k) => k + 1)
  }

  const active = LESSONS.find((l) => l.name === lesson)
  const activeIndex = LESSONS.findIndex((l) => l.name === lesson)
  // The state a chip or a dirtiness check reads: the loop's setup, not its view.
  const state = { plantId, plantP, ctrlId, ctrlP, stepInput }
  const dirty = isDirty(active, state)
  const applyChipTo = (chip) => {
    const next = applyChip(state, chip)
    setCtrlId(next.ctrlId)
    setCtrlP(next.ctrlP)
    setStepInput(next.stepInput)
    // A chip that flips the step input belongs to a time view.
    if (chip.set?.stepInput && lower !== 'step' && lower !== 'watch') setLower('step')
  }

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
  const scrub = useWatchPosition(WATCH_POINTS, `${lesson}#${loads}`)

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

  const chips = useMemo(
    () => chipsFor(active, state, marg),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, plantId, plantP, ctrlId, ctrlP, stepInput, marg],
  )
  const activeChip = activeChipOf(chips, state)
  const crossing = crossingGain(ctrlId, ctrlP, marg)

  // The lead lesson's ghost: the same loop with the lead taken out, L = K·P,
  // so the phase the network adds is the gap between two curves.
  const ghost = useMemo(() => {
    if (ctrlId !== 'lead') return null
    const bare = bode(series({ b: [ctrlP.k], a: [1] }, loop.plant), freqs)
    return {
      mag: bare.mag,
      phase: bare.phase,
      label: `ghost: K·P(s) without the lead (K = ${fmtNum(ctrlP.k, 3)})`,
    }
  }, [ctrlId, ctrlP, loop, freqs])

  // The hand-over in reverse: only when this plant IS a catalog circuit exactly,
  // and only where Circuit Lab is deployed beside this page (null in dev).
  const circuit = circuitFor(plantId, plantP)
  const circuitHref = circuitUrl(plantId, plantP)

  // The knobs a lesson is about, rendered under its try line so "raise Kp"
  // points at a slider that is on screen — not the plant's Gain K.
  // The knobs a lesson is about. Controller knobs are not duplicated under
  // the try line — the controller card follows it directly, with the
  // featured knob(s) FIRST in the card (Power Lab's knob-order rule), so
  // "raise Kp" points at the first slider on screen and not the plant's
  // Gain K. The one featured control that is not a controller knob, the
  // step toggle, renders under the try line itself.
  const featuredKeys = active?.featured || []
  // Featured first, then the card's own order — except the lead's bare gain
  // K, which follows its zero and pole so "pole, zero, gain" reads as the
  // network it is rather than "pole, gain, zero".
  const featuredRank = (key, i) => {
    const f = featuredKeys.indexOf(key)
    if (f >= 0) return f
    return ctrlId === 'lead' && key === 'k' ? 60 : 10 + i
  }
  const orderedCtrlParams = ctrl.params
    .map((p, i) => ({ p, r: featuredRank(p.key, i) }))
    .sort((a, b) => a.r - b.r)
    .map((x) => x.p)
  const renderStepToggle = () =>
    featuredKeys.includes('disturbance') ? (
      <div className="featured" data-featured="disturbance">
        <div className="segmented sm" role="group" aria-label="Where the step is applied (lesson)">
          <button
            type="button"
            className={stepInput === 'ref' ? 'on' : ''}
            aria-pressed={stepInput === 'ref'}
            onClick={() => chooseStepInput('ref')}
          >
            Reference
          </button>
          <button
            type="button"
            className={stepInput === 'dist' ? 'on' : ''}
            aria-pressed={stepInput === 'dist'}
            onClick={() => chooseStepInput('dist')}
          >
            Disturbance
          </button>
        </div>
      </div>
    ) : null

  const primaryView = active ? active.patch.view || 'step' : null
  const weighted = primaryView != null && primaryView !== 'bode'

  return (
    <div className={`app${active ? ' has-lesson' : ''}`}>
      <aside className="controls">
        <header>
          <LabNav current="control-lab" />
          <h1>Control Lab</h1>
          <p className="sub">
            A plant you are stuck with, a controller you get to choose, and the one point on the
            complex plane that decides whether it works.
          </p>
          <ReportIssue
            lab="Control Lab"
            version={pkg.version}
            state={{ plantId, plantP, ctrlId, ctrlP, stepInput, lower, showPhase, lesson }}
            summary={reportSummary({ plantId, plantP, ctrlId, ctrlP, stepInput, lower, lesson })}
          />
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
          {/* The course's spine rides in the section's sticky cap — prev /
              n of 13 / next, and reset once a knob has moved — so it is on
              screen wherever the sidebar is scrolled, and costs the fold
              nothing. */}
          <h2>
            <span>Try this</span>
            {active ? (
              <LessonNav
                index={activeIndex}
                total={LESSONS.length}
                dirty={dirty}
                onPrev={() => activeIndex > 0 && loadLesson(LESSONS[activeIndex - 1])}
                onNext={() => activeIndex < LESSONS.length - 1 && loadLesson(LESSONS[activeIndex + 1])}
                onReset={() => loadLesson(active)}
              />
            ) : null}
          </h2>
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
                  // The pinned group's toggles are not the reader's: a
                  // details element fires `toggle` when it is CREATED open,
                  // and recording that kept the opening lesson's group open
                  // under every other lesson — 139 px of the fold, gone.
                  if (holdsActive) return
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
              <p className={`hint note${dirty ? ' is-dirty' : ''}`}>
                {active.note}
                {/* Definitions on contact, opened from the note's last line
                    rather than a row of their own: the fold at 1366×768 has
                    no 22 px to spare, and the terms cost nothing to someone
                    who already has them. */}
                {termsFor(active.terms).length ? (
                  <>
                    {' '}
                    <button
                      type="button"
                      className="terms-link"
                      aria-expanded={termsOpen}
                      onClick={() => setTermsOpen((v) => !v)}
                    >
                      {termsOpen ? '▾ terms' : '▸ terms used here'}
                    </button>
                  </>
                ) : null}
              </p>
              {termsOpen && termsFor(active.terms).length ? (
                <dl className="terms-list">
                  {termsFor(active.terms).map((t) => (
                    <React.Fragment key={t.id}>
                      <dt>{t.name}</dt>
                      <dd>{t.def}</dd>
                    </React.Fragment>
                  ))}
                </dl>
              ) : null}
              <TryLine text={active.try} chips={chips} onChip={applyChipTo} activeChip={activeChip} />
              {renderStepToggle()}
            </>
          ) : null}
          {/* The hand-over in reverse. Exact only: a plant with a gain, or
              component values outside Circuit Lab's knobs, draws nothing. */}
          {circuit && circuitHref ? (
            <p className="hint circuit-back">
              This is also a circuit — {circuit.sentence}.{' '}
              <a href={circuitHref} title="The same transfer function, as the circuit it is">
                Open in Circuit Lab →
              </a>
            </p>
          ) : null}
        </section>

        {/* The section names carry the loop's symbols: the topbar strip, the
            block diagram and the math panel all speak C(s) and P(s), and the
            sidebar should say which card is which. The controller card comes
            FIRST: every lesson is about the controller, and the student
            review found "raise Kp" pointing below the fold while the plant's
            Gain K sat in reach — two things called gain, the wrong one
            visible. The plant is what you are stuck with; it follows. */}
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
          {/* The lesson's featured knob(s) first, marked, so the slider the
              try line names is the first one under the header. */}
          {orderedCtrlParams.map((p) => {
            const field = (
              <NumField
                key={p.key}
                label={p.label}
                unit={p.unit}
                value={ctrlP[p.key]}
                onChange={(v) => setCtrlP((s) => ({ ...s, [p.key]: v }))}
                min={p.min}
                max={p.max}
                scale={p.scale}
                eng
              />
            )
            return featuredKeys.includes(p.key) ? (
              <div className="featured" key={p.key} data-featured={p.key}>
                {field}
              </div>
            ) : (
              field
            )
          })}
        </section>

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
                  if (holdsActive) return
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
              onChange={(v) => setPlantP((s) => ({ ...s, [p.key]: v }))}
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

        {/* No View section: the view controls live in the headers of the
            panes they govern, same proximity rule Reed asked of Signal Lab —
            on a phone the sidebar is a full screen away from the plots. */}

        {/* On a short laptop screen with a lesson loaded the header's
            report link yields its 19 px to the fold and reappears here. */}
        <footer className="controls-foot">
          <ReportIssue
            lab="Control Lab"
            version={pkg.version}
            state={{ plantId, plantP, ctrlId, ctrlP, stepInput, lower, showPhase, lesson }}
            summary={reportSummary({ plantId, plantP, ctrlId, ctrlP, stepInput, lower, lesson })}
          />
        </footer>
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

      <main className={`views${weighted ? ' is-weighted' : ''}`}>
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
            ghostMag={ghost?.mag}
            ghostPhase={ghost?.phase}
            ghostLabel={ghost?.label}
          />
        </section>

        <section className={`view${weighted ? ' is-primary' : ''}`}>
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
                    : lower === 'math'
                      ? 'The math — theory against what this loop measures'
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
                { id: 'math', label: 'Math', title: 'Formulas beside the numbers this loop measures' },
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
                  {/* Each term at the cursor, in the DOM as well as on the
                      canvas — so "both parts still working" is a number a
                      probe can read, not a picture it has to trust. */}
                  {watch.parts.length > 1
                    ? watch.parts.map((p) => (
                        <span key={p.key} data-part={p.key}>
                          {p.label} <b>{fmtNum(p.y[Math.min(scrub.pos, p.y.length - 1)], 3)}</b>
                        </span>
                      ))
                    : null}
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
                <>
                  {/* You are here, and where the branch meets the axis — the
                      crossing gain is the current gain times the gain
                      margin, and the test bisects the verdict to pin it. */}
                  {crossing ? (
                    <span data-role="locus-here">
                      you are here: {crossing.label} = <b>{fmtNum(crossing.now, 3)}</b>
                      {' · '}
                      {crossing.crossing > crossing.now ? 'crosses' : 'crossed'} the axis at{' '}
                      {crossing.label} = <b>{fmtNum(crossing.crossing, 4)}</b>
                    </span>
                  ) : (
                    <span className="prov" data-role="locus-here">
                      never crosses — the phase never reaches −180°
                    </span>
                  )}
                  <span className="prov">crosses into the shaded half and the loop oscillates</span>
                </>
              ) : lower === 'math' ? (
                <span className="prov">a tick means the closed form and the live loop agree</span>
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
          ) : lower === 'math' ? (
            <div className="view-body math-pane">
              <MathBody entry={math} />
            </div>
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
