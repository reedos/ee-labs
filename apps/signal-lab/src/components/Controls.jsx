import React from 'react'
import { LabNav, NumField, fmtHz } from '@ee-labs/ui'
import { MathPanel } from '@ee-labs/explain'
import { sourceMath } from '../math-parts.js'
import { PRESET_GROUPS } from '../presets.js'
import BlockCard from './BlockCard.jsx'
import { WAVEFORMS } from '@ee-labs/dsp'
import { BLOCK_GROUPS, BLOCK_TYPES, makeBlockRecord } from '../dsp/blocks.js'
import { termsFor } from '../terms.js'

const HZ = { k: 1e3, khz: 1e3, hz: 1 }

/** 1st, 3rd, 5th, 11th — the ordinal suffix, for naming a harmonic. */
const ord = (n) => {
  const t = n % 100
  if (t >= 11 && t <= 13) return 'th'
  return { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'
}

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

      {src.type === 'square' && (
        <NumField
          label="Odd harmonics"
          value={src.partials || 0}
          onChange={(v) => set('partials', Math.max(0, Math.round(v)))}
          min={0}
          max={64}
          step={1}
          decimals={0}
          scale="linear"
          presets={[
            { value: 0, label: 'all', title: 'The naive square: harmonics forever, and whatever is above Nyquist folds back' },
            1,
            3,
            5,
            9,
            { value: 16, label: '16' },
          ]}
          hint={
            src.partials > 0
              ? `stops at ${fmtHz((2 * src.partials - 1) * src.freq)}Hz — the ${
                  2 * src.partials - 1
                }${ord(2 * src.partials - 1)} harmonic. Perfect reconstruction needs a rate above ${fmtHz(
                  2 * (2 * src.partials - 1) * src.freq,
                )}Hz${
                  sampleRate > 2 * (2 * src.partials - 1) * src.freq
                    ? ' — this rate clears it, so nothing folds'
                    : ' — this rate does NOT, so the top harmonics fold back'
                }.`
              : 'A real square has harmonics forever, so something always folds. Set a count to band-limit it and the sampling theorem becomes satisfiable.'
          }
        />
      )}

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
            {
              value: Math.round(nyquist),
              label: 'Nyq',
              title:
                'Nyquist — the fold point. Exactly here the samples land on the same two phases ' +
                'every cycle: at phase 0° a sine samples its zero crossings and vanishes; drag ' +
                'Phase to 90° and it returns at full amplitude.',
            },
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
        // Not compact: the LTI experiment says "drag the phase slider and
        // watch the filtered wave slide without changing shape", and time-
        // invariance deserves a control you can actually scrub. The note
        // pointed at a slider that was not there (Reed's report).
        <NumField
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
  linkFrom = null,
}) {
  // Which preset groups are unfolded. The active preset's group is always
  // open regardless, so collapsing is never able to hide where you are.
  const [openGroups, setOpenGroups] = React.useState(() => new Set())
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
        <LabNav current="signal-lab" />
        <h1>Signal Lab</h1>
        <p className="sub">
          A signal, its frequency content, and what happens when you put things in the way.
        </p>
      </header>

      <section>
        {cameFromLink ? (
          <p className="hint from-link">
            {linkFrom && linkFrom.label
              ? `This chain IS your “${linkFrom.label}” from ${
                  linkFrom.app === 'circuit' ? 'Circuit Lab' : linkFrom.app
                } — the same transfer function, sampled. Pick anything below to start over.`
              : 'Loaded from a link — this chain came from another tool in the suite. Pick anything below to start over.'}
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
        {/* Grouped as a curriculum, and COLLAPSED to group headers by default:
            thirty buttons were most of the sidebar, and the thing a preset
            changes - the sources and chain below - was scrolled out of sight
            at the moment it changed. Only the active preset's group stays
            open, so where-you-are survives the fold. */}
        {PRESET_GROUPS.map((g) => {
          const inGroup = presets.filter((p) => p.group === g)
          if (!inGroup.length) return null
          const holdsActive = inGroup.some((p) => p.name === state.presetName)
          return (
            <details
              className="preset-group"
              key={g}
              open={holdsActive || openGroups.has(g)}
              onToggle={(e) => {
                const next = new Set(openGroups)
                if (e.target.open) next.add(g)
                else next.delete(g)
                setOpenGroups(next)
              }}
            >
              {/* The browser folds a <details> natively BEFORE React hears of
                  it, and React will not rewrite an `open` prop that did not
                  change (true -> true), so the controlled prop alone is a
                  fiction: the active group could be folded away despite the
                  promise above. Refuse the gesture at the source — keyboard
                  activation arrives as a click too, so this covers Enter and
                  Space. Found by the Control Lab agent's harness. */}
              <summary onClick={holdsActive ? (e) => e.preventDefault() : undefined}>
                {g}
                {holdsActive ? <span className="group-active-dot" aria-hidden="true" /> : null}
              </summary>
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
            </details>
          )
        })}
        {activePreset ? (
          <>
            {/* The note gets its title. Once the groups fold, the paragraph
                below was the only place the selection was legible at all —
                and it opened mid-thought, anonymous. */}
            <h3 className="note-title">{activePreset.name}</h3>
            <p className="hint">{activePreset.note}</p>
          </>
        ) : null}
        {/* The vocabulary this lesson leans on, defined where it is used. A
            student meeting "bin" or "Q" mid-note should not need a second
            tab — and folded, the definitions cost nothing to someone who
            already has them. */}
        {activePreset && termsFor(activePreset.terms).length ? (
          <details className="terms">
            <summary>Terms used here</summary>
            <dl>
              {termsFor(activePreset.terms).map((t) => (
                <React.Fragment key={t.id}>
                  <dt>{t.name}</dt>
                  <dd>{t.def}</dd>
                </React.Fragment>
              ))}
            </dl>
          </details>
        ) : null}
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
        {/* The dB/lin scale, the overlay and the zoom moved to the frequency
            pane's own header — next to the plot they govern. This section
            keeps the lesson-flavoured toggles that annotate BOTH panes. */}
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
