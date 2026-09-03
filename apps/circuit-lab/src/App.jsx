import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  COLORS,
  LabNav,
  LessonNav,
  NumField,
  PoleZeroCanvas,
  ReportIssue,
  TryLine,
  fmt,
  fmtHz,
  fmtNum,
  readCircuitLink,
  track,
  arrivalEvent,
} from '@ee-labs/ui'
import { MathBody } from '@ee-labs/explain'
import {
  bode,
  magnitudeAt,
  phaseAt,
  polesZeros,
  secondOrderMetrics,
  stepResponse,
  dcGain,
  isStable,
} from '@ee-labs/systems'
import { CIRCUITS, CIRCUIT_GROUPS, defaultsOf, transferOf } from './circuits.js'
import { stateFromLink } from './incoming.js'
import { circuitMath } from './math.js'
import {
  LESSONS,
  LESSON_GROUPS,
  START_LESSON,
  applyLesson,
  chipSetup,
  featuredId,
  matchingChip,
  sameSetup,
} from './lessons.js'
import { TOLERANCES, responseBand, stepBand, toleranceCloud, tolsOf, spreadPct } from './tolerance.js'
import { TERMS, termsFor } from './terms.js'
import { dampingWord, stepReadout } from './stepReadout.js'
import {
  axisFreqs,
  ensureSampled,
  stickyCentre,
  stickyDuration,
  stickyRange,
  stickySpan,
} from './axis.js'
import { describeRoots } from './pzText.js'
import { reportSummary } from './report.js'
import { asFraction } from './fraction.js'
import pkg from '../package.json'
import Schematic from './schematics.jsx'
import HandOver, { SignalLabLink } from './components/HandOver.jsx'
import BodeCanvas from './components/BodeCanvas.jsx'
import StepCanvas from './components/StepCanvas.jsx'

const POINTS = 600

export default function App() {
  // A circuit handed over from Circuit Elements Lab, read once at startup and
  // checked against the catalog (incoming.js) before it becomes state.
  const [linked] = useState(() => {
    const { patch, warnings } = readCircuitLink()
    const { state, warnings: more } = stateFromLink(patch)
    return { state, warnings: [...warnings, ...more] }
  })
  // The other half of the hand-over count: the sender counts the click, this
  // counts the arrival. Once per load, and only for a load that came from a link.
  useEffect(() => {
    if (linked.state) track(arrivalEvent('circuit-lab', linked.state.from))
  }, [linked])

  // The course starts itself. With no link to honour, the lab opens on the
  // corner lesson exactly as clicking it would — a curve that moves when you
  // touch R — rather than as a bare instrument the student has to know to
  // unfold. An arriving link still wins: it names a circuit, not a lesson.
  const [start] = useState(() => {
    if (linked.state) return { ...linked.state, view: 'step', tols: 0, lesson: null }
    const l = LESSONS.find((x) => x.name === START_LESSON)
    return { ...applyLesson(l), lesson: l.name }
  })

  const [id, setId] = useState(start.id)
  const [params, setParams] = useState(() => start.params)
  const [output, setOutput] = useState(start.output)
  // How honest the parts are, PER PART: { paramKey: ±fraction }. Empty means
  // the textbook world of exact values; a board is never all one grade, and
  // which spec suffers depends on which part wobbles.
  const [tols, setTols] = useState(() => tolsOf(start.id, start.tols))
  const [showPhase, setShowPhase] = useState(true)
  const [lower, setLower] = useState(start.view)
  // Which lesson is loaded. A knob moved by hand no longer clears it: the
  // lesson stays the place you are (its chip lit, prev/next still counting)
  // and the note is flagged stale instead, with a reset back to the setup it
  // describes. Picking a circuit from the Circuits list is the one move that
  // leaves the course.
  const [lesson, setLesson] = useState(start.lesson)
  // The lesson a Circuits click left: the nav strip keeps counting from it
  // and offers the way back, so picking a circuit to poke at is a detour
  // rather than a silent exit from the course.
  const [lastLesson, setLastLesson] = useState(null)
  // Bumped when a lesson loads, and part of every sticky-axis key: a lesson's
  // defaults define its frames, whatever the previous setup had held.
  const frameNonce = useRef(0)
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
    if (lesson) setLastLesson(lesson)
    setLesson(null)
  }
  const setParam = (key, value) => setParams((p) => ({ ...p, [key]: value }))
  const chooseOutput = (key) => setOutput(key)
  const chooseTol = (key, value) => setTols((t) => ({ ...t, [key]: value }))
  const chooseAllTol = (value) => {
    const next = {}
    for (const p of circuit.params) next[p.key] = value
    setTols(next)
  }

  const applySetup = (next) => {
    setId(next.id)
    setParams(next.params)
    setOutput(next.output || CIRCUITS[next.id].outputs[0].key)
    setTols(tolsOf(next.id, next.tols))
  }
  const loadLesson = (l) => {
    const next = applyLesson(l)
    frameNonce.current++
    applySetup(next)
    setLower(next.view)
    setLesson(l.name)
    setLastLesson(null)
  }

  const active = LESSONS.find((l) => l.name === lesson)
  const lessonIndex = active ? LESSONS.indexOf(active) : -1
  const parked = !active && lastLesson ? LESSONS.find((l) => l.name === lastLesson) : null
  const parkedIndex = parked ? LESSONS.indexOf(parked) : -1
  const setup = useMemo(() => ({ id, params, output, tols }), [id, params, output, tols])
  // "Dirty" is derived, not flagged: the setup on screen is compared with the
  // lesson's own, so a chip that lands back on the lesson's values clears it
  // as surely as the reset button does.
  const dirty = active ? !sameSetup(setup, applyLesson(active)) : false
  const activeChip = active ? matchingChip(active, setup) : null
  // A chip is the LESSON's setup with the chip on top — never the current
  // one, so two chips in a row do not compound (lessons.js, chipSetup).
  const onChip = (chip) => applySetup(chipSetup(active, chip))

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
    const key = `${id}/${output}/${frameNonce.current}`
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
    const key = `${id}/${output}/${frameNonce.current}`
    const held = stepAxisRef.current.key === key ? stepAxisRef.current.duration : 0
    const d = stickyDuration(held, naturalDuration)
    stepAxisRef.current.key = key
    stepAxisRef.current.duration = d
    return d
  }, [id, output, naturalDuration])
  const step = useMemo(() => {
    // Affordability gate, the same one sineResponse applies: RK4 sub-steps
    // scale as duration × the fastest pole, and a slider-legal 1 MΩ tank at
    // Q ≈ 3e5 asks for ~4e7 of them — a tab frozen for half a minute per
    // keystroke. Null means "too stiff to simulate", and the pane says so.
    const fastest = Math.max(0, ...pz.poles.map(([re, im]) => Math.hypot(re, im)))
    if ((stepDuration * fastest) / 0.08 + 900 > 2e6) return null
    return stepResponse(tf, { duration: stepDuration, points: 900 })
  }, [tf, stepDuration, pz])

  const markers = useMemo(() => {
    const out = []
    if (metrics) out.push({ f: metrics.w0 / (2 * Math.PI), label: 'f₀' })
    else if (second) out.push({ f: second.f0, label: 'f₀' })
    else {
      // A first-order corner, named as the note names it — the cutoff, with
      // its value — rather than as the pole it also is.
      for (const [re, im] of pz.poles) {
        const w = Math.hypot(re, im)
        if (w > 1e-9) out.push({ f: w / (2 * Math.PI), label: `f_c = ${fmtHz(w / (2 * Math.PI))}Hz` })
      }
    }
    return out
  }, [metrics, second, pz])

  const gain = dcGain(tf)
  const stable = isStable(tf)

  // A response with no poles and no zeros is a flat line, and a flat line
  // with nothing written on it reads as empty chrome. Say what it is: the
  // gain as the ratio it is, and the phase it holds at every frequency.
  const annotations = useMemo(() => {
    if (pz.poles.length || pz.zeros.length || !Number.isFinite(gain) || gain <= 0) return []
    const frac = asFraction(gain)
    const db = 20 * Math.log10(gain)
    return [
      {
        db,
        text: `H = ${frac ?? fmtNum(gain, 3)} = ${db.toFixed(2).replace('-', '−')} dB at every frequency`,
      },
      { deg: 0, text: 'phase = 0°' },
    ]
  }, [pz, gain])

  // Marks pinned to a POINT (frequency, value) — the numbers the notes are
  // about, drawn where they happen: a first-order corner's −3.01 dB and
  // ±45° (the inverting amplifier's 135° too), and the tank's peak, which
  // reads R in ohms next to the dBΩ axis that hides it.
  const isZ = output === 'z'
  const points = useMemo(() => {
    const out = []
    const dbOf = (m) => 20 * Math.log10(m)
    const minus = (t) => t.replace('-', '−')
    if (metrics && isZ) {
      const f0 = metrics.w0 / (2 * Math.PI)
      const m = magnitudeAt(tf, f0)
      out.push({ f: f0, db: dbOf(m), text: `peak = R = ${fmt(m, 'Ω', 3)} = ${dbOf(m).toFixed(1)} dBΩ` })
    } else if (!metrics && !second && pz.poles.length === 1) {
      const [re, im] = pz.poles[0]
      const w = Math.hypot(re, im)
      if (w > 1e-9) {
        const fc = w / (2 * Math.PI)
        const m = dbOf(magnitudeAt(tf, fc))
        const ph = (phaseAt(tf, fc) * 180) / Math.PI
        out.push({ f: fc, db: m, text: minus(`${m.toFixed(2)} dB`) })
        out.push({ f: fc, deg: ph, text: minus(`${ph.toFixed(0)}°`) })
      }
    }
    return out
  }, [metrics, second, pz, tf, isZ])

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
    // 120 builds of a circuit the nominal simulation already declined would
    // be 120 frozen tabs; the band only exists when the trace does.
    () => (step ? stepBand(id, params, output, tolsN, stepDuration) : null),
    [id, params, output, tolsN, stepDuration, step],
  )
  // The step pane's y-range, held sticky over trace AND band so neither can
  // be clipped and shrinking overshoot visibly shrinks.
  const stepRange = useMemo(() => {
    let lo = 0
    let hi = 0
    if (!step) return null
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
    const key = `${id}/${output}/${frameNonce.current}`
    const prev = stepAxisRef.current.rangeKey === key ? stepAxisRef.current.range : null
    // Held (no shrink) while a lesson is loaded: the frame is the lesson's
    // own, so "ten times slower" is drawn ten times shallower.
    const r = stickyRange(prev, lo, hi, false, { hold: !!active })
    stepAxisRef.current.rangeKey = key
    stepAxisRef.current.range = r
    return r
  }, [id, output, step, stepEnvelope, active])
  // The pole view's frame, sticky the same way — tuning C slides the poles
  // along their radius across a held axis. Delivered through PoleZeroCanvas's
  // `span` prop; until the packages agent adds it (NEEDS.md) the prop is
  // ignored and the view keeps its per-render auto-fit.
  const pzSpanRef = useRef({ key: '', span: 0 })
  const pzSpan = useMemo(() => {
    let m = 1
    const all = [...pz.poles, ...pz.zeros, ...(wobble.any ? wobble.cloud : [])]
    for (const [re, im] of all) m = Math.max(m, Math.abs(re) * 1.4, Math.abs(im) * 1.4)
    const key = `${id}/${output}/${frameNonce.current}`
    const prev = pzSpanRef.current.key === key ? pzSpanRef.current.span : 0
    const s = stickySpan(prev, m)
    pzSpanRef.current = { key, span: s }
    return s
  }, [id, output, pz, wobble])
  const f0Nominal = metrics ? metrics.w0 / (2 * Math.PI) : second ? second.f0 : null
  const f0Spread = wobble.any && f0Nominal ? spreadPct(wobble.f0, f0Nominal) : null
  const qNominal = metrics && Number.isFinite(metrics.q) ? metrics.q : second ? second.q : null
  const qSpread = wobble.any && qNominal ? spreadPct(wobble.q, qNominal) : null

  // Provenance for outgoing hand-over links — memoized so HandOver's link
  // building doesn't re-run on unrelated renders.
  const handOverFrom = useMemo(() => ({ app: 'circuit', id, label: circuit.name }), [id, circuit])

  // One component's value field with its own tolerance row — rendered in the
  // Components section for every part, and again under a try line for the
  // part the line names, bound to the same state.
  const componentField = (p) => (
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
      {tolRow(p)}
    </React.Fragment>
  )
  const tolRow = (p) => (
    <div className="field-tol" role="group" aria-label={`${p.label} tolerance`} key={`tol:${p.key}`}>
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
  )
  // Rendered in the Components section and, for the wobble lesson, again
  // under the try line — so the label id takes a suffix per instance.
  const tolAllRow = (where) => (
    <div className="field" key="tol-all">
      <span className="field-label" id={`tol-all-label-${where}`}>
        Every part at once
      </span>
      <div
        className="segmented sm"
        role="group"
        aria-labelledby={`tol-all-label-${where}`}
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
  )
  const outputSelect =
    circuit.outputs.length > 1 ? (
      <label className="field" key="output">
        <span className="field-label">Output measured</span>
        <select value={output} onChange={(e) => chooseOutput(e.target.value)}>
          {circuit.outputs.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    ) : null

  // The controls a lesson's try line names, rendered right under it: a
  // component's field, a tolerance row, the output probe, or the hand-over
  // button. "Drag R" must never point at a slider below the fold.
  const featured = (active?.featured || [])
    .map((entry) => {
      const f = featuredId(entry)
      if (f === 'tol') return tolAllRow('featured')
      if (f.startsWith('tol:')) {
        const p = circuit.params.find((q) => q.key === f.slice(4))
        return p ? tolRow(p) : null
      }
      if (f === 'output') return outputSelect
      if (f === 'handover') {
        return (
          <div className="featured-handover" key="handover">
            <SignalLabLink tf={tf} from={handOverFrom} />
          </div>
        )
      }
      // The value field alone, slider included ("drag R"); its tolerance
      // row stays in the Components section, where the wobble lessons
      // feature it by name. A lesson may scope the slider to the range its
      // try line names — 20 to 200 Ω was 46 px of a 1 Ω–1 MΩ log slider.
      const p = circuit.params.find((q) => q.key === f)
      const range = typeof entry === 'object' ? entry : null
      return p ? (
        <NumField
          key={p.key}
          label={p.label}
          unit={p.unit}
          value={params[p.key]}
          onChange={(v) => setParam(p.key, v)}
          min={range?.min ?? p.min}
          max={range?.max ?? p.max}
          scale={p.scale}
          hint={p.hint}
          eng
        />
      ) : null
    })
    .filter(Boolean)

  return (
    <div className="app">
      <aside className="controls">
        <header>
          <LabNav current="circuit-lab" />
          <h1>Circuit Lab</h1>
          <p className="sub">
            A circuit, the transfer function it has, and the same thing seen in frequency, in
            time, and as poles. Start with Try this, top to bottom.
          </p>
          <ReportIssue
            lab="Circuit Lab"
            version={pkg.version}
            state={{ id, params, output, tols, lower, showPhase, lesson, dirty }}
            summary={reportSummary({ id, params, output, tols, lower, lesson })}
          />
        </header>

        <section>
          {linked.state ? (
            <p className="hint from-link" data-role="from-link">
              Loaded from a link —{' '}
              {linked.state.from?.label
                ? `your “${linked.state.from.label}” arrived from ${linked.state.from.app === 'elements' ? 'Circuit Elements Lab' : 'another tool'} as ${CIRCUITS[linked.state.id].name}, component values exact.`
                : `${CIRCUITS[linked.state.id].name} with the values the link carried.`}{' '}
              Pick anything below to start over.
            </p>
          ) : null}
          {linked.warnings.length ? (
            <ul className="link-warnings" data-role="link-warnings">
              {linked.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          ) : null}
          <h2>
            Try this
            {/* The course's spine rides the section's sticky cap: prev /
                n of N / next, and the reset once a knob has moved. Measured
                at 1366×768 the strip cost 34 px as its own row under the
                list and pushed the featured knob past the fold; up here it
                costs nothing and is on screen at any scroll. */}
            {active ? (
              <LessonNav
                index={lessonIndex}
                total={LESSONS.length}
                onPrev={() => loadLesson(LESSONS[lessonIndex - 1])}
                onNext={() => loadLesson(LESSONS[lessonIndex + 1])}
                onReset={() => loadLesson(active)}
                dirty={dirty}
                noun="lesson"
              />
            ) : parked ? (
              // A Circuits click used to drop the course without a word.
              // The strip keeps the lesson's place and offers the way back.
              <LessonNav
                index={parkedIndex}
                total={LESSONS.length}
                onPrev={() => loadLesson(LESSONS[parkedIndex - 1])}
                onNext={() => loadLesson(LESSONS[parkedIndex + 1])}
                onReset={() => loadLesson(parked)}
                dirty={false}
                noun="lesson"
              />
            ) : null}
          </h2>
          {parked ? (
            <button
              type="button"
              className="lesson-nav-back"
              data-role="lesson-back"
              onClick={() => loadLesson(parked)}
              title={`Reload “${parked.name}” with the setup its note describes`}
            >
              ↩ back to lesson {parkedIndex + 1}: {parked.name}
            </button>
          ) : null}
          {/* Both lists fold to their group headers — thirteen lessons and
              eight circuits were a wall of buttons that pushed the components
              and the schematic below the fold. Only the active item's group
              stays open, so where-you-are survives any amount of tidying. */}
          {/* Two blocks: the list, and the active lesson's body. On a phone
              the body comes first (styles.css reorders them) — a 30vh
              sidebar showed seventeen buttons and no lesson at all. */}
          <div className="lesson-list">
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
          </div>
          {active ? (
            <div className="lesson-body" data-role="lesson-body">
              <h3 className="note-title">
                {active.name}
                {dirty ? (
                  <span className="note-stale" data-role="note-stale">
                    values changed
                  </span>
                ) : null}
              </h3>
              {/* Stale means the picture no longer matches the paragraph: a
                  knob moved since the lesson loaded. The note stays (it is
                  still the lesson you are in) but says so, and the reset
                  above puts the described setup back. */}
              <p className={`hint note${dirty ? ' is-stale' : ''}`} data-role="lesson-note">
                {active.note}
              </p>
              <TryLine text={active.try} chips={active.chips} onChip={onChip} activeChip={activeChip} />
              {featured.length ? (
                <div className="featured" data-role="featured">
                  {featured}
                </div>
              ) : null}
              {/* The vocabulary this lesson leans on, defined where it is
                  used — Signal Lab's pattern. A student meeting "Q" or
                  "pole" mid-note should not need a second tab, and folded,
                  the definitions cost nothing to someone who already has
                  them. */}
              {termsFor(active.terms).length ? (
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
            </div>
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
          {active ? null : (
            <>
              <h3 className="note-title">{circuit.name}</h3>
              <p className="hint">{circuit.hint}</p>
            </>
          )}
        </section>

        <section>
          <h2>Schematic</h2>
          <Schematic id={id} params={params} output={output} />
          {outputSelect}
        </section>

        <section>
          <h2>Components</h2>
          {/* No part in a drawer is exact, and no board is all one grade —
              so each part carries its own tolerance, right under its value.
              The shaded bands on the plots, the ranges below and the cloud on
              the pole view are all the same 120 builds from these bands. */}
          {circuit.params.map(componentField)}

          {/* One row to grade the whole drawer at once — it reads as "on"
              only when every part agrees with it. */}
          {tolAllRow('components')}
          {wobble.any && f0Spread != null ? (
            <p className="hint" data-role="tolerance-spread">
              With these parts f₀ lands anywhere in {fmt(wobble.f0.lo, 'Hz', 3)} to{' '}
              {fmt(wobble.f0.hi, 'Hz', 3)} (±{f0Spread.toFixed(1)}%)
              {qSpread != null
                ? ` and Q in ${wobble.q.lo.toPrecision(3)} to ${wobble.q.hi.toPrecision(3)} (±${qSpread.toFixed(1)}%). The square root halves L's and C's errors in both — what doubles Q's spread is R, which enters Q in full and f₀ not at all.`
                : '.'}{' '}
              The poles view shows the scatter.
            </p>
          ) : null}
          {/* The math used to unfold here, and unfolding it grew the sidebar
              by nearly two thousand pixels — every knob below it gone. It is
              a view of the circuit now, a tab beside Step and Poles. */}
          <p className="hint math-pointer">
            The math for this circuit — its H(s), and every claim checked against the running
            model — is the <b>Math</b> tab in the lower pane.
          </p>
        </section>

        <section>
          <h2>Hand it to the other labs</h2>
          <HandOver tf={tf} circuitName={circuit.name} from={handOverFrom} />
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
          {/* Defined on contact, on hover: the strip is on every screen and
              "1 pole, 0 zeros" is the first jargon a student meets. */}
          <span className="flow-node" title={`${TERMS.tf.name}: ${TERMS.tf.def}`}>
            H(s)
            <em>
              {pz.poles.length} pole{pz.poles.length === 1 ? '' : 's'}, {pz.zeros.length} zero
              {pz.zeros.length === 1 ? '' : 's'}
            </em>
          </span>
          <span className="flow-arrow" aria-hidden="true">
            →
          </span>
          <span
            className={`flow-node ${stable ? 'is-out' : 'is-off'}`}
            title={`${TERMS.lhp.name}: ${TERMS.lhp.def}`}
          >
            {stable ? 'stable' : 'not stable'}
            <em>{stable ? 'left half plane' : 'on or right of the axis'}</em>
          </span>
        </nav>
        <div className="topbar-controls">
          <span className="topbar-field">
            {/* The tank's plot is an impedance, so its DC value is ohms — "DC
                gain 0" over a Z plot named the wrong quantity. */}
            <span>{isZ ? 'Z at DC' : 'DC gain'}</span>
            {/* A gain is dimensionless: 0.5, not "500 m". */}
            <b>{Number.isFinite(gain) ? (isZ ? fmt(gain, 'Ω', 4) : fmtNum(gain, 4)) : '∞'}</b>
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
                  {dampingWord(second.zeta)}
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
            annotations={annotations}
            points={points}
            yUnit={isZ ? 'dBΩ' : 'dB'}
          />
        </section>

        <section className="view">
          <div className="view-head">
            <h2>In time, as poles, and as math</h2>
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
                {
                  id: 'math',
                  label: 'Math',
                  title: 'H(s) derived, and every claim checked against the running model',
                },
              ]}
            />
            <div className="readout">
              {lower === 'step' ? (
                <StepReadout r={stepReadout(step, gain, second, isZ ? 'Ω' : '')} />
              ) : lower === 'pz' ? (
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
              ) : (
                <span>
                  {circuit.name}
                  <em className="prov"> · theory beside measurement, every row live</em>
                </span>
              )}
            </div>
          </div>
          {lower === 'step' ? (
            step ? (
              <StepCanvas
                t={step.t}
                y={step.y}
                final={gain}
                band={stepEnvelope}
                range={stepRange}
              />
            ) : (
              <p className="hint" data-role="step-too-stiff">
                Too stiff to simulate: this circuit rings for millions of its fastest time
                steps, so drawing its step response would freeze the page. The frequency
                view above is exact regardless — it needs no integration.
              </p>
            )
          ) : lower === 'pz' ? (
            <PoleZeroCanvas
              poles={pz.poles}
              zeros={pz.zeros}
              cloud={wobble.any ? wobble.cloud : null}
              span={pzSpan}
            />
          ) : (
            <div className="math-pane" data-role="math-pane">
              <MathBody entry={math} />
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

/**
 * The step pane's readout, from stepReadout.js: final value, then EITHER the
 * overshoot (against a non-zero final) OR the peak the trace reaches (when
 * the final value is 0 and overshoot means nothing), then settling.
 */
function StepReadout({ r }) {
  return (
    <>
      <span>
        final{' '}
        <b>{r.final != null ? (r.unit ? fmt(r.final, r.unit, 4) : fmtNum(r.final, 4)) : r.finalText}</b>
      </span>
      {r.overshoot != null ? (
        <span>
          overshoot <b>{(r.overshoot * 100).toFixed(1)}%</b>
        </span>
      ) : null}
      {r.peak != null ? (
        <span data-role="step-peak">
          peak <b>{r.unit ? fmt(r.peak, r.unit, 3) : fmtNum(r.peak, 3)}</b>
          <em className="prov"> — final is 0, so no overshoot to quote</em>
        </span>
      ) : null}
      {r.settling != null ? (
        <span>
          settles in <b>{fmt(r.settling, 's', 3)}</b>
          <em className="prov"> to within 2%</em>
        </span>
      ) : null}
    </>
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
        // A <details> created open fires `toggle` too. That open came from
        // holdsActive, not the student, so it must not be remembered as a
        // hand-open — or the group holding the opening lesson would stay
        // unfolded under every other group for the rest of the session.
        const next = new Set(openGroups)
        if (e.target.open) {
          if (!holdsActive) next.add(sectionKey)
        } else next.delete(sectionKey)
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
