import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  LabNav,
  LessonNav,
  NumField,
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
  margins,
  rootLocus,
  secondOrderMetrics,
  stepResponse,
  dcGain,
  series,
  closeLoop,
} from '@ee-labs/systems'
import { PLANTS, PLANT_GROUPS, CONTROLLERS, buildLoop, defaultsOf, settlesOnScreen, ctrlDefaultsFor } from './systems.js'
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
import { stateFromLink, fromAppName, fromDisplayName } from './fromLink.js'
import BodeCanvas from './components/BodeCanvas.jsx'
import StepCanvas from './components/StepCanvas.jsx'
import NyquistCanvas from './components/NyquistCanvas.jsx'
import LoopDiagram from './components/LoopDiagram.jsx'
import LocusCanvas from './components/LocusCanvas.jsx'
import WatchCanvas, { useWatchPosition, WATCH_SPEEDS } from './components/WatchCanvas.jsx'
import { watchSignals } from './watch.js'
import { verdictOf, oscillationOf, presentMargins, steadyErrorOf } from './verdict.js'
import { leadPeak } from './lead.js'
import { naturalWindow, settleTime } from './stepWindow.js'
import { simBlockReason, simCost, STEP_BUDGET } from './affordable.js'
import { locusExtent, stickyExtent } from './locusFrame.js'

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
  // The lesson a picker click (a different plant or controller entirely,
  // not a knob tuned in place) just stepped away from — so a "back to
  // lesson" link can undo the click without a hunt through the list. A
  // knob move keeps the lesson (dirty, with its own reset); a picker click
  // clears it outright: the note it left behind was for a different setup,
  // and it was hiding the plant/controller's own hint underneath it.
  const [lastLesson, setLastLesson] = useState(null)
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

  // A picker click clears the lesson (remembering it for "back to lesson")
  // rather than leaving its stale note on screen over a setup it no longer
  // describes.
  const clearLesson = () => {
    setLastLesson((prev) => lesson || prev)
    setLesson(null)
  }
  const choosePlant = (id) => {
    const newPlantP = defaultsOf(PLANTS[id])
    setPlantId(id)
    setPlantP(newPlantP)
    // The controller's OWN gains, not the bare registry defaults: the
    // registry's Kp = 1 sits exactly on the unstable plant's boundary
    // (Kp*K = p), and a fast plant's Ki = 1 default put a pole light-years
    // from the rest of the loop. ctrlDefaultsFor picks gains this plant
    // actually opens stable with.
    setCtrlP(ctrlDefaultsFor(id, newPlantP, ctrlId))
    setFromInfo(null)
    clearLesson()
  }
  const chooseCtrl = (id) => {
    setCtrlId(id)
    setCtrlP(ctrlDefaultsFor(plantId, plantP, id))
    clearLesson()
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
    setLastLesson(null)
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
  const margRaw = useMemo(() => margins(loop.open, wideFreqs), [loop, wideFreqs])
  // Erase the float-noise crossover of a loop whose gain is exactly 1 at DC
  // forever (a lead cancelling the plant's own pole): "crossover 8.215 nHz,
  // phase margin 180.0°" against correct physics — there is no crossover to
  // measure, and the picker's own First order x Lead default is exactly
  // this loop.
  const marg = useMemo(() => presentMargins(margRaw, loop.open, freqs[0]), [margRaw, loop, freqs])
  // The one-word judgement: 'stable' | 'marginal' | 'unstable'. A pole
  // sitting exactly on the imaginary axis (the crossing chip's whole point)
  // is neither of the other two — it is a sustained oscillation, its own
  // state, and every pane that used to see only isStable()'s yes/no now
  // reads this instead.
  const verdict = verdictOf(loop.closed, marg)
  const stable = verdict === 'stable'
  const marginal = verdict === 'marginal'
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
    const grow = Math.max(0, ...pz.poles.map(([re]) => re))
    const osc = verdict === 'marginal' ? oscillationOf(loop.closed) : 0
    // The affordability guard naturalWindow needs before it runs its OWN
    // coarse simulation to measure a settle time: a stiff loop must not be
    // asked to simulate itself just to find out it cannot afford to.
    const canSim = (d) => simCost(pz.poles, d) <= STEP_BUDGET
    const natural = naturalWindow(stepTf, { verdict, slow, grow, osc }, canSim)
    const key = `${plantId}|${ctrlId}|${stepInput}|${verdict}`
    const dur = stickyDuration(
      durRef.current.key === key ? durRef.current.dur : NaN,
      natural,
    )
    durRef.current = { key, dur }
    return dur
  }, [pz, plantId, ctrlId, stepInput, verdict, loop, stepTf])

  // The reasons a time simulation is declined, shared by step and watch.
  const simBlocked = useMemo(() => simBlockReason(loop.open, pz.poles, duration), [loop, pz, duration])
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

  // The locus's own frame: fitted to the open-loop poles/zeros and the
  // closed-loop poles AT THIS GAIN, not to the branches — a sweep to 100x
  // gain runs some branches to hundreds of rad/s, and framing every point
  // on them parked an unstable-plant loop with poles inside ±4 on a ±300
  // axis as a dot. Sticky the same way the step and frequency axes are, so
  // dragging the gain moves the crosses and not the axis.
  const locusExtentRef = useRef(null)
  const locusFrameExtent = useMemo(() => {
    if (lower !== 'locus') return locusExtentRef.current || 4
    const natural = locusExtent(openPz.poles, openPz.zeros, pz.poles)
    const next = stickyExtent(locusExtentRef.current, natural)
    locusExtentRef.current = next
    return next
  }, [lower, openPz, pz])

  const math = useMemo(
    () => loopMath(plantId, plantP, ctrlId, ctrlP, loop, marg, freqs),
    [plantId, plantP, ctrlId, ctrlP, loop, marg, freqs],
  )

  const err = 1 - dcGain(loop.closed)
  // The top bar's own field: '—' with a reason for a loop that never
  // settles, rather than "200%" or "−Infinity%" printed against physics
  // that has nothing to report.
  const errInfo = steadyErrorOf(loop.closed, verdict)

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
              {fromInfo
                ? `your "${fromDisplayName(fromInfo)}" arrived from ${fromAppName(fromInfo)} as the plant.`
                : 'this plant came from another tool in the suite.'}{' '}
              Pick anything below to start over.
            </p>
          ) : null}
          {/* A picker click (a different plant or controller, not a knob
              tuned in place) clears the lesson rather than leaving its note
              stranded over a setup it no longer describes — this is the way
              back, in one click, without a hunt through the list. */}
          {!active && lastLesson ? (
            <p className="hint back-to-lesson">
              <button
                type="button"
                className="lesson-link"
                onClick={() => loadLesson(LESSONS.find((l) => l.name === lastLesson))}
              >
                ↩ back to lesson
              </button>{' '}
              — {lastLesson}
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
          {/* Two blocks, same shape as Circuit Lab's lesson-list / lesson-body:
              the fold-out group list, and the active lesson's own note/try
              line/knobs. On a phone (styles.css) the body renders ABOVE the
              list — a fresh load otherwise left the note and try line below
              the 338 px sidebar's own visible box, with only a lesson list
              and a plot on screen. */}
          <div className="lesson-list">
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
          </div>
          {active ? (
            <div className="lesson-body">
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
              {/* The last lesson used to just disable Next and leave it at
                  that — a dead end with no next move offered. */}
              {activeIndex === LESSONS.length - 1 ? (
                <p className="hint course-end">
                  That is the course.{' '}
                  {circuit && circuitHref ? (
                    <a href={circuitHref}>Open Circuit Lab →</a>
                  ) : (
                    <button type="button" className="lesson-link" onClick={() => loadLesson(LESSONS[0])}>
                      ↩ back to lesson 1
                    </button>
                  )}
                </p>
              ) : null}
            </div>
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
            // A lesson may clamp a knob's range tighter than the controller's
            // own (the lead lesson keeps its pole above its zero — below it
            // the network is a lag, a different lesson, and the note would
            // go quietly false). The picker's own range stands outside a
            // lesson.
            const lessonRange = active?.ranges?.[p.key]?.(ctrlP)
            const field = (
              <NumField
                key={p.key}
                label={p.label}
                unit={p.unit}
                value={ctrlP[p.key]}
                onChange={(v) => setCtrlP((s) => ({ ...s, [p.key]: v }))}
                min={lessonRange?.min ?? p.min}
                max={lessonRange?.max ?? p.max}
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
              <p className="hint">{typeof plant.hint === 'function' ? plant.hint(plantP) : plant.hint}</p>
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
          <span className={`flow-node ${stable ? 'is-out' : marginal ? 'is-warn' : 'is-off'}`}>
            {stable ? 'stable' : marginal ? 'ON THE BOUNDARY' : 'UNSTABLE'}
            {/* Two renderings of the same verdict, toggled by CSS (styles.css):
                the full sentence on a wide screen, and on phone the short
                verdict word — the sentence used to sit inside .flow's own
                horizontal scrollbox, invisible past "stable closed loo"
                unless the reader thought to scroll that one mini-strip. */}
            <em>
              <span className="flow-note-full">
                {stable
                  ? 'closed loop settles'
                  : marginal
                    ? 'sustained oscillation — neither settles nor runs away'
                    : 'closed loop runs away'}
              </span>
              <span className="flow-note-short">
                {stable ? 'settles' : marginal ? 'oscillates' : 'runs away'}
              </span>
            </em>
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
          <span className="topbar-field" title={errInfo.title}>
            <span>steady error</span>
            <b>{errInfo.text}</b>
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
                <span className="prov">{marg.crossoverNote || 'gain never reaches 1 — no crossover to measure'}</span>
              ) : (
                <span>
                  crosses 0 dB at <b>{fmtHz(marg.gainCrossover)}Hz</b>
                  {/* Both unit systems, always: the textbook says rad/s. */}
                  <em className="prov"> = {fmt(2 * Math.PI * marg.gainCrossover, 'rad/s', 3)}</em>
                  <em className="prov"> with {marg.phaseMargin.toFixed(1)}° to spare</em>
                </span>
              )}
              {marginal ? (
                // The crossing chip's exact point: a gain margin of ~1× read
                // as "room for 1.00× more gain" against a loop that IS the
                // boundary — the sentence has to say that instead.
                <span className="prov">no room — this gain is the boundary</span>
              ) : marg.gainMargin == null ? (
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
              {/* The lead network's own number — the try line quotes it,
                  because the loop's phase margin is NOT monotone in the
                  pole (it dips, then rises, as the pole passes the zero),
                  while what the network itself adds is. */}
              {ctrlId === 'lead'
                ? (() => {
                    const lp = leadPeak(ctrlP.z, ctrlP.p)
                    if (!lp) return null
                    return (
                      <span className="prov">
                        {lp.kind === 'lag' ? 'lag subtracts' : 'lead adds'} up to{' '}
                        <b>{Math.abs(lp.phiMax).toFixed(1)}°</b> at √(zp) = {fmtHz(lp.f)}Hz
                      </span>
                    )
                  })()
                : null}
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
                  {/* MEASURED off the sampled trace, the same 2% band the
                      dashed line and shaded band on the plot mark — never a
                      number quoted from a pole location alone. */}
                  {stable && step
                    ? (() => {
                        const ts = settleTime(step.t, step.y, dcGain(stepTf))
                        return ts != null ? (
                          <span className="prov">
                            settles in <b>{fmt(ts, 's', 3)}</b> (2% band)
                          </span>
                        ) : null
                      })()
                    : null}
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
                  {marginal ? (
                    // The crossing chip's own destination: the poles sit
                    // exactly on the axis, and "crosses"/"crossed" reads
                    // wrong for a gain that IS the crossing.
                    <span data-role="locus-here">you are here: on the axis — sustained oscillation</span>
                  ) : crossing ? (
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
                // What the loop was ASKED to do — 1, for a reference step —
                // distinct from where it settles. A disturbance step asks
                // for nothing; the loop's whole job there is to hold zero.
                reference={stepInput === 'ref' ? 1 : null}
                diverges={!stable}
                resetKey={`${plantId}|${ctrlId}|${stepInput}`}
                // The same unfiltered-derivative kick the watch view marks:
                // a reference step meets Kd·ė as a jump at t = 0, and the
                // step plot used to just show the discontinuity with no
                // word about why.
                caption={
                  ctrlId === 'pid' && stepInput === 'ref' && ctrlP.kd > 0
                    ? "unfiltered Kd·s: derivative kick at t = 0"
                    : null
                }
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
            <LocusCanvas
              poles={openPz.poles}
              zeros={openPz.zeros}
              branches={locus}
              highlight={pz.poles}
              extent={locusFrameExtent}
              gainLabel={crossing?.label ?? (ctrlId === 'lead' ? 'Kc' : 'Kp')}
              verdict={verdict}
            />
          )}
        </section>
      </main>
    </div>
  )
}
