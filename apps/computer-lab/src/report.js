// What the "Something wrong or unclear?" link carries with it.
//
// CONTRIBUTING.md says the attached setup is usually what decides whether a
// report can be chased down. For this lab that is the experiment, every knob,
// the program if there is one, and the readings on screen, so a reader only
// has to write what they noticed.

import { quantitiesOf } from './analysis.js'
import { printed } from './components/panes.jsx'

export function reportSummary(exp, p, x, view) {
  const knobs = exp.params.map((k) => `${k.label}: ${format(k, p[k.key])}`)
  const lines = [`Computer Lab — ${exp.id.toUpperCase()} ${exp.name}`, `View: ${view}`, '', 'Settings:', ...knobs.map((s) => `  ${s}`)]
  if (x && x.program) lines.push('', `Program: ${x.program.name} (${x.code.length} instructions)`)
  if (x && x.cache) lines.push('', `Cache: ${x.cache.geometry.bytes} B, ${x.cache.geometry.blockBytes} B blocks, ${x.cache.geometry.ways} way, over ${x.cache.refs} references`)
  if (x) {
    lines.push('', 'Readings:')
    for (const r of quantitiesOf(x)) lines.push(`  ${r.label}: ${printed(r)}`)
  }
  return lines.join('\n')
}

const format = (k, v) => {
  if (k.kind === 'bit') return v ? k.on : k.off
  if (k.kind === 'choice') return (k.options.find((o) => o.value === v) || {}).label ?? String(v)
  return `${v}${k.unit ? ` ${k.unit}` : ''}`
}
