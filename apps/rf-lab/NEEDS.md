# RF Lab: what it needs from elsewhere

`PROGRAM.md` §1 says two overseers who need the same thing write it here and the
director resolves it once. This file is that list for the RF Lab. Nothing in it
is a request to another overseer. Every line is for the director.

## 1. The deploy line

One line for `.github/workflows/deploy.yml`, added at integration.

```
cp -r apps/rf-lab/dist _site/rf-lab
```

`release.test.js` holds this file to carrying that line, in that exact text. It
asserts nothing about the workflow itself, because that file is the director's.
The lab deploys dark at `/rf-lab/`, and `RELEASE_STATUS` reads `dark` until Reed
changes it.

## 2. The progression test

`packages/ui/src/progression.test.js` belongs to the seams overseer. These are
this lab's ids and counts for it.

The slug is `rf-lab`. Nine experiments exist today, in two groups. The plan's
other six groups are later sittings' and their ids do not go into the
progression test until they land.

| Group | Ids | Count |
| --- | --- | --- |
| A The line at one frequency | a1 to a5 | 5 |
| B The Smith chart | b1 to b4 | 4 |

Not built. `RF_LAB_PLAN.md` §9 says which phase each of these waits for, and
`BACKLOG.md` carries them under this lab's heading.

| Group | Ids | Count | Waits for |
| --- | --- | --- | --- |
| C Matching networks | c1 to c5 | 5 | `packages/rf/src/match.js` |
| D S-parameters | d1 to d5 | 5 | the S-parameter view |
| E The transistor near f_T | e1 to e5 | 5 | the Electronics Lab's `smallSignal` |
| F Noise | f1 to f4 | 4 | the Electronics Lab's Group O |
| G Mixers and linearity | g1 to g4 | 4 | `packages/rf/src/linearity.js` |
| H Oscillators and power | h1 to h3 | 3 | `packages/rf/src/leeson.js` |

Cross-references this lab makes into other labs today: none. Group A defines the
characteristic impedance and the propagation constant in its own term panel,
which is Decision 3's fallback, because the Fields Lab's transmission-line group
is not built. Two references land the moment it is:

| From | To | What it would say |
| --- | --- | --- |
| a3 | Fields Lab, transmission lines | where Z_0 and γ come from |
| a5 | Fields Lab, the lossy line | the time-domain answer that does exist |

Cross-references other labs will make into this one, once they are built:

| From | To | What it needs |
| --- | --- | --- |
| Fields Lab | b1, b2 | the Smith chart, which its group I shares |
| Instruments Lab | d1 to d5 | S-parameters, which are not built |
| System Lab | f3, g3 | the cascade budget, which is not built |

## 3. The canvas promotion, recorded rather than argued

`PROGRAM.md` §4 names the Smith chart's three labs, in order: the RF Lab, then
the Fields Lab, then the Instruments Lab. It says a new canvas goes into
`packages/ui` when a second lab will need it, and carries that lab's needs in
its props from the start. Both conditions hold, so the canvas landed in
`packages/ui/src/SmithCanvas.jsx` with `packages/ui/src/SmithCanvas.test.jsx`
beside it and one line added to `packages/ui/index.js`.

This entry records the promotion. `PROGRAM.md` is the director's file and this
lab does not edit it.

**The props, fixed from the first commit.** `RF_LAB_PLAN.md` §4.2 named five and
the file ships six.

| Prop | Whose | What it carries |
| --- | --- | --- |
| `mode` | RF | `'impedance'`, `'admittance'` or `'both'` |
| `z0` | all three | the reference the chart is normalised to, printed on the picture |
| `grid` | all three | the families to draw, as centres and radii |
| `points` | all three | labelled markers, by kind |
| `paths` | Fields, RF | motion along a line, or through a matching network |
| `circles` | RF | the standing-wave, Q, stability, gain and noise families, with a shaded side |
| `rotate` | Instruments | the calibration plane, in degrees towards the generator |

**What the Fields Lab gets.** Its `NEEDS.md` §3.2 asked the director to decide
whether that lab draws a minimal chart in its group I or waits for this one.
This is the answer to the second half of that question. The chart exists, and it
draws two families with one load marker and the rotation towards the generator.
Its arithmetic is that lab's own `zToGamma`, `resistanceCircle` and
`reactanceCircle`, imported by `packages/rf/src/smith.js` rather than written
again.

**What the Instruments Lab gets.** `rotate` moves the marks and leaves the chart
under them alone, which is what a reference-plane offset does. The aria text
says when the plane has moved, so a rotated point is never shown as the raw one.
The S-parameter view that lab also needs is not built, and it is Group D's.

**The styles.** The canvas carries no CSS of its own. The consuming app carries
it, which is `OneLineCanvas`'s arrangement in this suite. A second lab needs the
block below in its own `styles.css`, and it is written out here so the director
can move it into `base.css` in one place if a third lab wants it.

```css
.smith { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 100%; min-width: 0; }
.smith-svg { width: 100%; max-width: 420px; height: auto; display: block; }
.smith-disc { fill: var(--panel); stroke: var(--line-bright); stroke-width: 1.5; }
.smith-grid { fill: none; stroke: var(--line); stroke-width: 0.75; }
.smith-grid.is-r { stroke: var(--line-bright); }
.smith-grid.is-g, .smith-grid.is-b { stroke: rgba(240, 162, 60, 0.35); }
.smith-axis { stroke: var(--line-bright); stroke-width: 1; }
.smith-circle-line { fill: none; stroke: var(--accent); stroke-width: 1.4; }
.smith-circle.is-stability .smith-circle-line { stroke: var(--warn); }
.smith-shade { fill: rgba(255, 92, 122, 0.14); }
.smith-circle-label { fill: var(--dim); font-size: 9px; }
.smith-path { fill: none; stroke: var(--accent); stroke-width: 2; }
.smith-path.is-line { stroke: var(--amber); }
.smith-path.is-dashed { stroke-dasharray: 5 3; }
.smith-point circle { fill: var(--accent); stroke: var(--bg); stroke-width: 1.2; }
.smith-point.is-source circle { fill: var(--amber); }
.smith-point text { fill: var(--text); font-size: 9.5px; }
.smith-edge, .smith-ref { fill: var(--dim); font-size: 9.5px; }
.smith-caption { font-size: 11px; color: var(--dim); margin: 0; }
```

## 4. What Groups E to H need from the Electronics Lab

Plan Decision 4 keeps `EE_LABS_MAP.md` §5's rule about the bench, so nothing is
loaded from a vendor file. The two curated S-parameter sets are generated from a
small-signal netlist this suite solves. That makes the dependency exact rather
than vague, and it is listed here so the director can sequence it.

| Group | Needs | From | State |
| --- | --- | --- | --- |
| E1, E4 | `smallSignal(net, op, { caps: true })` returning the hybrid-π netlist with `C_π` and `C_μ`, and its operating-point label | Electronics Lab Group F and Group K | being built |
| E1 | `transitFreq` and the Miller-loaded pole, so `f_T` is derived rather than quoted | Electronics Lab Group K | being built |
| E2 to E5 | nothing further. Once the netlist exists, `sFromNetlist` converts it to S at each frequency and `stability.js` does the rest | this lab | not built |
| F1, F2 | `noiseDensity` and `noiseSources` over an exactly solved network, at 290 K | Electronics Lab Group O | being built |
| F3, F4 | nothing further. Friis and the noise circles are this lab's `noise.js` and `budget.js` | this lab | not built |
| G1 | an ideal multiplier and a switching mixer. The Gilbert cell that implements them has no built home, and the plan's §1 names that as a decision rather than an omission | Analog IC Lab | not started |
| H1, H2 | the oscillator's amplitude limit, cited rather than rebuilt | Electronics Lab Group N | being built |

Two things the plan asks the director to note. `budget.js` is written here and
the System Lab is named as its second user, which is Decision 2. And the S-
parameter view's second user is the Instruments Lab's network analyser group,
which needs a calibration-plane offset in the view's props from the first
commit, the way `rotate` is in the chart's.

## 5. Nothing else

This lab needs no new element in `packages/network`, no change to any existing
component in `packages/ui`, and no experiment from another lab for the nine that
are built. `packages/rf` is new and this overseer owns it, which
`EE_LABS_MAP.md` §3 records.
