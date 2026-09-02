import React, { useMemo, useState } from 'react'
import { LabNav, NumField, ReportIssue, Schematic, fmt } from '@ee-labs/ui'
import { MathPanel } from '@ee-labs/explain'
import { equations, normalize, complex as cx } from '@ee-labs/network'
import { EXPERIMENTS, GROUPS, VIEW_ORDER, byId, defaultsOf, drawables, isDynamic } from './experiments.js'
import { analyse, atDrive, experimentMath, netPower, refusalReason, snapNoise, turnedLabel } from './math.js'
import { termsFor } from './terms.js'
import { reportSummary } from './report.js'
import { EquationsPane, PowerPane, TheveninPane, SuperpositionPane, StatePane, AcPowerPane, Refusal } from './components/panes.jsx'
import SweepCanvas from './components/SweepCanvas.jsx'
import ScopeCanvas from './components/ScopeCanvas.jsx'
import EnergyCanvas from './components/EnergyCanvas.jsx'
import DampingCanvas from './components/DampingCanvas.jsx'
import PhasorCanvas from './components/PhasorCanvas.jsx'
import FreqCanvas from './components/FreqCanvas.jsx'
import HandOver from './components/HandOver.jsx'
import pkg from '../package.json'

const FIRST = EXPERIMENTS[0].id
// Groups A and B read the KCL/KVL primer above their equations: A uses the
// laws before B takes them apart, and a name must not arrive before its meaning.
const PRIMER_GROUPS = GROUPS.slice(0, 2)

const VIEW_LABELS = {
  equations: { label: 'Equations', title: 'The equations the solver built: the two laws in words, each row with live values, the matrix in letters and in numbers' },
  power: { label: 'Power', title: 'p = v × i for every element — who delivers, who absorbs, and the two totals matching' },
  thevenin: { label: 'Thévenin', title: 'The equivalent seen at the port, found three ways' },
  superposition: { label: 'Superposition', title: 'Each source alone, and the sum' },
  sweep: { label: 'Load sweep', title: 'The port quantity as the load resistance sweeps' },
  scope: { label: 'Scope', title: 'Voltages and currents against time; drag to move the cursor' },
  state: { label: 'State equation', title: 'ẋ = Ax + Bu as built, its roots, and the state before t = 0' },
  energy: { label: 'Energy', title: 'Where the energy went: stored, dissipated, supplied' },
  damping: { label: 'Damping sweep', title: 'Overshoot and settling time as R sweeps through critical' },
  phasor: { label: 'Phasors', title: 'Each steady-state voltage as a turning arrow, beside the waveform its tip draws' },
  impedance: { label: 'Impedance', title: '|Z| and ∠Z seen by the source against frequency; the marker is the drive' },
  bode: { label: 'Bode', title: '|H| in dB and ∠H against log frequency; the marker is the drive' },
  acpower: { label: 'AC power', title: 'P, Q, |S| and power factor per element from the phasors' },
}

/** The cursor an experiment opens at: its own fraction of its window at the defaults. */
const cursorFor = (exp, p) => (isDynamic(exp) ? exp.cursor * exp.window(p) : null)

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

  const exp = byId[id]

  const choose = (next) => {
    setId(next)
    setParams(defaultsOf(next))
    setShow(byId[next].show)
    setView(byId[next].view)
    setCursor(cursorFor(byId[next], defaultsOf(next)))
    setPristine(true)
  }
  const setParam = (key, value) => {
    setParams((p) => ({ ...p, [key]: value }))
    setPristine(false)
  }

  const x = useMemo(() => analyse(exp, params, cursor), [exp, params, cursor])
  const dynamic = isDynamic(exp)
  const eq = useMemo(() => {
    try {
      return x.sol ? equations(x.sol.norm, x.sol) : equations(normalize(x.net))
    } catch {
      return null
    }
  }, [x])
  const math = useMemo(() => experimentMath(exp, params, x), [exp, params, x])
  const drive = useMemo(() => (x.ac && exp.out ? atDrive(exp, x) : null), [exp, x])
  const elements = useMemo(() => drawables(x.net), [x])
  const meters = useMemo(() => (x.sol ? snapNoise(x.sol) : null), [x])

  const nodeCount = x.sol ? x.sol.norm.n : normalize(x.net).n
  const outcome = x.sol
    ? `current in = current out at every node (KCL), largest imbalance ${fmt(x.sol.maxResidual, 'A', 2)}`
    : `refused: ${x.refusal.code}`

  const viewOptions = VIEW_ORDER.filter((v) => exp.views.includes(v)).map((v) => ({ id: v, ...VIEW_LABELS[v] }))
  const currentView = exp.views.includes(view) ? view : exp.view

  return (
    <div className="app">
      <aside className="controls">
        <header>
          <LabNav current="circuit-elements-lab" currentLabel="Elements" />
          <h1>Circuit Elements Lab</h1>
          <p className="sub">
            Circuits from the two laws up. Every number on the schematic is solved, every equation is
            the one the solver used, and every claim in a note is measured.
          </p>
          <ReportIssue
            lab="Circuit Elements Lab"
            version={pkg.version}
            state={{ id, params, show, view: currentView, cursor }}
            summary={reportSummary({ id, params, show, view: currentView, outcome, cursor: dynamic ? x.cursor : null })}
          />
        </header>

        <section>
          <h2>Experiments</h2>
          {GROUPS.map((g) => {
            const inGroup = EXPERIMENTS.filter((e) => e.group === g)
            return (
              <FoldGroup
                key={g}
                sectionKey={g}
                label={g}
                holdsActive={inGroup.some((e) => e.id === id)}
                openGroups={openGroups}
                setOpenGroups={setOpenGroups}
              >
                {inGroup.map((e) => (
                  <button
                    type="button"
                    key={e.id}
                    className={`preset${e.id === id ? ' is-on' : ''}`}
                    onClick={() => choose(e.id)}
                  >
                    {e.name}
                  </button>
                ))}
              </FoldGroup>
            )
          })}
          <h3 className="note-title">
            {exp.id.toUpperCase()} · {exp.name}
          </h3>
          <p className="hint" data-role="note" data-pristine={pristine}>
            {exp.note}
            {pristine ? null : (
              <em className="prov"> — the note describes the defaults; you have moved away from them.</em>
            )}
          </p>
          {termsFor(exp.terms).length ? (
            <details className="terms">
              <summary>Terms used here</summary>
              <dl>
                {termsFor(exp.terms).map((t) => (
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
          <h2>Knobs</h2>
          {exp.params.map((p) =>
            p.kind === 'toggle' ? (
              <div className="toggle-knob" key={p.key} data-role="toggle" data-key={p.key}>
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
                {p.hint ? <p className="hint">{p.hint}</p> : null}
              </div>
            ) : (
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
                presets={p.presets}
                eng={p.eng !== false}
              />
            ),
          )}
          <MathPanel entry={math} />
          {exp.circuitLab ? <HandOver exp={exp} params={params} /> : null}
        </section>
      </aside>

      <div className="topbar">
        <nav className="flow" aria-label="Experiment summary">
          <span className="flow-node">
            {exp.id.toUpperCase()}
            <em>{exp.name}</em>
          </span>
          <span className="flow-arrow" aria-hidden="true">
            →
          </span>
          <span className="flow-node">
            {nodeCount} node{nodeCount === 1 ? '' : 's'}
            <em>
              {eq ? `${eq.unknowns.length} unknown${eq.unknowns.length === 1 ? '' : 's'}` : 'no system'}
            </em>
          </span>
          <span className="flow-arrow" aria-hidden="true">
            →
          </span>
          <span className={`flow-node ${x.sol ? 'is-out' : 'is-off'}`} data-role="outcome">
            {x.sol ? 'solved' : 'no solution'}
            <em>{x.sol ? `current in = current out at every node, to ${fmt(x.sol.maxResidual, 'A', 2)}` : refusalReason(x.refusal)}</em>
          </span>
        </nav>
        <div className="topbar-controls">
          {dynamic && x.tr ? (
            <>
              <span className="topbar-field" data-role="cursor-time">
                <span>t</span>
                <b>{fmt(x.cursor, 's', 3)}</b>
              </span>
              {x.omega ? (
                <span className="topbar-field" data-role="drive">
                  <span>ω</span>
                  <b>{fmt(x.omega, 'rad/s', 3)}</b>
                  <em className="prov"> {fmt(x.omega / (2 * Math.PI), 'Hz', 3)}</em>
                </span>
              ) : null}
              {x.state.n === 1 ? (
                <span className="topbar-field">
                  <span>τ</span>
                  <b>{x.state.tau === Infinity ? '∞' : fmt(x.state.tau, 's', 3)}</b>
                </span>
              ) : x.state.n === 2 ? (
                <>
                  <span className="topbar-field">
                    <span>ω₀</span>
                    <b>{fmt(x.state.w0, 'rad/s', 3)}</b>
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
          {x.sol ? (
            <span className="topbar-field">
              <span>Σ power</span>
              <b>{fmt(netPower(x.sol), 'W', 2)}</b>
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
                  .filter(([n]) => n !== 'gnd')
                  .map(([n, v]) => (
                    <span key={n}>
                      v_{n} <b>{fmt(v, 'V', 4)}</b>
                    </span>
                  ))
              ) : (
                <span className="flag warn">the solver refused — see below</span>
              )}
            </div>
          </div>
          <div className="view-body">
            {/* "none" promises just the circuit, so it drops the node voltages too. */}
            <Schematic className="big" elements={elements} layout={exp.layout} meters={show === 'none' ? null : meters} show={show} />
            {x.refusal ? <Refusal err={x.refusal} /> : null}
            {dynamic && x.tr ? (
              <div className="cursor-row" data-role="cursor">
                <label htmlFor="cursor-slider">
                  the meters read the circuit at <b>t = {fmt(x.cursor, 's', 3)}</b>
                </label>
                <input
                  id="cursor-slider"
                  className="num-slider"
                  type="range"
                  min={0}
                  max={x.tEnd}
                  step={x.tEnd / 600}
                  value={x.cursor}
                  onChange={(e) => setCursor(Number(e.target.value))}
                  aria-label="Cursor time"
                />
                <span className="cursor-ends" aria-hidden="true">
                  <span>0</span>
                  <span>{fmt(x.tEnd, 's', 2)}</span>
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
                  <span>
                    V_oc <b>{fmt(x.thevenin.voc, 'V', 4)}</b>
                  </span>
                  <span>
                    R_th <b>{fmt(x.thevenin.rth.test, 'Ω', 4)}</b>
                  </span>
                </>
              ) : null}
              {currentView === 'sweep' && x.sweep ? (
                <>
                  <span>
                    {exp.sweepId} now <b>{fmt(params[exp.sweepId], 'Ω', 3)}</b>
                  </span>
                  {exp.sweepY === 'p' ? (
                    <span>
                      peak <b>{fmt(x.sweep.pMax, 'W', 3)}</b>
                      <em className="prov"> near {fmt(x.sweep.rOpt, 'Ω', 3)}</em>
                    </span>
                  ) : null}
                </>
              ) : null}
              {currentView === 'scope' && x.tr
                ? [...exp.scope.left.traces, ...(exp.scope.right ? exp.scope.right.traces : [])].map((q) => (
                    <span key={`${q.q}.${q.key}`}>
                      {q.label} <b>{fmt(x.sol[q.q][q.key], q.q === 'i' ? 'A' : q.q === 'p' ? 'W' : 'V', 4)}</b>
                    </span>
                  ))
                : null}
              {currentView === 'energy' && x.tr ? <EnergyReadout energy={x.energy} t={x.cursor} /> : null}
              {currentView === 'phasor' && x.ac ? (
                <>
                  <span>
                    |{exp.out.label}| <b>{fmt(cx.cabs(x.ac[exp.out.q][exp.out.key]), exp.out.q === 'i' ? 'A' : 'V', 4)}</b>
                  </span>
                  <span>
                    ∠{exp.out.label} <b>{deg(cx.carg(x.ac[exp.out.q][exp.out.key]))}</b>
                    <em className="prov"> re v_s: {deg(cx.carg(x.ac[exp.out.q][exp.out.key]) - cx.carg(x.ac.volt.V1))}</em>
                  </span>
                  <span>
                    turned <b>{turnedLabel(x.omega, x.cursor)}</b>
                  </span>
                </>
              ) : null}
              {currentView === 'impedance' && drive ? (
                <>
                  <span>
                    |Z| <b>{fmt(cx.cabs(drive.Z), 'Ω', 4)}</b>
                  </span>
                  <span>
                    ∠Z <b>{deg(cx.carg(drive.Z))}</b>
                    <em className="prov"> {drive.Z[1] < -1e-9 * cx.cabs(drive.Z) ? 'capacitive' : drive.Z[1] > 1e-9 * cx.cabs(drive.Z) ? 'inductive' : 'resonant'}</em>
                  </span>
                </>
              ) : null}
              {currentView === 'bode' && drive ? (
                <>
                  <span>
                    |H| <b>{(20 * Math.log10(cx.cabs(drive.H))).toFixed(2)} dB</b>
                    <em className="prov"> ×{cx.cabs(drive.H).toPrecision(4)}</em>
                  </span>
                  <span>
                    ∠H <b>{deg(cx.carg(drive.H))}</b>
                  </span>
                </>
              ) : null}
              {currentView === 'acpower' && x.ac ? <AcPowerReadout x={x} /> : null}
              {currentView === 'damping' && x.damping ? (
                x.damping.at ? (
                  <>
                    <span>
                      overshoot <b>{(100 * x.damping.at.overshoot).toFixed(1)} %</b>
                    </span>
                    <span>
                      settles in <b>{fmt(x.damping.at.settle, 's', 3)}</b>
                    </span>
                  </>
                ) : (
                  <span className="flag warn">
                    R is outside the sweep ({fmt(x.damping.lo, 'Ω', 2)} – {fmt(x.damping.hi, 'Ω', 2)})
                  </span>
                )
              ) : null}
            </div>
          </div>
          <div className="view-body">
            {currentView === 'scope' && x.tr ? (
              <ScopeCanvas
                tr={x.tr}
                ghost={x.ghost || null}
                ghostLabel={exp.ghostLabel}
                scope={exp.scope}
                cursor={x.cursor}
                onCursor={setCursor}
                marks={math?.marks || []}
                guides={math?.guides || []}
              />
            ) : null}
            {currentView === 'state' && x.tr ? <StatePane x={x} /> : null}
            {currentView === 'phasor' && x.ac ? <PhasorCanvas exp={exp} x={x} cursor={x.cursor} onCursor={setCursor} /> : null}
            {(currentView === 'impedance' || currentView === 'bode') && x.freq && drive ? (
              <FreqCanvas
                freq={x.freq}
                mode={currentView}
                fDrive={x.omega / (2 * Math.PI)}
                at={drive}
                corner={{ f: x.freq.wc / (2 * Math.PI), label: x.state.n === 1 ? 'f_c' : 'f₀' }}
              />
            ) : null}
            {currentView === 'acpower' && x.ac ? <AcPowerPane x={x} /> : null}
            {currentView === 'energy' && x.tr ? <EnergyCanvas energy={x.energy} tEnd={x.tEnd} cursor={x.cursor} onCursor={setCursor} /> : null}
            {currentView === 'damping' && x.damping ? <DampingCanvas exp={exp} params={params} at={x.damping.at} /> : null}
            {currentView === 'equations' && eq ? <EquationsPane eq={eq} solved={!!x.sol} primer={PRIMER_GROUPS.includes(exp.group)} /> : null}
            {currentView === 'power' && x.sol ? <PowerPane sol={x.sol} /> : null}
            {currentView === 'thevenin' && x.thevenin ? <TheveninPane th={x.thevenin} port={exp.port} /> : null}
            {currentView === 'superposition' && x.superposition ? <SuperpositionPane sp={x.superposition} /> : null}
            {currentView === 'sweep' && x.sweep ? (
              <SweepCanvas
                points={x.sweep.points}
                y={exp.sweepY || 'p'}
                at={params[exp.sweepId]}
                rth={x.thevenin ? x.thevenin.rth.test : null}
                efficiency={!!exp.sweepEfficiency}
              />
            ) : null}
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
      <span>
        P <b>{fmt(S[0], 'W', 4)}</b>
      </span>
      <span>
        Q <b>{fmt(S[1], 'var', 4)}</b>
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
      <span>
        stored <b>{fmt(q.stored, 'J', 3)}</b>
      </span>
      <span>
        dissipated <b>{fmt(q.dissipated, 'J', 3)}</b>
      </span>
      <span>
        supplied <b>{fmt(q.supplied, 'J', 3)}</b>
      </span>
    </>
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
 * One foldable sidebar group — Circuit Lab's FoldGroup, copied. The group
 * holding the active experiment cannot be folded, so where-you-are survives
 * any amount of tidying; the refusal happens on the summary click because the
 * browser folds a <details> before React hears about it.
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
