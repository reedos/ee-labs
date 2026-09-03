# On-screen chrome — every string that changes

Chrome means the text outside the lessons: taglines, pane titles, tab labels,
tooltips, empty states, and the small annotations (`.prov`, `.flag`) that sit
beside a number. 286 chrome strings were extracted across the five labs and
`packages/ui`. Most are already plain ("Sample rate", "Step response of the
circuit in time"). The 34 below are the ones the rules change. Line numbers are
from the trees on 2026-09-03.

Renaming a **button, tab or spinbutton label** breaks the browser checks: the
five `verify.mjs` scripts hold 53 selectors that match a control by its exact
name. Every rename in this file that touches a control is marked ⚠ and lists the
selector to update in the same commit.

---

## Circuit Elements Lab

| Where | Now | Rewrite |
|---|---|---|
| `App.jsx:305` tagline | Circuits from the two laws up — every claim measured. | Circuits from KVL and KCL up to AC power and the diode. |
| `App.jsx:485` fold ⚠ | Why it works, and the working | Explanation and working |
| `App.jsx:406` completion | Every step done. | All steps done. |
| `App.jsx:856` empty state | Nothing to show until the circuit has a solution. | No solution to plot. See the reason above. |
| `App.jsx:636` hint | Tap a node to make it the reference — the meter's black lead can go anywhere. | Tap a node to make it the reference. Any node can be the reference, as with a meter's black lead. |
| sidebar heading | Two laws build every row below. | KVL and KCL produce every row below. |
| `experiments.js` | the solver refused — see below | no solution. The reason is below. |
| `package.json` name | Circuit Elements Lab | unchanged |

⚠ verify selectors: `getByRole('button', { name: 'Equations' })` is unaffected;
the fold is addressed by `data-role="deeper"`, so its summary text is safe to
change. Confirm with `npm run verify --workspace apps/circuit-elements-lab`.

`CIRCUIT_ELEMENTS_LAB_PLAN.md` still calls this fold "Deeper", which is not what
the screen says. One name per thing (S11): the plan follows the label.

## Power Lab

| Where | Now | Rewrite |
|---|---|---|
| `App.jsx:251` tagline | Pick an experiment. Turn the knob it names. Watch the number the note promised. | Each experiment loads a converter, names one knob, and states the number to read. |
| `App.jsx:315` drift note | — the note describes the defaults; you have moved away from them. | The note describes the default settings. Some knobs have moved. |
| `App.jsx:305` badge | Start here | First experiment |
| reset tooltip | Every knob back to this experiment's defaults | Reset every knob to this experiment's defaults |

## Circuit Lab

| Where | Now | Rewrite |
|---|---|---|
| `App.jsx:723` heading | Hand it to the other labs | Open this circuit in another lab |
| `App.jsx:842` heading | In time, as poles, and as math | Step response, poles, and derivation |
| `App.jsx:890` annotation | · theory beside measurement, every row live | · each row compares the formula with the measured value |
| `App.jsx:949` annotation | — final is 0, so no overshoot to quote | Final value is 0, so overshoot is undefined. |
| `HandOver.jsx:60,82` | → Signal Lab · the same filter, sampled | → Signal Lab · this filter, sampled |
| `HandOver.jsx:364,375` | → Control Lab · the same network, as a plant | → Control Lab · this network as a plant |

## Control Lab

| Where | Now | Rewrite |
|---|---|---|
| `App.jsx:935` tooltip ⚠ | The half of the response the magnitude curve cannot show | Phase of the open loop, on its own axis |
| `App.jsx:956` annotation | no room — this gain is the boundary | Gain margin 0 dB. This gain is the stability boundary. |
| `App.jsx:1056` tooltip ⚠ | Shove the plant's input and watch the loop fight back — the reason feedback exists | Apply the step at the plant input as a disturbance |
| `App.jsx:1095` annotation | not there yet at the plot's right edge | Not settled by the right edge of the plot. |
| `App.jsx:1129` flag | rejected completely — the integrator erases it | Steady-state error 0. The integrator removes the disturbance. |
| `App.jsx:1146` locus readout | you are here: on the axis — sustained oscillation | Current gain: poles on the imaginary axis, sustained oscillation. |
| step-input tabs ⚠ | Shove the plant | Disturbance at plant input |

⚠ verify selectors in `apps/control-lab/scripts/verify.mjs` match the step-input
buttons and the phase toggle by name. Update both in the renaming commit.

## Signal Lab

| Where | Now | Rewrite |
|---|---|---|
| `Controls.jsx:370` empty state | Nothing between the sources and the plots. Add a filter and its response is drawn over the spectrum. | No blocks in the chain. Add a filter to draw its response over the spectrum. |
| `fields.jsx:115` tooltip | Nyquist — the fold point. Exactly here the samples land on the same two phases every cycle: at phase 0° a sine samples its zero crossings and vanishes; drag Phase to 90° and it returns at full amplitude. | Nyquist frequency. Samples land on the same two phases every cycle. At 0° a sine is sampled at its zero crossings and reads zero. Set Phase to 90° and it reads full amplitude. |
| preset name ⚠ | One sine, one line | One sine wave |
| `fields.jsx` | The true square: harmonics forever. Not a bigger number — a different object, and everything above Nyquist folds back | The ideal square wave has harmonics without limit. Every harmonic above Nyquist folds back into the spectrum. |

⚠ `App.smoke.test.jsx:30` asserts `'One sine, one line'`; `readme-claims.test.js`
does not quote preset names. Rename in one commit with the test.

---

## Rules applied here

- Tooltips state what a control does, not why it matters (S9, S14).
- Annotations beside a number are complete sentences with the number in them,
  so a screen reader reaches the same fact as a sighted reader (S6).
- Empty states say what to do next in at most 12 words (budget table).
- No dash carries meaning that a full stop can carry (S3).
