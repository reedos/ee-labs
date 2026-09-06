import React, { useMemo, useState } from 'react'
import { LabNav, LessonNav, ReportIssue, TryLine, NumField, fmt, fmtNum } from '@ee-labs/ui'
import { EXPERIMENTS, GROUPS, VIEWS } from './experiments.js'
import { LESSONS } from './lessons.js'
import { termsFor, CHROME_TERMS } from './terms.js'
import { analyse, DEFAULTS } from './analysis.js'
import { reportSummary } from './report.js'
import ConstellationCanvas from './components/ConstellationCanvas.jsx'
import EyeCanvas from './components/EyeCanvas.jsx'
import BerCanvas from './components/BerCanvas.jsx'
import {
  TraceCanvas,
  IqCanvas,
  SpectrumCanvas,
  ChannelCanvas,
  SubcarrierCanvas,
  LoopCanvas,
  BudgetTable,
} from './components/views.jsx'
import { Closed, Counted, Against, Assumptions, Pane, Terms } from './components/panes.jsx'

// The knobs a view can put on screen, with their units and their ranges. A knob
// not listed here is still a parameter and is simply not offered.
const KNOBS = {
  seed: { label: 'Seed', min: 1, max: 9999, step: 1, integer: true },
  ebN0Db: { label: 'Eb/N0', unit: 'dB', min: -5, max: 30, step: 0.5 },
  symbols: { label: 'Symbols', min: 64, max: 8192, step: 64, integer: true },
  countSymbols: { label: 'Counted symbols', min: 2000, max: 200000, step: 2000, integer: true },
  countTo: { label: 'Count up to', unit: 'dB', min: 0, max: 12, step: 1 },
  m: { label: 'Modulation index', min: 0, max: 2, step: 0.05 },
  deviation: { label: 'Deviation', unit: 'Hz', min: 0, max: 2000, step: 5 },
  carrier: { label: 'Carrier', unit: 'Hz', min: 250, max: 3500, step: 50 },
  message: { label: 'Message', unit: 'Hz', min: 50, max: 1000, step: 25 },
  beta: { label: 'Roll-off', min: 0, max: 1, step: 0.05 },
  span: { label: 'Span', min: 2, max: 24, step: 2, integer: true },
  timingError: { label: 'Timing error', min: -0.5, max: 0.5, step: 0.01 },
  phaseOffsetDeg: { label: 'Phase offset', unit: '°', min: -90, max: 90, step: 1 },
  freqOffsetHz: { label: 'Frequency offset', unit: 'Hz', min: 0, max: 40, step: 1 },
  bnT: { label: 'Loop bandwidth', min: 0.001, max: 0.1, step: 0.001 },
  zeta: { label: 'Damping', min: 0.3, max: 2, step: 0.01 },
  gate: { label: 'Gate spacing', min: 0.125, max: 1, step: 0.125 },
  ofdmN: { label: 'Subcarriers', min: 16, max: 256, step: 16, integer: true },
  ofdmCp: { label: 'Prefix', min: 2, max: 64, step: 2, integer: true },
  ofdmUsed: { label: 'Used', min: 8, max: 200, step: 4, integer: true },
  ofdmPilots: { label: 'Pilots', min: 0, max: 16, step: 1, integer: true },
  channelTaps: { label: 'Channel taps', min: 1, max: 24, step: 1, integer: true },
  echo: { label: 'Echo', min: 0, max: 0.95, step: 0.05 },
  echoDelay: { label: 'Echo delay', min: 1, max: 16, step: 1, integer: true },
  eqTaps: { label: 'Equaliser taps', min: 3, max: 61, step: 2, integer: true },
  mu: { label: 'Step size', min: 0.001, max: 0.2, step: 0.001 },
  lmsSymbols: { label: 'Training symbols', min: 1000, max: 60000, step: 1000, integer: true },
  n0: { label: 'Noise density', min: 0.005, max: 1, step: 0.005 },
  pulseLength: { label: 'Pulse length', min: 8, max: 256, step: 8, integer: true },
  trials: { label: 'Trials', min: 2000, max: 60000, step: 2000, integer: true },
  distance: { label: 'Distance', unit: 'm', min: 10, max: 50000, step: 10 },
  frequency: { label: 'Frequency', unit: 'Hz', min: 1e8, max: 6e9, step: 1e6 },
  txDbm: { label: 'Transmit power', unit: 'dBm', min: -10, max: 40, step: 1 },
  antennaDbi: { label: 'Antenna gain', unit: 'dBi', min: -5, max: 20, step: 0.5 },
  noiseFigureDb: { label: 'Noise figure', unit: 'dB', min: 0, max: 15, step: 0.5 },
  bandwidth: { label: 'Bandwidth', unit: 'Hz', min: 1e4, max: 2e7, step: 1e4 },
  bitRate: { label: 'Bit rate', unit: 'bit/s', min: 1e4, max: 2e7, step: 1e4 },
  lnaGainDb: { label: 'Amplifier gain', unit: 'dB', min: 0, max: 30, step: 0.5 },
  lnaNfDb: { label: 'Amplifier figure', unit: 'dB', min: 0.5, max: 10, step: 0.1 },
  kFactor: { label: 'Rician factor', min: 0, max: 20, step: 0.5 },
}

const CHOICES = {
  scheme: ['bpsk', 'qpsk', 'psk8', 'pam4', 'qam16', 'qam64', 'fskCoherent', 'fskNoncoherent', 'dbpsk'],
  shape: ['rrc', 'rc', 'rect'],
  pulse: ['rect', 'halfSine', 'ramp'],
  loopOrder: [1, 2],
}

export default function App() {
  const [index, setIndex] = useState(0)
  const experiment = EXPERIMENTS[index]
  const [params, setParams] = useState(experiment.params)
  const [view, setView] = useState(experiment.view)

  const load = (i) => {
    const e = EXPERIMENTS[i]
    setIndex(i)
    setParams(e.params)
    setView(e.view)
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
        <LabNav current="comms-lab" currentLabel="Communications Lab" />

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

        <ReportIssue lab="comms-lab" state={params} summary={reportSummary(experiment, merged)} />
      </aside>

      <header className="topbar">
        <span className="topbar-field">Eb/N0 {merged.ebN0Db} dB</span>
        <span className="topbar-field">{headline(experiment, a, merged)}</span>
        <span className="topbar-field">{merged.scheme}</span>
        <span className="topbar-field">{merged.sps} samples a symbol</span>
        <span className="topbar-field">seed {merged.seed}</span>
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
        <View view={view} a={a} p={merged} />
        <Readouts view={view} a={a} p={merged} />
      </main>
    </div>
  )
}

/** The experiment's own headline number, second in the top bar. */
function headline(experiment, a, p) {
  switch (experiment.view) {
    case 'ber':
      return `rate ${fmtNum(a.ber().closed, 3)}`
    case 'constellation':
      return `error vector ${a.cloud().evm.percent.toFixed(2)} %`
    case 'eye':
      return `opening ${fmtNum(a.eye().opening, 3)}`
    case 'channel':
      return `notch ${a.chan().notchDb.toFixed(2)} dB`
    case 'subcarriers':
      return `${a.ofdm().dataCarriers} data subcarriers`
    case 'loop':
    case 'gate':
      return `Bn ${fmt(a.loop().bn, 'Hz', 4)}`
    case 'budget':
      return `margin ${a.budget().margin.toFixed(2)} dB`
    case 'spectrum':
    case 'scope':
      return `index ${fmtNum(p.deviation / p.message, 3)}`
    default:
      return `${p.symbolRate} symbols a second`
  }
}

function Knob({ name, value, onChange }) {
  if (CHOICES[name]) {
    return (
      <label className="knob">
        <span>{name}</span>
        <select
          value={value}
          onChange={(e) =>
            onChange(name, typeof CHOICES[name][0] === 'number' ? Number(e.target.value) : e.target.value)
          }
        >
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

function View({ view, a, p }) {
  switch (view) {
    case 'constellation': {
      const c = a.cloud()
      const m = a.map()
      return (
        <ConstellationCanvas
          points={c.noisy}
          ideal={m.points}
          regions={m.name === 'psk8' || m.name === 'qpsk' ? 'circular' : 'auto'}
          evm={c.evm}
          caption={`${m.label}, ${m.bits} bits a symbol`}
        />
      )
    }
    case 'eye':
      return <EyeCanvas buffer={a.eye().traces} sps={p.sps} decisionAt={p.timingError} />
    case 'ber':
      return (
        <BerCanvas
          curve={a.ber().curve}
          hollowBelow={a.ber().hollowBelow}
          label={p.scheme}
          limits={null}
        />
      )
    case 'spectrum': {
      const which = p.deviation && p.view !== 'am' ? a.fm() : a.am()
      const s = which.spectrum
      return (
        <SpectrumCanvas
          freqs={s.freqs}
          amps={s.amps}
          xMax={3000}
          markers={[
            { hz: p.carrier, label: 'carrier' },
            { hz: p.carrier - p.message, label: 'lower' },
            { hz: p.carrier + p.message, label: 'upper' },
          ]}
        />
      )
    }
    case 'scope':
      return <TraceCanvas data={a.am().buf.subarray(2048, 2048 + 512)} xLabel="Sample" label="Amplitude" />
    case 'iq':
      return <IqCanvas buffer={a.wave().shaped} sampleRate={p.sampleRate} />
    case 'channel':
      return <ChannelCanvas chan={a.chan()} occupied={a.chan().occupied} />
    case 'subcarriers':
      return (
        <SubcarrierCanvas
          channel={a.ofdm().channel}
          n={p.ofdmN}
          used={p.ofdmUsed}
          pilots={p.ofdmPilots}
        />
      )
    case 'loop':
      return <LoopCanvas phase={a.loop().run.phase} symbolRate={p.symbolRate} />
    case 'gate':
      return <LoopCanvas curve={a.loop().gate.curve} offsets={a.loop().gate.offsets} />
    case 'pulse':
      return <TraceCanvas data={a.pulse().taps} xLabel="Tap" label="Kernel" />
    case 'budget':
      return <BudgetTable budget={a.budget()} />
    default:
      return null
  }
}

function Readouts({ view, a, p }) {
  switch (view) {
    case 'constellation': {
      const m = a.map()
      const c = a.cloud()
      return (
        <Pane title="What the constellation measures">
          <Closed label="Bits a symbol" value={m.bits} sig={0} />
          <Closed label="Minimum distance" value={m.minDistance} />
          <Closed label="Mean square" value={m.meanSquare} />
          <Closed label="Peak to average" value={m.paprDb} unit="dB" />
          <Closed label="Es over Eb" value={m.esOverEbDb} unit="dB" />
          <Closed label="Error vector" value={c.evm.percent} note="per cent" />
          <Closed label="Symbol errors" value={c.outside.errors} sig={0} />
          <Against label="Symbol error rate" measured={c.symbolErrorRate} predicted={a.ber().ser} />
        </Pane>
      )
    }
    case 'eye': {
      const e = a.eye()
      const pu = a.pulse()
      return (
        <Pane title="What the eye measures">
          <Closed label="Opening at the instant" value={e.openingClean} />
          <Closed label="Opening as set" value={e.opening} note={e.closed ? 'the eye is closed' : null} />
          <Closed label="At a twentieth of a symbol" value={e.openingAt[0]} />
          <Closed label="At a tenth" value={e.openingAt[1]} />
          <Closed label="At a fifth" value={e.openingAt[2]} />
          <Closed label="Residual, nearest two" value={pu.isi.near} />
          <Closed label="Residual, every lag" value={pu.isi.peak} note={pu.guarded ? 'span below six symbols' : null} />
          <Closed label="Residual, added" value={pu.isi.sum} />
        </Pane>
      )
    }
    case 'ber': {
      const b = a.ber()
      return (
        <Pane title="The form, and the count">
          <Closed label="Closed form" value={b.closed} />
          <Counted label="Counted rate" est={b.counted} />
          <Closed label="Symbol error rate" value={b.ser} />
          <Closed label="Half width at 100 errors" value={b.halfWidth100 * 100} note="per cent" />
          <Closed label="Errors for a tenth" value={b.errorsForTenth} sig={0} />
          <Closed label="Threshold for the target" value={b.threshold[p.scheme]} unit="dB" />
        </Pane>
      )
    }
    case 'spectrum':
    case 'scope': {
      const am = a.am()
      const fm = a.fm()
      return (
        <Pane title="What the spectrum measures">
          <Closed label="Sideband level" value={am.sidebandDb} unit="dB" />
          <Against label="Measured sideband" measured={am.measuredSidebandDb} predicted={am.sidebandDb} />
          <Closed label="Power in the sidebands" value={am.sidebandPower * 100} note="per cent" />
          <Closed label="Modulation index" value={fm.beta} />
          <Closed label="Carson bandwidth" value={fm.carsonBandwidth} unit="Hz" />
          <Closed label="Power inside it" value={fm.carson * 100} note="per cent" />
          <Closed label="Distortion" value={am.thd * 100} note="per cent" />
        </Pane>
      )
    }
    case 'channel': {
      const c = a.chan()
      const e = a.eq()
      return (
        <Pane title="What the channel does">
          <Closed label="Peak" value={c.peakDb} unit="dB" />
          <Closed label="Notch" value={c.notchDb} unit="dB" />
          <Closed label="Notch spacing" value={c.notchSpacing} unit="Hz" />
          <Closed label="First notch" value={c.firstNotch} unit="Hz" />
          <Closed label="Coherence bandwidth" value={c.coherenceBandwidth} unit="Hz" />
          <Closed label="Signal occupies" value={c.occupied} unit="Hz" note={c.selective ? 'frequency selective' : 'flat over the signal'} />
          <Closed label="Residual after equalising" value={e.residual} />
          <Closed label="Noise enhancement" value={e.noiseGainDb} unit="dB" />
        </Pane>
      )
    }
    case 'subcarriers': {
      const o = a.ofdm()
      return (
        <Pane title="What the grid costs">
          <Closed label="Subcarrier spacing" value={o.spacing} unit="Hz" />
          <Closed label="Useful symbol" value={o.usefulMs} note="ms" />
          <Closed label="Prefix" value={o.prefixMs} note="ms" />
          <Closed label="Symbol rate" value={o.symbolRate} note="a second" />
          <Closed label="Occupied bandwidth" value={o.occupied} unit="Hz" />
          <Closed label="Uncoded rate" value={o.bitRate} note="bit/s" />
          <Closed label="Prefix cost" value={o.prefixCostDb} unit="dB" />
          <Closed label="Pilot cost" value={o.pilotCostDb} unit="dB" />
          <Closed label="Worst peak to average" value={o.worstPaprDb} unit="dB" />
        </Pane>
      )
    }
    case 'loop':
    case 'gate': {
      const l = a.loop()
      return (
        <Pane title="What the loop does">
          <Closed label="Loop bandwidth" value={l.bn} unit="Hz" />
          <Closed label="Natural frequency" value={l.wn} note="rad/s" />
          <Closed label="Settles in" value={l.settleMs} note="ms" />
          <Closed label="Settles in symbols" value={l.settleSymbols1pc} sig={0} />
          <Closed label="Residual phase error" value={l.residualDeg} note="degrees" />
          <Closed label="First-order error" value={l.firstOrderErrorDeg} note="degrees" />
          <Closed label="Loop ratio" value={l.snrDb} unit="dB" />
          <Closed label="Detector gain" value={l.slope} />
          <Closed label="Pull-in edge" value={l.peakAt} note="symbol periods" />
        </Pane>
      )
    }
    case 'pulse': {
      const pu = a.pulse()
      return (
        <Pane title="What the pulse costs">
          <Closed label="Baseband bandwidth" value={pu.bandwidth} unit="Hz" />
          <Closed label="Passband bandwidth" value={pu.passband} unit="Hz" />
          <Closed label="Spectral efficiency" value={pu.efficiency} note="bit/s/Hz" />
          <Closed label="Stream peak" value={pu.peak} />
          <Closed label="Stream peak in decibels" value={pu.peakDb} unit="dB" />
          <Closed label="Residual, nearest two" value={pu.isi.near} />
        </Pane>
      )
    }
    case 'budget': {
      const b = a.budget()
      return (
        <Pane title="What the budget leaves">
          <Closed label="kT" value={b.kT} note="dBm/Hz" />
          <Closed label="Noise floor" value={b.noiseFloor} note="dBm" />
          <Closed label="Path loss" value={b.pathLoss} unit="dB" />
          <Closed label="Received" value={b.received} note="dBm" />
          <Closed label="Signal to noise" value={b.snr} unit="dB" />
          <Closed label="Eb over N0" value={b.ebN0} unit="dB" />
          <Closed label="Margin" value={b.margin} unit="dB" />
          <Closed label="Range" value={b.range} unit="m" />
          <Closed label="Noise figure" value={b.noiseFigure} unit="dB" />
          <Closed label="Implementation loss" value={b.implementationTotal} unit="dB" />
        </Pane>
      )
    }
    case 'iq': {
      const w = a.wave()
      const pu = a.pulse()
      return (
        <Pane title="What the shaping does">
          <Closed label="Kernel taps" value={pu.taps.length} sig={0} />
          <Closed label="Baseband bandwidth" value={pu.bandwidth} unit="Hz" />
          <Closed label="Samples a symbol" value={p.sps} sig={0} />
          <Closed label="Symbols drawn" value={w.syms.length / 2} sig={0} />
        </Pane>
      )
    }
    default:
      return null
  }
}

export { KNOBS, CHOICES, Assumptions }
