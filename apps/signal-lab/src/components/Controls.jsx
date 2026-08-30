import React from 'react'
import { NumField } from '@ee-labs/ui'
import { MathPanel } from '@ee-labs/explain'
import { sourceMath } from '../math-parts.js'
import { PRESET_GROUPS } from '../presets.js'
import BlockCard from './BlockCard.jsx'
import { WAVEFORMS } from '@ee-labs/dsp'
import { BLOCK_GROUPS, BLOCK_TYPES, makeBlockRecord } from '../dsp/blocks.js'

const HZ = { k: 1e3, khz: 1e3, hz: 1 }

function Source({ src, sampleRate, onChange, onRemove, canRemove , fftSize}) {
  const set = (k, v) => onChange({ ...src, [k]: v })
  const nyquist = sampleRate / 2
  const aliased = src.freq > nyquist
  const folded = Math.abs(src.freq - Math.round(src.freq / sampleRate) * sampleRate)

  return (
    <div className={`source${src.enabled ? '' : ' is-off'}`}>
      <div className="source-head">
        <input
          type="checkbox"
          checked={src.enabled}
          onChange={(e) => set('enabled', e.target.checked)}
          aria-label="Enable source"
        />
        <select value={src.type} onChange={(e) => set('type', e.target.value)}>
          {WAVEFORMS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="ghost"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label="Remove source"
          title={canRemove ? 'Remove' : 'Keep at least one source'}
        >
          ×
        </button>
      </div>

      {src.type !== 'noise' && (
        <NumField
          label="Frequency"
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
            { value: Math.round(nyquist), label: 'Nyq', title: 'Nyquist — the fold point' },
            {
              value: Math.round(nyquist * 1.5),
              label: 'alias',
              title: 'Above Nyquist — watch the peak walk back down',
            },
          ]}
        />
      )}

      <NumField
        label="Amplitude"
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

      {src.type !== 'noise' && (
        <NumField
          compact
          label="Phase"
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
      )}

      <MathPanel
        label="The math for this source"
        getEntry={() => sourceMath(src, { sampleRate, fftSize })}
      />
    </div>
  )
}

export default function Controls({ state, setState, presets, onPreset, openBlocks, setOpenBlocks,
  math,

  linkWarnings = [],
  cameFromLink = false,
}) {
  const patch = (k, v) => setState((s) => ({ ...s, [k]: v }))

  const setSource = (i, next) =>
    setState((s) => ({ ...s, sources: s.sources.map((v, j) => (j === i ? next : v)) }))

  const addSource = () =>
    setState((s) => ({
      ...s,
      sources: [
        ...s.sources,
        {
          id: Math.max(0, ...s.sources.map((v) => v.id)) + 1,
          type: 'sine',
          freq: 500,
          amp: 0.5,
          phase: 0,
          enabled: true,
        },
      ],
    }))

  const removeSource = (i) =>
    setState((s) => ({ ...s, sources: s.sources.filter((_, j) => j !== i) }))

  const addBlock = (type) => {
    if (!type) return
    setState((s) => {
      const id = Math.max(0, ...s.blocks.map((b) => b.id)) + 1
      setOpenBlocks((o) => new Set(o).add(id))
      return { ...s, blocks: [...s.blocks, makeBlockRecord(type, id)] }
    })
  }

  const setBlock = (i, next) =>
    setState((s) => ({ ...s, blocks: s.blocks.map((b, j) => (j === i ? next : b)) }))

  const removeBlock = (i) =>
    setState((s) => ({ ...s, blocks: s.blocks.filter((_, j) => j !== i) }))

  const moveBlock = (i, dir) =>
    setState((s) => {
      const j = i + dir
      if (j < 0 || j >= s.blocks.length) return s
      const next = s.blocks.slice()
      ;[next[i], next[j]] = [next[j], next[i]]
      return { ...s, blocks: next }
    })

  const toggleOpen = (id) =>
    setOpenBlocks((o) => {
      const n = new Set(o)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const activePreset = presets.find((p) => p.name === state.presetName)

  return (
    <aside className="controls">
      <header>
        <h1>Signal Lab</h1>
        <p className="sub">
          A signal, its frequency content, and what happens when you put things in the way.
        </p>
      </header>

      <section>
        {cameFromLink ? (
          <p className="hint from-link">
            Loaded from a link — this chain came from another tool in the suite. Pick anything
            below to start over.
          </p>
        ) : null}
        {linkWarnings.length ? (
          <ul className="link-warnings">
            {linkWarnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        ) : null}
        <h2>Try this</h2>
        {/* Grouped as a rough curriculum. A flat list of two dozen buttons is a
            wall; four short labeled runs can be read. */}
        {PRESET_GROUPS.map((g) => {
          const inGroup = presets.filter((p) => p.group === g)
          if (!inGroup.length) return null
          return (
            <div className="preset-group" key={g}>
              <h3>{g}</h3>
              <div className="presets">
                {inGroup.map((p) => (
                  <button
                    type="button"
                    key={p.name}
                    className={`preset${p.name === state.presetName ? ' is-on' : ''}`}
                    onClick={() => onPreset(p)}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
        {activePreset ? <p className="hint">{activePreset.note}</p> : null}
        <MathPanel entry={math} />
      </section>

      <section id="sources">
        <h2>
          Sources
          <button type="button" className="ghost add" onClick={addSource}>
            + add
          </button>
        </h2>
        {state.sources.map((s, i) => (
          <Source
            key={s.id}
            src={s}
            sampleRate={state.sampleRate}
            fftSize={state.fftSize}
            onChange={(next) => setSource(i, next)}
            onRemove={() => removeSource(i)}
            canRemove={state.sources.length > 1}
          />
        ))}
      </section>

      <section id="chain">
        <h2>
          Chain
          <select
            className="ghost add"
            value=""
            aria-label="Add a processing block"
            onChange={(e) => {
              addBlock(e.target.value)
              e.target.value = ''
            }}
          >
            <option value="" disabled>
              + add block
            </option>
            {BLOCK_GROUPS.map((g) => (
              <optgroup key={g} label={g}>
                {Object.entries(BLOCK_TYPES)
                  .filter(([, def]) => def.group === g)
                  .map(([type, def]) => (
                    <option key={type} value={type}>
                      {def.label}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </h2>

        {state.blocks.length === 0 ? (
          <p className="hint empty">
            Nothing between the sources and the plots. Add a filter and its response
            is drawn over the spectrum.
          </p>
        ) : (
          state.blocks.map((b, i) => (
            <BlockCard
              key={b.id}
              block={b}
              index={i}
              count={state.blocks.length}
              open={openBlocks.has(b.id)}
              sampleRate={state.sampleRate}
              onToggleOpen={() => toggleOpen(b.id)}
              onChange={(next) => setBlock(i, next)}
              onRemove={() => removeBlock(i)}
              onMove={(dir) => moveBlock(i, dir)}
            />
          ))
        )}
      </section>

      <section>
        <h2>View</h2>
        <label className="check">
          <input
            type="checkbox"
            checked={state.showHarmonics}
            onChange={(e) => patch('showHarmonics', e.target.checked)}
          />
          Mark harmonics of source 1
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={state.showGhost}
            onChange={(e) => patch('showGhost', e.target.checked)}
          />
          Show pre-chain spectrum
        </label>
        {/* One right-hand axis, so one choice. Phase and group delay are the
            same information differentiated, and showing both at once makes a
            worse plot than either. */}
        <div className="field">
          <label className="field-label" htmlFor="overlay-none">
            Overlay on the spectrum
          </label>
          <div className="segmented sm" role="group">
            {[
              { id: 'none', label: 'None', title: 'Magnitude only' },
              { id: 'phase', label: 'Phase', title: 'How much each frequency is shifted' },
              {
                id: 'delay',
                label: 'Group delay',
                title:
                  'How long each frequency is held up, in samples. Flat means the shape survives.',
              },
            ].map((o) => (
              <button
                key={o.id}
                id={`overlay-${o.id}`}
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
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={state.showTransient}
            onChange={(e) => patch('showTransient', e.target.checked)}
          />
          Show filter start-up transient
        </label>
      </section>
    </aside>
  )
}
