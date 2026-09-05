import { fmtNum } from '@ee-labs/ui'
import { num } from './format.js'

/**
 * What a report from this lab carries at the top.
 *
 * The other labs send the netlist and the operating point. This lab has no
 * netlist, so it sends the structure and the model. A report that says "the
 * capacitance is wrong" is unanswerable without both, because the same gate
 * voltage on a high-frequency and a low-frequency curve is two different
 * numbers, and both are right.
 */
export function reportSummary(exp, params, x, headline) {
  const knob = (k, v) => {
    const def = exp.params.find((q) => q.key === k)
    if (typeof v === 'boolean') return `${k} = ${def ? (v ? def.on : def.off) : v}`
    if (typeof v === 'string') {
      const pick = def && def.options && def.options.find((o) => o.value === v)
      return `${k} = ${pick ? pick.label : v}`
    }
    return `${k} = ${fmtNum(v)}`
  }
  const out = {
    Experiment: `${exp.id.toUpperCase()} · ${exp.name}`,
    Group: exp.group,
    Structure: exp.structure,
    Settings: Object.entries(params)
      .map(([k, v]) => knob(k, v))
      .join(', '),
    'Lower pane': exp.view,
    Outcome: x.sol ? `${exp.headline.label} = ${headlineText(exp, headline)}` : `declined: ${x.refusal ? x.refusal.message : 'unknown'}`,
  }
  if (x.sol) out['Cross-section'] = x.stack.title
  if (x.mos) out.Regime = x.mos.regime
  if (x.fet) out.Region = x.fet.region
  if (x.j) out.Model = 'depletion approximation'
  if (x.guard && x.guard.degenerate) out.Guard = 'above the doping where Boltzmann statistics hold'
  return out
}

/** The headline as the topbar prints it, so a report and a screenshot agree. */
function headlineText(exp, v) {
  if (typeof v === 'string') return v
  return Number.isFinite(v) ? num(v, exp.headline.unit) : '—'
}
