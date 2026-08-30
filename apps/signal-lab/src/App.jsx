import React, { useMemo, useState } from 'react'
import Controls from './components/Controls.jsx'
import TopBar from './components/TopBar.jsx'
import ScopeCanvas from './components/ScopeCanvas.jsx'
import SpectrumCanvas from './components/SpectrumCanvas.jsx'
import ImpulseCanvas from './components/ImpulseCanvas.jsx'
import ConvolutionCanvas, { useConvolutionPosition } from './components/ConvolutionCanvas.jsx'
import { APERIODIC, render, rms, peak } from '@ee-labs/dsp'
import { COLORS, ZPlaneCanvas } from '@ee-labs/ui'
import { spectrum } from '@ee-labs/dsp'
import {
  applyChain,
  chainGroupDelay,
  chainImpulse,
  chainPhase,
  kernelCentre,
  chainPolesZeros,
  chainResponse,
  renderChain,
  runChain,
} from './dsp/chain.js'
import { PRESETS } from './presets.js'
import { readLocationLink } from '@ee-labs/ui'
import { stateFromLink } from './fromLink.js'
import { mathContext, mathFor } from './math.js'

const INITIAL = {
  sources: [{ id: 1, type: 'sine', freq: 250, amp: 1, phase: 0, enabled: true }],
  blocks: [],
  sampleRate: 8000,
  fftSize: 2048,
  window: 'hann',
  timeSpanMs: 20,
  spanCycles: 5,
  scale: 'db',
  showHarmonics: false,
  showGhost: false,
  // Phase and group delay share one right-hand axis, so they are a choice
  // rather than two toggles. See SpectrumCanvas.
  overlay: 'none',
  showTransient: false,
  // Each pane can show the chain from a different side. The signal and its
  // spectrum are the default pair; the impulse response and the z-plane are the
  // same filter described by its kernel and by its roots.
  timeView: 'signal',
  freqView: 'spectrum',
  presetName: 'Single tone',
}

/**
 * Which side of the chain a pane is showing.
 *
 * Sits in the pane's own header rather than in the sidebar because it changes
 * that pane and nothing else — and because the two panes stay two panes, which
 * is the constraint the whole layout is built around.
 */
function ViewSwitch({ value, onChange, options }) {
  return (
    <div className="segmented sm view-switch" role="group">
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

export default function App() {
  // A link from another tool in the suite, if there is one. Read once at
  // startup: it is where you arrived from, not a thing that keeps changing.
  const [linked] = useState(() => {
    const { patch, warnings } = readLocationLink()
    const { state, warnings: more } = stateFromLink(patch, INITIAL)
    return { state, warnings: [...warnings, ...more] }
  })

  const [state, setState] = useState(linked.state || INITIAL)
  // A block that arrived from a link should be open. You did not choose it, so
  // being able to see what you were handed is the first thing you want.
  const [openBlocks, setOpenBlocks] = useState(
    () => new Set((linked.state?.blocks ?? []).map((b) => b.id)),
  )

  const applyPreset = (p) => {
    // Every toggle is re-pinned to its default before the patch lands, or settings
    // from the previous preset leak into this one.
    setState((s) => ({
      ...INITIAL,
      sources: s.sources,
      sampleRate: s.sampleRate,
      fftSize: s.fftSize,
      ...p.patch,
      presetName: p.name,
    }))
    setOpenBlocks(new Set((p.patch.blocks || []).map((b) => b.id)))
  }

  const patch = (k, v) => setState((s) => ({ ...s, [k]: v }))

  const reveal = (id) => {
    const el = document.getElementById(id)
    if (!el) return
    // CSS scroll-behavior cannot override an explicit 'smooth' argument, so
    // the reduced-motion preference has to be honoured here in the call.
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ block: 'nearest', behavior: still ? 'auto' : 'smooth' })
    el.classList.add('is-flash')
    window.setTimeout(() => el.classList.remove('is-flash'), 600)
  }

  // The scope counts the signal's own cycles, so the span survives a change of
  // frequency: "show me five periods" stays five periods whether the source is
  // at 250 Hz or 2 kHz. Noise has no cycles to count, so a noise-only patch
  // falls back to a span in milliseconds.
  const divisionRate = useMemo(() => {
    const f = state.sources.find((s) => s.enabled && !APERIODIC.has(s.type))
    return f && f.freq > 0 ? f.freq : null
  }, [state.sources])

  const spanSeconds = divisionRate ? state.spanCycles / divisionRate : state.timeSpanMs / 1000

  // Time-domain buffer covers the visible span; the FFT gets its own frame. Both
  // go through the chain, or the two plots would disagree at the left edge.
  const timeN = Math.max(2, Math.ceil(spanSeconds * state.sampleRate))

  const { out: timeBuf, stages } = useMemo(
    () =>
      runChain(state.sources, state.blocks, timeN, state.sampleRate, {
        t0: 0,
        warmup: state.showTransient ? 0 : 'auto',
      }),
    [state.sources, state.blocks, timeN, state.sampleRate, state.showTransient],
  )

  const { freqs, amps, clamped } = useMemo(() => {
    const r = renderChain(state.sources, state.blocks, state.fftSize, state.sampleRate)
    const s = spectrum(r.buf, state.sampleRate, state.window)
    return { ...s, clamped: r.clamped }
  }, [state.sources, state.blocks, state.fftSize, state.sampleRate, state.window])

  // The same window of signal without the chain, drawn under the processed
  // trace. "What did this block do to the shape" should be answerable by
  // looking, not by toggling the block off and trying to remember.
  const dryBuf = useMemo(() => {
    if (!state.showGhost || state.blocks.length === 0) return null
    return render(state.sources, timeN, state.sampleRate, 0)
  }, [state.showGhost, state.sources, state.blocks.length, timeN, state.sampleRate])

  const ghostAmps = useMemo(() => {
    if (!state.showGhost || state.blocks.length === 0) return null
    const buf = render(state.sources, state.fftSize, state.sampleRate)
    return spectrum(buf, state.sampleRate, state.window).amps
  }, [state.showGhost, state.sources, state.blocks, state.fftSize, state.sampleRate, state.window])

  const resp = useMemo(() => {
    if (state.blocks.length === 0) return null
    const r = chainResponse(state.blocks, freqs, state.sampleRate)
    return r.any || !r.exact ? r : null
  }, [state.blocks, freqs, state.sampleRate])

  // Only the chain's own phase or delay, and only when asked for. See chainPhase
  // for why the measured signal's phase is deliberately not on offer.
  const overlay = useMemo(() => {
    if (state.overlay === 'none' || state.blocks.length === 0) return null
    if (state.overlay === 'phase') {
      const r = chainPhase(state.blocks, freqs, state.sampleRate)
      if (!r.any) return null
      const values = new Float64Array(r.phase.length)
      for (let i = 0; i < values.length; i++) values[i] = (r.phase[i] * 180) / Math.PI
      return {
        kind: 'phase',
        values,
        label: 'Phase of the chain',
        tick: (v) => `${v}°`,
      }
    }
    const r = chainGroupDelay(state.blocks, freqs, state.sampleRate)
    if (!r.any) return null
    return {
      kind: 'delay',
      values: r.delay,
      label: 'Group delay of the chain',
      tick: (v) => `${Number(v.toPrecision(3))}`,
    }
  }, [state.overlay, state.blocks, freqs, state.sampleRate])

  // The same chain said two more ways: as the kernel it convolves with, and as
  // the roots that kernel has. Both are cheap and neither is computed unless its
  // pane is actually showing.
  const impulse = useMemo(() => {
    if (state.timeView !== 'impulse') return null
    // Long enough to show an IIR tail decaying, capped so a resonant section at
    // Q 40 does not turn the view into a solid block of stems.
    const n = Math.min(2048, Math.max(64, Math.ceil(state.sampleRate * 0.05)))
    return chainImpulse(state.blocks, n, state.sampleRate)
  }, [state.timeView, state.blocks, state.sampleRate])

  const pz = useMemo(() => {
    if (state.freqView !== 'zplane') return null
    return chainPolesZeros(state.blocks, state.sampleRate)
  }, [state.freqView, state.blocks, state.sampleRate])

  // Where a linear-phase kernel's centre of symmetry is, and so its delay.
  const impulseCentre = useMemo(
    () => (impulse && impulse.exact ? kernelCentre(impulse.h) : null),
    [impulse],
  )

  // The convolution view's three actors. The input starts at t = 0 with no
  // pre-roll — deliberately, because the first N samples of partial overlap
  // ARE the filter's warm-up, and this is the one view where showing it is the
  // point rather than a contamination.
  const conv = useMemo(() => {
    if (state.timeView !== 'conv') return null
    const x = render(state.sources, timeN, state.sampleRate, 0)
    const { h, exact } = chainImpulse(
      state.blocks,
      Math.min(2048, Math.max(64, Math.ceil(state.sampleRate * 0.05))),
      state.sampleRate,
    )
    const y = applyChain(state.blocks, x, state.sampleRate, 0)
    return { x, h, y, exact }
  }, [state.timeView, state.sources, state.blocks, timeN, state.sampleRate])

  const scrub = useConvolutionPosition(timeN)

  // The sum the shaded bars represent, computed HERE from the kernel — an
  // independent path from the chain's own stateful processors. For a linear
  // chain the two must agree to rounding; for a nonlinear one they visibly
  // do not, and that disagreement is the readout's whole message.
  const convDot = useMemo(() => {
    if (!conv) return 0
    const n = Math.min(conv.x.length - 1, scrub.pos)
    let acc = 0
    for (let k = 0; k < conv.h.length && k <= n; k++) acc += conv.h[k] * conv.x[n - k]
    return acc
  }, [conv, scrub.pos])

  const stats = useMemo(() => {
    let iMax = 0
    for (let i = 1; i < amps.length; i++) if (amps[i] > amps[iMax]) iMax = i
    return {
      rms: rms(timeBuf),
      peak: peak(timeBuf),
      peakFreq: freqs[iMax],
      peakAmp: amps[iMax],
    }
  }, [timeBuf, freqs, amps])

  const markers = useMemo(() => {
    if (!state.showHarmonics) return []
    const first = state.sources.find((s) => s.enabled && s.type !== 'noise')
    if (!first) return []
    const out = []
    for (let k = 1; k * first.freq <= state.sampleRate / 2; k++) out.push(k * first.freq)
    return out
  }, [state.showHarmonics, state.sources, state.sampleRate])

  // Must account for the pre-chain trace as well, or a filter that cuts the
  // signal down rescales the axis and clips its own ghost off the top.
  const yMax = useMemo(() => {
    const pk = dryBuf ? Math.max(stats.peak, peak(dryBuf)) : stats.peak
    return Math.max(0.2, Math.ceil(pk * 10) / 10 || 1)
  }, [stats.peak, dryBuf])

  // Ghost first, so the processed trace is drawn on top of it.
  const scopeTraces = useMemo(() => {
    const list = []
    if (dryBuf) list.push({ buf: dryBuf, color: COLORS.traceGhost, dim: true })
    list.push({ buf: timeBuf, color: COLORS.trace })
    return list
  }, [dryBuf, timeBuf])

  // Built from live state, so the numbers follow the sliders. The context
  // builder is shared with math.test.js, which checks every panel's claims.
  const math = useMemo(
    () =>
      mathFor(
        state.presetName,
        mathContext({ state, freqs, amps, ghostAmps, resp, peakFreq: stats.peakFreq }),
      ),
    [state, freqs, amps, ghostAmps, resp, stats.peakFreq],
  )

  return (
    <div className="app">
      <Controls
        state={state}
        setState={setState}
        presets={PRESETS}
        linkWarnings={linked.warnings}
        cameFromLink={!!linked.state}
        math={math}
        onPreset={applyPreset}
        openBlocks={openBlocks}
        setOpenBlocks={setOpenBlocks}
      />

      <TopBar
        state={{ ...state, divisionRate }}
        patch={patch}
        stages={stages}
        onReveal={reveal}
      />

      <main className="views">
        <section className="view">
          <div className="view-head">
            <h2>Time domain</h2>
            <ViewSwitch
              value={state.timeView}
              onChange={(v) => patch('timeView', v)}
              options={[
                { id: 'signal', label: 'Signal', title: 'The waveform going through the chain' },
                {
                  id: 'impulse',
                  // Not "Impulse response": there is already a preset by that
                  // name, and two buttons reading the same and doing different
                  // things is a genuine ambiguity, not just an awkward selector.
                  label: 'Kernel',
                  title: 'The impulse response — the kernel the chain convolves every input with',
                },
                {
                  id: 'conv',
                  label: 'Convolution',
                  title: 'Watch the kernel slide over the input, one output sample at a time',
                },
              ]}
            />
            <div className="readout">
              {state.timeView === 'signal' ? (
                <>
                  <span>
                    RMS <b>{stats.rms.toFixed(3)}</b>
                  </span>
                  <span>
                    peak <b>{stats.peak.toFixed(3)}</b>
                  </span>
                  <span>
                    crest <b>{(stats.peak / (stats.rms || 1)).toFixed(2)}</b>
                  </span>
                  {state.showTransient && state.blocks.length > 0 ? (
                    <span className="flag">transient shown</span>
                  ) : null}
                </>
              ) : state.timeView === 'conv' && conv ? (
                <>
                  <span>
                    n = <b>{Math.min(conv.x.length - 1, scrub.pos)}</b>
                  </span>
                  <span>
                    chain y[n] <b>{conv.y[Math.min(conv.x.length - 1, scrub.pos)].toFixed(4)}</b>
                  </span>
                  <span>
                    Σ h·x <b>{convDot.toFixed(4)}</b>
                  </span>
                  {conv.exact ? null : (
                    <span className="flag warn">they disagree — this chain is not LTI</span>
                  )}
                </>
              ) : (
                <>
                  {impulseCentre != null ? (
                    <span>
                      delay <b>{impulseCentre} samples</b>, every frequency
                    </span>
                  ) : (
                    <span>
                      delay <b>varies with frequency</b>
                    </span>
                  )}
                  {impulse && !impulse.any ? <span className="flag">no blocks — h[0] = 1</span> : null}
                  {impulse && !impulse.exact ? (
                    <span className="flag warn">nonlinear: this is not an impulse response</span>
                  ) : null}
                </>
              )}
            </div>
          </div>
          {state.timeView === 'conv' && conv ? (
            <>
              <div className="conv-bar">
                <button
                  type="button"
                  className="ghost"
                  onClick={() => scrub.setPlaying((p) => !p)}
                >
                  {scrub.playing ? '⏸ pause' : '▶ play'}
                </button>
                <input
                  type="range"
                  min={0}
                  max={timeN - 1}
                  value={Math.min(timeN - 1, scrub.pos)}
                  aria-label="Output sample n"
                  onChange={(e) => {
                    scrub.setPlaying(false)
                    scrub.setPos(Number(e.target.value))
                  }}
                />
              </div>
              <ConvolutionCanvas
                x={conv.x}
                h={conv.h}
                y={conv.y}
                pos={scrub.pos}
                exact={conv.exact}
              />
            </>
          ) : state.timeView === 'impulse' && impulse ? (
            <ImpulseCanvas
              h={impulse.h}
              sampleRate={state.sampleRate}
              centre={impulseCentre}
              exact={impulse.exact}
            />
          ) : (
            <ScopeCanvas
              traces={scopeTraces}
              sampleRate={state.sampleRate}
              spanSeconds={spanSeconds}
              divisionRate={divisionRate}
              yMax={yMax}
            />
          )}
        </section>

        <section className="view">
          <div className="view-head">
            <h2>Frequency domain</h2>
            <ViewSwitch
              value={state.freqView}
              onChange={(v) => patch('freqView', v)}
              options={[
                { id: 'spectrum', label: 'Spectrum', title: 'What came out, against what the chain should do' },
                {
                  id: 'zplane',
                  label: 'z-plane',
                  title: 'The same filter as poles and zeros, with the unit circle as the frequency axis',
                },
              ]}
            />
            <div className="readout">
              {state.freqView === 'spectrum' ? (
                <>
                  <span>
                    peak <b>{stats.peakFreq.toFixed(1)} Hz</b>
                  </span>
                  <span>
                    amp <b>{stats.peakAmp.toFixed(3)}</b>
                  </span>
                  <span>
                    Nyquist <b>{state.sampleRate / 2} Hz</b>
                  </span>
                  {resp && !resp.exact ? (
                    <span className="flag">response covers linear blocks only</span>
                  ) : null}
                  {clamped ? <span className="flag warn">still ringing at frame start</span> : null}
                </>
              ) : (
                <>
                  <span>
                    poles <b>{pz ? pz.poles.length : 0}</b>
                  </span>
                  <span>
                    zeros <b>{pz ? pz.zeros.length : 0}</b>
                  </span>
                  {pz && !pz.any && state.blocks.length === 0 ? (
                    <span className="flag">add a filter to see its roots</span>
                  ) : null}
                  {pz && pz.tooMany ? (
                    <span className="flag">
                      {pz.tooMany} delay taps — too many roots to draw
                    </span>
                  ) : null}
                  {pz && !pz.exact && !pz.tooMany ? (
                    <span className="flag">nonlinear blocks have no roots to show</span>
                  ) : null}
                </>
              )}
            </div>
          </div>
          {state.freqView === 'zplane' && pz ? (
            <ZPlaneCanvas
              poles={pz.poles}
              zeros={pz.zeros}
              markerFreq={stats.peakFreq}
              sampleRate={state.sampleRate}
            />
          ) : (
            <SpectrumCanvas
              freqs={freqs}
              amps={amps}
              ghostAmps={ghostAmps}
              response={resp ? resp.mag : null}
              responseExact={resp ? resp.exact : true}
              overlay={overlay}
              scale={state.scale}
              markers={markers}
            />
          )}
        </section>
      </main>
    </div>
  )
}
