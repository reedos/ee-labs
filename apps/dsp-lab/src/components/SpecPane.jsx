import React from 'react'
import { fmtHz } from '@ee-labs/ui'

/**
 * SpecPane: a target and the margin against it.
 *
 * `PROGRAM.md` §4 gives this canvas to the Applied Analog Lab first and this lab
 * second, and the director ruled that this lab lands it because this lab is
 * building now. So it carries both labs' needs in its props from the first
 * commit, and `APPLIED_ANALOG_LAB_PLAN.md` §4.3 is the contract it is written to.
 * `apps/dsp-lab/NEEDS.md` lists it as the `packages/ui` promotion candidate.
 *
 * Two forms, because a specification is written in two ways and both are real.
 *
 *   items  a list of scalar rows. Each names one measured number, the target it
 *          is compared against, and how ("at least", "at most", "within"). This
 *          is the form a board-level specification takes: a bandwidth, an offset,
 *          a rejection ratio, a settling time.
 *   mask   a set of band limits a response must stay inside, with the margin
 *          reported per band. This is the form a filter specification takes, and
 *          it is exactly what `specMarginRef` returns, so a caller passes the
 *          result through with no reshaping.
 *
 * The pane computes nothing. `margin` and `pass` arrive already decided, because
 * one function has to decide them everywhere or two panes will disagree about
 * the same filter. For a mask that function is `specMarginRef` in
 * `packages/dsp`, and for items it is whatever the lab's own analysis uses.
 *
 * Props:
 *   items    [{ key, label, value, target, unit, cmp, tol, margin, pass }]
 *   binding  the key of the row to show first, and to mark as the one that binds
 *   mode     'table' (default) or 'bars', which is the phone layout
 *   mask     { axis, bands: [{ id, label, from, to, max, min, maxDb, minDb,
 *              atHz, marginDb, met }] }
 *   onEdit   (key, target) => void. Absent means the targets are fixed and no
 *            field renders, which is the reading case rather than the design one.
 */

const CMP_WORD = { min: 'at least', max: 'at most', window: 'within' }

/** A frequency with its unit, in the suite's engineering notation. */
export const hz = (v) => `${fmtHz(v)}Hz`

/** A number with its unit, at the precision the unit deserves. */
export function formatValue(value, unit) {
  if (value == null || !Number.isFinite(value)) return '—'
  if (unit === 'Hz') return hz(value)
  if (unit === 'dB') return `${value.toFixed(2)} dB`
  const abs = Math.abs(value)
  const digits = abs >= 100 ? 0 : abs >= 1 ? 2 : 4
  return `${value.toFixed(digits)}${unit ? ` ${unit}` : ''}`
}

/** The margin, signed, in the row's own unit. Positive means met. */
export function formatMargin(margin, unit) {
  if (margin == null || !Number.isFinite(margin)) return '—'
  const sign = margin >= 0 ? '+' : '−'
  return `${sign}${formatValue(Math.abs(margin), unit)}`
}

/** How far along a bar the margin sits, as a fraction, clamped to the bar. */
export function barFraction(margin, span) {
  if (!Number.isFinite(margin) || !(span > 0)) return 0.5
  const f = 0.5 + margin / (2 * span)
  return Math.max(0.02, Math.min(0.98, f))
}

function MarginBar({ margin, span, pass }) {
  const f = barFraction(margin, span)
  return (
    <div className="spec-bar" aria-hidden="true">
      <div className="spec-bar-track" />
      <div className="spec-bar-zero" />
      <div
        className={pass ? 'spec-bar-fill met' : 'spec-bar-fill missed'}
        style={{ left: `${Math.min(50, f * 100)}%`, width: `${Math.abs(f * 100 - 50)}%` }}
      />
    </div>
  )
}

function ItemRow({ item, binding, mode, span, onEdit }) {
  const pass = item.pass
  const word = CMP_WORD[item.cmp] || CMP_WORD.max
  const target =
    item.cmp === 'window' && item.tol != null
      ? `${formatValue(item.target, item.unit)} ± ${formatValue(item.tol, item.unit)}`
      : formatValue(item.target, item.unit)
  return (
    <tr className={`${pass ? 'met' : 'missed'}${binding === item.key ? ' binds' : ''}`}>
      <th scope="row">{item.label}</th>
      <td className="spec-value">{formatValue(item.value, item.unit)}</td>
      <td className="spec-target">
        <span className="spec-cmp">{word}</span>{' '}
        {onEdit ? (
          <input
            type="number"
            className="spec-edit"
            value={item.target}
            aria-label={`${item.label} target`}
            onChange={(e) => onEdit(item.key, Number(e.target.value))}
          />
        ) : (
          target
        )}
      </td>
      <td className="spec-margin">
        {mode === 'bars' ? (
          <MarginBar margin={item.margin} span={span} pass={pass} />
        ) : (
          formatMargin(item.margin, item.unit)
        )}
      </td>
      <td className="spec-pass">{pass ? 'met' : 'missed'}</td>
    </tr>
  )
}

function BandRow({ band, mode, span }) {
  const limit =
    band.max != null && band.min != null
      ? `${band.min.toFixed(2)} to ${band.max.toFixed(2)} dB`
      : band.max != null
        ? `at most ${band.max.toFixed(2)} dB`
        : `at least ${band.min.toFixed(2)} dB`
  return (
    <tr className={band.met ? 'met' : 'missed'}>
      <th scope="row">
        {band.label}
        <span className="spec-range">
          {hz(band.from)} to {hz(band.to)}
        </span>
      </th>
      <td className="spec-value">
        {band.max != null && band.min != null
          ? `${band.minDb.toFixed(2)} to ${band.maxDb.toFixed(2)} dB`
          : `${band.maxDb.toFixed(2)} dB`}
      </td>
      <td className="spec-target">{limit}</td>
      <td className="spec-margin">
        {mode === 'bars' ? (
          <MarginBar margin={band.marginDb} span={span} pass={band.met} />
        ) : (
          formatMargin(band.marginDb, 'dB')
        )}
      </td>
      <td className="spec-pass">
        {band.met ? 'met' : `missed at ${hz(band.atHz)}`}
      </td>
    </tr>
  )
}

export default function SpecPane({
  items = [],
  binding = null,
  mode = 'table',
  mask = null,
  onEdit = null,
  title = 'Specification',
}) {
  const bands = mask?.bands ?? []
  if (items.length === 0 && bands.length === 0) {
    return (
      <section className="spec-pane empty">
        <h3>{title}</h3>
        <p className="empty-state">Load an experiment that states one.</p>
      </section>
    )
  }

  // One scale for every bar, so two rows of the same length mean the same
  // margin. The span is the largest margin on show, floored so a set of tiny
  // margins does not fill the pane with full-length bars.
  const all = [...items.map((i) => i.margin), ...bands.map((b) => b.marginDb)].filter((v) =>
    Number.isFinite(v),
  )
  const span = Math.max(1, ...all.map((v) => Math.abs(v)))

  const missed = [
    ...items.filter((i) => !i.pass),
    ...bands.filter((b) => !b.met),
  ]
  const worst = all.length ? Math.min(...all) : null

  // The binding row first, then the rest in the order the caller gave.
  const ordered = binding
    ? [...items.filter((i) => i.key === binding), ...items.filter((i) => i.key !== binding)]
    : items

  return (
    <section className="spec-pane">
      <h3>{title}</h3>
      <p className={missed.length ? 'spec-head missed' : 'spec-head met'}>
        {missed.length === 0
          ? `Met, with ${formatMargin(worst, 'dB')} at the tightest.`
          : `Missed by ${formatMargin(worst, 'dB')} in ${missed.length} of ${items.length + bands.length}.`}
      </p>
      <table className={`spec-table ${mode}`}>
        <thead>
          <tr>
            <th scope="col">Row</th>
            <th scope="col">Measured</th>
            <th scope="col">Target</th>
            <th scope="col">Margin</th>
            <th scope="col">Result</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((item) => (
            <ItemRow
              key={item.key}
              item={item}
              binding={binding}
              mode={mode}
              span={span}
              onEdit={onEdit}
            />
          ))}
          {bands.map((band) => (
            <BandRow key={band.id} band={band} mode={mode} span={span} />
          ))}
        </tbody>
      </table>
      {mask ? (
        <p className="spec-note">
          The mask is drawn on the {mask.axis === 'f' ? 'frequency' : mask.axis} axis beside this
          pane.
        </p>
      ) : null}
    </section>
  )
}
