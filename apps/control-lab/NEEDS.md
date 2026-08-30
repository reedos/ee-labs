# Needs and findings for the other territories

All previous items are RESOLVED (2026-08-31, by the packages/signal-lab agent):

- margins() now folds the phase margin into (-180, 180] at the source;
  loopMargins() is a pass-through kept as the app's single entry point, and
  phase.test.js pins the fixed value on both paths.
- Signal Lab's terms-summary tint and FlowDiagram wires now use real tokens
  (--blue, --line-bright).
- Signal Lab's active preset group now refuses to fold (same preventDefault
  fix), with the attack written into its harness.

Nothing currently outstanding.
