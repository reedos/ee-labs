import React, { useEffect, useMemo, useRef, useState } from 'react'
import { LabNav, NumField, ReportIssue, Schematic } from '@ee-labs/ui'
import { MathPanel } from '@ee-labs/explain'
import { complex as cx, equations, normalize } from '@ee-labs/network'
import { EXPERIMENTS, GROUPS, VIEW_ORDER, byId, defaultsOf, drawables, isDynamic, layoutOf, viewLabel } from './experiments.js'
import { analyse, atDrive, experimentMath, netPower, refusalReason, snapNoise } from './math.js'
import { firstUses } from './glossary.js'
import { GROUP_INTRO, buildsOn, introFor, leadsTo, letterOf, opensGroup } from './course.js'
import { reportSummary } from './report.js'
import { forReading, num, scaleOf } from './format.js'
import { EquationsPane, ReadingsPane, Refusal } from './components/panes.jsx'
import ScopeCanvas from './components/ScopeCanvas.jsx'
import FreqCanvas from './components/FreqCanvas.jsx'
import ErrorBarCanvas from './components/ErrorBarCanvas.jsx'
import ContribCanvas from './components/ContribCanvas.jsx'
import { DefCard, Marked, TermChips } from './components/Prose.jsx'
import { familyOf } from './palette.js'
import pkg from '../package.json'

// The Instruments Lab's shell: Circuit Elements Lab's layout, with this lab's
// seven views and its two new ones.
//
// The rule the whole app obeys is that it computes nothing. `analyse` in
// math.js solves the circuit once per setting, and every pane, meter and
// headline reads that one analysis. A number on the schematic and the same
// number in a plot are therefore the same number, not two computations that
// happen to agree today.

// The cursor's play: the whole window in this many milliseconds, whatever the
// window is, so a 10 τ transient and a four-cycle sine both take one breath.
const PLAY_MS = 4000
const FIRST = EXPERIMENTS[0].id

/** The chrome the topbar wears, by instrument. */
const INSTRUMENT = {
  scope: 'Oscilloscope',
  dmm: 'Multimeter',
  analyser: 'Spectrum analyser',
  lockin: 'Lock-in amplifier',
}

/** The cursor an experiment opens at: its own fraction of its window at the defaults. */
const cursorFor = (exp, p) => (isDynamic(exp) ? exp.cursor * exp.window(p) : null)
/** The experiment after this one on the path: the next in the list when it builds on this one, else the first that does. */
const nextUp = (exp) => {
  const seq = EXPERIMENTS[EXPERIMENTS.indexOf(exp) + 1]
  const to = leadsTo(exp.id)
  if (seq && to.includes(seq.id)) return seq.id
  return to[0] || (seq ? seq.id : null)
}
/** The knob open when nothing else is: the first that is not the window's. */
const firstKnob = (exp) => (exp.params.find((p) => !(p.key === 'N' && exp.window)) || {}).key
/**
 * Back to the top of the page and of the sidebar.
 *
 * The page itself never scrolls: base.css gives html, body and #root
 * `overflow: hidden`, and on a phone it is #root alone that turns to
 * `overflow: auto`. So `window.scrollTo` moved nothing there, and opening the
 * picker and reaching down it for C5 left the reader in the middle of C5 with
 * its note and its first knob above the screen.
 */
const toTop = () => {
  const aside = document.querySelector('.controls')
  if (aside) aside.scrollTop = 0
  const root = document.getElementById('root')
  if (root) root.scrollTop = 0
  window.scrollTo(0, 0)
}
const deg = (rad) => `${((rad * 180) / Math.PI).toFixed(1)}°`

export default function App() {
  const [id, setId] = useState(FIRST)
  const [params, setParams] = useState(() => defaultsOf(FIRST))
  const [show, setShow] = useState(byId[FIRST].show)
  const [view, setView] = useState(byId[FIRST].view)
  // The instant the schematic reads, in seconds; null for the static experiments.
  const [cursor, setCursor] = useState(() => cursorFor(byId[FIRST], defaultsOf(FIRST)))
  const [pickerOpen, setPickerOpen] = useState(false)
  const [openGroups, setOpenGroups] = useState(() => new Set([GROUPS[0]]))
  // The one term whose definition is open, and the paragraph it was opened from.
  const [openTerm, setOpenTerm] = useState(null)
  const [openKnob, setOpenKnob] = useState(null)
  const [focusStep, setFocusStep] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [hover, setHover] = useState(null)
  const [deeperOpen, setDeeperOpen] = useState(false)

  const exp = byId[id]
  const uses = useMemo(() => firstUses(exp), [exp])
  const steps = exp.try || []

  const choose = (next) => {
    // Also here, and not only in the effect below: picking the experiment that
    // is already open changes no state, so the effect does not run, and the
    // reader is left wherever reaching down the picker scrolled them to.
    toTop()
    setId(next)
    setParams(defaultsOf(next))
    setShow(byId[next].show)
    setView(byId[next].view)
    setCursor(cursorFor(byId[next], defaultsOf(next)))
    setPickerOpen(false)
    setOpenTerm(null)
    setOpenKnob(null)
    setFocusStep(null)
    setPlaying(false)
    setHover(null)
    setDeeperOpen(false)
  }
  const scrub = (t) => {
    setPlaying(false)
    setCursor(t)
  }
  const setParam = (key, value) => {
    setParams((p) => ({ ...p, [key]: value }))
    setFocusStep(null)
  }
  /** A try step, applied: its knobs turn and its cursor moves, so the screen answers at once. */
  const runStep = (i) => {
    const t = steps[i]
    setFocusStep(i === focusStep ? null : i)
    if (t.set) setParams((p) => ({ ...p, ...t.set }))
    if (t.at != null) setCursor(t.at)
    if (t.set) setOpenKnob(Object.keys(t.set)[0])
  }

  // One analysis per setting, and every pane reads it.
  const x = useMemo(() => analyse(exp, params, cursor), [exp, params, cursor])
  const dynamic = isDynamic(exp)
  // The equations, with their live numbers where the solve they came from is
  // the one on screen. A sine-driven experiment with no time axis reads its
  // meters from the steady state (math.js `snap`), and the DC system the
  // equations describe is a different solve at a different instant, so the
  // pane shows the system without pretending its zeros are the reading.
  //
  // Its source rows carry the instantaneous drive rather than the wave's
  // resting `value`. A source written as {value: 0, wave: sine(1 V)} otherwise
  // printed the constraint "v_tip = 0" beside a schematic reading v_tip = 1 V.
  const eq = useMemo(() => {
    try {
      if (x.sol && !x.snap) return equations(x.sol.norm, x.sol)
      const net = x.snap
        ? { ...x.net, elements: x.net.elements.map((e) => (e.wave ? { ...e, value: x.snap.volt[e.id] ?? e.value, wave: undefined } : e)) }
        : x.net
      return equations(normalize(net))
    } catch {
      return null
    }
  }, [x])
  const math = useMemo(() => experimentMath(exp, params, x), [exp, params, x])
  const readable = useMemo(() => forReading(math), [math])
  const elements = useMemo(() => drawables(exp, params), [exp, params])
  const layout = useMemo(() => layoutOf(exp, params), [exp, params])
  // What the meters, the readout and the reading table all show: the transient
  // at the cursor where there is one, the steady state at the drive's peak
  // where the experiment has no time axis, and the DC solve otherwise.
  const reading = x.snap || x.sol
  const meters = useMemo(() => (reading ? snapNoise(reading) : null), [reading])
  const drive = useMemo(() => (x.ac && exp.sweep ? atDrive(exp, x) : null), [exp, x])
  // The curves the scope draws beside its traces. B1's is the alias: the other
  // tone that the same dots belong to, which is what makes the dots the lesson.
  const guides = useMemo(() => (x.samples && x.samples.alias ? [{ f: x.samples.alias.of, label: x.samples.alias.label }] : []), [x])
  const lit = useMemo(() => {
    const nodes = new Set()
    const els = new Set()
    if (hover && hover.node) nodes.add(hover.node)
    if (hover && hover.el) els.add(hover.el)
    return { nodes, elements: els }
  }, [hover])
  // The topbar's numbers are the math entry's own value rows: the reading the
  // experiment is about, then the two that decide it. They are already computed
  // for the panel below, so the topbar cannot quote a different arithmetic.
  //
  // The rows come from the last block, not the first. An experiment's blocks
  // are its `claim` keys in the order they build, so the last one is the claim
  // the experiment is named for. F2 carries resolution and then accuracy, and
  // taking the first three rows put F1's three numbers on F2's topbar: its
  // first try step raised the counts term from 2 to 5 and not one number on
  // the first screen moved.
  const headline = useMemo(() => {
    const blocks = math.blocks.filter((b) => b.kind === 'values')
    return (blocks[blocks.length - 1]?.rows || []).slice(0, 3)
  }, [math])

  // The play: from where the cursor is (or from 0, at the end) to the end of the
  // window at PLAY_MS per window, one frame at a time. It re-arms when the
  // window changes under it and stops itself at the end.
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
  // A new experiment shows from its top, sidebar and page alike.
  useEffect(toTop, [id])

  const nodeCount = x.sol ? x.sol.norm.n : normalize(x.net).n
  // The imbalance belongs to the solve the meters are reading, so a steady-state
  // reading quotes the phasor solve's residual and not the DC one's.
  const residual = reading ? num(x.snap ? x.ac.maxResidual : x.sol.maxResidual, 'A', 2, scaleOf(reading.i)) : null
  const outcome = x.sol ? `current in = current out at every node (KCL), largest imbalance ${residual}` : `refused: ${x.refusal.code}`
  const currentView = exp.views.includes(view) ? view : exp.view
  const viewOptions = VIEW_ORDER.filter((v) => exp.views.includes(v)).map((v) => ({ id: v, ...viewLabel(v) }))
  const windowKnob = exp.window ? exp.params.find((p) => p.key === 'N') : null

  return (
    <div className="app">
      <aside className="controls">
        <header>
          <LabNav current="instruments-lab" currentLabel="Instruments" />
          <h1>Instruments Lab</h1>
          <p className="sub">How instruments work, as the circuits they are.</p>
          <ReportIssue
            lab="Instruments Lab"
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
          <div className="picker" data-role="picker">
            <button type="button" className="picker-current" aria-expanded={pickerOpen} onClick={() => setPickerOpen((v) => !v)}>
              <b>{exp.id.toUpperCase()}</b> {exp.name}
              <span aria-hidden="true">{pickerOpen ? ' ▴' : ' ▾'}</span>
            </button>
            {pickerOpen ? (
              <div className="picker-list">
                {GROUPS.map((g) => (
                  <div className="preset-group" key={g}>
                    <button
                      type="button"
                      className="picker-row"
                      aria-expanded={openGroups.has(g)}
                      onClick={() =>
                        setOpenGroups((s) => {
                          const next = new Set(s)
                          if (next.has(g)) next.delete(g)
                          else next.add(g)
                          return next
                        })
                      }
                    >
                      {g}
                    </button>
                    {openGroups.has(g)
                      ? EXPERIMENTS.filter((e) => e.group === g).map((e) => (
                          <button
                            key={e.id}
                            type="button"
                            className={`preset${e.id === id ? ' on' : ''}`}
                            aria-current={e.id === id ? 'true' : undefined}
                            onClick={() => choose(e.id)}
                          >
                            <b>{e.id.toUpperCase()}</b> {e.name}
                          </button>
                        ))
                      : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {opensGroup(exp) ? (
            <details className="group-intro" data-role="group-intro">
              <summary>
                <b>Group {letterOf(exp.group)}</b> starts here — what it is for
              </summary>
              <p>{introFor(exp)}</p>
            </details>
          ) : null}

          <p className="note" data-role="see">
            <Marked text={exp.see} marks={uses.see} field="see" open={openTerm} onOpen={setOpenTerm} />
          </p>
          {uses.unplaced.length ? <TermChips ids={uses.unplaced} field="see" open={openTerm} onOpen={setOpenTerm} /> : null}
          <DefCard open={openTerm} field="see" exp={exp} onClose={() => setOpenTerm(null)} choose={choose} />

          {steps.length ? (
            <ol className="try" data-role="try" aria-label="Try">
              {steps.map((t, i) => (
                <li key={i} data-step={i} data-shown={i === focusStep || undefined}>
                  <span className="step-n" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="step-body">
                    <button type="button" className="step-text" data-role="try-step" onClick={() => runStep(i)} title="Turn the knobs this step names">
                      <Marked text={t.say} marks={uses[`try.${i}`]} field={`try.${i}`} open={openTerm} onOpen={setOpenTerm} />
                    </button>
                  </span>
                </li>
              ))}
            </ol>
          ) : null}
          {openTerm && openTerm.field.startsWith('try.') ? (
            <DefCard open={openTerm} field={openTerm.field} exp={exp} onClose={() => setOpenTerm(null)} choose={choose} />
          ) : null}

          <p className="thread" data-role="thread">
            {buildsOn(exp.id).length ? (
              <>
                <span className="thread-label">builds on</span>
                {buildsOn(exp.id).map((b) => (
                  <button key={b} type="button" className="thread-chip" onClick={() => choose(b)} title={byId[b].name}>
                    {b.toUpperCase()}
                  </button>
                ))}
              </>
            ) : null}
            {nextUp(exp) ? (
              <>
                <span className="thread-label">next</span>
                <button type="button" className="thread-chip" onClick={() => choose(nextUp(exp))} title={byId[nextUp(exp)].name}>
                  {nextUp(exp).toUpperCase()}
                </button>
              </>
            ) : null}
          </p>
        </section>

        <section className="knobs" id="knobs">
          <h2>Knobs</h2>
          <div className="knob-list">
            {exp.params
              // The window knob sits with the cursor it scales, under the schematic.
              .filter((p) => !(p.key === 'N' && exp.window))
              .map((p) => {
                const open = (openKnob ?? firstKnob(exp)) === p.key
                return (
                  <div className="knob-slot" key={p.key} data-key={p.key} data-open={open} onFocus={() => setOpenKnob(p.key)} onClick={() => setOpenKnob(p.key)}>
                    {p.kind === 'toggle' || p.kind === 'choice' ? (
                      <div className="toggle-knob" data-role="toggle" data-key={p.key}>
                        <span className="toggle-label">{p.label}</span>
                        <div className="segmented sm" role="group" aria-label={p.label}>
                          {(p.kind === 'choice'
                            ? p.options.map((o) => [o.value, o.label])
                            : [
                                [true, p.on],
                                [false, p.off],
                              ]
                          ).map(([val, label]) => (
                            <button key={String(val)} type="button" className={params[p.key] === val ? 'on' : ''} aria-pressed={params[p.key] === val} onClick={() => setParam(p.key, val)}>
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
          {/* One fold: why it works, then the solver's own working with its check tables. */}
          <details className="deeper-fold" data-role="deeper" open={deeperOpen} onToggle={(e) => setDeeperOpen(e.target.open)}>
            <summary>Explanation and working</summary>
            <div className="why" data-role="why">
              <p className="hint">
                <Marked text={exp.why} marks={uses.why} field="why" open={openTerm} onOpen={setOpenTerm} />
              </p>
              <DefCard open={openTerm} field="why" exp={exp} onClose={() => setOpenTerm(null)} choose={choose} />
            </div>
            <MathPanel entry={readable} />
          </details>
        </section>
      </aside>

      <div className="topbar">
        <nav className="flow" aria-label="Experiment summary">
          <span className="flow-node" data-role="instrument">
            {INSTRUMENT[exp.instrument] || exp.instrument}
            <em>
              {exp.id.toUpperCase()} · {exp.name}
            </em>
          </span>
          <span className="flow-arrow" aria-hidden="true">
            →
          </span>
          <span
            className="flow-node"
            data-role="system-size"
            title="Nodes are the junctions where elements meet, ground included. The numbers to find are the solver's unknowns: one voltage per node except ground, plus the current through each element that fixes a voltage."
          >
            {nodeCount} node{nodeCount === 1 ? '' : 's'}
            <em>{eq ? `${eq.unknowns.length} number${eq.unknowns.length === 1 ? '' : 's'} to find` : 'nothing to solve'}</em>
          </span>
          <span className="flow-arrow" aria-hidden="true">
            →
          </span>
          <span className={`flow-node ${x.sol ? 'is-out' : 'is-off'}`} data-role="outcome" title={x.sol ? `Solved. The largest imbalance left by the arithmetic is ${residual}.` : undefined}>
            {x.sol ? 'every node balances' : 'no solution'}
            <em>{x.sol ? `current in = current out, to ${residual}` : refusalReason(x.refusal)}</em>
          </span>
        </nav>
        <div className="topbar-controls">
          {headline.map((r) => (
            <span className="topbar-field" key={r.label} data-role="headline" title={r.note || undefined}>
              <span>{r.label}</span>
              <b>{Number.isFinite(r.value) ? num(r.value, r.unit, 4) : '—'}</b>
            </span>
          ))}
          {dynamic && x.tr ? (
            <span className="topbar-field" data-role="cursor-time">
              <span>t</span>
              <b>{num(x.cursor, 's', 3)}</b>
            </span>
          ) : null}
          {reading && show === 'p' ? (
            <span className="topbar-field" data-role="net-power">
              <span>Σ power</span>
              <b>{num(netPower(reading), 'W', 2, scaleOf(reading.p))}</b>
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
                <button key={k} type="button" className={show === k ? 'on' : ''} aria-pressed={show === k} title={title} onClick={() => setShow(k)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="readout">
              {meters ? (
                Object.entries(meters.v)
                  .filter(([n]) => n !== 'gnd')
                  .map(([n, v]) => (
                    <span key={n} data-q="voltage" data-node={n}>
                      v_{n} <b>{num(v, 'V', 4)}</b>
                    </span>
                  ))
              ) : (
                <span className="flag warn">no solution. The reason is below</span>
              )}
            </div>
          </div>
          <div className="view-body" data-show={show}>
            <Schematic className="big" elements={elements} layout={layout} meters={show === 'none' ? null : meters} show={show} lit={lit} />
            {x.refusal ? <Refusal err={x.refusal} /> : null}
            {/* No cursor to move, so the instant is stated instead of scrubbed. */}
            {x.snap ? (
              <p className="cursor-row still" data-role="steady">
                the meters read the circuit at <b>t = {num(x.snapAt, 's', 3)}</b>, where the {num(x.omega / (2 * Math.PI), 'Hz', 4)} drive is at its peak
              </p>
            ) : null}
            {dynamic && x.tr ? (
              <div className="cursor-row" data-role="cursor">
                <div className="cursor-head">
                  <label htmlFor="cursor-slider">
                    <span className="cursor-lead">the meters read </span>the circuit at <b>t = {num(x.cursor, 's', 3)}</b>
                  </label>
                  {windowKnob ? (
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
            <div className="segmented sm view-switch" role="group" aria-label="What the lower pane shows">
              {viewOptions.map((o) => (
                <button key={o.id} type="button" className={currentView === o.id ? 'on' : ''} aria-pressed={currentView === o.id} title={o.title} onClick={() => setView(o.id)}>
                  {o.label}
                </button>
              ))}
            </div>
            <div className="readout">
              {currentView === 'scope' && x.tr
                ? [...exp.scope.left.traces, ...(exp.scope.right ? exp.scope.right.traces : [])].map((q) => (
                    <span key={`${q.q}.${q.key}`} data-q={familyOf(q)}>
                      {q.label} <b>{num(x.sol[q.q][q.key], q.q === 'i' ? 'A' : q.q === 'p' ? 'W' : 'V', 4)}</b>
                    </span>
                  ))
                : null}
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
              {currentView === 'impedance' && drive ? (
                <>
                  <span data-q="voltage">
                    |Z| <b>{num(cx.cabs(drive.Z), 'Ω', 4)}</b>
                  </span>
                  <span data-q="angle">
                    ∠Z <b>{deg(cx.carg(drive.Z))}</b>
                  </span>
                </>
              ) : null}
              {currentView === 'errorbar' && x.meter ? (
                <>
                  <span data-q="voltage">
                    display <b>{num(x.meter.shown, 'V', 5)}</b>
                  </span>
                  <span data-q="power">
                    error <b>{x.meter.errorPct.toPrecision(3)} %</b>
                    <em className="prov"> against {num(x.meter.true, 'V', 5)}</em>
                  </span>
                </>
              ) : null}
              {currentView === 'contrib' && x.sens ? (
                <>
                  <span data-q="current">
                    quadrature <b>{x.sens.quad.toPrecision(3)} %</b>
                  </span>
                  <span>
                    worst case <b>{x.sens.worst.toPrecision(3)} %</b>
                  </span>
                </>
              ) : null}
            </div>
          </div>
          <div className="view-body">
            {currentView === 'reading' && reading ? <ReadingsPane sol={reading} elements={elements} /> : null}
            {currentView === 'equations' && eq ? <EquationsPane eq={eq} solved={!!x.sol && !x.snap} fold={false} onHover={setHover} /> : null}
            {currentView === 'scope' && x.tr ? (
              <ScopeCanvas tr={x.tr} scope={exp.scope} cursor={x.cursor} onCursor={scrub} samples={x.samples} guides={guides} />
            ) : null}
            {(currentView === 'impedance' || currentView === 'bode') && x.freq && drive ? (
              <FreqCanvas freq={x.freq} mode={currentView} fDrive={x.omega / (2 * Math.PI)} at={drive} corner={null} />
            ) : null}
            {currentView === 'errorbar' && x.meter ? <ErrorBarCanvas meter={x.meter} unit="V" /> : null}
            {currentView === 'contrib' && x.sens ? <ContribCanvas sens={x.sens} /> : null}
            {!x.sol && currentView !== 'equations' ? <p className="hint">No solution to plot. The reason is above.</p> : null}
          </div>
        </section>
      </main>

      {/* The phone's tab bar. styles.css has carried the whole component since
          the shell was written — the fixed bar, its four columns, the active
          colour, the scroll-margin the jump lands on, and 72 px of clearance
          under Deeper for it — and nothing rendered it. On a phone the first
          knob sits 1100 px down the page, so the reader had a scroll and no
          way to jump. `display: none` off the phone keeps the desktop as it is. */}
      <nav className="tabbar" aria-label="Parts of this page">
        {[
          ['Lesson', '.controls > .lesson'],
          ['Circuit', '.views .view'],
          ['Analysis', '.views .view:nth-of-type(2)'],
          ['Knobs', '.controls > .knobs'],
        ].map(([label, sel]) => (
          <button key={label} type="button" onClick={() => document.querySelector(sel)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}
