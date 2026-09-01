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
export function reportSummary({ id, params, show, view, outcome }) {
  const exp = byId[id]
  return {
    Experiment: exp ? `${exp.id.toUpperCase()} · ${exp.name}` : id,
    Group: exp?.group || '(unknown)',
    Settings: Object.entries(params || {})
      .map(([k, v]) => `${k} = ${fmtNum(v)}`)
      .join(', '),
    'Schematic shows': { i: 'currents', v: 'voltages', p: 'powers', none: 'no readings' }[show] || show,
    'Lower pane': view,
    Outcome: outcome,
  }
}
