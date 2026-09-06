// The setup a report carries with it.
//
// CONTRIBUTING.md's rule: the sidebar's report link opens an issue with the
// exact setup already filled in, because reconstructing it by hand is what
// stops a report being chased down.

/** One line per knob, plus the experiment and the view. */
export function summary(exp, params, view) {
  const knobs = exp.params
    .map((p) => `- ${p.label}: ${params[p.key]}${p.unit ? ` ${p.unit}` : ''}`)
    .join('\n')
  return [`Experiment: ${exp.id} · ${exp.name}`, `Model: ${exp.kind}`, `View: ${view}`, '', 'Settings:', knobs].join('\n')
}
