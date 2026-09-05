# Needs and heads-ups for the other territories

## For the director's queue

- **Deploy line.** `.github/workflows/deploy.yml` needs one more `cp` line,
  added when this lab's `RELEASE_STATUS` flips: `cp -r apps/dsp-lab/dist
  _site/dsp-lab`.
- **Progression test.** `packages/ui/src/progression.test.js` does not exist
  in this worktree yet (the seams overseer owns it, on `lab/seams`). This
  lab's ids and counts to add, once it lands: group "Changing the rate" holds
  seven, `a1` through `a7`. Group "Designing to a specification" holds eight,
  `b1` through `b8`. Fifteen experiments in all, in that sidebar order.

## `packages/ui` promotion candidates

- **`SpecPane.jsx`.** Built here first, at the director's ruling
  (`DSP_LAB_PLAN.md` Decision 4), to the contract `APPLIED_ANALOG_LAB_PLAN.md`
  §4.3 states. Both prop forms ship from the first commit: the scalar `items`
  form and the `mask` form a filter specification needs. The Applied Analog
  Lab is the second consumer named in that plan, and can import this file
  once it is promoted rather than writing its own.
- **`ScopeCanvas.jsx`, `SpectrumCanvas.jsx`, `Controls.jsx`.** Copied from
  Signal Lab with the minimum change this lab's blocks needed. The response
  overlay now reads `exact: false` and draws a reason string for a block with
  no transfer function, and the frequency pane accepts the `mask` prop
  `SpecPane` also reads. A second lab that wants either canvas can promote it
  rather than copy it again.

## Open

- **`scripts/verify.mjs` is not written.** `AGENT_BRIEF.md` §7 asks lane 2 for
  a Playwright harness. This overseer's brief for this pass excluded
  Playwright, so the harness, and its screenshots at 390 px and 1280 by 900,
  are deferred to whichever pass extends the app past groups A and B.
