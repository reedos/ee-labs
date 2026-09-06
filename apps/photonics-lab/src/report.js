import { byId } from './experiments.js'
import { fmtNum } from '@ee-labs/ui'

/**
 * What a "something looks wrong" report carries: which experiment, what the
 * knobs were set to, which view was open, and the one number the experiment is
 * about, so a report can be acted on without asking the sender to reproduce it
 * by hand.
 */
export function reportSummary({ id, params, view, x }) {
  const exp = byId[id]
  return {
    Experiment: exp ? `${exp.id.toUpperCase()} · ${exp.name}` : id,
    Group: exp?.group || '(unknown)',
    Settings: Object.entries(params || {})
      .map(([k, v]) => `${k} = ${fmtNum(v)}`)
      .join(', '),
    View: view,
    Headline: x?.headline ? `${x.headline.label}: ${fmtNum(x.headline.value)} ${x.headline.unit || ''}`.trim() : '',
    Engine:
      'a closed form is exact and never hedged; a rate limit is quoted with the criterion it was read under; the ' +
      'photodiode’s current comes from the circuit solver and not from a formula; every number in every note is ' +
      'recomputed from the engine by a test',
  }
}
