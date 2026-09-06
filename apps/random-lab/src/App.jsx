import React, { useMemo, useState } from 'react'
import { LabNav, LessonNav, ReportIssue, TryLine, NumField, fmt, fmtNum } from '@ee-labs/ui'
import { EXPERIMENTS, GROUPS, VIEWS, byId } from './experiments.js'
import { LESSONS } from './lessons.js'
import { termsFor, CHROME_TERMS } from './terms.js'
import { analyse, DEFAULTS } from './analysis.js'
import { reportSummary } from './report.js'
import EnsembleCanvas from './components/EnsembleCanvas.jsx'
import {
  ScopeCanvas, HistogramCanvas, CorrelationCanvas, DensityCanvas,
  OutcomeCanvas, MatchedCanvas, ErrorRateCanvas, KalmanCanvas,
} from './components/views.jsx'
import { Closed, Estimate, Against, Pane, Terms } from './components/panes.jsx'

// The knobs a view can put on screen, with their units and their ranges. A knob
// not listed here is still a parameter and is simply not offered.
const KNOBS = {
  seed: { label: 'Seed', min: 1, max: 9999, step: 1, integer: true },
  n: { label: 'Samples', min: 100, max: 200000, step: 100, integer: true },
  bins: { label: 'Bins', min: 8, max: 100, step: 1, integer: true },
  cltTerms: { label: 'Terms summed', min: 1, max: 24, step: 1, integer: true },
  level: { label: 'Level', min: 0.5, max: 0.999, step: 0.01 },
  runs: { label: 'Runs', min: 2, max: 2000, step: 1, integer: true },
  length: { label: 'Run length', min: 8, max: 4096, step: 8, integer: true },
  averages: { label: 'Averages', min: 1, max: 400, step: 1, integer: true },
  segment: { label: 'Segment', min: 64, max: 4096, step: 64, integer: true },
  fc: { label: 'Corner', unit: 'Hz', min: 10, max: 20000, step: 10 },
  noiseRms: { label: 'Source rms', unit: 'V', min: 1e-6, max: 10, step: 1e-6 },
  R: { label: 'R', unit: 'Ω', min: 1, max: 1e9, step: 1 },
  C: { label: 'C', unit: 'F', min: 1e-15, max: 1e-3, step: 1e-15 },
  T: { label: 'Temperature', unit: 'K', min: 1, max: 500, step: 1 },
  noiseVariance: { label: 'Noise variance', min: 1e-6, max: 10, step: 1e-6 },
  pulseLength: { label: 'Pulse length', min: 4, max: 512, step: 4, integer: true },
  ebN0Db: { label: 'Eb/N0', unit: 'dB', min: 0, max: 13, step: 0.5 },
  symbols: { label: 'Symbols', min: 1000, max: 400000, step: 1000, integer: true },
  wienerNoiseVariance: { label: 'Noise variance', min: 1e-4, max: 100, step: 1e-4 },
  taps: { label: 'Taps', min: 1, max: 32, step: 1, integer: true },
  q: { label: 'Process noise', min: 1e-4, max: 100, step: 1e-4 },
  r: { label: 'Measurement noise', min: 1e-4, max: 1000, step: 1e-4 },
  kalmanA: { label: 'State transition', min: 0, max: 0.999, step: 0.001 },
  sigma: { label: 'Sigma', min: 0.01, max: 10, step: 0.01 },
  mu: { label: 'Mean', min: -10, max: 20, step: 0.1 },
  lambda: { label: 'Rate', min: 0.1, max: 10, step: 0.1 },
  maxLag: { label: 'Max lag', min: 16, max: 800, step: 16, integer: true },
  wkN: { label: 'Record', min: 256, max: 16384, step: 256, integer: true },
}

const CHOICES = {
  dist: ['gaussian', 'uniform', 'exponential', 'bernoulli', 'rayleigh'],
  pulse: ['rect', 'halfSine', 'ramp'],
  ensembleKind: ['gaussian', 'filtered', 'constant', 'outcome'],
  window: ['hann', 'hamming', 'blackman', 'none'],
}

export default function App() {
  const [index, setIndex] = useState(0)
  const experiment = EXPERIMENTS[index]
  const [params, setParams] = useState(experiment.params)
  const [view, setView] = useState(experiment.view)
  const [highlight, setHighlight] = useState(null)

  const load = (i) => {
    const e = EXPERIMENTS[i]
    setIndex(i)
    setParams(e.params)
    setView(e.view)
    setHighlight(null)
  }

  const dirty = useMemo(
    () => JSON.stringify(params) !== JSON.stringify(experiment.params),
    [params, experiment],
  )

  const merged = { ...DEFAULTS, ...params }
  const a = useMemo(() => analyse(params), [params])
  const lesson = LESSONS[experiment.id]

  // Only the knobs this experiment's own parameters name, so a pane never
  // offers a control that does nothing to what is on screen.
  const knobs = Object.keys(params).filter((k) => KNOBS[k] || CHOICES[k])
  const featured = experiment.featured.field

  const set = (k, v) => setParams((p) => ({ ...p, [k]: v }))

  return (
    <div className="app">
      <aside className="controls">
        <LabNav current="random-lab" currentLabel="Random Signals Lab" />

        <div className="lesson">
          <div className="crumb">
            {experiment.group} · {index + 1} of {EXPERIMENTS.length}
          </div>
          <h2>{experiment.name}</h2>
          <p className="see">{lesson.see}</p>

          <TryLine
            text={lesson.try[0].say}
            chips={lesson.try.map((t, i) => ({ label: `${i + 1}`, title: t.say }))}
            onChip={(chip) => {
              const step = lesson.try[Number(chip.label) - 1]
              if (step && step.set) setParams((p) => ({ ...p, ...step.set }))
            }}
          />

          {featured && (KNOBS[featured] || CHOICES[featured]) ? (
            <div className="featured">
              <Knob name={featured} value={merged[featured]} onChange={set} />
            </div>
          ) : null}

          <details className="why">
            <summary>Why</summary>
            <p>{lesson.why}</p>
          </details>

          <Terms terms={termsFor(experiment.terms)} />
          <details className="terms">
            <summary>What the top bar means</summary>
            <dl>
              {termsFor(CHROME_TERMS).map((t) => (
                <React.Fragment key={t.id}>
                  <dt>{t.name}</dt>
                  <dd>{t.def}</dd>
                </React.Fragment>
              ))}
            </dl>
          </details>

          <LessonNav
            index={index}
            total={EXPERIMENTS.length}
            onPrev={() => load(Math.max(0, index - 1))}
            onNext={() => load(Math.min(EXPERIMENTS.length - 1, index + 1))}
            onReset={() => setParams(experiment.params)}
            dirty={dirty}
            noun="experiment"
          />
        </div>

        <div className="knobs">
          {knobs
            .filter((k) => k !== featured)
            .map((k) => (
              <Knob key={k} name={k} value={merged[k]} onChange={set} />
            ))}
        </div>

        <nav className="picker">
          {GROUPS.map((g) => (
            <details key={g} open={g === experiment.group}>
              <summary>{g}</summary>
              <ul>
                {EXPERIMENTS.map((e, i) =>
                  e.group === g ? (
                    <li key={e.id}>
                      <button
                        type="button"
                        className={i === index ? 'on' : ''}
                        onClick={() => load(i)}
                      >
                        <span className="id">{e.id}</span> {e.name}
                      </button>
                    </li>
                  ) : null,
                )}
              </ul>
            </details>
          ))}
        </nav>

        <ReportIssue lab="random-lab" state={params} summary={reportSummary(experiment, merged)} />
      </aside>

      <header className="topbar">
        <span className="topbar-field">seed {merged.seed}</span>
        {experiment.views.includes('ensemble') || experiment.views.includes('outcome') ? (
          <span className="topbar-field">{merged.runs} runs</span>
        ) : null}
        <span className="topbar-field">level {(merged.level * 100).toFixed(0)} %</span>
        <div className="topbar-controls">
          <div className="segmented view-switch" role="group" aria-label="View">
            {experiment.views.map((v) => (
              <button
                key={v}
                type="button"
                className={view === v ? 'on' : ''}
                aria-pressed={view === v}
                onClick={() => setView(v)}
              >
                {VIEWS[v]}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="panes">
        <View view={view} a={a} p={merged} highlight={highlight} onPickRun={setHighlight} />
        <Readouts view={view} a={a} p={merged} />
      </main>
    </div>
  )
}

function Knob({ name, value, onChange }) {
  if (CHOICES[name]) {
    return (
      <label className="knob">
        <span>{name}</span>
        <select value={value} onChange={(e) => onChange(name, e.target.value)}>
          {CHOICES[name].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
    )
  }
  const k = KNOBS[name]
  if (!k) return null
  if (typeof value === 'boolean') {
    return (
      <label className="knob">
        <span>{k.label}</span>
        <input type="checkbox" checked={value} onChange={(e) => onChange(name, e.target.checked)} />
      </label>
    )
  }
  return (
    <NumField
      label={k.label}
      unit={k.unit || ''}
      value={value}
      min={k.min}
      max={k.max}
      onChange={(v) => onChange(name, k.integer ? Math.round(v) : v)}
    />
  )
}

function View({ view, a, p, highlight, onPickRun }) {
  switch (view) {
    case 'scope':
      return <ScopeCanvas data={a.params.filtered || a.params.noiseRms !== DEFAULTS.noiseRms ? a.record().x.subarray(0, 2048) : a.draw()} />
    case 'histogram':
      return <HistogramCanvas hist={a.hist()} />
    case 'ensemble': {
      const e = a.ens()
      const band = p.spec ? { lo: p.spec[0], hi: p.spec[1], label: 'spec' } : null
      const y = band ? e.withinSpec() : null
      return (
        <EnsembleCanvas
          ensemble={e}
          y={{ label: 'Value', units: '' }}
          show={{ paths: 24, mean: true, spread: 'gaussian' }}
          level={0.6827}
          highlight={highlight}
          band={band}
          count={y ? { pass: y.k, n: y.n, stderr: y.se } : null}
          target={p.spec ? (p.spec[0] + p.spec[1]) / 2 : null}
          onPickRun={onPickRun}
        />
      )
    }
    case 'outcome': {
      const e = a.ens()
      const band = p.spec ? { lo: p.spec[0], hi: p.spec[1], label: 'spec' } : null
      const y = band ? e.withinSpec() : null
      return (
        <OutcomeCanvas
          stats={e.stats}
          band={band}
          count={y ? { pass: y.k, n: y.n, stderr: y.se } : null}
        />
      )
    }
    case 'correlation':
      return <CorrelationCanvas acf={a.acf()} />
    case 'density':
      return <DensityCanvas psd={a.psd()} />
    case 'matched':
      return <MatchedCanvas snr={a.snr()} />
    case 'errorrate':
      return <ErrorRateCanvas ber={a.ber()} />
    case 'kalman':
      return <KalmanCanvas kalman={a.kalman()} />
    case 'wiener':
      return <ScopeCanvas data={a.wiener().fir.apply(a.draw())} label="Estimate" />
    case 'ktc':
      return <KtcTable a={a} />
    default:
      return null
  }
}

function KtcTable({ a }) {
  const k = a.ktc()
  return (
    <table className="ktc">
      <caption>The same rms at every resistance, because the density and the bandwidth cancel</caption>
      <thead>
        <tr>
          <th>R</th>
          <th>Density</th>
          <th>Corner</th>
          <th>Noise bandwidth</th>
          <th>rms</th>
        </tr>
      </thead>
      <tbody>
        {k.sweep.map((row) => (
          <tr key={row.R}>
            <td>{fmt(row.R, 'Ω', 3)}</td>
            <td>{fmt(row.density, 'V/√Hz', 4)}</td>
            <td>{fmt(row.fc, 'Hz', 4)}</td>
            <td>{fmt(row.enb, 'Hz', 4)}</td>
            <td>{fmt(row.rms, 'V', 4)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Readouts({ view, a, p }) {
  switch (view) {
    case 'histogram': {
      const h = a.hist()
      const e = a.est()
      return (
        <Pane title="What the histogram measures">
          <Closed label="Expectation" value={a.dist.mean} />
          <Closed label="Variance" value={a.dist.variance} />
          <Estimate label="Sample mean" est={e.mean} />
          <Estimate label="Sample variance" est={e.variance} />
          <Against label="Gap to the density" measured={h.error.rms} predicted={h.error.predicted} />
          <Closed label="Bin width" value={h.width} />
          <Closed label="Outside the range" value={h.outside} sig={0} />
        </Pane>
      )
    }
    case 'density': {
      const s = a.psd()
      return (
        <Pane title="What the density measures">
          <Closed label="Source density" value={s.inputDensity} unit="V/√Hz" />
          <Closed label="Averages" value={s.segments} sig={0} />
          <Closed label="Degrees of freedom" value={s.dof} sig={0} note={s.dofExact ? null : 'effective, under overlap'} />
          <Closed label="Predicted spread" value={s.relativeSe} />
          <Against label="Measured spread" measured={s.flatness} predicted={s.relativeSe} />
          <Against label="Integral as rms" measured={s.rmsFromIntegral} predicted={s.inputRms} />
          <Closed label="Interval, low" value={s.ciLo} />
          <Closed label="Interval, high" value={s.ciHi} />
          <Closed label="Bin width" value={s.df} unit="Hz" />
        </Pane>
      )
    }
    case 'correlation': {
      const c = a.acf()
      return (
        <Pane title="What the correlation measures">
          <Closed
            label="Mean square at zero lag"
            value={c.r0}
            unit="V²"
            note="the plot divides by it, so the curve starts at 1"
          />
          <Closed label="1/e lag" value={c.lagAt1e} sig={0} note="samples" />
          <Closed label="Time constant" value={c.tauSamples} note="samples" />
          <Closed
            label="White record band"
            value={c.whiteBand}
            note="plus and minus, at 5 over the root of the record length"
          />
        </Pane>
      )
    }
    case 'ensemble':
    case 'outcome': {
      const e = a.ens()
      const y = p.spec ? e.withinSpec() : null
      return (
        <Pane title="What the ensemble measures">
          <Closed label="Runs" value={e.runs} sig={0} />
          <Closed label="Run length" value={e.length} sig={0} />
          {e.statEstimate ? <Estimate label="Mean outcome" est={e.statEstimate} /> : null}
          <Closed label="Spread of time averages" value={e.ergodicity.spread} />
          <Closed
            label="Ensemble and time gap"
            value={e.ergodicity.gap}
            note="the two averages sum the same values, so this is rounding"
          />
          {y ? <Estimate label="Yield" est={y} scale={100} /> : null}
        </Pane>
      )
    }
    case 'matched': {
      const s = a.snr()
      return (
        <Pane title="What the filter reaches">
          <Closed label="Output ratio" value={s.snr} />
          <Closed label="In decibels" value={s.snrDb} unit="dB" />
          <Against label="2E/N0" measured={s.twoEOverN0} predicted={s.snr} />
          <Closed label="Pulse energy" value={s.energyDiscrete} />
          <Closed label="Mismatched ratio" value={s.mismatch} unit="%" note="of the matched filter's ratio" />
          <Closed label="Mismatch loss" value={s.mismatchLossDb} unit="dB" />
        </Pane>
      )
    }
    case 'errorrate': {
      const b = a.ber()
      return (
        <Pane title="What the count measures">
          <Closed label="Closed form" value={b.predicted} />
          <Closed label="On-off keying" value={b.orthogonal} />
          <Estimate label="Counted rate" est={b.measured} />
          <Closed label="Errors" value={b.errors} sig={0} />
          <Closed label="Symbols" value={b.symbols} sig={0} />
        </Pane>
      )
    }
    case 'wiener': {
      const w = a.wiener()
      return (
        <Pane title="What the filter leaves">
          <Closed label="Weight" value={w.w} />
          <Closed label="Error with the weight" value={w.mmse} />
          <Closed label="Error with none" value={w.unfilteredMse} />
          <Closed label="Gain in decibels" value={w.gainDb} unit="dB" note="a scaling cannot change a ratio" />
          <Closed label="One weight, on this record" value={w.oneWeightMmse} />
          <Closed label={`${p.taps} taps`} value={w.bestMmse} />
          <Closed label="As a fraction" value={w.bestFraction} />
        </Pane>
      )
    }
    case 'kalman': {
      const k = a.kalman()
      return (
        <Pane title="What the gain settles to">
          <Closed label="Settled gain" value={k.steadyGain} />
          <Closed label="Prior variance" value={k.priorVariance} />
          <Closed label="Error left" value={k.posteriorVariance} />
          <Closed label="Innovation variance" value={k.innovationVariance} />
          <Closed label="Settles at step" value={k.settledAt} sig={0} />
          {k.oneShotMmse === null ? (
            <Closed
              label="One-shot estimate"
              value={NaN}
              note="a random walk has no stationary variance, so there is none to compare"
            />
          ) : (
            <>
              <Closed label="One-shot error" value={k.oneShotMmse} />
              <Closed
                label="What memory is worth"
                value={k.memoryWorth}
                note="the settled error as a fraction of the one-shot error"
              />
            </>
          )}
        </Pane>
      )
    }
    case 'ktc': {
      const k = a.ktc()
      return (
        <Pane title="What kT over C measures">
          <Closed label="rms" value={k.rms} unit="V" />
          <Closed label="Through the bandwidth" value={k.viaBandwidth} unit="V" />
          <Closed label="Density" value={k.density} unit="V/√Hz" />
          <Closed label="Corner" value={k.fc} unit="Hz" />
          <Closed label="Noise bandwidth" value={k.enb} unit="Hz" />
        </Pane>
      )
    }
    default:
      return null
  }
}

export { KNOBS, CHOICES, fmtNum }
