import { byId } from './experiments.js'
import { fmtNum } from '@ee-labs/ui'

/**
 * What a "something looks wrong" report carries: which experiment, what the
 * knobs were set to, which view was open, and the one number the experiment
 * is about — so a report can be acted on without asking the sender to
 * reproduce it by hand.
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
    // A headline the engine declined to quote has no number in it. `fmtNum`
    // throws on anything but a number, so a report must never hand it one:
    // a refusal is reported as the refusal, which is what a reader saw.
    Headline: headlineOf(x),
    Engine:
      'a closed form is exact and never hedged; a grid answer is quoted to the figures its mesh-refinement guard ' +
      'allows; every number in every note is recomputed from the engine by a test',
  }
}

/** The one number the experiment is about, or the sentence shown where it would be. */
function headlineOf(x) {
  const h = x?.headline
  if (!h) return ''
  if (!Number.isFinite(h.value)) return `${h.label}: not quoted`
  return `${h.label}: ${fmtNum(h.value)} ${h.unit || ''}`.trim()
}
