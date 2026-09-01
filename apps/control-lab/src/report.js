import { PLANTS, CONTROLLERS } from './systems.js'
import { fmtNum } from '@ee-labs/ui'

/**
 * What to show at the top of a report from this lab.
 *
 * A plain function rather than inline JSX so it can be checked. The first
 * version read `plant.label` and `ctrl.label`, and these descriptors carry
 * `name` — which here was worse than a missing row, because the value was
 * built by interpolation and so printed the word "undefined" into the report
 * rather than being dropped as empty.
 */
export function reportSummary({ plantId, plantP, ctrlId, ctrlP, stepInput, lower, lesson }) {
  const plant = PLANTS[plantId]
  const ctrl = CONTROLLERS[ctrlId]
  const withParams = (label, p) => {
    const vals = Object.entries(p || {})
      .map(([k, v]) => `${k} = ${fmtNum(v)}`)
      .join(', ')
    return vals ? `${label} — ${vals}` : label
  }
  return {
    'Started from': lesson || '(built by hand)',
    Plant: withParams(plant?.name || plantId, plantP),
    Controller: withParams(ctrl?.name || ctrlId, ctrlP),
    'Step applied to': stepInput === 'dist' ? 'the plant input' : 'the reference',
    'Lower pane': lower,
  }
}
