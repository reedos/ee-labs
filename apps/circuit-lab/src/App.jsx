import React, { useMemo, useState } from 'react'
import { NumField, fmt, fmtHz } from '@ee-labs/ui'
import { MathPanel } from '@ee-labs/explain'
import {
  bode,
  polesZeros,
  secondOrderMetrics,
  stepResponse,
  dcGain,
  isStable,
} from '@ee-labs/systems'
import { CIRCUITS, CIRCUIT_GROUPS, defaultsOf, transferOf } from './circuits.js'
import { circuitMath } from './math.js'
import Schematic from './schematics.jsx'
import BodeCanvas from './components/BodeCanvas.jsx'
import StepCanvas from './components/StepCanvas.jsx'
import PoleZeroCanvas from './components/PoleZeroCanvas.jsx'

const POINTS = 600

export default function App() {
  const [id, setId] = useState('rcLow')
  const [params, setParams] = useState(() => defaultsOf('rcLow'))
  const [output, setOutput] = useState(CIRCUITS.rcLow.outputs[0].key)
  const [showPhase, setShowPhase] = useState(true)
  const [lower, setLower] = useState('step')

  const circuit = CIRCUITS[id]

  const choose = (next) => {
    setId(next)
    setParams(defaultsOf(next))
    setOutput(CIRCUITS[next].outputs[0].key)
  }
  const setParam = (key, value) => setParams((p) => ({ ...p, [key]: value }))

  const tf = useMemo(() => transferOf(id, params, output), [id, params, output])
  const metrics = useMemo(() => (circuit.metrics ? circuit.metrics(params) : null), [circuit, params])
  const second = useMemo(() => secondOrderMetrics(tf), [tf])
  const pz = useMemo(() => polesZeros(tf), [tf])

  // A decade span centred on whatever the circuit's own scale turns out to be,
  // so the interesting part is on screen without anyone reaching for a control.
  const freqs = useMemo(() => {
    const scale = metrics ? metrics.w0 / (2 * Math.PI) : naturalScale(pz.poles)
    const centre = Number.isFinite(scale) && scale > 0 ? scale : 1000
    const lo = Math.log10(centre / 1000)
    const hi = Math.log10(centre * 1000)
    return Float64Array.from({ length: POINTS }, (_, i) =>
      Math.pow(10, lo + ((hi - lo) * i) / (POINTS - 1)),
    )
  }, [metrics, pz])

  const response = useMemo(() => bode(tf, freqs), [tf, freqs])

  // Long enough to see it arrive, short enough that the arrival fills the pane.
  const step = useMemo(() => {
    const slowest = Math.min(
      ...pz.poles.filter(([re]) => Math.abs(re) > 1e-9).map(([re, im]) => Math.hypot(re, im)),
    )
    const byPole = Number.isFinite(slowest) && slowest > 0 ? 8 / slowest : 5e-3
    // A lightly damped circuit rings for far longer than its pole radius
    // suggests, and a step response cut off before it settles is the one thing
    // this pane exists to show.
    const bySettling = second && Number.isFinite(second.settling) ? 1.4 * second.settling : 0
    return stepResponse(tf, { duration: Math.max(byPole, bySettling), points: 900 })
  }, [tf, pz, second])

  const markers = useMemo(() => {
    const out = []
    if (metrics) out.push({ f: metrics.w0 / (2 * Math.PI), label: 'f₀' })
    else if (second) out.push({ f: second.f0, label: 'f₀' })
    else {
      for (const [re, im] of pz.poles) {
        const w = Math.hypot(re, im)
        if (w > 1e-9) out.push({ f: w / (2 * Math.PI), label: 'pole' })
      }
    }
    return out
  }, [metrics, second, pz])

  const math = useMemo(() => circuitMath(id, tf, params, output), [id, tf, params, output])

  const gain = dcGain(tf)
  const stable = isStable(tf)

  return (
    <div className="app">
      <aside className="controls">
        <header>
          <h1>Circuit Lab</h1>
          <p className="sub">
            A circuit, the transfer function it has, and the same thing seen in frequency, in
            time, and as poles.
          </p>
        </header>

        <section>
          <h2>Circuits</h2>
          {CIRCUIT_GROUPS.map((g) => {
            const inGroup = Object.entries(CIRCUITS).filter(([, c]) => c.group === g)
            if (!inGroup.length) return null
            return (
              <div className="preset-group" key={g}>
                <h3>{g}</h3>
                <div className="presets">
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
                </div>
              </div>
            )
          })}
          <p className="hint">{circuit.hint}</p>
          <MathPanel entry={math} />
        </section>

        <section>
          <h2>Schematic</h2>
          <Schematic id={id} params={params} output={output} />
          {circuit.outputs.length > 1 ? (
            <label className="field">
              <span className="field-label">Output measured</span>
              <select value={output} onChange={(e) => setOutput(e.target.value)}>
                {circuit.outputs.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </section>

        <section>
          <h2>Components</h2>
          {circuit.params.map((p) => (
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
              eng
            />
          ))}
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
              Step response
            </button>
            <button
              type="button"
              className={lower === 'pz' ? 'on' : ''}
              onClick={() => setLower('pz')}
            >
              Poles &amp; zeros
            </button>
          </div>
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
          <span className="flow-node">
            H(s)
            <em>
              {pz.poles.length} pole{pz.poles.length === 1 ? '' : 's'}, {pz.zeros.length} zero
              {pz.zeros.length === 1 ? '' : 's'}
            </em>
          </span>
          <span className="flow-arrow" aria-hidden="true">
            →
          </span>
          <span className={`flow-node ${stable ? 'is-out' : 'is-off'}`}>
            {stable ? 'stable' : 'not stable'}
            <em>{stable ? 'left half plane' : 'on or right of the axis'}</em>
          </span>
        </nav>
        <div className="topbar-controls">
          <span className="topbar-field">
            <span>DC gain</span>
            <b>{Number.isFinite(gain) ? fmt(gain, '', 4) : '∞'}</b>
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
            <div className="readout">
              <span>
                span <b>{fmtHz(freqs[0])}Hz – {fmtHz(freqs[freqs.length - 1])}Hz</b>
              </span>
              {second ? (
                <span>
                  {second.zeta < 1 ? 'underdamped' : 'no overshoot'}
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
            markers={markers}
            yUnit={circuit.outputs.find((o) => o.key === output)?.key === 'z' ? 'dBΩ' : 'dB'}
          />
        </section>

        <section className="view">
          <div className="view-head">
            <h2>{lower === 'step' ? 'Step response' : 'Poles and zeros'}</h2>
            <div className="readout">
              {lower === 'step' ? (
                <>
                  <span>
                    final <b>{Number.isFinite(gain) ? fmt(gain, '', 4) : 'never settles'}</b>
                  </span>
                  {second && second.overshoot > 0 ? (
                    <span>
                      overshoot <b>{(second.overshoot * 100).toFixed(1)}%</b>
                    </span>
                  ) : null}
                  {second ? (
                    <span>
                      settles in <b>{fmt(second.settling, 's', 3)}</b>
                      <em className="prov"> to within 2%</em>
                    </span>
                  ) : null}
                </>
              ) : (
                <>
                  <span>
                    poles <b>{pz.poles.length}</b>
                  </span>
                  <span>
                    zeros <b>{pz.zeros.length}</b>
                  </span>
                  <span className={stable ? '' : 'flag warn'}>
                    {stable ? 'all in the left half plane' : 'not all in the left half plane'}
                  </span>
                </>
              )}
            </div>
          </div>
          {lower === 'step' ? (
            <StepCanvas t={step.t} y={step.y} final={gain} />
          ) : (
            <PoleZeroCanvas poles={pz.poles} zeros={pz.zeros} />
          )}
        </section>
      </main>
    </div>
  )
}

/** A frequency scale to centre the plot on, when there is no stated resonance. */
function naturalScale(poles) {
  const ws = poles.map(([re, im]) => Math.hypot(re, im)).filter((w) => w > 1e-9)
  if (!ws.length) return 1000
  const geo = Math.exp(ws.reduce((s, w) => s + Math.log(w), 0) / ws.length)
  return geo / (2 * Math.PI)
}
