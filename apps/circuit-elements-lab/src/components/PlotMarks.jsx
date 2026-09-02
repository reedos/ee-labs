import React from 'react'
import { num } from '../format.js'

const GLYPH = { level: '┈', point: '○', segment: '╱', time: '┆', curve: '∿' }

/**
 * The plot's caption: one entry per mark, the glyph the plot draws it with,
 * the label and the number it stands for. A canvas has no DOM, so this is
 * where a reader — or a test — finds what the dashed line at 7.59 V meant.
 */
export default function PlotMarks({ marks }) {
  if (!marks || marks.length === 0) return null
  return (
    <ul className="plot-marks" data-role="marks">
      {marks.map((m, i) => (
        <li key={i} data-kind={m.kind}>
          <span className="mark-glyph" aria-hidden="true">
            {GLYPH[m.kind] || '·'}
          </span>
          <span className="mark-label">{m.label}</span>
          {Number.isFinite(m.value) ? <b className="mark-value">{m.unit === '%' ? `${m.value.toFixed(0)} %` : m.unit === 'dB/decade' ? `${m.value} dB/decade` : m.unit === '×' ? `×${num(m.value, '', 3)}` : num(m.value, m.unit, 3)}</b> : null}
        </li>
      ))}
    </ul>
  )
}
