import React, { useEffect, useMemo, useState } from 'react'
import { LabNav, LessonNav, NumField, ReportIssue, TryLine } from '@ee-labs/ui'
import { stateText } from '@ee-labs/codes'
import { EXPERIMENTS, GROUPS, VIEW_LABELS, VIEW_ORDER, byId, defaultsOf } from './experiments.js'
import { analyse } from './analysis.js'
import { TERMS } from './terms.js'
import { reportSummary } from './report.js'
import { fmtBits, fmtRate } from './format.js'
import { ChannelPane, CodeTable, DecodePane, EncoderTable, FieldPane, GraphPane, Refusal, SourcePane } from './components/panes.jsx'
import CurveCanvas from './components/CurveCanvas.jsx'
import GainCanvas from './components/GainCanvas.jsx'
import TannerCanvas from './components/TannerCanvas.jsx'
import TreeCanvas from './components/TreeCanvas.jsx'
import TrellisCanvas from './components/TrellisCanvas.jsx'
import WeightCanvas from './components/WeightCanvas.jsx'
import pkg from '../package.json'

// The shell. One experiment at a time: its objects are built once
// (analysis.js's `analyse`), and every pane below reads that one result, so the
// code table, the trellis walker and the topbar can never disagree.
//
// Layout follows the plan (§4.1): a sidebar with the lesson and its knobs, a
// topbar of headline numbers, and one pane with a switch over the views the
// experiment offers.

const FIRST = EXPERIMENTS[0].id

export default function App() {
  const [id, setId] = useState(FIRST)
  const [params, setParams] = useState(() => defaultsOf(FIRST))
  const [view, setView] = useState(byId[FIRST].view)
  const [cursor, setCursor] = useState(null)
  const [openGroups, setOpenGroups] = useState(() => new Set())
  const [openTerm, setOpenTerm] = useState(null)

  const exp = byId[id]
  const idx = EXPERIMENTS.indexOf(exp)
  const prev = EXPERIMENTS[idx - 1]
  const next = EXPERIMENTS[idx + 1]
  const defaults = useMemo(() => defaultsOf(id), [id])
  const dirty = useMemo(() => Object.keys(defaults).some((k) => params[k] !== defaults[k]), [params, defaults])

  const choose = (nextId) => {
    setId(nextId)
    setParams(defaultsOf(nextId))
    setView(byId[nextId].view)
    setCursor(null)
    setOpenTerm(null)
  }

  useEffect(() => {
    const aside = document.querySelector('.controls')
    if (aside) aside.scrollTop = 0
  }, [id])

  const x = useMemo(() => analyse(exp, params), [exp, params])
  const currentView = exp.views.includes(view) ? view : exp.view
  const viewOptions = VIEW_ORDER.filter((v) => exp.views.includes(v)).map((v) => ({ id: v, ...VIEW_LABELS[v] }))
  const setParam = (key, value) => setParams((p) => ({ ...p, [key]: value }))
  const applyStep = (t) => {
    setParams((p) => ({ ...p, ...(t.set || {}) }))
    if (t.set) setCursor(null)
  }

  // The scrubber, where the view has one: the trellis walks its steps and the
  // Tanner graph walks its iterations.
  const scrub = scrubberOf(x, currentView)
  const at = cursor == null ? scrub && scrub.last : Math.min(cursor, scrub ? scrub.last : 0)

  return (
    <div className="app">
      <aside className="controls">
        <header>
          <LabNav current="info-lab" currentLabel="Information" />
          <h1>Information Lab</h1>
          <p className="sub">Entropy, capacity, and the codes that reach them.</p>
          <ReportIssue lab="Information Lab" version={pkg.version} state={{ id, params, view: currentView, cursor }} summary={reportSummary(exp, params, x, currentView)} />
        </header>

        <section className="lesson">
          <h2>
            Experiment
            <span className="h2-aside">
              {idx + 1} of {EXPERIMENTS.length}
            </span>
          </h2>
          <LessonNav index={idx} total={EXPERIMENTS.length} onPrev={() => prev && choose(prev.id)} onNext={() => next && choose(next.id)} onReset={() => setParams(defaults)} dirty={dirty} noun="experiment" />
          <div className="picker-groups">
            {GROUPS.map((g) => {
              const inGroup = EXPERIMENTS.filter((e) => e.group === g)
              const holdsActive = inGroup.some((e) => e.id === id)
              return (
                <details
                  key={g}
                  className="preset-group"
                  open={holdsActive || openGroups.has(g)}
                  onToggle={(e) => {
                    const set = new Set(openGroups)
                    if (e.target.open) set.add(g)
                    else set.delete(g)
                    setOpenGroups(set)
                  }}
                >
                  <summary onClick={(e) => holdsActive && e.preventDefault()}>
                    {g}
                    {holdsActive ? <span className="group-active-dot" aria-hidden="true" /> : null}
                  </summary>
                  <div className="presets">
                    {inGroup.length ? (
                      inGroup.map((e) => (
                        <button key={e.id} type="button" className={`preset${e.id === id ? ' is-on' : ''}`} title={`${e.id.toUpperCase()} · ${e.name}`} onClick={() => choose(e.id)}>
                          <b>{e.id.toUpperCase()}</b> {e.name}
                        </button>
                      ))
                    ) : (
                      <p className="hint empty">This group waits on the Communications Lab.</p>
                    )}
                  </div>
                </details>
              )
            })}
          </div>

          <h3 className="note-title">{exp.name}</h3>
          <p className="hint see" data-role="see">
            {exp.see}
          </p>

          <div className="terms" data-role="terms">
            <h4>Terms</h4>
            <div className="term-chips">
              {exp.terms.map((t) => (
                <button key={t} type="button" className={`chip${openTerm === t ? ' is-on' : ''}`} aria-expanded={openTerm === t} onClick={() => setOpenTerm(openTerm === t ? null : t)}>
                  {TERMS[t] ? TERMS[t].name : t}
                </button>
              ))}
            </div>
            {openTerm && TERMS[openTerm] ? (
              <div className="def-card">
                <div className="def-head">
                  <b>{TERMS[openTerm].name}</b>
                  <button type="button" className="def-close" onClick={() => setOpenTerm(null)} aria-label="Close">
                    &times;
                  </button>
                </div>
                <p>{TERMS[openTerm].def}</p>
              </div>
            ) : null}
          </div>

          <div className="try-list" data-role="try">
            <h4>Try</h4>
            {exp.try.map((t, i) => (
              <TryLine key={i} text={t.say} chips={t.set ? [{ label: 'apply' }] : []} onChip={() => applyStep(t)} />
            ))}
          </div>
        </section>

        <section className="knobs">
          <h2>Knobs</h2>
          <div className="knob-list">
            {exp.params.map((p) => (
              <div className="knob-slot" key={p.key}>
                <KnobField p={p} value={params[p.key]} onChange={(v) => setParam(p.key, v)} />
              </div>
            ))}
          </div>
        </section>

        <section className="deeper">
          <h2>Deeper</h2>
          <details className="deeper-fold">
            <summary>Why it works</summary>
            <p className="hint why" data-role="why">
              {exp.why}
            </p>
          </details>
        </section>
      </aside>

      <div className="topbar">
        <nav className="flow" aria-label="Experiment summary">
          <span className="flow-node">
            {exp.id.toUpperCase()}
            <em>{exp.name}</em>
          </span>
          <span className="flow-arrow" aria-hidden="true">
            &rarr;
          </span>
          {headline(x).map((cell, i) => (
            <React.Fragment key={cell.label}>
              {i ? (
                <span className="flow-arrow" aria-hidden="true">
                  &rarr;
                </span>
              ) : null}
              <span className={`flow-node${cell.tone ? ` is-${cell.tone}` : ''}`} data-role={cell.role}>
                {cell.value}
                <em>{cell.label}</em>
              </span>
            </React.Fragment>
          ))}
        </nav>
      </div>

      <main className="views">
        <section className="view">
          <div className="view-head">
            <h2>{VIEW_LABELS[currentView].label}</h2>
            <ViewSwitch value={currentView} onChange={setView} options={viewOptions} />
          </div>
          <div className="view-body">
            {x.refusal ? <Refusal refusal={x.refusal} /> : null}
            <Pane view={currentView} x={x} step={at} />
            {scrub ? (
              <div className="cursor-row" data-role="cursor">
                <label htmlFor="scrub">
                  {scrub.label} <b>{at}</b> of {scrub.last}
                </label>
                <input id="scrub" className="num-slider" type="range" min={0} max={scrub.last} step={1} value={at} onChange={(e) => setCursor(Number(e.target.value))} />
              </div>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  )
}

/** Which pane the view switch is showing. */
function Pane({ view, x, step }) {
  if (view === 'source') return <SourcePane x={x} />
  if (view === 'channel') return <ChannelPane x={x} />
  if (view === 'decode') return <DecodePane x={x} />
  if (view === 'field') return <FieldPane x={x} />
  if (view === 'curve') return x.curve ? <CurveCanvas curve={x.curve} /> : <p className="pane-empty">This experiment sweeps nothing.</p>
  if (view === 'gain') {
    const g = x.gain
    if (!g) return <p className="pane-empty">This experiment measures no gain.</p>
    return (
      <GainCanvas
        curve={g.curve}
        target={g.target}
        limits={[{ ebN0Db: g.limitDb, label: `limit at ${g.efficiency} bit/s/Hz` }]}
        marks={g.crossoverDb === null || g.crossoverDb === undefined ? [] : [{ ebN0Db: g.crossoverDb, ber: g.crossoverBer, label: 'the curves cross' }]}
        gain={g.real === undefined ? null : { real: g.real, coded: g.atCoded, uncoded: g.atUncoded }}
      />
    )
  }
  if (view === 'tree') return x.source ? <TreeCanvas code={x.source.code} arith={x.source.arith} /> : <p className="pane-empty">This experiment has no source.</p>
  if (view === 'weights') {
    if (x.block) return <WeightCanvas weights={x.block.weights || []} d={x.block.d} t={x.block.t} detect={x.block.detect} label="codewords" />
    if (x.gain && x.gain.weights) return <WeightCanvas weights={x.gain.weights} d={x.gain.d} t={x.gain.t} detect={x.gain.detect} label="codewords" />
    if (x.gain && x.gain.spectrumA) return <WeightCanvas weights={x.gain.spectrumA} d={x.gain.dFree} label="error events" />
    if (x.conv && x.conv.spectrum) return <WeightCanvas weights={x.conv.spectrum.a} d={x.conv.dfree} label="error events" />
    if (x.conv) return <p className="pane-empty">The spectrum is drawn for the reference code.</p>
    return <p className="pane-empty">This experiment has no weights.</p>
  }
  if (view === 'table') {
    if (x.block) return <CodeTable x={x} />
    if (x.conv) return <EncoderTable x={x} />
    if (x.ldpc) return <GraphPane x={x} />
    return <p className="pane-empty">This experiment has no table.</p>
  }
  if (view === 'trellis') {
    const v = x.conv
    if (!v) return <p className="pane-empty">This experiment has no trellis.</p>
    // A trellis of 64 states or more has no picture in it at this size, so the
    // pane says which code it draws rather than drawing a smear of them.
    if (v.enc.states > 32)
      return (
        <p className="pane-empty">
          A trellis of {v.enc.states} states does not fit a screen. Set the constraint length to 3 or 5 to walk one.
        </p>
      )
    const states = Array.from({ length: v.enc.states }, (_, s) => stateText(v.enc, s))
    return <TrellisCanvas states={states} steps={v.viterbi.steps} path={v.viterbi.path} step={step} height={Math.max(220, Math.min(420, 26 * v.enc.states))} />
  }
  if (view === 'tanner') {
    const g = x.ldpc
    if (!g) return <p className="pane-empty">This experiment has no graph.</p>
    const it = g.bp && g.bp.iterations.length ? g.bp.iterations[Math.max(0, Math.min(step, g.bp.iterations.length) - 1)] : null
    const bits = it ? it.bits : g.received
    return <TannerCanvas graph={g.graph} beliefs={it ? it.toVar : null} bits={bits} failing={failingOf(g, bits)} />
  }
  return null
}

/** Which checks a word fails, as one bit per check. */
const failingOf = (g, bits) => g.H.map((row) => row.reduce((acc, b, i) => acc ^ (b & bits[i]), 0))

/** The topbar's cells: what this experiment is about, in two or three numbers. */
function headline(x) {
  const out = []
  if (x.source) {
    out.push({ label: 'entropy', value: fmtBits(x.source.H), role: 'entropy' })
    out.push({ label: 'average length', value: fmtBits(x.source.meanLength), role: 'length' })
  }
  if (x.capacity) {
    if (x.capacity.awgn !== undefined) out.push({ label: 'capacity', value: fmtBits(x.capacity.awgn, 'bit/s/Hz'), role: 'capacity' })
    if (x.capacity.bsc !== undefined) out.push({ label: 'symmetric capacity', value: fmtBits(x.capacity.bsc, 'bit per use'), role: 'bsc' })
    if (x.capacity.limitDb !== undefined) out.push({ label: 'Shannon limit', value: `${x.capacity.limitDb.toFixed(3)} dB`, role: 'limit' })
  }
  if (x.block) {
    out.push({ label: 'code', value: `(${x.block.n},${x.block.k}) d = ${x.block.d}`, role: 'code' })
    out.push({ label: 'rate', value: fmtRate(x.block.rate), role: 'rate' })
    out.push({
      label: x.block.decoded ? (x.block.right ? 'decoded rightly' : 'decoded to another word') : 'syndrome',
      value: x.block.syndrome.join('') || '—',
      role: 'outcome',
      tone: x.block.decoded && !x.block.right ? 'off' : 'out',
    })
  }
  if (x.field) {
    out.push({ label: 'code', value: `${x.field.rs.name} d = ${x.field.rs.d}`, role: 'code' })
    out.push({ label: 'erasures', value: `${x.field.positions.length} of ${x.field.rs.erasures}`, role: 'erasures', tone: x.field.refusal ? 'off' : 'out' })
  }
  if (x.conv) {
    out.push({ label: 'encoder', value: `K = ${x.conv.enc.K}, ${x.conv.enc.states} states`, role: 'code' })
    out.push({ label: 'free distance', value: String(x.conv.dfree), role: 'dfree' })
    out.push({ label: 'bits wrong', value: String(x.conv.errors), role: 'outcome', tone: x.conv.errors ? 'off' : 'out' })
  }
  if (x.ldpc) {
    out.push({ label: 'graph', value: `${x.ldpc.graph.n} bits, ${x.ldpc.graph.m} checks`, role: 'code' })
    out.push({ label: 'rate', value: fmtRate(x.ldpc.rate), role: 'rate' })
    if (x.ldpc.bp)
      out.push({
        label: x.ldpc.bp.converged ? `converged at ${x.ldpc.bp.iteration}` : 'did not converge',
        value: String(x.ldpc.bp.syndromeWeights[x.ldpc.bp.syndromeWeights.length - 1]),
        role: 'outcome',
        tone: x.ldpc.bp.converged ? 'out' : 'off',
      })
  }
  return out
}

/** The scrubber a view needs, or none. */
function scrubberOf(x, view) {
  if (view === 'trellis' && x.conv) return { label: 'step', last: x.conv.viterbi.steps.length }
  if (view === 'tanner' && x.ldpc && x.ldpc.bp && x.ldpc.bp.iterations.length) return { label: 'iteration', last: x.ldpc.bp.iterations.length }
  return null
}

/** One knob: a segmented control for a choice, else a numeric field. */
function KnobField({ p, value, onChange }) {
  if (p.kind === 'choice') {
    return (
      <div className="toggle-knob" data-key={p.key}>
        <span className="toggle-label">{p.label}</span>
        <div className="segmented sm" role="group" aria-label={p.label}>
          {p.options.map((o) => (
            <button key={String(o.value)} type="button" className={value === o.value ? 'on' : ''} aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
              {o.label}
            </button>
          ))}
        </div>
        {p.hint ? <p className="hint">{p.hint}</p> : null}
      </div>
    )
  }
  return <NumField label={p.label} unit={p.unit} value={value} onChange={onChange} min={p.min} max={p.max} scale={p.scale} step={p.step} decimals={p.decimals} hint={p.hint} />
}

/** Which view the pane shows — a row of small buttons, one per view this experiment offers. */
function ViewSwitch({ value, onChange, options }) {
  return (
    <div className="segmented sm view-switch" role="group" aria-label="View shown in this pane">
      {options.map((o) => (
        <button key={o.id} type="button" className={value === o.id ? 'on' : ''} aria-pressed={value === o.id} title={o.title} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
