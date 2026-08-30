import React, { useMemo, useState } from 'react'
import { NumField, PoleZeroCanvas, fmt, fmtHz } from '@ee-labs/ui'
import { MathPanel } from '@ee-labs/explain'
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
import { PLANTS, PLANT_GROUPS, CONTROLLERS, buildLoop, defaultsOf } from './systems.js'
import { loopMath } from './math.js'
import BodeCanvas from './components/BodeCanvas.jsx'
import StepCanvas from './components/StepCanvas.jsx'
import NyquistCanvas from './components/NyquistCanvas.jsx'

const POINTS = 900

export default function App() {
  const [plantId, setPlantId] = useState('motor')
  const [plantP, setPlantP] = useState(() => defaultsOf(PLANTS.motor))
  const [ctrlId, setCtrlId] = useState('p')
  const [ctrlP, setCtrlP] = useState(() => defaultsOf(CONTROLLERS.p))
  const [lower, setLower] = useState('step')
  const [showPhase, setShowPhase] = useState(true)

  const plant = PLANTS[plantId]
  const ctrl = CONTROLLERS[ctrlId]

  const choosePlant = (id) => {
    setPlantId(id)
    setPlantP(defaultsOf(PLANTS[id]))
  }
  const chooseCtrl = (id) => {
    setCtrlId(id)
    setCtrlP(defaultsOf(CONTROLLERS[id]))
  }

  const loop = useMemo(
    () => buildLoop(plantId, plantP, ctrlId, ctrlP),
    [plantId, plantP, ctrlId, ctrlP],
  )

  const pz = useMemo(() => polesZeros(loop.closed), [loop])
  const openPz = useMemo(() => polesZeros(loop.open), [loop])

  // Centre the sweep on whatever the loop's own timescale turns out to be.
  const freqs = useMemo(() => {
    const ws = [...openPz.poles, ...openPz.zeros]
      .map(([re, im]) => Math.hypot(re, im))
      .filter((w) => w > 1e-9)
    const centre = ws.length
      ? Math.exp(ws.reduce((s, w) => s + Math.log(w), 0) / ws.length) / (2 * Math.PI)
      : 1
    const lo = Math.log10(centre / 300)
    const hi = Math.log10(centre * 300)
    return Float64Array.from({ length: POINTS }, (_, i) =>
      Math.pow(10, lo + ((hi - lo) * i) / (POINTS - 1)),
    )
  }, [openPz])

  const open = useMemo(() => bode(loop.open, freqs), [loop, freqs])
  const marg = useMemo(() => margins(loop.open, freqs), [loop, freqs])
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

  const step = useMemo(() => {
    // Long enough to see it settle, or to see clearly that it will not.
    const slow = Math.min(
      ...pz.poles.filter(([re]) => Math.abs(re) > 1e-9).map(([re]) => Math.abs(re)),
    )
    const d = Number.isFinite(slow) && slow > 0 ? Math.min(12 / slow, 400) : 20
    return stepResponse(loop.closed, { duration: d, points: 900 })
  }, [loop, pz])

  // The locus of closed-loop poles as the loop gain is swept, with the poles at
  // the CURRENT gain marked on it.
  const locus = useMemo(() => {
    const gains = Array.from({ length: 160 }, (_, i) => Math.pow(10, -2 + (5 * i) / 159))
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
          <p className="hint">{plant.hint}</p>
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
              eng
            />
          ))}
        </section>

        <section>
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
          <p className="hint">{ctrl.hint}</p>
          {ctrl.params.map((p) => (
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
          <span className="topbar-field">
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
                ? 'Closed-loop step response'
                : lower === 'nyquist'
                  ? 'Nyquist — the loop against −1'
                  : 'Root locus — poles as the gain sweeps'}
            </h2>
            <div className="readout">
              {lower === 'step' ? (
                <>
                  <span>
                    settles to <b>{fmt(dcGain(loop.closed), '', 4)}</b>
                  </span>
                  {second && second.overshoot > 0 ? (
                    <span>
                      overshoot <b>{(second.overshoot * 100).toFixed(1)}%</b>
                    </span>
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
            <StepCanvas t={step.t} y={step.y} final={dcGain(loop.closed)} diverges={!stable} />
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
