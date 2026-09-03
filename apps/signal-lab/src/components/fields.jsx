import React from 'react'
import { NumField, fmtHz } from '@ee-labs/ui'
import { WAVEFORMS, WINDOWS } from '@ee-labs/dsp'
import { BLOCK_TYPES, resolve } from '../dsp/blocks.js'

// The knobs, as functions of the record they edit.
//
// One definition per control, used in two places: the card it belongs to
// (Source, BlockCard) and the "featured" slot under a lesson's try line, where
// the knob the try names is rendered so it is on screen without scrolling.
// Two renderings of one definition is what keeps them the same knob — same
// range, same chips, same label — rather than a copy that drifts.

const HZ = { k: 1e3, khz: 1e3, hz: 1 }

/** The largest odd number not exceeding n. */
const oddAtOrBelow = (n) => (n < 1 ? 1 : n % 2 === 1 ? n : n - 1)

export const SOURCE_FIELDS = {
  type: 'Type',
  topHarmonic: 'Highest harmonic',
  freq: 'Frequency',
  amp: 'Amplitude',
  phase: 'Phase',
  enabled: 'Enabled',
}

/** The chain-global controls a try line can also name: not a source's or a
 * block's own field, but a setting in the top bar or a pane header. Featured
 * the same way — `{ field: 'fftSize' }` with no `source` or `block` — so a
 * lesson whose knob is "FFT" or "the overlay" gets it under the try line
 * exactly like one whose knob lives on a source or a block. */
export const GLOBAL_FIELDS = {
  fftSize: 'FFT',
  sampleRate: 'Rate',
  window: 'Window',
  overlay: 'Overlay',
}

/**
 * One of a source's numeric controls.
 *
 * `field` is a key of SOURCE_FIELDS. Renders nothing for a field the source's
 * type does not have (Frequency on noise, Highest harmonic on a sine).
 */
export function SourceField({ src, field, sampleRate, onChange }) {
  const set = (k, v) => onChange({ ...src, [k]: v })
  const nyquist = sampleRate / 2

  if (field === 'type') {
    return (
      <label className="field">
        <span className="field-label">{SOURCE_FIELDS.type}</span>
        <select value={src.type} onChange={(e) => set('type', e.target.value)}>
          {WAVEFORMS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
    )
  }

  if (field === 'enabled') {
    return (
      <label className="check">
        <input
          type="checkbox"
          checked={!!src.enabled}
          onChange={(e) => set('enabled', e.target.checked)}
        />
        {SOURCE_FIELDS.enabled}
      </label>
    )
  }

  if (field === 'topHarmonic') {
    if (src.type !== 'square') return null
    // The highest odd harmonic of this fundamental that still lands below
    // Nyquist. At least 1: a fundamental already past Nyquist has no harmonic
    // that fits, and offering 0 there would mean the ideal square instead.
    const fits = Math.max(1, oddAtOrBelow(Math.ceil(nyquist / Math.max(src.freq, 1e-9)) - 1))
    return (
      <NumField
        label={SOURCE_FIELDS.topHarmonic}
        value={src.topHarmonic || 0}
        // Snapped DOWN to an odd number, because a square has no even
        // harmonics to stop on: "up to the 4th" can only mean the 3rd, and
        // silently keeping 4 would put a number on screen that names no
        // term in the series.
        onChange={(v) => {
          const n = Math.max(0, Math.round(v))
          set('topHarmonic', n === 0 ? 0 : n % 2 === 1 ? n : n - 1)
        }}
        min={0}
        max={127}
        step={2}
        decimals={0}
        scale="linear"
        // Chips only. The paragraph that used to sit here — how many terms,
        // where the series tops out, what rate that needs, why the ideal
        // square looks cleaner — is in "The math for this source", where the
        // numbers are live and the field stays one row tall (Reed's review).
        presets={[
          1,
          3,
          5,
          9,
          15,
          // A real number rather than a vague one: the highest odd harmonic
          // that still fits under Nyquist, which is the most detailed square
          // this rate can carry without anything folding.
          {
            value: fits,
            label: `fits (${fits})`,
            title: `The highest odd harmonic below Nyquist at ${fmtHz(sampleRate)}Hz — the sharpest square this rate can hold with nothing folding`,
          },
          {
            value: 0,
            label: 'ideal',
            title:
              'The true square: harmonics forever. Not a bigger number, a different object, and everything ' +
            'above Nyquist folds back',
          },
        ]}
      />
    )
  }

  if (field === 'freq') {
    if (src.type === 'noise') return null
    const aliased = src.freq > nyquist
    const folded = Math.abs(src.freq - Math.round(src.freq / sampleRate) * sampleRate)
    return (
      <NumField
        label={SOURCE_FIELDS.freq}
        unit="Hz"
        spoken="hertz"
        value={src.freq}
        onChange={(v) => set('freq', v)}
        min={1}
        max={sampleRate}
        scale="log"
        step={1}
        suffixes={HZ}
        tone={aliased ? 'warn' : null}
        hint={aliased ? `aliases to ${folded.toFixed(0)} Hz` : null}
        presets={[
          1,
          100,
          440,
          1000,
          { value: Math.round(nyquist / 2), label: 'Nyq/2' },
          {
            value: Math.round(nyquist),
            label: 'Nyq',
            title:
              'Nyquist, the fold point. Exactly here the samples land on the same two phases every cycle: at ' +
            'phase 0° a sine samples its zero crossings and vanishes. Drag Phase to 90° and it returns at ' +
            'full amplitude.',
          },
          {
            value: Math.round(nyquist * 1.5),
            label: 'alias',
            title: 'Above Nyquist, watch the peak walk back down',
          },
        ]}
      />
    )
  }

  if (field === 'amp') {
    return (
      <NumField
        label={SOURCE_FIELDS.amp}
        value={src.amp}
        onChange={(v) => set('amp', v)}
        min={0}
        max={2}
        scale="linear"
        step={0.01}
        decimals={2}
        presets={[
          0,
          0.25,
          0.5,
          { value: 0.707, label: '0.707', title: '1/√2 — a sine here reads 0.500 RMS' },
          1,
          1.5,
        ]}
      />
    )
  }

  if (field === 'phase') {
    if (src.type === 'noise') return null
    // Not compact: the LTI experiment says "drag the phase slider and
    // watch the filtered wave slide without changing shape", and time-
    // invariance deserves a control you can actually scrub. The note
    // pointed at a slider that was not there (Reed's report).
    return (
      <NumField
        label={SOURCE_FIELDS.phase}
        unit="°"
        spoken="degrees"
        value={(src.phase * 180) / Math.PI}
        onChange={(d) => set('phase', (d * Math.PI) / 180)}
        min={0}
        max={360}
        scale="linear"
        step={1}
        coarse={15}
        decimals={0}
      />
    )
  }

  return null
}

/**
 * One of a block's parameters, rendered straight from the type's schema —
 * number, select or checkbox — with the schema's `when` honoured: a knob the
 * current settings hide (Q at 4th order) explains its absence instead.
 */
export function BlockField({ block, field, sampleRate, onChange }) {
  // Bypass is the block's own on/off switch, not one of its type's params —
  // the same control BlockCard's own ⏻ button flips, so "bypass block 2" can
  // be the knob a try line features without inventing a param no block has.
  if (field === 'bypass') {
    return (
      <label className="check">
        <input
          type="checkbox"
          checked={!!block.bypass}
          onChange={(e) => onChange({ ...block, bypass: e.target.checked })}
        />
        Bypass
      </label>
    )
  }
  const def = BLOCK_TYPES[block.type]
  if (!def) return null
  const p = def.params.find((x) => x.key === field)
  if (!p) return null
  const ctx = { sampleRate, nyquist: sampleRate / 2 }
  const setParam = (key, value) => onChange({ ...block, params: { ...block.params, [key]: value } })

  if (p.when && !p.when(block.params)) {
    // A hidden control explains its absence where it used to stand, or its
    // disappearance reads as a bug rather than physics.
    return p.whenHint ? <p className="param-absent">{p.whenHint(block.params)}</p> : null
  }
  if (p.kind === 'select') {
    return (
      <label className="field">
        <span className="field-label">{p.label}</span>
        <select value={block.params[p.key]} onChange={(e) => setParam(p.key, e.target.value)}>
          {p.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
    )
  }
  if (p.kind === 'check') {
    return (
      <label className="check">
        <input
          type="checkbox"
          checked={!!block.params[p.key]}
          onChange={(e) => setParam(p.key, e.target.checked)}
        />
        {p.label}
      </label>
    )
  }
  return (
    <NumField
      label={p.label}
      unit={p.unit}
      value={block.params[p.key]}
      onChange={(v) => setParam(p.key, v)}
      min={resolve(p.min, ctx)}
      max={resolve(p.max, ctx)}
      scale={p.scale}
      step={p.step}
      decimals={p.decimals}
      hint={p.hint}
      presets={resolve(p.presets, ctx)}
      suffixes={p.unit === 'Hz' ? HZ : undefined}
      spoken={p.unit === 'Hz' ? 'hertz' : undefined}
    />
  )
}

/**
 * One of the chain-global settings — FFT size, sample rate, the analysis
 * window, the spectrum overlay — mirrored from its own home (the top bar, or
 * the frequency pane's header) so a try line that names one of these can
 * feature it too. Same idea as SourceField/BlockField: one definition, two
 * renderings, so the knob under the try line and the knob in its usual home
 * never drift apart.
 */
export function GlobalField({ field, state, onChange }) {
  if (field === 'fftSize') {
    return (
      <NumField
        label={GLOBAL_FIELDS.fftSize}
        value={state.fftSize}
        onChange={onChange}
        min={512}
        max={16384}
        scale="pow2"
        decimals={0}
        hint={`${(state.sampleRate / state.fftSize).toFixed(2)} Hz/bin`}
      />
    )
  }
  if (field === 'sampleRate') {
    return (
      <NumField
        label={GLOBAL_FIELDS.sampleRate}
        unit="Hz"
        spoken="hertz"
        value={state.sampleRate}
        onChange={onChange}
        min={1000}
        max={96000}
        scale="log"
        step={1}
        eng
        suffixes={{ k: 1e3, khz: 1e3, hz: 1 }}
      />
    )
  }
  if (field === 'window') {
    return (
      <label className="field">
        <span className="field-label">{GLOBAL_FIELDS.window}</span>
        <select value={state.window} onChange={(e) => onChange(e.target.value)}>
          {WINDOWS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </label>
    )
  }
  if (field === 'overlay') {
    const options = [
      { id: 'none', label: 'no overlay' },
      { id: 'phase', label: 'phase' },
      { id: 'delay', label: 'delay' },
    ]
    return (
      <div className="segmented sm" role="group" aria-label="Overlay on the spectrum">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            className={state.overlay === o.id ? 'on' : ''}
            aria-pressed={state.overlay === o.id}
            onClick={() => onChange(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
    )
  }
  return null
}

/**
 * The controls a preset declares as `featured`, resolved against live state.
 * Returns [{ key, from, node }] — `from` names the card the knob mirrors.
 * A declaration whose source or block the student has since removed yields
 * nothing: the try line then points at a knob that is genuinely gone.
 *
 * A `featured` entry with neither `source` nor `block` names a chain-global
 * setting instead (`{ field: 'overlay' }`) — the try line's own knob when
 * that knob lives in the top bar or a pane header rather than on a source or
 * a block.
 */
export function featuredFields(featured = [], state, { setSource, setBlock, patch }) {
  const out = []
  for (const f of featured) {
    if (f.source != null) {
      const i = state.sources.findIndex((s) => s.id === f.source)
      if (i < 0) continue
      const src = state.sources[i]
      out.push({
        key: `s${f.source}.${f.field}`,
        from: `Source ${i + 1}`,
        node: (
          <SourceField
            src={src}
            field={f.field}
            sampleRate={state.sampleRate}
            onChange={(next) => setSource(i, next)}
          />
        ),
      })
    } else if (f.block != null) {
      const i = state.blocks.findIndex((b) => b.id === f.block)
      if (i < 0) continue
      const block = state.blocks[i]
      const def = BLOCK_TYPES[block.type]
      out.push({
        key: `b${f.block}.${f.field}`,
        from: def ? `${def.label} · block ${i + 1}` : `Block ${i + 1}`,
        node: (
          <BlockField
            block={block}
            field={f.field}
            sampleRate={state.sampleRate}
            onChange={(next) => setBlock(i, next)}
          />
        ),
      })
    } else if (f.field != null) {
      out.push({
        key: `g.${f.field}`,
        from: 'Chain',
        node: <GlobalField field={f.field} state={state} onChange={(v) => patch(f.field, v)} />,
      })
    }
  }
  return out
}
