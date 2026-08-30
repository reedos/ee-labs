import React, { useMemo, useState } from 'react'
import Controls from './components/Controls.jsx'
import TopBar from './components/TopBar.jsx'
import ScopeCanvas from './components/ScopeCanvas.jsx'
import SpectrumCanvas from './components/SpectrumCanvas.jsx'
import { APERIODIC, render, rms, peak } from '@ee-labs/dsp'
import { COLORS } from '@ee-labs/ui'
import { spectrum } from '@ee-labs/dsp'
import { chainPhase, chainResponse, renderChain, runChain } from './dsp/chain.js'
import { PRESETS } from './presets.js'
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
  showPhase: false,
  showTransient: false,
  presetName: 'Single tone',
}

export default function App() {
  const [state, setState] = useState(INITIAL)
  const [openBlocks, setOpenBlocks] = useState(() => new Set())

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
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
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

  // Only the chain's own phase, and only when asked for. See chainPhase for why
  // the measured signal's phase is deliberately not on offer.
  const phase = useMemo(() => {
    if (!state.showPhase || state.blocks.length === 0) return null
    const r = chainPhase(state.blocks, freqs, state.sampleRate)
    return r.any ? r.phase : null
  }, [state.showPhase, state.blocks, freqs, state.sampleRate])

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
            <div className="readout">
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
            </div>
          </div>
          <ScopeCanvas
            traces={scopeTraces}
            sampleRate={state.sampleRate}
            spanSeconds={spanSeconds}
            divisionRate={divisionRate}
            yMax={yMax}
          />
        </section>

        <section className="view">
          <div className="view-head">
            <h2>Frequency domain</h2>
            <div className="readout">
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
            </div>
          </div>
          <SpectrumCanvas
            freqs={freqs}
            amps={amps}
            ghostAmps={ghostAmps}
            response={resp ? resp.mag : null}
            responseExact={resp ? resp.exact : true}
            phase={phase}
            scale={state.scale}
            markers={markers}
          />
        </section>
      </main>
    </div>
  )
}
