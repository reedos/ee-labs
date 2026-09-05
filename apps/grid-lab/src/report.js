// What the "Something wrong or unclear?" link carries into an issue.
//
// The setup is what makes a report chaseable, so the whole knob set goes in
// alongside the experiment and the two views on screen.

/** The one-line summary rows an issue opens with. */
export function reportSummary(exp, params, views) {
  return {
    Experiment: `${exp.id} · ${exp.name}`,
    Group: exp.group,
    Picture: views.plot,
    Panel: views.panel,
    Knobs: exp.params.map((k) => `${k.label} = ${params[k.key]}`).join(', '),
  }
}
