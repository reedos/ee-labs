// What the "Something wrong or unclear?" link carries with it.
//
// CONTRIBUTING.md says the attached setup is usually what decides whether a
// report can be chased down. For this lab that is the experiment, every knob,
// and the two or three numbers on screen, so a reader only has to write what
// they noticed.

import { ps } from './format.js'

export function reportSummary(exp, p, x, view) {
  const knobs = exp.params.map((k) => `${k.label}: ${format(k, p[k.key])}`)
  const lines = [`Logic Lab — ${exp.id.toUpperCase()} ${exp.name}`, `View: ${view}`, '', 'Settings:', ...knobs.map((s) => `  ${s}`)]
  if (x && x.refusal) lines.push('', `The engine declined this netlist: ${x.refusal.code}`, `  ${x.refusal.message}`)
  else if (x && x.res) {
    lines.push('', 'Readings:')
    lines.push(`  gates: ${x.norm.gates.length}`)
    if (x.paths) lines.push(`  critical path: ${ps(x.paths.long.delay)} (${x.paths.long.path.join(' → ')})`)
    if (x.minimise) lines.push(`  cover: ${x.minimise.cubes} terms, ${x.minimise.literals} literals`)
    lines.push(`  events: ${x.res.events.length}`)
    if (x.res.swallowed.length) lines.push(`  pulses removed by the ${x.norm.delayMode} model: ${x.res.swallowed.length}`)
    if (x.res.violations.length) lines.push(`  setup or hold violations: ${x.res.violations.length}`)
  }
  return lines.join('\n')
}

const format = (k, v) => {
  if (k.kind === 'bit') return v ? '1' : '0'
  if (k.kind === 'choice') return (k.options.find((o) => o.value === v) || {}).label ?? String(v)
  return k.unit === 'ps' ? ps(v) : String(v)
}
