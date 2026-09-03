import React from 'react'
import { MathPanel } from '@ee-labs/explain'
import { blockMath } from '../math-parts.js'
import { BLOCK_GROUPS, BLOCK_TYPES } from '../dsp/blocks.js'
import { BlockField } from './fields.jsx'

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
            {block.bypass ? 'bypassed' : def.summary(block.params, ctx)}
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
          {/* Change what this block IS, in place. "Switch the block to
              band-pass" used to mean delete-and-re-add; a lesson that says
              "try it as a band-pass" should be one select away. Parameters the
              two types share — cutoff, Q — survive the change. */}
          <label className="field">
            <span className="field-label">Block type</span>
            <select
              value={block.type}
              aria-label="Change block type"
              onChange={(e) => {
                const type = e.target.value
                const next = BLOCK_TYPES[type]
                const params = { ...next.defaults }
                for (const key of Object.keys(params)) {
                  if (key in block.params) params[key] = block.params[key]
                }
                onChange({ ...block, type, params })
              }}
            >
              {BLOCK_GROUPS.map((g) => (
                <optgroup key={g} label={g}>
                  {Object.entries(BLOCK_TYPES)
                    .filter(([, d]) => d.group === g)
                    .map(([t, d]) => (
                      <option key={t} value={t}>
                        {d.label}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
          {/* What this block does, in a sentence, where someone meeting it for
              the first time will actually look: inside the block itself. */}
          {def.hint ? (
            <p className="block-hint">
              {typeof def.hint === 'function' ? def.hint(block.params) : def.hint}
            </p>
          ) : null}
          {/* Each parameter from the schema, through the one definition the
              featured slot under a lesson's try line also renders — so the
              knob up there and the knob down here are the same knob. */}
          {def.params.map((p) => (
            <BlockField
              key={p.key}
              block={block}
              field={p.key}
              sampleRate={sampleRate}
              onChange={onChange}
            />
          ))}

          {/* Below the parameters, not above: set fc, order and Q first,
              THEN unfold what those choices mean. The flow is the lesson. */}
          <MathPanel
            label="The math for this block"
            getEntry={() => blockMath(block, ctx)}
          />
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
