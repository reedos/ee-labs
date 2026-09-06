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
      .map(([k, v]) => `${k} = ${typeof v === 'string' ? v || 'none' : fmtNum(v)}`)
      .join(', '),
    View: view,
    Headline: x?.headline ? `${x.headline.label}: ${fmtNum(x.headline.value)} ${x.headline.unit || ''}`.trim() : '',
    Engine:
      'every number here is a sum or a ratio over the four numbers each block carries, walked once for the totals ' +
      'and once in decibels for the levels; the cascaded input IP3 is the aligned-phase worst case and says so; ' +
      'every number in every note is recomputed from the engine by a test',
  }
}
