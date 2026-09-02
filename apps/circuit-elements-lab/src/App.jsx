import React, { useEffect, useMemo, useRef, useState } from 'react'
import { LabNav, NumField, ReportIssue, Schematic } from '@ee-labs/ui'
import { MathPanel } from '@ee-labs/explain'
import { equations, normalize, complex as cx } from '@ee-labs/network'
import { EXPERIMENTS, GROUPS, VIEW_ORDER, byId, defaultsOf, drawables, isDynamic, viewLabel, VIEW_LABELS } from './experiments.js'
import { analyse, atDrive, experimentMath, netPower, refusalReason, snapNoise, turnedLabel } from './math.js'
import { firstUses } from './glossary.js'
import { predictFor } from './predict.js'
import { GROUP_INTRO, buildsOn, introFor, leadsTo, letterOf, opensGroup } from './course.js'
import { reportSummary } from './report.js'
import { forReading, num, scaleOf } from './format.js'
import { calloutText } from './headlines.js'
import { theoremShows } from './theorems.js'
import { EquationsPane, PowerPane, TheveninPane, SuperpositionPane, StatePane, AcPowerPane, Refusal } from './components/panes.jsx'
import { Headline, Bridge, Readings, TheoremBlock, EquivalentPane } from './components/insight.jsx'
import SweepCanvas from './components/SweepCanvas.jsx'
import ScopeCanvas from './components/ScopeCanvas.jsx'
import EnergyCanvas from './components/EnergyCanvas.jsx'
import DampingCanvas from './components/DampingCanvas.jsx'
import PhasorCanvas from './components/PhasorCanvas.jsx'
import FreqCanvas from './components/FreqCanvas.jsx'
import HandOver from './components/HandOver.jsx'
import PlotMarks from './components/PlotMarks.jsx'
import PlotCaption from './components/PlotCaption.jsx'
import LiveNote from './components/LiveNote.jsx'
import Predict from './components/Predict.jsx'
import { Marked, DefCard, TermChips } from './components/Prose.jsx'
import { marksFor, timeMarks } from './marks.js'
import { captionFor } from './captions.js'
import { familyOf, familyOfLabel } from './palette.js'
import { activeStep, advance, complete, groupArc, knobsOf, load, measurable, readsOf, save, tick, withPredicted, withSteps } from './progress.js'
import { rereference, switchKnob } from './reference.js'
import pkg from '../package.json'

// The cursor's play: the whole window in this many milliseconds, whatever the
// window is — a 5τ transient and a four-cycle sine both take one breath.
const PLAY_MS = 4000

const FIRST = EXPERIMENTS[0].id
// Groups A and B read a primer above their equations: A uses the laws before
// B takes them apart, and a name must not arrive before its meaning. A1, the
// first screen, gets Ohm's law alone — the one law its circuit needs; the rest
// of A gets the two laws in a line each; B, which is about them, the full primer.
const primerFor = (exp) => (exp.id === 'a1' ? 'ohm' : exp.group === GROUPS[0] ? 'brief' : exp.group === GROUPS[1] ? 'full' : false)
// Groups A–E open their equations folded: the headline is the lesson, the
// solver's working is there for whoever wants it.
const FOLDED_GROUPS = GROUPS.slice(0, 5)
// The topbar's Σ power chip appears from the experiment that introduces power.
const POWER_FROM = EXPERIMENTS.findIndex((e) => e.id === 'b3')

/** The cursor an experiment opens at: its own fraction of its window at the defaults. */
const cursorFor = (exp, p) => (isDynamic(exp) ? exp.cursor * exp.window(p) : null)
/** The browser's store for progress, or null where there is none (progress.js copes). */
const storage = () => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}
/** The experiment after this one on the path: the next in the list when it builds on this one, else the first that does, else the next. */
const nextUp = (exp) => {
  const seq = EXPERIMENTS[EXPERIMENTS.indexOf(exp) + 1]
  const to = leadsTo(exp.id)
  if (seq && to.includes(seq.id)) return seq.id
  return to[0] || (seq ? seq.id : null)
}
/** The knob open when no step names one: the first in the Knobs section. */
const firstKnob = (exp) => (exp.params.find((p) => !(p.key === 'N' && exp.window)) || {}).key

export default function App() {
  const [id, setId] = useState(FIRST)
  const [params, setParams] = useState(() => defaultsOf(FIRST))
  const [show, setShow] = useState(byId[FIRST].show)
  const [view, setView] = useState(byId[FIRST].view)
  // The instant the schematic shows, in seconds; null for the DC groups. The
  // analysis clamps it to the window, so a knob that shrinks the window pulls
  // the cursor back with it.
  const [cursor, setCursor] = useState(() => cursorFor(byId[FIRST], defaultsOf(FIRST)))
  // Whether the note still describes what is on screen: any knob moved by hand
  // retires it, as in the other labs. The schematic/view toggles and the
  // cursor are exempt.
  const [pristine, setPristine] = useState(true)
  const [openGroups, setOpenGroups] = useState(() => new Set())
  // The full list of experiments, folded under the picker until asked for.
  const [pickerOpen, setPickerOpen] = useState(false)
  // The one term whose definition is open, and the paragraph it was opened
  // from ({ id, field }) — the card sits under that paragraph.
  const [openTerm, setOpenTerm] = useState(null)
  // The rule of the answer picked in "predict before you turn", once picked.
  const [predicted, setPredicted] = useState(null)
  // Whether the cursor is sweeping the window on its own (the ▶ under the schematic).
  const [playing, setPlaying] = useState(false)
  // How far along each experiment's Try list the student has come (progress.js),
  // kept in localStorage so it survives a reload.
  const [progress, setProgress] = useState(() => load(storage()))
  // A step the student tapped to read in full, beside the active one.
  const [focusStep, setFocusStep] = useState(null)
  // The knob the student opened by hand; otherwise the active step's knob is open.
  const [openKnob, setOpenKnob] = useState(null)
  // The node the student tapped to take as the zero of voltage (A3's lesson).
  const [refNode, setRefNode] = useState(null)
  // The node or element under the pointer in the equations pane, lit on the schematic.
  const [hover, setHover] = useState(null)
  // Whether Deeper is unfolded; a new experiment starts with it folded.
  const [deeperOpen, setDeeperOpen] = useState(false)

  const exp = byId[id]
  const uses = useMemo(() => firstUses(exp), [exp])
  const predict = useMemo(() => predictFor(exp), [exp])
  const steps = exp.try || []
  const done = useMemo(() => new Set((progress[id] && progress[id].steps) || []), [progress, id])
  const active = activeStep(steps, done)
  const activeKnobs = active >= 0 ? knobsOf(steps[active]) : []
  const activeReads = useMemo(() => (active >= 0 ? readsOf(steps[active]) : { nodes: new Set(), elements: new Set() }), [steps, active])
  const isComplete = complete(exp, progress[id])
  useEffect(() => {
    save(storage(), progress)
  }, [progress])
  // A new experiment shows from its top: the list the student scrolled through
  // to reach it has folded, and neither the sidebar nor (on a phone, where #root
  // scrolls the page) the page should be left part-way down.
  useEffect(() => {
    const aside = document.querySelector('.controls')
    if (aside) aside.scrollTop = 0
    pageScroller().scrollTop = 0
    window.scrollTo(0, 0)
  }, [id])

  const choose = (next) => {
    setId(next)
    setParams(defaultsOf(next))
    setShow(byId[next].show)
    setView(byId[next].view)
    setCursor(cursorFor(byId[next], defaultsOf(next)))
    setPristine(true)
    setPickerOpen(false)
    setOpenTerm(null)
    setPredicted(null)
    setPlaying(false)
    setFocusStep(null)
    setOpenKnob(null)
    setRefNode(null)
    setHover(null)
    setDeeperOpen(false)
  }
  // A hand on the cursor stops the play.
  const scrub = (t) => {
    setPlaying(false)
    setCursor(t)
  }
  const setParam = (key, value) => {
    setParams((p) => ({ ...p, [key]: value }))
    setPristine(false)
    setFocusStep(null)
  }
  // A prediction made: the knob turns to the step's setting so the meters
  // answer at once, and the cursor moves if the step named an instant. The
  // step stays open so the reveal can be read.
  const pick = (rule) => {
    setPredicted(rule)
    setParams((p) => ({ ...p, ...predict.set }))
    setPristine(false)
    setFocusStep(predict.step)
    setProgress((p) => withPredicted(p, id))
    const at = exp.try[predict.step].at
    if (at != null) setCursor(at)
  }
  // A watch step ("drag the cursor and watch") ticked by hand.
  const seen = (i) => setProgress((p) => withSteps(p, id, tick(done, steps, i)))

  // The solver's analysis, then the student's: with a node tapped as the
  // reference, every node voltage is re-read from there (reference.js).
  const solved = useMemo(() => analyse(exp, params, cursor), [exp, params, cursor])
  const x = useMemo(() => (exp.claim && exp.claim.reference ? rereference(solved, refNode) : solved), [exp, solved, refNode])
  const dynamic = isDynamic(exp)
  const eq = useMemo(() => {
    try {
      return solved.sol ? equations(solved.sol.norm, solved.sol) : equations(normalize(solved.net))
    } catch {
      return null
    }
  }, [solved])
  // Where the student is on the Try list: a step is done once the screen shows
  // what it asked for, and stays done (progress.js).
  useEffect(() => {
    const next = advance(done, steps, { params, cursor: x.cursor, tEnd: x.tEnd, show })
    if (next !== done) setProgress((p) => withSteps(p, id, next))
  }, [done, steps, params, x.cursor, x.tEnd, show, id])
  // A new active step leads again: the knob it names opens.
  useEffect(() => {
    setOpenKnob(null)
  }, [active])
  // Tapping a node makes it the reference (where the experiment is about that);
  // tapping a switch throws it — by its knob if one throws it, else by replaying t = 0.
  const takesReference = !!(exp.claim && exp.claim.reference)
  const onNode = takesReference ? (name) => setRefNode((r) => (r === name ? null : name)) : null
  const hasSwitch = x.net.elements.some((e) => e.type === 'SW')
  const onElement = hasSwitch
    ? (elId) => {
        const key = switchKnob(exp, params, elId)
        if (key) setParam(key, !params[key])
        else {
          setCursor(0)
          setPlaying(true)
        }
      }
    : null
  useEffect(() => {
    if (refNode) setPristine(false)
  }, [refNode])
  // What the schematic lights: what the active step says to read, and whatever
  // row of the equations pane the pointer is on.
  const lit = useMemo(() => {
    const nodes = new Set(activeReads.nodes)
    const els = new Set(activeReads.elements)
    if (hover && hover.node) nodes.add(hover.node)
    if (hover && hover.el) els.add(hover.el)
    return { nodes, elements: els }
  }, [activeReads, hover])
  const math = useMemo(() => experimentMath(exp, params, x), [exp, params, x])
  // What the plot points at: the experiment's data marks, then the instants the math entry names.
  const marks = useMemo(() => {
    if (!x.sol && !x.tr) return { scope: [], freq: [], sweep: [] }
    const on = (plot) => marksFor(exp, params, x, plot)
    return { scope: [...on('scope'), ...timeMarks(math?.marks)], freq: on('freq'), sweep: on('sweep') }
  }, [exp, params, x, math])
  // The tables the student reads: every row in the unit a first course writes (100 µA, not 1.000e-4 A).
  const readable = useMemo(() => forReading(math), [math])
  const drive = useMemo(() => (x.ac && exp.out ? atDrive(exp, x) : null), [exp, x])
  const elements = useMemo(() => drawables(x.net), [x])
  // The play: from where the cursor is (or from 0, if it is at the end) to the
  // end of the window at PLAY_MS per window, one frame at a time; stops itself
  // at the end. Re-arms when the window changes under it.
  const tEnd = x.tEnd
  const cursorRef = useRef(x.cursor)
  cursorRef.current = x.cursor
  useEffect(() => {
    if (!playing || !Number.isFinite(tEnd) || !(tEnd > 0)) return undefined
    let raf = 0
    let start = null
    const c0 = cursorRef.current
    const from = Number.isFinite(c0) && c0 < tEnd * 0.999 ? c0 : 0
    const step = (now) => {
      if (start === null) start = now
      const t = from + ((now - start) / PLAY_MS) * tEnd
      if (t >= tEnd) {
        setCursor(tEnd)
        setPlaying(false)
        return
      }
      setCursor(t)
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [playing, tEnd])
  const meters = useMemo(() => (x.sol ? snapNoise(x.sol) : null), [x])
  // The drawing with its live texts: the headline's callout takes the number
  // (and steps aside when there is none), and any text marked `live` reads a
  // solution quantity. The frame was sized with the widest text, so nothing moves.
  const layout = useMemo(() => {
    const items = exp.layout.items.flatMap((it) => {
      if (it.callout) {
        const text = calloutText(exp.headline, x, params)
        return text === null ? [] : [{ ...it, text }]
      }
      if (it.live) {
        const v = x.sol ? x.sol[it.live.q][it.live.key] : null
        return Number.isFinite(v) ? [{ ...it, text: it.live.prefix + num(v, it.live.unit, 3) }] : [{ ...it, text: it.live.prefix.trim() }]
      }
      return [it]
    })
    return { ...exp.layout, items }
  }, [exp, x, params])
  // The theorem drawings (D4's three circuits) use the drawing without the callout.
  const plainLayout = useMemo(() => ({ ...exp.layout, items: exp.layout.items.filter((it) => !it.callout) }), [exp])

  const nodeCount = x.sol ? x.sol.norm.n : normalize(x.net).n
  // The residual is judged against the currents that flow: 1e-19 A of
  // imbalance at a node carrying milliamps is the arithmetic, and reads 0 A.
  const residual = x.sol ? num(x.sol.maxResidual, 'A', 2, scaleOf(x.sol.i)) : null
  const outcome = x.sol ? `current in = current out at every node (KCL), largest imbalance ${residual}` : `refused: ${x.refusal.code}`
  // Σ power is the lesson from B3 on; beside A1's 12 V and 12 mA a "0 W" reads
  // as a dead circuit, so the first experiments do without it.
  const showsNetPower = EXPERIMENTS.indexOf(exp) >= POWER_FROM

  const viewOptions = VIEW_ORDER.filter((v) => exp.views.includes(v)).map((v) => ({ id: v, ...viewLabel(v, exp) }))
  // The window knob (how many τ or cycles the slider spans) lives under the schematic, not among the knobs.
  const windowKnob = exp.window ? exp.params.find((p) => p.key === 'N') : null
  const currentView = exp.views.includes(view) ? view : exp.view
  // The sentence under the plot, bound to the same analysis the plot drew.
  const caption = useMemo(() => {
    const on = currentView === 'scope' ? marks.scope : currentView === 'sweep' ? marks.sweep : marks.freq
    return captionFor(exp, currentView, x, params, on, drive)
  }, [exp, currentView, x, params, marks, drive])

  return (
    <div className="app">
      <aside className="controls">
        <header>
          <LabNav current="circuit-elements-lab" currentLabel="Elements" />
          <h1>Circuit Elements Lab</h1>
          <p className="sub">Circuits from the two laws up — every claim measured.</p>
          <ReportIssue
            lab="Circuit Elements Lab"
            version={pkg.version}
            state={{ id, params, show, view: currentView, cursor }}
            summary={reportSummary({ id, params, show, view: currentView, outcome, cursor: dynamic ? x.cursor : null })}
          />
        </header>

        <section className="lesson">
          <h2>
            Experiment
            <span className="h2-aside">
              {EXPERIMENTS.indexOf(exp) + 1} of {EXPERIMENTS.length}
            </span>
          </h2>
          <Picker
            id={id}
            choose={choose}
            open={pickerOpen}
            setOpen={setPickerOpen}
            openGroups={openGroups}
            setOpenGroups={setOpenGroups}
            progress={progress}
          />
          {/* The experiment that opens a group carries the group's one sentence,
              folded to a line so the note stays where the eye lands. */}
          {opensGroup(exp) ? (
            <details className="group-intro" data-role="group-intro">
              <summary>
                <b>Group {letterOf(exp.group)}</b> starts here — what it is for
              </summary>
              <p>{introFor(exp)}</p>
            </details>
          ) : null}
          {/* The note with its numbers alive and its terms marked where they first do work. */}
          <LiveNote
            exp={exp}
            x={x}
            params={params}
            pristine={pristine}
            dfn={(s, i) => <Marked key={i} text={s.text} base={s.start} marks={uses.see} field="see" open={openTerm} onOpen={setOpenTerm} />}
          >
            {uses.unplaced.length ? <TermChips ids={uses.unplaced} field="see" open={openTerm} onOpen={setOpenTerm} /> : null}
          </LiveNote>
          <DefCard open={openTerm} field="see" exp={exp} onClose={() => setOpenTerm(null)} choose={choose} />
          {steps.length ? (
            // The Try list as a path: done steps ticked, the active step in full
            // with its knob open and its readings lit, the steps ahead one line
            // each. Tap a step to read it in full; tick a watch step by hand.
            <ol className="try" data-role="try" aria-label="Try" data-active={active}>
              {steps.map((t, i) => {
                const state = done.has(i) ? 'done' : i === active ? 'active' : 'ahead'
                const shown = i === active || i === focusStep
                const posed = predict && predict.step === i
                // The posed step shows its question while unanswered and open, and its reveal while the student keeps it open.
                const asQuestion = posed && (predicted ? focusStep === i : shown)
                return (
                  <li
                    key={i}
                    data-step={i}
                    data-state={state}
                    data-shown={shown || undefined}
                    data-predict={posed ? (predicted ? 'answered' : 'pending') : undefined}
                    onClick={(ev) => {
                      if (ev.target.closest('button, dfn, a')) return
                      setFocusStep(i === focusStep ? null : i)
                    }}
                  >
                    <span className="step-n" aria-hidden="true">
                      {state === 'done' ? '✓' : i + 1}
                    </span>
                    <span className="step-body">
                      {asQuestion ? (
                        // This step is posed as a question first; its sentence appears once answered.
                        <Predict q={predict} picked={predicted} onPick={pick} marks={uses[`try.${i}`]} field={`try.${i}`} open={openTerm} onOpen={setOpenTerm} />
                      ) : posed && !predicted ? (
                        <span className="step-text">
                          <span className="predict-tag">predict</span> {predict.ask}
                        </span>
                      ) : (
                        <span className="step-text">
                          <Marked text={t.say} marks={uses[`try.${i}`]} field={`try.${i}`} open={openTerm} onOpen={setOpenTerm} />
                        </span>
                      )}
                      {state === 'active' && !measurable(t) ? (
                        <button type="button" className="step-seen" data-role="seen" onClick={() => seen(i)} title="Tick this step off">
                          seen ✓
                        </button>
                      ) : null}
                    </span>
                  </li>
                )
              })}
            </ol>
          ) : null}
          {openTerm && openTerm.field.startsWith('try.') ? (
            <DefCard open={openTerm} field={openTerm.field} exp={exp} onClose={() => setOpenTerm(null)} choose={choose} />
          ) : null}
          {isComplete && nextUp(exp) ? (
            <p className="next-up" data-role="next-up">
              <span>Every step done.</span>
              <button type="button" className="tag is-on" onClick={() => choose(nextUp(exp))} title={`${nextUp(exp).toUpperCase()} · ${byId[nextUp(exp)].name}`}>
                next up: {nextUp(exp).toUpperCase()} →
              </button>
            </p>
          ) : null}
          <Thread id={id} choose={choose} />
        </section>

        <section className="knobs" id="knobs">
          <h2>
            Knobs
            {activeKnobs.length ? <span className="h2-aside">step {active + 1} turns the lit one</span> : null}
          </h2>
          <div className="knob-list">
            {exp.params
              // The window knob sits with the cursor it scales, under the schematic.
              .filter((p) => !(p.key === 'N' && exp.window))
              .map((p) => {
                const open = (openKnob ?? activeKnobs[0] ?? firstKnob(exp)) === p.key
                return (
                  <div
                    className="knob-slot"
                    key={p.key}
                    data-key={p.key}
                    data-open={open}
                    data-named={activeKnobs.includes(p.key) || undefined}
                    onFocus={() => setOpenKnob(p.key)}
                    onClick={() => setOpenKnob(p.key)}
                  >
                    {p.kind === 'toggle' ? (
                      <div className="toggle-knob" data-role="toggle" data-key={p.key}>
                        <span className="toggle-label">{p.label}</span>
                        <div className="segmented sm" role="group" aria-label={p.label}>
                          {[
                            [true, p.on],
                            [false, p.off],
                          ].map(([val, label]) => (
                            <button
                              key={String(val)}
                              type="button"
                              className={params[p.key] === val ? 'on' : ''}
                              aria-pressed={params[p.key] === val}
                              onClick={() => setParam(p.key, val)}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        {p.hint && open ? <p className="hint">{p.hint}</p> : null}
                      </div>
                    ) : (
                      <NumField
                        label={p.label}
                        unit={p.unit}
                        value={params[p.key]}
                        onChange={(v) => setParam(p.key, v)}
                        min={p.min}
                        max={p.max}
                        scale={p.scale}
                        hint={p.hint}
                        presets={p.presets}
                        eng={p.eng !== false}
                        compact={!open}
                      />
                    )}
                  </div>
                )
              })}
          </div>
        </section>

        <section className="deeper">
          <h2>Deeper</h2>
          {/* One fold: why it works, the solver's working with its check tables, and the hand-over. */}
          <details className="deeper-fold" data-role="deeper" open={deeperOpen} onToggle={(e) => setDeeperOpen(e.target.open)}>
            <summary>Why it works, and the working</summary>
            {exp.why ? (
              <div className="why" data-role="why">
                <p className="hint">
                  <Marked text={exp.why} marks={uses.why} field="why" open={openTerm} onOpen={setOpenTerm} />
                </p>
                <DefCard open={openTerm} field="why" exp={exp} onClose={() => setOpenTerm(null)} choose={choose} />
              </div>
            ) : null}
            <MathPanel entry={readable} />
            {exp.circuitLab ? <HandOver exp={exp} params={params} /> : null}
          </details>
        </section>
      </aside>

      {/* Phone only (CSS): the page is one scroll — lesson, circuit, plot, knobs —
          and this bar names the four and goes to each. */}
      <TabBar />

      <div className="topbar">
        <nav className="flow" aria-label="Experiment summary">
          <span className="flow-node">
            {exp.id.toUpperCase()}
            <em>{exp.name}</em>
          </span>
          <span className="flow-arrow" aria-hidden="true">
            →
          </span>
          {/* In the student's words (Phase 8): the solver's "unknowns" and "residual" stay in the hover text, where they are explained. */}
          <span
            className="flow-node"
            data-role="system-size"
            title={`Nodes are the junctions where elements meet, ground included. The numbers to find are the solver's unknowns: one voltage per node except ground, plus the current through each element that fixes a voltage (a source, a capacitor, a wire).`}
          >
            {nodeCount} node{nodeCount === 1 ? '' : 's'}
            <em>{eq ? `${eq.unknowns.length} number${eq.unknowns.length === 1 ? '' : 's'} to find` : 'nothing to solve'}</em>
          </span>
          <span className="flow-arrow" aria-hidden="true">
            →
          </span>
          <span
            className={`flow-node ${x.sol ? 'is-out' : 'is-off'}`}
            data-role="outcome"
            title={x.sol ? `Solved: at every node the currents in add up to the currents out (KCL). The largest imbalance left by the arithmetic, the residual, is ${residual}.` : undefined}
          >
            {x.sol ? 'every node balances' : 'no solution'}
            <em>{x.sol ? `current in = current out, to ${residual}` : refusalReason(x.refusal)}</em>
          </span>
        </nav>
        <div className="topbar-controls">
          {dynamic && x.tr ? (
            <>
              <span className="topbar-field" data-role="cursor-time">
                <span>t</span>
                <b>{num(x.cursor, 's', 3)}</b>
              </span>
              {x.omega ? (
                <span className="topbar-field" data-role="drive">
                  <span>ω</span>
                  <b>{num(x.omega, 'rad/s', 3)}</b>
                  <em className="prov"> {num(x.omega / (2 * Math.PI), 'Hz', 3)}</em>
                </span>
              ) : null}
              {x.state.n === 1 ? (
                <span className="topbar-field">
                  <span>τ</span>
                  <b>{x.state.tau === Infinity ? '∞' : num(x.state.tau, 's', 3)}</b>
                </span>
              ) : x.state.n === 2 ? (
                <>
                  <span className="topbar-field">
                    <span>ω₀</span>
                    <b>{num(x.state.w0, 'rad/s', 3)}</b>
                  </span>
                  <span className="topbar-field" data-role="zeta">
                    <span>ζ</span>
                    <b>{Number.isFinite(x.state.zeta) ? x.state.zeta.toPrecision(3) : '∞'}</b>
                    <em className="prov"> {x.state.face}</em>
                  </span>
                </>
              ) : null}
            </>
          ) : null}
          {x.sol && showsNetPower ? (
            <span className="topbar-field" data-role="net-power">
              <span>Σ power</span>
              <b>{num(netPower(x.sol), 'W', 2, scaleOf(x.sol.p))}</b>
            </span>
          ) : null}
        </div>
      </div>

      <main className="views">
        <section className="view">
          <div className="view-head">
            <h2>Schematic, with meters</h2>
            <div className="segmented sm" role="group" aria-label="What the meters read">
              {[
                ['i', 'currents', 'Current through each element, arrow in the direction it flows'],
                ['v', 'voltages', 'Voltage across each element, + marks the reference end'],
                ['p', 'powers', 'Power in each element: positive absorbs, negative delivers'],
                ['none', 'none', 'Just the circuit'],
              ].map(([k, label, title]) => (
                <button
                  key={k}
                  type="button"
                  className={show === k ? 'on' : ''}
                  aria-pressed={show === k}
                  title={title}
                  onClick={() => setShow(k)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="readout">
              {meters ? (
                Object.entries(meters.v)
                  // Ground reads 0 and is not listed — until another node is the reference and it no longer does.
                  .filter(([n]) => n !== 'gnd' || refNode)
                  .map(([n, v]) => (
                    <span key={n} data-q="voltage" data-node={n} data-lit={lit.nodes.has(n) || undefined}>
                      v_{n} <b>{num(v, 'V', 4)}</b>
                    </span>
                  ))
              ) : (
                <span className="flag warn">the solver refused — see below</span>
              )}
            </div>
          </div>
          {/* data-show lets the stylesheet give the meters the hue of what they read (palette.js). */}
          <div className="view-body" data-show={show}>
            {/* "none" promises just the circuit, so it drops the node voltages too. */}
            <Schematic
              className="big"
              elements={elements}
              layout={layout}
              meters={show === 'none' ? null : meters}
              show={show}
              lit={lit}
              reference={refNode}
              onNode={onNode}
              onElement={onElement}
            />
            {takesReference ? (
              <p className="sch-hint" data-role="ref-hint">
                {refNode ? (
                  <>
                    <b>{refNode}</b> is the reference: it reads 0 V and every other node is measured from it. Tap it again for ground.
                  </>
                ) : (
                  <>Tap a node to make it the reference — the meter’s black lead can go anywhere.</>
                )}
              </p>
            ) : null}
            {hasSwitch ? (
              <p className="sch-hint" data-role="switch-hint">
                Tap the switch to throw it{dynamic ? ' — the clock restarts at t = 0' : ''}.
              </p>
            ) : null}
            {x.refusal ? <Refusal err={x.refusal} /> : null}
            {dynamic && x.tr ? (
              <div className="cursor-row" data-role="cursor">
                <div className="cursor-head">
                  <label htmlFor="cursor-slider">
                    <span className="cursor-lead">the meters read </span>the circuit at <b>t = {num(x.cursor, 's', 3)}</b>
                  </label>
                  {windowKnob ? (
                    // The window knob, beside the cursor it scales: how many τ or cycles the slider spans.
                    <NumField
                      label={windowKnob.label.toLowerCase()}
                      unit={windowKnob.unit}
                      value={params[windowKnob.key]}
                      onChange={(v) => setParam(windowKnob.key, v)}
                      min={windowKnob.min}
                      max={windowKnob.max}
                      scale={windowKnob.scale}
                      eng={windowKnob.eng !== false}
                      compact
                    />
                  ) : null}
                  <button
                    type="button"
                    className={`play${playing ? ' on' : ''}`}
                    data-role="play"
                    aria-pressed={playing}
                    title={playing ? 'Stop the cursor' : 'Sweep the cursor across the window'}
                    onClick={() => setPlaying((v) => !v)}
                  >
                    {playing ? '■ stop' : '▶ play'}
                  </button>
                </div>
                <input
                  id="cursor-slider"
                  className="num-slider"
                  type="range"
                  min={0}
                  max={x.tEnd}
                  step={x.tEnd / 600}
                  value={x.cursor}
                  onChange={(e) => scrub(Number(e.target.value))}
                  aria-label="Cursor time"
                />
                <span className="cursor-ends" aria-hidden="true">
                  <span>0</span>
                  <span>{num(x.tEnd, 's', 2)}</span>
                </span>
              </div>
            ) : null}
          </div>
        </section>

        <section className="view">
          <div className="view-head">
            <h2>Analysis</h2>
            <ViewSwitch value={currentView} onChange={setView} options={viewOptions} />
            <div className="readout">
              {currentView === 'thevenin' && x.thevenin ? (
                <>
                  <span data-q="voltage">
                    V_oc <b>{num(x.thevenin.voc, 'V', 4)}</b>
                  </span>
                  <span>
                    R_th <b>{num(x.thevenin.rth.test, 'Ω', 4)}</b>
                  </span>
                </>
              ) : null}
              {currentView === 'sweep' && x.sweep ? (
                <>
                  <span>
                    {exp.sweepId} now <b>{num(params[exp.sweepId], 'Ω', 3)}</b>
                  </span>
                  {exp.sweepY === 'p' ? (
                    <span data-q="power">
                      peak <b>{num(x.sweep.pMax, 'W', 3)}</b>
                      <em className="prov"> near {num(x.sweep.rOpt, 'Ω', 3)}</em>
                    </span>
                  ) : null}
                </>
              ) : null}
              {currentView === 'scope' && x.tr
                ? [...exp.scope.left.traces, ...(exp.scope.right ? exp.scope.right.traces : [])].map((q) => (
                    <span key={`${q.q}.${q.key}`} data-q={familyOf(q)}>
                      {q.label} <b>{num(x.sol[q.q][q.key], q.q === 'i' ? 'A' : q.q === 'p' ? 'W' : 'V', 4)}</b>
                    </span>
                  ))
                : null}
              {currentView === 'energy' && x.tr ? <EnergyReadout energy={x.energy} t={x.cursor} /> : null}
              {currentView === 'phasor' && x.ac ? (
                <>
                  <span data-q={familyOf(exp.out)}>
                    |{exp.out.label}| <b>{num(cx.cabs(x.ac[exp.out.q][exp.out.key]), exp.out.q === 'i' ? 'A' : 'V', 4)}</b>
                  </span>
                  <span data-q="angle">
                    ∠{exp.out.label} <b>{deg(cx.carg(x.ac[exp.out.q][exp.out.key]))}</b>
                    <em className="prov"> re v_s: {deg(cx.carg(x.ac[exp.out.q][exp.out.key]) - cx.carg(x.ac.volt.V1))}</em>
                  </span>
                  <span data-q="angle">
                    turned <b>{turnedLabel(x.omega, x.cursor)}</b>
                  </span>
                </>
              ) : null}
              {currentView === 'impedance' && drive ? (
                <>
                  <span data-q="voltage">
                    |Z| <b>{num(cx.cabs(drive.Z), 'Ω', 4)}</b>
                  </span>
                  <span data-q="angle">
                    ∠Z <b>{deg(cx.carg(drive.Z))}</b>
                    <em className="prov"> {drive.Z[1] < -1e-9 * cx.cabs(drive.Z) ? 'capacitive' : drive.Z[1] > 1e-9 * cx.cabs(drive.Z) ? 'inductive' : 'resonant'}</em>
                  </span>
                </>
              ) : null}
              {currentView === 'bode' && drive ? (
                <>
                  <span data-q="voltage">
                    |H| <b>{(20 * Math.log10(cx.cabs(drive.H))).toFixed(2)} dB</b>
                    <em className="prov"> ×{cx.cabs(drive.H).toPrecision(4)}</em>
                  </span>
                  <span data-q="angle">
                    ∠H <b>{deg(cx.carg(drive.H))}</b>
                  </span>
                </>
              ) : null}
              {currentView === 'acpower' && x.ac ? <AcPowerReadout x={x} /> : null}
              {currentView === 'damping' && x.damping ? (
                x.damping.at ? (
                  <>
                    <span data-q={familyOfLabel('overshoot')}>
                      overshoot <b>{(100 * x.damping.at.overshoot).toFixed(1)} %</b>
                    </span>
                    <span data-q={familyOfLabel('settles in')}>
                      settles in <b>{num(x.damping.at.settle, 's', 3)}</b>
                    </span>
                  </>
                ) : (
                  <span className="flag warn">
                    R is outside the sweep ({num(x.damping.lo, 'Ω', 2)} – {num(x.damping.hi, 'Ω', 2)})
                  </span>
                )
              ) : null}
            </div>
          </div>
          <div className="view-body">
            <Headline exp={exp} x={x} params={params} />
            <Bridge exp={exp} view={currentView} />
            {theoremShows(exp, currentView) ? <TheoremBlock exp={exp} x={x} params={params} elements={elements} layout={plainLayout} /> : null}
            {currentView === 'reading' && x.sol ? <Readings x={x} elements={elements} power={showsNetPower} /> : null}
            {currentView === 'equivalent' && x.thevenin ? <EquivalentPane x={x} exp={exp} /> : null}
            {currentView === 'scope' && x.tr ? (
              <ScopeCanvas
                tr={x.tr}
                ghost={x.ghost || null}
                ghostLabel={exp.ghostLabel}
                scope={exp.scope}
                cursor={x.cursor}
                onCursor={scrub}
                marks={marks.scope}
                guides={math?.guides || []}
              />
            ) : null}
            {currentView === 'scope' && x.tr ? <PlotCaption parts={caption} /> : null}
            {currentView === 'scope' && x.tr ? <PlotMarks marks={marks.scope} /> : null}
            {currentView === 'state' && x.tr ? <StatePane x={x} /> : null}
            {currentView === 'phasor' && x.ac ? <PhasorCanvas exp={exp} x={x} cursor={x.cursor} onCursor={scrub} /> : null}
            {currentView === 'phasor' && x.ac ? <PlotCaption parts={caption} /> : null}
            {(currentView === 'impedance' || currentView === 'bode') && x.freq && drive ? (
              <FreqCanvas
                freq={x.freq}
                mode={currentView}
                fDrive={x.omega / (2 * Math.PI)}
                at={drive}
                corner={{ f: x.freq.wc / (2 * Math.PI), label: x.state.n === 1 ? 'f_c' : 'f₀' }}
                marks={marks.freq}
              />
            ) : null}
            {(currentView === 'impedance' || currentView === 'bode') && x.freq && drive ? <PlotCaption parts={caption} /> : null}
            {(currentView === 'impedance' || currentView === 'bode') && x.freq && drive ? <PlotMarks marks={marks.freq} /> : null}
            {currentView === 'acpower' && x.ac ? <AcPowerPane x={x} /> : null}
            {currentView === 'energy' && x.tr ? <EnergyCanvas energy={x.energy} tEnd={x.tEnd} cursor={x.cursor} onCursor={scrub} /> : null}
            {currentView === 'energy' && x.tr ? <PlotCaption parts={caption} /> : null}
            {currentView === 'damping' && x.damping ? <DampingCanvas exp={exp} params={params} at={x.damping.at} /> : null}
            {currentView === 'damping' && x.damping ? <PlotCaption parts={caption} /> : null}
            {currentView === 'equations' && eq ? (
              <EquationsPane
                eq={eq}
                solved={!!x.sol}
                primer={primerFor(exp)}
                fold={FOLDED_GROUPS.includes(exp.group)}
                contradiction={exp.theorem?.kind === 'contradiction' && !x.sol ? exp.theorem.rows : []}
                onHover={setHover}
              />
            ) : null}
            {currentView === 'power' && x.sol ? <PowerPane sol={x.sol} /> : null}
            {currentView === 'thevenin' && x.thevenin ? <TheveninPane th={x.thevenin} port={exp.port} named={viewLabel('thevenin', exp) === VIEW_LABELS.thevenin} /> : null}
            {currentView === 'superposition' && x.superposition ? <SuperpositionPane sp={x.superposition} /> : null}
            {currentView === 'sweep' && x.sweep ? (
              <SweepCanvas
                points={x.sweep.points}
                y={exp.sweepY || 'p'}
                at={params[exp.sweepId]}
                rth={x.thevenin ? x.thevenin.rth.test : null}
                efficiency={!!exp.sweepEfficiency}
                marks={marks.sweep}
              />
            ) : null}
            {currentView === 'sweep' && x.sweep ? <PlotCaption parts={caption} /> : null}
            {currentView === 'sweep' && x.sweep ? <PlotMarks marks={marks.sweep} /> : null}
            {!x.sol && currentView !== 'equations' ? (
              <p className="hint">Nothing to show until the circuit has a solution.</p>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  )
}

/** Radians as degrees, one decimal, wrapped to (−180°, 180°]. */
function deg(a) {
  const v = Math.atan2(Math.sin(a), Math.cos(a))
  return `${((v * 180) / Math.PI).toFixed(1)}°`
}

/** What the source is supplying in the steady state: P, Q and the power factor, from the AC power table. */
function AcPowerReadout({ x }) {
  const src = x.net.elements.find((e) => e.type === 'V' && e.wave && e.wave.kind === 'sine')
  if (!src) return null
  const V = x.ac.volt[src.id]
  const I = cx.cscale(x.ac.i[src.id], -1) // delivered, not absorbed
  const S = cx.cscale(cx.cmul(V, cx.conj(I)), 0.5)
  const apparent = cx.cabs(S)
  return (
    <>
      <span data-q="power">
        P <b>{num(S[0], 'W', 4)}</b>
      </span>
      <span data-q="power">
        Q <b>{num(S[1], 'var', 4)}</b>
      </span>
      <span>
        pf <b>{apparent > 0 ? (S[0] / apparent).toPrecision(3) : '—'}</b>
        <em className="prov"> {S[1] > 1e-12 * apparent ? 'lagging' : S[1] < -1e-12 * apparent ? 'leading' : 'unity'}</em>
      </span>
    </>
  )
}

/** Stored, dissipated and supplied so far, read off the energy bookkeeping at the sample nearest the cursor. */
function EnergyReadout({ energy, t }) {
  const pts = energy.points
  let k = 0
  for (let i = 1; i < pts.length; i++) if (Math.abs(pts[i].t - t) < Math.abs(pts[k].t - t)) k = i
  const q = pts[k]
  return (
    <>
      <span data-q="energy">
        stored <b>{num(q.stored, 'J', 3)}</b>
      </span>
      <span data-q="energy">
        dissipated <b>{num(q.dissipated, 'J', 3)}</b>
      </span>
      <span data-q="energy">
        supplied <b>{num(q.supplied, 'J', 3)}</b>
      </span>
    </>
  )
}

/**
 * Where this experiment sits in the thread: what it builds on and what builds
 * on it, each a chip that goes there. The student sees the course as a path,
 * not a list (student review, Phase 6).
 */
function Thread({ id, choose }) {
  const on = buildsOn(id)
  const to = leadsTo(id)
  if (!on.length && !to.length) return null
  const chip = (target) => {
    const e = byId[target]
    return (
      <button type="button" key={target} className="tag thread-chip" title={`${target.toUpperCase()} · ${e.name}`} onClick={() => choose(target)}>
        {target.toUpperCase()}
      </button>
    )
  }
  return (
    <p className="thread" data-role="thread">
      {on.length ? (
        <span className="thread-part" data-role="builds-on">
          <span className="thread-label">builds on</span> {on.map(chip)}
        </span>
      ) : null}
      {to.length ? (
        <span className="thread-part" data-role="leads-to">
          <span className="thread-label">leads to</span> {to.map(chip)}
        </span>
      ) : null}
    </p>
  )
}

/**
 * The phone's bottom bar (student review, Phase 8): the page is one scroll —
 * lesson, circuit, plot, knobs — and the bar names the four and goes to each,
 * lighting the one on screen. Hidden above 900 px by the stylesheet, where the
 * sidebar and the two panes are all on screen at once.
 */
const TABS = [
  ['lesson', 'Lesson', '.controls > .lesson'],
  ['circuit', 'Circuit', '.views .view:first-child'],
  ['plot', 'Plot', '.views .view:last-child'],
  ['knobs', 'Knobs', '.controls > .knobs'],
]
/**
 * The element that scrolls the page: on a phone base.css makes #root the
 * scroller (html and body stay one screen tall), on a desktop nothing does.
 */
function pageScroller() {
  for (let n = document.querySelector('.app'); n; n = n.parentElement) {
    const o = getComputedStyle(n).overflowY
    if ((o === 'auto' || o === 'scroll') && n.scrollHeight > n.clientHeight + 1) return n
  }
  return document.scrollingElement || document.documentElement
}
function TabBar() {
  const [on, setOn] = useState('lesson')
  useEffect(() => {
    let raf = 0
    const read = () => {
      raf = 0
      // The section on screen: the last one whose top has passed a third of the way down.
      const line = window.innerHeight * 0.35
      let hit = TABS[0][0]
      for (const [key, , sel] of TABS) {
        const el = document.querySelector(sel)
        if (el && el.getBoundingClientRect().top <= line) hit = key
      }
      // At the foot of a page too short to bring its last part up to the line, that part is the one on screen.
      const sc = pageScroller()
      const scrolls = sc.scrollHeight > sc.clientHeight + 2
      const atEnd = sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 2
      if (scrolls && atEnd) {
        const last = TABS.filter(([, , sel]) => document.querySelector(sel)).pop()
        if (last) hit = last[0]
      }
      setOn(hit)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read)
    }
    // Scroll events do not bubble; the capture phase on the document sees every scroller's.
    document.addEventListener('scroll', onScroll, { capture: true, passive: true })
    window.addEventListener('resize', onScroll)
    read()
    return () => {
      document.removeEventListener('scroll', onScroll, { capture: true })
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])
  const go = (sel) => {
    const el = document.querySelector(sel)
    if (!el) return
    // The bar is fixed at the foot of the screen, so the top is clear; the sections' scroll-margin keeps a breath above.
    el.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }
  return (
    <nav className="tabbar" data-role="tabbar" aria-label="Parts of the page">
      {TABS.map(([key, label, sel]) => (
        <button key={key} type="button" className={on === key ? 'on' : ''} aria-current={on === key ? 'true' : undefined} data-tab={key} onClick={() => go(sel)}>
          {label}
        </button>
      ))}
    </nav>
  )
}

/** Which view a pane is showing — Signal Lab's ViewSwitch, copied. */
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
 * Where you are and how to move: ◂ the current experiment ▸, one line, with the
 * whole tree folded underneath it. Before this the eight groups stood open
 * above the note and the knobs began a screen down (student review, 2026-09-02).
 * The buttons keep their `.preset` shape, so the harness picks experiments the
 * way it always did.
 */
function Picker({ id, choose, open, setOpen, openGroups, setOpenGroups, progress }) {
  const idx = EXPERIMENTS.findIndex((e) => e.id === id)
  const exp = EXPERIMENTS[idx]
  const prev = EXPERIMENTS[idx - 1]
  const next = EXPERIMENTS[idx + 1]
  const title = (e) => `${e.id.toUpperCase()} · ${e.name}`
  const finished = EXPERIMENTS.filter((e) => complete(e, progress[e.id])).length
  return (
    <nav className="picker" aria-label="Choose an experiment">
      <div className="picker-row">
        <button
          type="button"
          className="picker-step"
          disabled={!prev}
          aria-label={prev ? `Previous: ${title(prev)}` : 'This is the first experiment'}
          title={prev ? title(prev) : ''}
          onClick={() => prev && choose(prev.id)}
        >
          ◂
        </button>
        <button
          type="button"
          className="picker-current"
          aria-expanded={open}
          aria-controls="picker-list"
          title={open ? 'Fold the list of experiments' : 'Show every experiment'}
          onClick={() => setOpen((v) => !v)}
        >
          <b>{exp.id.toUpperCase()}</b>
          <span>{exp.name}</span>
          <i aria-hidden="true">{open ? '▴' : '▾'}</i>
        </button>
        <button
          type="button"
          className="picker-step"
          disabled={!next}
          aria-label={next ? `Next: ${title(next)}` : 'This is the last experiment'}
          title={next ? title(next) : ''}
          onClick={() => next && choose(next.id)}
        >
          ▸
        </button>
      </div>
      <div id="picker-list" className="picker-list" hidden={!open}>
        {finished ? (
          <p className="picker-arc" data-role="course-arc">
            <b>{finished}</b> of {EXPERIMENTS.length} experiments complete
          </p>
        ) : null}
        {GROUPS.map((g) => {
          const inGroup = EXPERIMENTS.filter((e) => e.group === g)
          return (
            <FoldGroup
              key={g}
              sectionKey={g}
              label={g}
              holdsActive={inGroup.some((e) => e.id === id)}
              intro={GROUP_INTRO[letterOf(g)]}
              arc={groupArc(inGroup, progress)}
              openGroups={openGroups}
              setOpenGroups={setOpenGroups}
            >
              {inGroup.map((e) => {
                const isDone = complete(e, progress[e.id])
                return (
                  <button
                    type="button"
                    key={e.id}
                    className={`preset${e.id === id ? ' is-on' : ''}`}
                    data-done={isDone || undefined}
                    title={isDone ? `${title(e)} — every step done` : title(e)}
                    onClick={() => choose(e.id)}
                  >
                    {e.name}
                    {isDone ? (
                      <span className="preset-done" aria-hidden="true">
                        ✓
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </FoldGroup>
          )
        })}
      </div>
    </nav>
  )
}

/**
 * One foldable sidebar group — Circuit Lab's FoldGroup, copied. The group
 * holding the active experiment cannot be folded, so where-you-are survives
 * any amount of tidying; the refusal happens on the summary click because the
 * browser folds a <details> before React hears about it.
 */
function FoldGroup({ sectionKey, label, holdsActive, intro, arc, openGroups, setOpenGroups, children }) {
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
        {arc && arc.done ? (
          <span className="group-arc" data-role="group-arc" title={`${arc.done} of ${arc.total} complete`}>
            {arc.done}/{arc.total}
          </span>
        ) : null}
      </summary>
      {intro ? <p className="hint group-blurb">{intro}</p> : null}
      <div className="presets">{children}</div>
    </details>
  )
}
