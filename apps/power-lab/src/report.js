import { byId, TRACES, VIEWS } from './experiments.js'
import { fmtNum } from '@ee-labs/ui'

/**
 * What to show a reader — and Reed — at the top of a report from this lab.
 *
 * A plain function rather than inline JSX so it can be checked row by row
 * (Circuit Lab's first real report was missing the row that said which circuit
 * it came from, and its probe passed because it counted rows without reading
 * them). `outcome` is the one-line result: the mode and the conversion ratio.
 */
export function reportSummary({ id, params, traces, view, outcome }) {
  const exp = byId[id]
  const shown = [...(traces || [])].map((t) => TRACES[t]?.label || t)
  return {
    Experiment: exp ? `${exp.id.toUpperCase()} · ${exp.name}` : id,
    Group: exp?.group || '(unknown)',
    Settings: Object.entries(params || {})
      .map(([k, v]) => `${k} = ${fmtNum(v)}`)
      .join(', '),
    'Scope shows': shown.length ? shown.join(', ') : 'no traces',
    'Lower pane': VIEWS[view]?.label || view,
    Outcome: outcome,
    // The lab's provenance, which the header used to carry: what the numbers
    // on screen are, for whoever reads the report.
    Engine:
      'every waveform is the exact periodic steady state; every formula is evaluated beside what it predicts; ' +
      'every claim in a note is measured by a test',
  }
}
