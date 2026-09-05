import { PLANTS, CONTROLLERS, NONLINEARITIES } from './systems.js'
import { fmtNum } from '@ee-labs/ui'

/**
 * What goes at the top of a report from this lab.
 *
 * A plain function rather than inline JSX so it can be checked. Control Lab's
 * version read `plant.label` where the registry carries `name`, and because
 * the value was built by interpolation it printed the word "undefined" into
 * every report rather than leaving the row out. Reading a key that does not
 * exist is worse than a missing row, so this one names every key it reads.
 */
export function reportSummary(state, experiment) {
  const plant = PLANTS[state.plantId]
  const ctrl = CONTROLLERS[state.ctrlId]
  const withParams = (label, p) => {
    const vals = Object.entries(p || {})
      .map(([k, v]) => `${k} = ${fmtNum(v)}`)
      .join(', ')
    return vals ? `${label}, ${vals}` : label
  }
  const out = {
    'Started from': experiment ? `${experiment.id} ${experiment.name}` : '(built by hand)',
    Plant: withParams(plant?.name || state.plantId, state.plantP),
    Controller: withParams(ctrl?.name || state.ctrlId, state.ctrlP),
    View: state.view || state.mode,
  }
  if (state.mode === 'sampled') {
    out['Sample time'] = state.perCycle
      ? `${state.perCycle} samples a cycle at crossover`
      : `${fmtNum(state.Ts)} s`
    out['Emulation rule'] = state.emulation || 'tustin'
  }
  if (state.nlId && state.nlId !== 'none') {
    out.Nonlinearity = `${NONLINEARITIES[state.nlId]?.name || state.nlId}, limit ${fmtNum(state.delta)}`
  }
  if (state.mode === 'fit') out.Noise = `${fmtNum(100 * (state.noise ?? 0))} % of the gain`
  return out
}
