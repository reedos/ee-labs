import React, { useEffect, useMemo, useState } from 'react'
import Controls from './components/Controls.jsx'
import TopBar from './components/TopBar.jsx'
import ScopeCanvas from './components/ScopeCanvas.jsx'
import SpectrumCanvas from './components/SpectrumCanvas.jsx'
import ImpulseCanvas from './components/ImpulseCanvas.jsx'
import ConvolutionCanvas, { CONV_SPEEDS, useConvolutionPosition } from './components/ConvolutionCanvas.jsx'
import { APERIODIC, render, rms, peak } from '@ee-labs/dsp'
import { COLORS, NumField, ZPlaneCanvas } from '@ee-labs/ui'
import { spectrum } from '@ee-labs/dsp'
import {
  applyChain,
  chainGroupDelay,
  chainImpulse,
  chainPhase,
  convKernel,
  kernelCentre,
  chainPolesZeros,
  chainResponse,
  framedRoots,
  renderChain,
  runChain,
  ZPLANE_MAX_R,
} from './dsp/chain.js'
import { PRESETS } from './presets.js'
import { readLocationLink, track, arrivalEvent } from '@ee-labs/ui'
import { stateFromLink } from './fromLink.js'
import { mathContext, mathFor } from './math.js'
import { samplingState } from './sampling.js'
import { INITIAL, presetState } from './state.js'
import { applyChip } from './chips.js'
import { circuitUrl } from './toCircuitLab.js'
import { allTonal, fmtAmp, formatPeaks, isBroadband, offBin, spectralPeaks } from './peaks.js'

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

  // The other half of the hand-over count: Circuit Lab counts the click, this
  // counts the arrival, with the circuit's id when the link carried one. Once
  // per load, and only for a load that came from a link.
  useEffect(() => {
    if (linked.state) track(arrivalEvent('signal-lab', linked.state.linkFrom))
  }, [linked])

  const [state, setState] = useState(linked.state || INITIAL)
  // The state the current experiment loaded with. `dirty` — the lesson nav's
  // reset appears — is the state having moved away from it, compared by value
  // so a chip clicked and clicked back is not "moved".
  const [applied, setApplied] = useState(linked.state || INITIAL)
  // A block that arrived from a link should be open. You did not choose it, so
  // being able to see what you were handed is the first thing you want.
  const [openBlocks, setOpenBlocks] = useState(
    () => new Set((linked.state?.blocks ?? []).map((b) => b.id)),
  )
  // Preset groups the student unfolded by hand. Cleared whenever an
  // experiment loads, so only the group holding it is open from then on.
  const [openGroups, setOpenGroups] = useState(() => new Set())
  // Which try-line chip the student actually clicked last, so activeChip
  // (chips.js) can prefer it over array order when a later chip's partial
  // patch still happens to match too (clicking "12 bits" then "dither" left
  // "12 bits" lit, since its patch never checks dither — Reed's review).
  // Cleared on every preset load, same as the other per-lesson UI state above.
  const [lastChip, setLastChip] = useState(null)

  const applyPreset = (p) => {
    const next = presetState(p)
    setState(next)
    setApplied(next)
    setOpenBlocks(new Set((p.patch.blocks || []).map((b) => b.id)))
    setOpenGroups(new Set())
    setLastChip(null)
  }

  const dirty = useMemo(() => JSON.stringify(state) !== JSON.stringify(applied), [state, applied])

  // The course's spine: the sidebar's order, which presets.js is in.
  const presetIndex = PRESETS.findIndex((p) => p.name === state.presetName)
  const nav = {
    index: presetIndex >= 0 ? presetIndex : null,
    total: PRESETS.length,
    dirty,
    onPrev: () => presetIndex > 0 && applyPreset(PRESETS[presetIndex - 1]),
    onNext: () => presetIndex < PRESETS.length - 1 && applyPreset(PRESETS[presetIndex + 1]),
    onReset: () => presetIndex >= 0 && applyPreset(PRESETS[presetIndex]),
  }

  const onChip = (c) => {
    setState((s) => applyChip(s, c.patch))
    setLastChip(c.label)
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

  // Samples either side of the visible span, for the scope's reconstruction
  // to lean on. sincInterp's window goes one-sided at a buffer edge, which
  // draws a spurious overshoot exactly where the trace meets the frame — at
  // Nyquist the honest interior peak is 1.02 and the edge threw 1.26. The
  // guard is the same idea as the FFT's pre-roll: compute past what you show.
  const GUARD = 64
  const guarded = useMemo(
    () =>
      runChain(state.sources, state.blocks, timeN + 2 * GUARD, state.sampleRate, {
        t0: -GUARD / state.sampleRate,
        warmup: state.showTransient ? 0 : 'auto',
      }),
    [state.sources, state.blocks, timeN, state.sampleRate, state.showTransient],
  )
  // Everything that MEASURES — the RMS/peak readouts, the flow strip — reads
  // the visible span alone, or the numbers would describe more signal than
  // the picture shows.
  const timeBuf = useMemo(() => guarded.out.subarray(GUARD, GUARD + timeN), [guarded, timeN])
  const stages = useMemo(
    () => guarded.stages.map((s) => ({ ...s, buf: s.buf.subarray(GUARD, GUARD + timeN) })),
    [guarded, timeN],
  )

  const { freqs, amps, clamped } = useMemo(() => {
    const r = renderChain(state.sources, state.blocks, state.fftSize, state.sampleRate)
    const s = spectrum(r.buf, state.sampleRate, state.window)
    return { ...s, clamped: r.clamped }
  }, [state.sources, state.blocks, state.fftSize, state.sampleRate, state.window])

  // The same window of signal without the chain, drawn under the processed
  // trace. "What did this block do to the shape" should be answerable by
  // looking, not by toggling the block off and trying to remember.
  // Guarded like the wet trace, since it is reconstructed the same way.
  const dryGuarded = useMemo(() => {
    if (!state.showGhost || state.blocks.length === 0) return null
    return render(state.sources, timeN + 2 * GUARD, state.sampleRate, -GUARD / state.sampleRate)
  }, [state.showGhost, state.sources, state.blocks.length, timeN, state.sampleRate])
  const dryBuf = useMemo(
    () => (dryGuarded ? dryGuarded.subarray(GUARD, GUARD + timeN) : null),
    [dryGuarded, timeN],
  )

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
        // Longest first. SpectrumCanvas draws the longest that fits the pane's
        // height, because a rotated title wider than the plot is cut by the
        // canvas edge — see fitTitle. The shortest still names the quantity
        // and its unit, and the unit is now written: the group-delay title
        // carried "(samples)" while this one said only "Phase of the chain".
        labels: ['Phase of the chain (degrees)', 'Phase (degrees)', 'Phase (°)'],
        tick: (v) => `${v}°`,
      }
    }
    const r = chainGroupDelay(state.blocks, freqs, state.sampleRate)
    if (!r.any) return null
    return {
      kind: 'delay',
      values: r.delay,
      labels: [
        'Group delay of the chain (samples)',
        'Group delay (samples)',
        'Delay (samples)',
      ],
      tick: (v) => `${Number(v.toPrecision(3))}`,
    }
  }, [state.overlay, state.blocks, freqs, state.sampleRate])

  // Why the overlay button reads as pressed and nothing was drawn.
  //
  // Both overlays are properties of the CHAIN, so an empty chain has neither.
  // Pressing "phase" on "Single tone" turned the button on, drew no curve, no
  // right-hand axis and no title, and gave no reason — the pane looked broken
  // rather than empty. CORE_SCOPE's rule 2: a refusal states why, and it is
  // content, not a gap.
  const overlayRefusal =
    state.overlay !== 'none' && !overlay
      ? state.blocks.length === 0
        ? 'overlay needs a block — it measures the chain, not the signal'
        : 'these blocks have no transfer function, so no phase to plot'
      : null

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

  // What the canvas is allowed to frame. The readout keeps counting all of
  // them — see framedRoots for why an outlier must not set the scale.
  const pzFramed = useMemo(
    () => (pz ? framedRoots(pz.poles, pz.zeros) : null),
    [pz],
  )

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
    // Kernel long enough that the sum genuinely equals the chain — sized by
    // the chain's own ring time, not by a guess. See convKernel.
    const k = convKernel(state.blocks, state.sampleRate)
    const { h, exact } = chainImpulse(state.blocks, k.n, state.sampleRate)
    const y = applyChain(state.blocks, x, state.sampleRate, 0)
    return { x, h, y, exact, truncated: k.truncated }
  }, [state.timeView, state.sources, state.blocks, timeN, state.sampleRate])

  const scrub = useConvolutionPosition(timeN, state.presetName)

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

  // Is the top of the band carrying a HASH, or a tone?
  //
  // Is anything actually folding at this rate, and is anything sitting on the
  // boundary? Measured in sampling.js, where the thresholds are pinned against
  // the whole preset library.
  const sampling = useMemo(
    () =>
      samplingState({
        sources: state.sources,
        blocks: state.blocks,
        sampleRate: state.sampleRate,
        fftSize: state.fftSize,
        window: state.window,
      }),
    [state.sources, state.blocks, state.sampleRate, state.fftSize, state.window],
  )

  // The spectral lines worth naming — every one within 6 dB of the tallest
  // (Beating's pair, a ring modulator's two sidebands) — and the tallest of
  // them as THE peak for the math panel and the z-plane marker. See peaks.js
  // for the tie at Nyquist that used to read 3996.1 Hz for a 4 kHz tone.
  const stats = useMemo(() => {
    const peaks = spectralPeaks(freqs, amps, { window: state.window })
    const top = peaks.reduce((m, p) => (m && m.amp >= p.amp ? m : p), null)
    return {
      rms: rms(timeBuf),
      peak: peak(timeBuf),
      peaks,
      peakFreq: top ? top.freq : 0,
      peakAmp: top ? top.amp : 0,
    }
  }, [timeBuf, freqs, amps, state.window])

  // Whether the "peak"/"amp" readout means anything for what is actually
  // playing. A noise source holds every frequency at once, so its tallest
  // three bins are three random bins — see isBroadband's docstring in
  // peaks.js for the cold-walk quote this replaced. allTonal is the
  // narrower, stricter condition under which a line's HEIGHT means an
  // amplitude at all (mixed tone + noise still names its lines, but the
  // height is not trustworthy either).
  const broadband = useMemo(() => isBroadband(state.sources), [state.sources])
  const tonal = useMemo(() => allTonal(state.sources), [state.sources])
  // Bin spacing, for the scalloping flag: a tone that falls between bin
  // centres shares its height between them and reads low. See OFF_BIN/offBin
  // in peaks.js.
  const binHz = state.sampleRate / state.fftSize
  const scalloped = tonal && offBin(stats.peakFreq, binHz)

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
    // Five percent of headroom above the peak before rounding up. Without it
    // a 0.6-amplitude square's flat top lands EXACTLY on the axis border and
    // spends half of every period lying on the frame - which reads as a
    // clipped, hidden signal. A sine only ever touched the border at single
    // points, which is why the tight ceiling survived until a square met it.
    return Math.max(0.2, Math.ceil(pk * 1.05 * 10) / 10 || 1)
  }, [stats.peak, dryBuf])

  // Ghost first, so the processed trace is drawn on top of it.
  // The scope gets the GUARDED buffers — it is the one consumer that reads
  // past the visible span, and it is told how far past by `guard`.
  const scopeTraces = useMemo(() => {
    const list = []
    if (dryGuarded) list.push({ buf: dryGuarded, color: COLORS.traceGhost, dim: true })
    list.push({ buf: guarded.out, color: COLORS.trace })
    return list
  }, [dryGuarded, guarded])

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

  // The hand-over out: this block, as the circuit it is — null off the one
  // preset it is exact for, and null in dev where Circuit Lab is not deployed
  // beside this page. See toCircuitLab.js for why this is exact rather than
  // approximate.
  const circuitHref = useMemo(
    () => circuitUrl(state.blocks[0], state.presetName),
    [state.blocks, state.presetName],
  )

  return (
    <div className="app">
      <Controls
        state={state}
        setState={setState}
        presets={PRESETS}
        linkWarnings={linked.warnings}
        cameFromLink={!!linked.state}
        linkFrom={linked.state ? linked.state.linkFrom : null}
        math={math}
        onPreset={applyPreset}
        onChip={onChip}
        lastChip={lastChip}
        nav={nav}
        openBlocks={openBlocks}
        setOpenBlocks={setOpenBlocks}
        openGroups={openGroups}
        setOpenGroups={setOpenGroups}
        onConvPlay={scrub.play}
        convPlaying={scrub.playing}
        circuitHref={circuitHref}
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
            {/* The span governs THIS pane, so it lives here — not in the top
                bar a full screen-width away. Cycles of the fundamental when
                something periodic is playing; milliseconds otherwise. */}
            {state.timeView !== 'impulse' ? (
              divisionRate ? (
                <NumField
                  compact
                  label="Span"
                  unit="cycles"
                  value={state.spanCycles}
                  onChange={(v) => patch('spanCycles', v)}
                  min={0.5}
                  max={200}
                  scale="log"
                  step={0.5}
                />
              ) : (
                <NumField
                  compact
                  label="Span"
                  unit="ms"
                  value={state.timeSpanMs}
                  onChange={(v) => patch('timeSpanMs', v)}
                  min={0.1}
                  max={1000}
                  scale="log"
                  step={0.1}
                />
              )
            ) : null}
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
                    {/* A crest factor of numerical dust is not a crest
                        factor: a sine at exactly Nyquist, phase 0, samples
                        to ~1e-13 and the ratio read 2.96 (Reed's report).
                        Below any real signal level the honest readout is
                        a dash. */}
                    crest <b>{stats.peak > 1e-6 ? (stats.peak / (stats.rms || 1)).toFixed(2) : '—'}</b>
                  </span>
                  {state.showTransient && state.blocks.length > 0 ? (
                    <span className="flag">transient shown</span>
                  ) : null}
                </>
              ) : state.timeView === 'conv' && conv ? (
                <>
                  <span className="prov">the kernel is the impulse response, doing its job</span>
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
                  {conv.truncated ? (
                    <span className="flag warn">
                      kernel truncated — the chain rings past the window, sums may drift
                    </span>
                  ) : null}
                </>
              ) : (
                <>
                  {/* Two names, one sequence — said where both camps can see
                      it, because someone taught "impulse response" should not
                      have to guess what a button called "Kernel" shows. */}
                  <span className="prov">
                    the impulse response — the same sequence the convolution view uses as the
                    kernel
                  </span>
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
                <button type="button" className="ghost" onClick={scrub.play}>
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
                <div className="segmented sm conv-speed" role="group" aria-label="Playback speed">
                  {CONV_SPEEDS.map((v) => (
                    <button
                      key={v}
                      type="button"
                      className={scrub.speed === v ? 'on' : ''}
                      aria-pressed={scrub.speed === v}
                      onClick={() => scrub.setSpeed(v)}
                    >
                      {v < 1 ? `${v}×`.replace('0.25', '¼').replace('0.5', '½') : `${v}×`}
                    </button>
                  ))}
                </div>
              </div>
              <ConvolutionCanvas
                x={conv.x}
                h={conv.h}
                y={conv.y}
                pos={scrub.pos}
                exact={conv.exact}
              />
              {conv.exact && (
                // The theorem this view enacts, in both vocabularies. This lab
                // is sampled, so its exact identity is the z-form; the s-form
                // is the continuous twin Circuit Lab speaks. Both, labelled,
                // because they are one theorem — the suite's thesis in a line.
                // Gated on exact: a nonlinear chain has no H, and the canvas
                // label above already says so. Tested (linear vs circular
                // convolution) in views.test.js before this sentence prints.
                //
                // Neither s nor z is defined algebraically right here, and s
                // is Laplace analysis, past this lab's own background of
                // sine waves, Fourier series and j² = −1. Marked as such,
                // not cut: a stronger student gets the real cross-reference
                // to Circuit Lab, and a first-year is told plainly that the
                // check row above (not this sentence) is what to trust.
                <p className="conv-theorem">
                  One theorem, two vocabularies: y = x ∗ h in time is{' '}
                  <b>
                    Y(z) = X(z)·H(z)
                  </b>{' '}
                  here in the sampled domain, and Y(s) = X(s)·H(s) is its
                  continuous twin, the form Circuit Lab reads. Both s and z
                  stand for complex frequency, sampled for z and continuous
                  for s. Reading either equation is optional. The math
                  panel's check row already confirms y = x ∗ h with plain
                  numbers, and Laplace's s sits beyond this lab's own
                  background.
                </p>
              )}
              {/* What this view is NOT drawing, said once. The sum produces
                  SAMPLES; the smooth curve a scope shows is a later, separate
                  step, and conflating the two is how "convolution" starts
                  sounding like it smooths things. */}
              <p className="conv-theorem">
                Every dot is one sample — one completed sum. The line joining them is
                drawn for legibility, not computed: what the samples describe between
                themselves is the (sin x)/x curve the <b>Signal</b> view draws, which is
                reconstruction, a separate step after this arithmetic and not part of it.
              </p>
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
              sampling={sampling}
              guard={GUARD}
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
            {state.freqView === 'spectrum' ? (
              <>
                <div className="segmented sm" role="group" aria-label="Amplitude scale">
                  <button
                    type="button"
                    className={state.scale === 'db' ? 'on' : ''}
                    aria-pressed={state.scale === 'db'}
                    onClick={() => patch('scale', 'db')}
                  >
                    dB
                  </button>
                  <button
                    type="button"
                    className={state.scale === 'linear' ? 'on' : ''}
                    aria-pressed={state.scale === 'linear'}
                    onClick={() => patch('scale', 'linear')}
                  >
                    lin
                  </button>
                </div>
                <div className="segmented sm" role="group" aria-label="Overlay on the spectrum">
                  {[
                    { id: 'none', label: 'no overlay', title: 'Magnitude only' },
                    { id: 'phase', label: 'phase', title: 'How much each frequency is shifted' },
                    {
                      id: 'delay',
                      label: 'delay',
                      title: 'How long each frequency is held up, in samples — flat means the shape survives',
                    },
                  ].map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      className={state.overlay === o.id ? 'on' : ''}
                      aria-pressed={state.overlay === o.id}
                      title={o.title}
                      onClick={() => patch('overlay', o.id)}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                <NumField
                  compact
                  label="to"
                  unit="Hz"
                  spoken="hertz"
                  value={state.specMax ?? state.sampleRate / 2}
                  onChange={(v) => patch('specMax', v >= state.sampleRate / 2 ? null : v)}
                  min={50}
                  max={state.sampleRate / 2}
                  scale="log"
                  step={1}
                  suffixes={{ k: 1e3, khz: 1e3, hz: 1 }}
                />
              </>
            ) : null}
            <div className="readout">
              {state.freqView === 'spectrum' ? (
                <>
                  <span>
                    {/* Same dust rule: the argmax of a numerically-zero
                        spectrum is a random bin, not a peak — spectralPeaks
                        returns nothing for one, and that prints as a dash.
                        A pure-noise source holds every frequency at once, so
                        "the tallest three bins" would be three random bins —
                        say "broadband" instead of naming them. */}
                    peak <b>{broadband ? 'broadband' : formatPeaks(stats.peaks)}</b>
                  </span>
                  <span>
                    {/* A line's height only means an amplitude when every
                        enabled source is a tone (allTonal) — noise in the
                        mix makes "amp" as meaningless as the peak list. The
                        dB figure is a nice-to-have hidden on phone (.amp-db)
                        when the readout is fighting for room to keep both
                        canvases at their 120 px floor — the linear number
                        alone still answers "how tall is the line". */}
                    amp <b>{tonal ? fmtAmp(stats.peakAmp).lin : '—'}</b>
                    {tonal && fmtAmp(stats.peakAmp).db ? (
                      <span className="amp-db"> ({fmtAmp(stats.peakAmp).db})</span>
                    ) : null}
                  </span>
                  <span>
                    Nyquist <b>{state.sampleRate / 2} Hz</b>
                  </span>
                  {scalloped ? (
                    <span className="flag">(off-bin, reads low — scalloping)</span>
                  ) : null}
                  {resp && !resp.exact ? (
                    <span className="flag">response covers linear blocks only</span>
                  ) : null}
                  {clamped ? <span className="flag warn">still ringing at frame start</span> : null}
                  {overlayRefusal ? <span className="flag">{overlayRefusal}</span> : null}
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
                  {pzFramed && pzFramed.hidden ? (
                    <span className="flag">
                      {pzFramed.hidden} beyond |z| = {ZPLANE_MAX_R}, off this frame
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
              poles={pzFramed.poles}
              zeros={pzFramed.zeros}
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
              xMax={state.specMax}
              floorDb={state.floorDb}
            />
          )}
        </section>
      </main>
    </div>
  )
}
