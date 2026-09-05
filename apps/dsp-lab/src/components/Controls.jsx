import React from 'react'
import { NumField } from '@ee-labs/ui'
import { BLOCK_GROUPS, BLOCK_TYPES, makeBlockRecord, resolve } from '../blocks.js'

// The racks: sources at the top, blocks below, one card each.
//
// One card component renders every block, because a block declares its own
// parameter schema in blocks.js. Adding a block type touches that file and this
// one not at all, which is Signal Lab's arrangement and the reason its rack has
// survived eleven block types.
//
// A parameter with a `when` predicate leaves when it does not apply, and its
// `whenHint` stands in its place. A control that vanishes silently reads as a
// bug, and this lab has three of them: no step size on RLS, no window on a
// Parks-McClellan design, no overflow rule with a float64 state.

const WAVEFORMS = ['sine', 'square', 'triangle', 'sawtooth', 'noise', 'impulse', 'step']

function Field({ param, value, ctx, onChange }) {
  const label = param.label
  if (param.kind === 'select') {
    return (
      <label className="field select">
        <span>{label}</span>
        <select value={value} onChange={(e) => onChange(param.key, e.target.value)}>
          {param.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        {param.hint ? <small>{param.hint}</small> : null}
      </label>
    )
  }
  if (param.kind === 'check') {
    return (
      <label className="field check">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(param.key, e.target.checked)}
        />
        <span>{label}</span>
        {param.hint ? <small>{param.hint}</small> : null}
      </label>
    )
  }
  if (param.kind === 'text') {
    return (
      <label className="field text">
        <span>{label}</span>
        <input type="text" value={value} onChange={(e) => onChange(param.key, e.target.value)} />
        {param.hint ? <small>{param.hint}</small> : null}
      </label>
    )
  }
  return (
    <NumField
      label={label}
      value={Number(value)}
      onChange={(v) => onChange(param.key, v)}
      min={resolve(param.min, ctx)}
      max={resolve(param.max, ctx)}
      scale={param.scale || 'linear'}
      step={param.step ?? 1}
      unit={param.unit || ''}
      decimals={param.decimals}
      presets={resolve(param.presets, ctx)}
      hint={param.hint}
      compact
    />
  )
}

function BlockCard({ block, ctx, open, onToggle, onParam, onRemove, onBypass }) {
  const def = BLOCK_TYPES[block.type]
  if (!def) return null
  const shown = def.params.filter((p) => !p.when || p.when(block.params))
  const hidden = def.params.filter((p) => p.when && !p.when(block.params) && p.whenHint)
  return (
    <div className={`card block ${block.bypass ? 'bypassed' : ''}`}>
      <button
        type="button"
        className="block-head"
        aria-expanded={open}
        onClick={() => onToggle(block.id)}
      >
        <strong>{def.label}</strong>
        <span className="summary">{def.summary ? def.summary(block.params, ctx) : ''}</span>
      </button>
      {open ? (
        <div className="block-body">
          <p className="hint">{def.hint}</p>
          {def.reason ? <p className="refusal">{def.reason}</p> : null}
          {shown.map((p) => (
            <Field
              key={p.key}
              param={p}
              value={block.params[p.key]}
              ctx={ctx}
              onChange={(k, v) => onParam(block.id, k, v)}
            />
          ))}
          {hidden.map((p) => (
            <p key={p.key} className="hint when">
              {typeof p.whenHint === 'function' ? p.whenHint(block.params) : p.whenHint}
            </p>
          ))}
          <div className="row">
            <button type="button" onClick={() => onBypass(block.id)}>
              {block.bypass ? 'Enable' : 'Bypass'}
            </button>
            <button type="button" onClick={() => onRemove(block.id)}>
              Remove
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function Controls({ state, setState, openBlocks, setOpenBlocks }) {
  const ctx = { sampleRate: state.sampleRate, nyquist: state.sampleRate / 2 }

  const setSource = (id, key, value) =>
    setState((s) => ({
      ...s,
      sources: s.sources.map((x) => (x.id === id ? { ...x, [key]: value } : x)),
    }))

  const setParam = (id, key, value) =>
    setState((s) => ({
      ...s,
      blocks: s.blocks.map((b) =>
        b.id === id ? { ...b, params: { ...b.params, [key]: value } } : b,
      ),
    }))

  const addBlock = (type) =>
    setState((s) => {
      const id = Math.max(0, ...s.blocks.map((b) => b.id)) + 1
      return { ...s, blocks: [...s.blocks, makeBlockRecord(type, id)] }
    })

  const toggle = (id) =>
    setOpenBlocks((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="controls">
      <section>
        <h3>Sources</h3>
        {state.sources.map((src) => (
          <div className="card source" key={src.id}>
            <label className="field select">
              <span>Waveform</span>
              <select value={src.type} onChange={(e) => setSource(src.id, 'type', e.target.value)}>
                {WAVEFORMS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </label>
            <NumField
              label="Frequency"
              value={src.freq}
              onChange={(v) => setSource(src.id, 'freq', v)}
              min={1}
              max={ctx.nyquist}
              scale="log"
              step={1}
              unit="Hz"
              presets={[375, 1500, 3000, 9000]}
              hint="A multiple of 375 Hz lands on a bin centre of the 4096-point frame."
              compact
            />
            <NumField
              label="Amplitude"
              value={src.amp}
              onChange={(v) => setSource(src.id, 'amp', v)}
              min={0}
              max={2}
              step={0.01}
              presets={[0.25, 0.5, 1]}
              compact
            />
          </div>
        ))}
      </section>

      <section>
        <h3>Blocks</h3>
        {state.blocks.map((b) => (
          <BlockCard
            key={b.id}
            block={b}
            ctx={ctx}
            open={openBlocks.has(b.id)}
            onToggle={toggle}
            onParam={setParam}
            onBypass={(id) =>
              setState((s) => ({
                ...s,
                blocks: s.blocks.map((x) => (x.id === id ? { ...x, bypass: !x.bypass } : x)),
              }))
            }
            onRemove={(id) =>
              setState((s) => ({ ...s, blocks: s.blocks.filter((x) => x.id !== id) }))
            }
          />
        ))}
        <div className="add-block">
          {BLOCK_GROUPS.map((g) => (
            <div key={g} className="add-group">
              <span>{g}</span>
              {Object.entries(BLOCK_TYPES)
                .filter(([, d]) => d.group === g)
                .map(([type, d]) => (
                  <button key={type} type="button" onClick={() => addBlock(type)}>
                    {d.label}
                  </button>
                ))}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3>Frame</h3>
        <NumField
          label="Sample rate"
          value={state.sampleRate}
          onChange={(v) => setState((s) => ({ ...s, sampleRate: v }))}
          min={8000}
          max={192000}
          scale="log"
          step={1000}
          unit="Hz"
          presets={[8000, 44100, 48000, 96000]}
          compact
        />
        <label className="field select">
          <span>Frame</span>
          <select
            value={state.fftSize}
            onChange={(e) => setState((s) => ({ ...s, fftSize: Number(e.target.value) }))}
          >
            {[1024, 2048, 4096, 8192, 16384].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <small>A radix-2 transform needs a power of two, which is F5.</small>
        </label>
        <label className="field select">
          <span>Estimator</span>
          <select
            value={state.estimator}
            onChange={(e) => setState((s) => ({ ...s, estimator: e.target.value }))}
          >
            {['periodogram', 'bartlett', 'welch'].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <small>What the density view draws. One transform, or an average of many.</small>
        </label>
        <NumField
          label="Segments"
          value={state.segments}
          onChange={(v) => setState((s) => ({ ...s, segments: Math.max(1, Math.round(v)) }))}
          min={1}
          max={256}
          scale="log"
          step={1}
          presets={[1, 4, 16, 64, 256]}
          hint="How many pieces the record is cut into before the pieces are averaged."
          compact
        />
        <NumField
          label="Model order"
          value={state.arOrder}
          onChange={(v) => setState((s) => ({ ...s, arOrder: Math.max(1, Math.round(v)) }))}
          min={1}
          max={24}
          step={1}
          presets={[2, 4, 8, 12]}
          hint="How many poles the all-pole model is given, which D7 is about choosing."
          compact
        />
        <NumField
          label="dB floor"
          value={state.floorDb}
          onChange={(v) => setState((s) => ({ ...s, floorDb: v }))}
          min={-160}
          max={-40}
          step={5}
          unit="dB"
          presets={[-160, -120, -100, -60]}
          hint="The bottom of the frequency axis. A deep stopband needs room below it."
          compact
        />
      </section>
    </div>
  )
}
