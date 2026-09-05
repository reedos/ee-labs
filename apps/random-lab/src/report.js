import { fmt } from '@ee-labs/ui'

/**
 * What to show at the top of a report from this lab.
 *
 * A plain function rather than inline JSX so it can be checked, which is what
 * the other labs' briefs record as the failure that shipped once.
 *
 * The seed is the first row, because in this lab it is the row that decides
 * whether a report can be reproduced at all. Everything a reader saw is a
 * function of it.
 */
export function reportSummary(experiment, params) {
  const rows = {
    Experiment: `${experiment.id} · ${experiment.name}`,
    Group: experiment.group,
    Seed: String(params.seed),
    Level: `${(params.level * 100).toFixed(0)} %`,
  }
  if (experiment.views.includes('ensemble') || experiment.views.includes('outcome')) {
    rows.Ensemble = `${params.runs} runs of ${params.length}`
  }
  if (experiment.views.includes('density')) {
    rows.Spectrum = `${params.averages} averages of ${params.segment}, ${params.window} window`
    rows['Sample rate'] = `${fmt(params.sampleRate, 'Hz', 4)}`
  }
  if (experiment.views.includes('histogram')) {
    rows.Source = `${params.dist}, ${params.n} draws`
    rows.Histogram = `${params.bins} bins from ${params.lo} to ${params.hi}`
  }
  if (experiment.view === 'ktc') {
    rows.Capacitor = `R = ${fmt(params.R, 'Ω', 3)}, C = ${fmt(params.C, 'F', 3)}, T = ${params.T} K`
  }
  if (experiment.views.includes('errorrate') || experiment.views.includes('matched')) {
    rows.Pulse = `${params.pulse}, ${params.pulseLength} samples`
    rows['Eb/N0'] = `${params.ebN0Db} dB`
  }
  return rows
}
