import React from 'react'

export default function PlotLegend({ items }) {
  return <ul className="plot-key" aria-label="Plot key">{items.map(({ label, color, kind = 'line' }) =>
    <li key={label}><span aria-hidden="true" className={`plot-swatch ${kind}`} style={{ '--key-color': color }} /><span>{label}</span></li>)}</ul>
}
