import React from 'react'
import NumField from './NumField.jsx'
import MathPanel from './MathPanel.jsx'
import { blockMath } from '../math-parts.js'
import { BLOCK_TYPES, resolve } from '../dsp/blocks.js'

/**
 * One block in the chain. Collapsed it is a 30px summary row; expanded it renders
 * its parameters straight from the type's schema, so no block type needs its own
 * component.
 */
export default function BlockCard({
  block,
  index,
  count,
  open,
  sampleRate,
  onToggleOpen,
  onChange,
  onRemove,
  onMove,
}) {
  const def = BLOCK_TYPES[block.type]
  if (!def) return null

  const ctx = { sampleRate, nyquist: sampleRate / 2 }
  const setParam = (key, value) =>
    onChange({ ...block, params: { ...block.params, [key]: value } })

  return (
    <div
      className={`block${block.bypass ? ' is-off' : ''}`}
      id={`block-${block.id}`}
    >
      <div className="block-head">
        <span className="block-index" aria-hidden="true">
          {index + 1}
        </span>
        <button
          type="button"
          className="block-title"
          aria-expanded={open}
          aria-controls={`bb-${block.id}`}
          onClick={onToggleOpen}
        >
          <span className="block-caret" aria-hidden="true">
            {open ? '▾' : '▸'}
          </span>
          {def.label}
        </button>
        {!open && (
          <span className="block-summary">
            {block.bypass ? 'bypassed' : def.summary(block.params)}
          </span>
        )}
        <button
          type="button"
          className={`icon${block.bypass ? '' : ' is-on'}`}
          aria-pressed={block.bypass}
          aria-label={`Bypass ${def.label}`}
          title={block.bypass ? 'Enable' : 'Bypass'}
          onClick={() => onChange({ ...block, bypass: !block.bypass })}
        >
          ⏻
        </button>
      </div>

      {open && (
        <div className="block-body" id={`bb-${block.id}`}>
          {/* What this block does, in a sentence, where someone meeting it for
              the first time will actually look: inside the block itself. */}
          {def.hint ? <p className="block-hint">{def.hint}</p> : null}
          <MathPanel
            label="The math for this block"
            getEntry={() => blockMath(block, ctx)}
          />
          {def.params.map((p) => {
            if (p.kind === 'select') {
              return (
                <label className="field" key={p.key}>
                  <span className="field-label">{p.label}</span>
                  <select
                    value={block.params[p.key]}
                    onChange={(e) => setParam(p.key, e.target.value)}
                  >
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
                <label className="check" key={p.key}>
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
                key={p.key}
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
                suffixes={p.unit === 'Hz' ? { k: 1e3, khz: 1e3, hz: 1 } : undefined}
                spoken={p.unit === 'Hz' ? 'hertz' : undefined}
              />
            )
          })}

          <div className="block-foot">
            <button
              type="button"
              className="icon"
              aria-label={`Move ${def.label} up`}
              disabled={index === 0}
              onClick={() => onMove(-1)}
            >
              ↑
            </button>
            <button
              type="button"
              className="icon"
              aria-label={`Move ${def.label} down`}
              disabled={index === count - 1}
              onClick={() => onMove(1)}
            >
              ↓
            </button>
            <button
              type="button"
              className="icon danger"
              aria-label={`Remove ${def.label}`}
              onClick={onRemove}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
