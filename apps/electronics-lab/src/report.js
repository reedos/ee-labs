import { fmtNum } from '@ee-labs/ui'
import { num } from './format.js'

/**
 * What a report from this lab carries at the top.
 *
 * The Elements lab's rows, plus the two this lab adds: the model each device
 * is on, and the operating point the tangent was taken at. A report that says
 * "the gain is wrong" is unanswerable without both, because the same circuit
 * on the three-region model and on the exponential one is two different
 * amplifiers.
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
    Settings: Object.entries(params)
      .map(([k, v]) => knob(k, v))
      .join(', '),
    'Lower pane': exp.view,
    Outcome: x.sol ? `${exp.headline.label} = ${headlineText(exp, headline)}` : `no solution: ${x.refusal ? x.refusal.message : 'unknown'}`,
  }
  if (x.label) out['Operating point'] = x.label
  const models = Object.entries(x.point || {})
    .map(([id, p]) => `${id} ${p.region || 'linear'}`)
    .join(', ')
  if (models) out.Devices = models
  if (Number.isFinite(x.cursor)) out.Cursor = `t = ${fmtNum(x.cursor)} s`
  return out
}

/** The headline as the topbar prints it, so a report and a screenshot agree. */
function headlineText(exp, v) {
  if (typeof v === 'string') return v
  return Number.isFinite(v) ? num(v, exp.headline.unit) : '—'
}
