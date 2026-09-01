import { CIRCUITS } from './circuits.js'
import { fmtNum } from '@ee-labs/ui'

/**
 * What to show a reader — and Reed — at the top of a report from this lab.
 *
 * A plain function rather than inline JSX so it can be checked. The first
 * version read `circuit.label`, and these descriptors carry `name`: the row
 * naming WHICH CIRCUIT the report came from evaluated to undefined and was
 * dropped, so the very first real report said everything about the setup
 * except what it was. The browser probe passed it, because it counted the
 * summary's rows without reading them.
 */
export function reportSummary({ id, params, output, tols, lower, lesson }) {
  const circuit = CIRCUITS[id]
  return {
    'Started from': lesson || '(built by hand)',
    Circuit: circuit?.name || id,
    'Measured at': circuit?.outputs.find((o) => o.key === output)?.label || output,
    Components: Object.entries(params || {})
      .map(([k, v]) => `${k} = ${fmtNum(v)}`)
      .join(', '),
    Tolerances: Object.keys(tols || {}).length
      ? Object.entries(tols)
          .map(([k, v]) => `${k} ±${(v * 100).toFixed(1)}%`)
          .join(', ')
      : 'exact values',
    'Lower pane': lower,
  }
}
