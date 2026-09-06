import { fmt } from '@ee-labs/ui'

/**
 * What to show at the top of a report from this lab.
 *
 * A plain function rather than inline JSX so it can be checked, which is what
 * the other labs' briefs record as the failure that shipped once.
 *
 * The seed and the Eb over N0 are the first two rows, because those two decide
 * whether a report can be reproduced at all. Everything a reader saw on a noisy
 * view is a function of them.
 */
export function reportSummary(experiment, params) {
  const rows = {
    Experiment: `${experiment.id} · ${experiment.name}`,
    Group: experiment.group,
    Seed: String(params.seed),
  }
  const has = (v) => experiment.views.includes(v)
  if (has('constellation') || has('ber') || has('eye')) {
    rows.Scheme = params.scheme
    rows['Eb/N0'] = `${params.ebN0Db} dB`
  }
  if (has('eye') || has('pulse') || has('gate')) {
    rows.Pulse = `${params.shape}, roll-off ${params.beta}, span ${params.span} symbols`
  }
  if (has('ber')) {
    rows.Count = `${params.countSymbols} symbols, counted to ${params.countTo} dB`
    rows.Level = `${(params.level * 100).toFixed(0)} %`
  }
  if (has('scope') || has('spectrum')) {
    rows.Carrier = fmt(params.carrier, 'Hz', 4)
    rows.Message = fmt(params.message, 'Hz', 4)
    rows.Index = `m = ${params.m}, deviation ${fmt(params.deviation, 'Hz', 4)}`
  }
  if (has('channel')) {
    rows.Channel = `echo ${params.echo} at ${params.echoDelay} samples, ${params.eqTaps} equaliser taps`
  }
  if (has('subcarriers')) {
    rows.OFDM = `${params.ofdmN} subcarriers, prefix ${params.ofdmCp}, ${params.ofdmUsed} used`
  }
  if (has('loop') || has('gate')) {
    rows.Loop = `BnT ${params.bnT}, damping ${params.zeta}, order ${params.loopOrder}`
  }
  if (has('budget')) {
    rows.Link = `${params.txDbm} dBm at ${fmt(params.distance, 'm', 3)}, ${fmt(params.frequency, 'Hz', 3)}`
  }
  rows.Grid = `${fmt(params.sampleRate, 'Hz', 4)}, ${params.symbolRate} symbols a second`
  return rows
}
