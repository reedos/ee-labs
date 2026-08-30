import React, { useMemo, useState } from 'react'
import Controls from './components/Controls.jsx'
import TopBar from './components/TopBar.jsx'
import ScopeCanvas from './components/ScopeCanvas.jsx'
import SpectrumCanvas from './components/SpectrumCanvas.jsx'
import { render, rms, peak } from './dsp/signals.js'
import { COLORS } from './components/plot.js'
import { spectrum } from './dsp/spectrum.js'
import { chainResponse, renderChain, runChain } from './dsp/chain.js'
import { BLOCK_TYPES } from './dsp/blocks.js'

const mk = (id, type, freq, amp, phase = 0) => ({ id, type, freq, amp, phase, enabled: true })
const bk = (id, type, params) => ({ id, type, bypass: false, params: { ...BLOCK_TYPES[type].defaults, ...params } })

// Each preset is a question worth answering by looking at both plots at once.
//
// Exported because the notes make physical claims — "only odd harmonics", "the
// peak is Q", "neither input survives" — and presets.test.js renders each one
// and checks the claim actually holds. Two of these notes were wrong before
// that test existed.
export const PRESETS = [
  {
    name: 'Single tone',
    note: 'One sine, one line. The baseline everything else is read against.',
    patch: { sources: [mk(1, 'sine', 250, 1)], sampleRate: 8000, timeSpanMs: 20, spanCycles: 5 },
  },
  {
    name: 'Square = odd harmonics',
    note: 'A square wave is a sum of odd harmonics at 4A/(kπ). Turn on harmonic markers and count: 1st, 3rd, 5th — and nothing between them.',
    patch: {
      sources: [mk(1, 'square', 250, 1)],
      sampleRate: 8000,
      timeSpanMs: 20, spanCycles: 5,
      showHarmonics: true,
    },
  },
  {
    name: 'Build a square',
    note: 'Three odd harmonics at 1, 1/3, 1/5 of the amplitude. Already square-ish. Add the 7th and 9th to sharpen the corners — the Fourier series assembled by hand.',
    patch: {
      sources: [mk(1, 'sine', 250, 1), mk(2, 'sine', 750, 1 / 3), mk(3, 'sine', 1250, 1 / 5)],
      sampleRate: 8000,
      timeSpanMs: 20, spanCycles: 5,
    },
  },
  {
    name: 'Aliasing',
    note: 'A 3.4 kHz tone at 8 kHz behaves. Drag it past 4 kHz — or click the "alias" chip — and the peak turns around and walks back down. The signal is gone and an impostor took its place.',
    patch: { sources: [mk(1, 'sine', 3400, 1)], sampleRate: 8000, timeSpanMs: 5, spanCycles: 6 },
  },
  {
    name: 'Spectral leakage',
    note: 'Window is set to "none". A tone that does not complete whole cycles in the frame smears across every bin. Switch to Hann in the top bar and watch it collapse back to a line.',
    patch: {
      sources: [mk(1, 'sine', 263, 1)],
      sampleRate: 8000,
      fftSize: 2048,
      window: 'none',
      timeSpanMs: 20, spanCycles: 5,
    },
  },
  {
    name: 'Beating',
    note: 'Two tones 5 Hz apart. The spectrum shows two lines; the scope shows one tone whose envelope pulses at the difference. Same signal, two truths.',
    patch: {
      sources: [mk(1, 'sine', 250, 0.5), mk(2, 'sine', 255, 0.5)],
      sampleRate: 8000,
      timeSpanMs: 200, spanCycles: 50,
    },
  },
  {
    name: 'Low-pass a square',
    note: 'The dim trace is the square before the filter, the solid one after. The gap between them at each harmonic IS the blue response curve: the 3rd is barely touched, the 5th is down 11 dB, and in the time view the corners round off. (The peaks do not sit ON the curve — a square\'s harmonics already fall as 4/kπ before the filter sees them. Try "Resonance is Q", where the input is flat and they do.)',
    patch: {
      sources: [mk(1, 'square', 250, 1)],
      blocks: [bk(1, 'lowpass', { freq: 700, q: Math.SQRT1_2 })],
      sampleRate: 8000,
      timeSpanMs: 20, spanCycles: 5,
      showHarmonics: true,
      showGhost: true,
    },
  },
  {
    name: 'Resonance is Q',
    note: 'White noise contains every frequency at once, so it paints the filter\'s shape directly — the orange trace and the blue curve are the same shape. For a low-pass the peak height at the cutoff IS Q: at Q=10 it stands exactly 20 dB above the flat part. Drag Q and watch it track. (Switch the block to band-pass and the peak stays pinned at 0 dB however hard you drag — there Q sets the width instead.)',
    patch: {
      sources: [mk(1, 'noise', 100, 0.6)],
      blocks: [bk(1, 'lowpass', { freq: 800, q: 10 })],
      sampleRate: 8000,
      timeSpanMs: 20,
    },
  },
  {
    name: 'Phase is invisible here',
    note: 'An all-pass changes the scope waveform completely and leaves the spectrum untouched — |H| = 1 at every frequency. The FFT throws phase away, so this filter is invisible to it. Nothing else here shows that.',
    patch: {
      sources: [mk(1, 'sine', 250, 0.6), mk(2, 'sine', 750, 0.3), mk(3, 'sine', 1250, 0.2)],
      blocks: [bk(1, 'allpass', { freq: 400, q: 2 })],
      sampleRate: 8000,
      timeSpanMs: 20, spanCycles: 5,
    },
  },
  {
    name: 'Clipping makes harmonics',
    note: 'Hard-clip a pure sine and odd harmonics appear at 4c/(kπ) — no filter involved, the nonlinearity manufactures them. The response curve goes dashed because it can no longer describe the whole chain.',
    patch: {
      sources: [mk(1, 'sine', 250, 1)],
      blocks: [bk(1, 'clip', { threshold: 0.3 })],
      sampleRate: 8000,
      timeSpanMs: 20, spanCycles: 5,
      showHarmonics: true,
    },
  },
  {
    name: 'DC breaks the symmetry',
    note: 'Same clipper, but offset the signal first. A symmetric clip makes only odd harmonics; asymmetry brings in the even ones. Drag the DC offset to zero and watch them vanish.',
    patch: {
      sources: [mk(1, 'sine', 250, 1)],
      blocks: [bk(1, 'gain', { gainDb: 0, dcOffset: 0.3 }), bk(2, 'clip', { threshold: 0.4 })],
      sampleRate: 8000,
      timeSpanMs: 20, spanCycles: 5,
      showHarmonics: true,
    },
  },
  {
    name: 'Comb',
    note: 'Add a delayed copy of the signal to itself and it cancels at every frequency where the delay is half a period — notches every fs/D, evenly spaced. Switch it to feedback and the notches become resonances.',
    patch: {
      sources: [mk(1, 'noise', 100, 0.6)],
      blocks: [bk(1, 'comb', { delayMs: 4, g: 0.9, mode: 'feedforward' })],
      sampleRate: 8000,
      timeSpanMs: 20,
    },
  },
  {
    name: 'Ring modulator',
    note: 'Multiply two signals and you get their sum and difference — 250 × 1000 gives 750 and 1250, and neither original frequency survives. Nothing was filtered; the frequencies were moved.',
    patch: {
      sources: [mk(1, 'sine', 250, 1)],
      blocks: [bk(1, 'ringmod', { freq: 1000 })],
      sampleRate: 8000,
      timeSpanMs: 20, spanCycles: 5,
    },
  },
  {
    name: '4 bits',
    note: 'Quantise to 4 bits and the error is correlated with the signal, so you get discrete spurs rather than a noise floor. Raise it to 12 and they smear into the flat floor that 6.02N+1.76 dB predicts.',
    patch: {
      sources: [mk(1, 'sine', 250, 1)],
      blocks: [bk(1, 'quantize', { bits: 4, dither: false })],
      sampleRate: 8000,
      timeSpanMs: 20, spanCycles: 5,
    },
  },
]

const INITIAL = {
  sources: [mk(1, 'sine', 250, 1)],
  blocks: [],
  sampleRate: 8000,
  fftSize: 2048,
  window: 'hann',
  timeSpanMs: 20,
  spanCycles: 5,
  scale: 'db',
  showHarmonics: false,
  showGhost: false,
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
    const f = state.sources.find((s) => s.enabled && s.type !== 'noise')
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

  return (
    <div className="app">
      <Controls
        state={state}
        setState={setState}
        presets={PRESETS}
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
            scale={state.scale}
            markers={markers}
          />
        </section>
      </main>
    </div>
  )
}
