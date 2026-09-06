import { byId } from './experiments.js'
import { fmtNum } from '@ee-labs/ui'

/**
 * What to show a reader — and Reed — at the top of a report from this lab.
 *
 * A plain function rather than inline JSX so it can be checked row by row
 * (Circuit Lab's first real report was missing the row that said which circuit
 * it came from, and its probe passed because it counted rows without reading
 * them). `outcome` is the one-line result: the KCL residual, or the refusal.
 */
export function reportSummary({ id, params, show, view, outcome, cursor }) {
  const exp = byId[id]
  // A toggle knob reports its position by name, a choice (a diode's model) by
  // the name of the position it is in, and a number as a number.
  const knob = (k, v) => {
    if (typeof v === 'string') {
      const def = exp?.params.find((q) => q.key === k)
      const pick = def?.options?.find((o) => o.value === v)
      return `${k} = ${pick ? pick.label : v}`
    }
    if (typeof v !== 'boolean') return `${k} = ${fmtNum(v)}`
    const def = exp?.params.find((q) => q.key === k)
    return `${k} = ${def ? (v ? def.on : def.off) : v}`
  }
  const out = {
    Experiment: exp ? `${exp.id.toUpperCase()} · ${exp.name}` : id,
    Group: exp?.group || '(unknown)',
    Settings: Object.entries(params || {})
      .map(([k, v]) => knob(k, v))
      .join(', '),
    'Schematic shows': { i: 'currents', v: 'voltages', p: 'powers', none: 'no readings' }[show] || show,
    'Lower pane': view,
    Outcome: outcome,
  }
  if (Number.isFinite(cursor)) out.Cursor = `t = ${fmtNum(cursor)} s`
  return out
}
