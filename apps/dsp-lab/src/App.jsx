import React, { useMemo, useState } from 'react'
import { LabNav, LessonNav, ReportIssue, TryLine, ZPlaneCanvas, fmtHz } from '@ee-labs/ui'
import { spectrum } from '@ee-labs/dsp'
import Controls from './components/Controls.jsx'
import ScopeCanvas from './components/ScopeCanvas.jsx'
import SpectrumCanvas from './components/SpectrumCanvas.jsx'
import SpecPane from './components/SpecPane.jsx'
import PoleGridCanvas from './components/PoleGridCanvas.jsx'
import WeightCanvas from './components/WeightCanvas.jsx'
import DensityCanvas from './components/DensityCanvas.jsx'
import { EXPERIMENTS, GROUPS } from './experiments.js'
import { INITIAL, experimentState } from './state.js'
import { applyChip } from './chips.js'
import {
  chainAdaptiveRun,
  chainPolesZeros,
  chainRefusals,
  chainResponse,
  chainSpec,
  renderChain,
} from './chain.js'
import { POLE_BOXES, arOf, poleBoxes, psdOf } from './measure.js'
import { readoutRows } from './measure.js'
import { CHROME_TERMS, TERMS } from './terms.js'

// The lab, in Signal Lab's shape: a lesson sidebar, a rack of sources and
// blocks, and two views side by side. What is new here is the specification
// pane, which sits under the frequency view when an experiment states one.

function ViewSwitch({ value, onChange, options }) {
  return (
    <div className="segmented sm view-switch" role="group">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={value === o.id ? 'on' : ''}
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function TermPanel({ ids, title }) {
  const [open, setOpen] = useState(false)
  const shown = ids.filter((id) => TERMS[id])
  if (shown.length === 0) return null
  return (
    <div className="terms">
      <button type="button" className="terms-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        {title}
      </button>
      {open ? (
        <dl>
          {shown.map((id) => (
            <React.Fragment key={id}>
              <dt>{TERMS[id].name}</dt>
              <dd>{TERMS[id].def}</dd>
            </React.Fragment>
          ))}
        </dl>
      ) : null}
    </div>
  )
}

export default function App() {
  const [state, setState] = useState(() => experimentState(EXPERIMENTS[0]))
  const [applied, setApplied] = useState(() => experimentState(EXPERIMENTS[0]))
  const [openBlocks, setOpenBlocks] = useState(() => new Set([1]))

  const experiment = EXPERIMENTS.find((e) => e.id === state.experimentId) ?? EXPERIMENTS[0]
  const index = EXPERIMENTS.findIndex((e) => e.id === experiment.id)

  const load = (e) => {
    const next = experimentState(e)
    setState(next)
    setApplied(next)
    setOpenBlocks(new Set((e.patch.blocks || []).map((b) => b.id)))
  }

  const dirty = useMemo(() => JSON.stringify(state) !== JSON.stringify(applied), [state, applied])

  // The chain, rendered once per state change and shared by both views.
  const run = useMemo(() => {
    const { buf } = renderChain(state.sources, state.blocks, state.fftSize, state.sampleRate)
    const s = spectrum(buf, state.sampleRate, state.window)
    const freqs = Float64Array.from({ length: 512 }, (_, i) => (i * state.sampleRate) / 2 / 511)
    const resp = chainResponse(state.blocks, freqs, state.sampleRate)
    return { buf, s, freqs, resp }
  }, [state])

  const refusals = useMemo(
    () => chainRefusals(state.blocks, state.sampleRate),
    [state.blocks, state.sampleRate],
  )
  const spec = useMemo(() => chainSpec(state.blocks, state.sampleRate), [state.blocks, state.sampleRate])
  const pz = useMemo(
    () => chainPolesZeros(state.blocks, state.sampleRate),
    [state.blocks, state.sampleRate],
  )
  const rows = useMemo(() => {
    try {
      return readoutRows(experiment, state)
    } catch {
      // A claim whose block the reader removed. The rack still works, and the
      // readout says what happened rather than taking the page down.
      return []
    }
  }, [experiment, state])

  // The pole grid is offered only where there is a quantised section to draw
  // one for, and only up to the word length whose grid can be computed. A view
  // with nothing behind it is not offered rather than shown empty.
  const grid = useMemo(() => {
    if (state.freqView !== 'polegrid') return null
    try {
      return poleBoxes(state)
    } catch (err) {
      return { error: String(err.message ?? err) }
    }
  }, [state])

  const hasGrid = useMemo(
    () => state.blocks.some((b) => !b.bypass && b.type === 'fixedbiquad'),
    [state.blocks],
  )

  // The adaptive run, for the weight view. It is the block's own `run`, at the
  // stride a plot wants, so the sequence drawn is the sequence measured.
  const weights = useMemo(() => {
    if (state.timeView !== 'weights') return null
    const { buf } = renderChain(state.sources, [], state.fftSize, state.sampleRate)
    return chainAdaptiveRun(state.blocks, buf, state.sampleRate)
  }, [state])

  const hasWeights = useMemo(
    () => state.blocks.some((b) => !b.bypass && b.type === 'adaptive'),
    [state.blocks],
  )

  const timeOptions = [
    { id: 'signal', label: 'Signal' },
    ...(hasWeights ? [{ id: 'weights', label: 'Weights' }] : []),
  ]

  // The density, and the all-pole model drawn over it. Both are computed only
  // where the view asks for them, because a 16384-point Welch estimate is not
  // free and four of the five groups never open this view.
  const density = useMemo(() => {
    if (state.freqView !== 'density') return null
    const est = psdOf(state)
    const model = state.blocks.some((b) => !b.bypass && b.type === 'allpole') ? arOf(state) : null
    return { est, model }
  }, [state])

  const freqOptions = [
    { id: 'spectrum', label: 'Spectrum' },
    { id: 'density', label: 'Density' },
    { id: 'zplane', label: 'z-plane' },
    ...(hasGrid ? [{ id: 'polegrid', label: 'Pole grid' }] : []),
  ]

  return (
    <div className="app">
      <header className="top">
        <h1>DSP Lab</h1>
        <p className="tagline">
          Rate changes, filter design to a specification, and the margin against it.
        </p>
        <LabNav current="dsp-lab" currentLabel="DSP" />
      </header>

      <aside className="sidebar">
        <h2>Experiments</h2>
        {GROUPS.map((g) => (
          <section key={g} className="lesson-group">
            <h3>{g}</h3>
            <ul>
              {EXPERIMENTS.filter((e) => e.group === g).map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    className={e.id === experiment.id ? 'on' : ''}
                    aria-pressed={e.id === experiment.id}
                    onClick={() => load(e)}
                  >
                    {e.name}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <ReportIssue lab="dsp-lab" state={state} summary={`${experiment.id}: ${experiment.name}`} />
      </aside>

      <main>
        <section className="lesson">
          <h2>{experiment.name}</h2>
          <p className="see">{experiment.see}</p>
          <TryLine
            text={experiment.try}
            chips={experiment.chips ?? []}
            onChip={(c) => setState((s) => applyChip(s, c.patch))}
          />
          <details className="why">
            <summary>Why</summary>
            <p>{experiment.why}</p>
          </details>
          <TermPanel ids={experiment.terms} title="Terms used here" />
          <TermPanel ids={CHROME_TERMS} title="What the top bar means" />
          <LessonNav
            index={index}
            total={EXPERIMENTS.length}
            dirty={dirty}
            onPrev={() => index > 0 && load(EXPERIMENTS[index - 1])}
            onNext={() => index < EXPERIMENTS.length - 1 && load(EXPERIMENTS[index + 1])}
            onReset={() => load(experiment)}
          />
        </section>

        <section className="views">
          <div className="pane">
            <div className="pane-head">
              <h3>Time domain</h3>
              <ViewSwitch
                value={state.timeView}
                onChange={(v) => setState((s) => ({ ...s, timeView: v }))}
                options={timeOptions}
              />
            </div>
            {state.timeView === 'weights' && weights ? (
              <WeightCanvas
                history={weights.history}
                stride={weights.stride}
                plant={weights.plant}
                label={`${weights.history[0]?.length ?? 0} taps, one row every ${weights.stride} samples`}
              />
            ) : (
              <ScopeCanvas
                buf={run.buf}
                sampleRate={state.sampleRate}
                spanMs={state.timeSpanMs}
                label={`${fmtHz(state.sampleRate)}Hz`}
              />
            )}
          </div>
          <div className="pane">
            <div className="pane-head">
              <h3>Frequency domain</h3>
              <ViewSwitch
                value={state.freqView}
                onChange={(v) => setState((s) => ({ ...s, freqView: v }))}
                options={freqOptions}
              />
            </div>
            {state.freqView === 'density' && density ? (
              <DensityCanvas
                est={density.est}
                model={density.model}
                label={`${state.estimator}, ${density.est.segments} segment${
                  density.est.segments === 1 ? '' : 's'
                } of ${density.est.n}${density.model ? `, with an order ${density.model.order} model` : ''}`}
              />
            ) : state.freqView === 'polegrid' && grid ? (
              grid.error ? (
                <p className="refusal">{grid.error}</p>
              ) : (
                <PoleGridCanvas
                  points={grid.points}
                  boxes={[
                    { ...POLE_BOXES.dense, side: POLE_BOXES.side },
                    { ...POLE_BOXES.sparse, side: POLE_BOXES.side },
                  ]}
                  counts={[grid.dense, grid.sparse]}
                  exact={pz.exactPoles}
                  poles={pz.poles}
                  note={`${grid.total} positions the coefficients can reach`}
                />
              )
            ) : state.freqView === 'zplane' ? (
              <ZPlaneCanvas poles={pz.poles} zeros={pz.zeros} sampleRate={state.sampleRate} />
            ) : (
              <SpectrumCanvas
                freqs={run.s.freqs}
                amps={run.s.amps}
                response={run.resp.any ? run.resp.mag : null}
                responseFreqs={run.freqs}
                floorDb={state.floorDb}
                refusals={refusals}
                mask={state.showSpec && spec ? { axis: 'f', bands: spec.margin.bands } : null}
              />
            )}
          </div>
        </section>

        {rows.length ? (
          <section className="readout">
            <h3>Measured</h3>
            <dl>
              {rows.map((r) => (
                <React.Fragment key={r.path}>
                  <dt>{r.label}</dt>
                  <dd>
                    {typeof r.value === 'boolean'
                      ? r.value
                        ? 'yes'
                        : 'no'
                      : r.unit === 'Hz'
                        ? `${fmtHz(r.value)}Hz`
                        : Number(r.value).toPrecision(4)}
                    {r.unit && r.unit !== 'Hz' ? ` ${r.unit}` : ''}
                  </dd>
                </React.Fragment>
              ))}
            </dl>
          </section>
        ) : null}

        {state.showSpec && spec ? (
          <SpecPane
            mask={{ axis: 'f', bands: spec.margin.bands }}
            mode="table"
            title={`Specification, from ${spec.label}`}
          />
        ) : null}
      </main>

      <aside className="rack">
        <Controls
          state={state}
          setState={setState}
          openBlocks={openBlocks}
          setOpenBlocks={setOpenBlocks}
        />
      </aside>
    </div>
  )
}
