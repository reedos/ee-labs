# Control Lab II: what this lab needs from elsewhere

Everything here is a change to a file this lab does not own, per `PROGRAM.md`
section 5. The director resolves each one at integration. Nothing in this
document is a request to another overseer, and no entry here blocks the lab
from being green on its own branch.

## 1. The deploy line, for the director

`.github/workflows/deploy.yml` needs one line in the "Assemble the site" step,
beside the other dark labs:

```
cp -r apps/control-lab-ii/dist _site/control-lab-ii
```

Without it the dark URL does not exist, and there is nothing for Reed to review
against. `apps/control-lab-ii/src/release.test.js` asserts that this request is
recorded here, and the assertion moves to the workflow itself the moment the
line lands.

## 2. The progression ids and counts, for the seams overseer

`packages/ui/src/progression.test.js` is the seams overseer's file. This lab's
ids and counts, as they stand on this branch:

| Group | Name | Ids | Built |
| --- | --- | --- | --- |
| A | The state | A1 to A7 | 7 |
| B | The sampled loop | B1 to B7 | 7 |
| C | The phase plane | C1 to C6 | 6 |
| D | The describing function | D1 to D5 | 5 |
| E | Identification | E1 to E5 | 5 |
| F | The Kalman filter | F1, F2 | 2 |

Thirty-two built. F3 to F5 are deferred to the Random Signals Lab and are in
`BACKLOG.md`, so the plan's thirty-five is thirty-two on the site until that
lab lands. The slug is `control-lab-ii` and the splash glyph is `⟳`.

What this lab leans on from elsewhere, for the progression test's own graph:

- Control Lab, the whole classical loop. Groups A, B and D all assume it.
- Signal Lab's sampling group and its z-plane, for Group B.
- Circuit Elements Lab F4 and G1, for A1 and A2's reading of a state.
- Power Lab Groups A and B, for the piecewise-linear view Groups C and D use.

## 3. Promotion candidates, for `packages/ui`

`PROGRAM.md` section 4 says a canvas moves into `packages/ui` when a second lab
claims it. Three sit here waiting.

- **`PhaseCanvas.jsx`**, built here and named in `PROGRAM.md` section 4 with the
  Machines Lab as its second lab. Its props already carry that lab's four
  needs, `levels`, `cursor`, `periodic` and `onPick`, and a test asserts the
  canvas honours `periodic` even though no lesson here sets it. It is ready to
  promote the day the Machines Lab claims it, with no change to its interface.
- **`StepCanvas.jsx`**, copied from `apps/control-lab/src/components/`. Two
  copies now exist. A third copy is the signal to promote it.
- **`LoopDiagram.jsx`**, the same, with this lab's copy carrying an extra block
  for the sampler and the hold.

`BodeCanvas.jsx` is not copied. This lab reads the shared `plot.js` and draws
its own smaller frequency pane, so there is nothing to promote.

## 4. What this lab does not need

Stated so the director does not go looking. No new element in
`packages/network`, no change to `packages/dsp`, and no new package. Every
addition this lab made is inside `packages/systems`, which this lab owns. Every
one of them is an addition rather than a change, so Circuit Lab, Control Lab
and Signal Lab stay green with no edits.
