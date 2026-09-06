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
    // A knob is a number or the name of a position. `fmtNum` takes the first
    // and throws on the second, so a choice knob is written out as its name.
    Settings: Object.entries(params || {})
      .map(([k, v]) => `${k} = ${typeof v === 'number' ? fmtNum(v) : String(v)}`)
      .join(', '),
    View: view,
    Headline: x?.headline ? `${x.headline.label}: ${fmtNum(x.headline.value)} ${x.headline.unit || ''}`.trim() : '',
    Engine:
      'every number here is a closed form at one frequency, exact and never hedged; the hand-over of a line to ' +
      'the rational core is declined with its reason; every number in every note is recomputed from the engine ' +
      'by a test',
  }
}
