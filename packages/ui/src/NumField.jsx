import React, { useEffect, useId, useRef, useState } from 'react'
import { POS_MAX, clamp, fromPos, near, snap, toPos } from './scale.js'
import { eng, engEcho, parseEng } from './units.js'

/**
 * A number you can type, drag, step, scroll, or click a preset for.
 *
 * `value` is always the canonical number in state units. Unit conversion (radians to
 * degrees, say) is the caller's job, so this component never needs a display
 * transform.
 */
export default function NumField({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  scale = 'linear',
  step = 1,
  coarse = 10,
  unit = '',
  spoken,
  decimals,
  suffixes,
  presets,
  hint,
  tone,
  compact = false,
  disabled = false,
  format,
  eng: engMode = false,
}) {
  const id = useId()
  const wrapRef = useRef(null)
  const inputRef = useRef(null)

  // null means "not editing, show the prop value". Holding the raw text while
  // typing is what lets you type `1` on the way to `1000` without being clamped to
  // the minimum after the first keystroke.
  const [draft, setDraft] = useState(null)
  const [flash, setFlash] = useState(null) // 'bad' | 'clamped'

  const opts = { scale, min, max, step }

  // Engineering mode: show the mantissa and move the prefix onto the unit, so a
  // 224 GBd symbol rate reads "224" next to "GBd" instead of twelve digits.
  const engParts = engMode ? eng(value) : null

  const fmt =
    format ||
    (engMode
      ? (v) => eng(v).num
      : (v) => {
          if (decimals != null) return v.toFixed(decimals)
          // Enough precision to round-trip, without a wall of zeros.
          return String(Number(v.toPrecision(6)))
        })

  const unitLabel = engMode ? `${engParts.prefix}${unit}` : unit

  // What a bare number mid-type will actually commit, given the prefix this
  // field currently has on display — see units.js#engEcho for the full case
  // this exists for (a milli-scale field reading a typed "1.0001" as 0.0010001
  // with nothing on screen saying so). `draft` is null except while the field
  // is actively being edited, so this is silent again the moment it commits,
  // blurs, or Escapes — no separate focus tracking needed.
  const echo = engMode && draft != null ? engEcho(draft, value, unit) : null

  const flashFor = (kind) => {
    setFlash(kind)
    window.setTimeout(() => setFlash(null), 400)
  }

  /**
   * Parse typed text. Returns null for anything unparseable — the caller reverts
   * rather than showing NaN.
   */
  const parse = (text) => {
    if (engMode) {
      // Full engineering notation: "224", "224G", "1.5T", "*2".
      const r = parseEng(text, unit)
      if (!r) return null
      let n = r.value
      // A bare number is read in the prefix currently on display, so typing
      // "112" into a field showing "224 GBd" means 112 GBd, not 112 baud.
      if (!r.hadPrefix && !r.ratio) n *= engParts.mult
      if (r.ratio === '*') n = value * r.value
      else if (r.ratio === '/') n = r.value === 0 ? NaN : value / r.value
      return Number.isFinite(n) ? n : null
    }

    const t = String(text).trim().toLowerCase().replace(/[\s,]/g, '')
    if (!t) return null
    const m = t.match(/^([*/])?(-?\d*\.?\d+)([a-z°%]*)$/)
    if (!m) return null
    const [, ratio, numStr, suffix] = m
    let n = Number(numStr)
    if (!Number.isFinite(n)) return null

    if (suffix) {
      const table = { ...(suffixes || {}) }
      const mult = table[suffix]
      if (mult == null) return null
      n *= mult
    }
    // `*2` is up an octave, `/2` is down. Four lines, disproportionately useful.
    if (ratio === '*') n = value * n
    else if (ratio === '/') n = n === 0 ? null : value / n
    return Number.isFinite(n) ? n : null
  }

  const commit = (text) => {
    const raw = parse(text)
    if (raw == null) {
      setDraft(null)
      flashFor('bad')
      return
    }
    const next = snap(clamp(raw, min, max), opts)
    setDraft(null)
    if (Math.abs(next - raw) > Math.abs(raw) * 1e-9 + 1e-12) flashFor('clamped')
    if (next !== value) onChange(next)
  }

  const bump = (delta) => {
    const next = snap(clamp(value + delta, min, max), opts)
    if (next !== value) onChange(next)
    setDraft(null)
  }

  // Stepping on a log scale by a fixed amount is useless at the top of the range
  // (adding 1 Hz to 8 kHz), so step proportionally there instead.
  const stepFor = (mult) =>
    scale === 'linear' ? step * mult : Math.max(step, Math.abs(value) * 0.02) * mult

  const onKeyDown = (e) => {
    const mult = e.shiftKey ? coarse : 1
    switch (e.key) {
      case 'Enter':
        e.preventDefault()
        commit(e.currentTarget.value)
        requestAnimationFrame(() => inputRef.current?.select())
        break
      case 'Escape':
        e.preventDefault()
        setDraft(null)
        e.currentTarget.blur()
        break
      case 'ArrowUp':
        e.preventDefault()
        bump(stepFor(mult))
        break
      case 'ArrowDown':
        e.preventDefault()
        bump(-stepFor(mult))
        break
      case 'PageUp':
        e.preventDefault()
        bump(stepFor(coarse * 10))
        break
      case 'PageDown':
        e.preventDefault()
        bump(-stepFor(coarse * 10))
        break
      case 'Home':
        e.preventDefault()
        onChange(min)
        setDraft(null)
        break
      case 'End':
        e.preventDefault()
        onChange(max)
        setDraft(null)
        break
      default:
    }
  }

  // React attaches wheel passively at the root, so preventDefault inside onWheel is
  // a no-op plus a console warning. Bind it natively instead, and only act while
  // this field owns focus — otherwise scrolling the sidebar rewrites the patch.
  useEffect(() => {
    const el = wrapRef.current
    if (!el || disabled) return
    const onWheel = (e) => {
      if (!el.contains(document.activeElement)) return
      e.preventDefault()
      bump(e.deltaY < 0 ? stepFor(e.shiftKey ? coarse : 1) : -stepFor(e.shiftKey ? coarse : 1))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  })

  const shown = draft ?? fmt(value)
  const cls = ['num', compact ? 'is-compact' : '', flash ? `is-${flash}` : '']
    .filter(Boolean)
    .join(' ')

  return (
    <div className={cls} data-tone={tone || undefined} ref={wrapRef}>
      <div className="num-head">
        <label className="num-label" htmlFor={id}>
          {label}
        </label>
        <span className="num-hint" aria-live="polite">
          {hint}
        </span>
      </div>

      <div className="num-entry">
        <button
          type="button"
          className="num-step"
          tabIndex={-1}
          disabled={disabled || value <= min}
          aria-label={`Decrease ${label}`}
          onClick={() => bump(-stepFor(1))}
        >
          −
        </button>
        <input
          ref={inputRef}
          id={id}
          className="num-input"
          type="text"
          inputMode="decimal"
          role="spinbutton"
          spellCheck={false}
          autoComplete="off"
          disabled={disabled}
          aria-valuenow={value}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuetext={`${fmt(value)}${spoken ? ` ${spoken}` : ''}`}
          aria-invalid={flash === 'bad' || undefined}
          aria-describedby={engMode ? `${id}-echo` : undefined}
          value={shown}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={(e) => e.target.select()}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {unitLabel ? (
          <span className="num-unit" aria-hidden="true">
            {unitLabel}
          </span>
        ) : null}
        <button
          type="button"
          className="num-step"
          tabIndex={-1}
          disabled={disabled || value >= max}
          aria-label={`Increase ${label}`}
          onClick={() => bump(stepFor(1))}
        >
          +
        </button>
      </div>

      {/* Out of flow on purpose: this can appear mid-keystroke, and the fold
          probes in every lab require the try line and the featured knob to
          stay on screen at 1366x768 and up. An absolutely positioned line
          costs zero layout whether it is empty, showing, or hidden by a
          reduced-motion setting — nothing here reflows the page. The element
          itself always exists so aria-live has something to announce a
          change into; it just sits empty until there's a bare number to
          re-read. */}
      {engMode && (
        <div className="num-echo" id={`${id}-echo`} aria-live="polite" data-visible={echo ? '' : undefined}>
          {echo ? echo.text : ''}
        </div>
      )}

      {!compact && (
        <input
          className="num-slider"
          type="range"
          tabIndex={-1}
          disabled={disabled}
          aria-label={`${label} slider`}
          min={0}
          max={POS_MAX}
          step={1}
          value={toPos(value, opts)}
          onChange={(e) => onChange(fromPos(Number(e.target.value), opts))}
        />
      )}

      {!compact && presets && presets.length > 0 && (
        <div className="num-chips">
          {presets.map((p) => {
            const pv = typeof p === 'object' ? p.value : p
            const pl = typeof p === 'object' ? p.label : fmt(p)
            const on = near(value, pv, opts)
            return (
              <button
                type="button"
                key={`${pv}-${pl}`}
                className={`chip${on ? ' is-on' : ''}`}
                aria-pressed={on}
                disabled={disabled}
                title={typeof p === 'object' ? p.title : undefined}
                onClick={() => onChange(clamp(pv, min, max))}
              >
                {pl}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
