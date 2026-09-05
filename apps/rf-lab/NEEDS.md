# RF Lab: what it needs from elsewhere

`PROGRAM.md` §1 says two overseers who need the same thing write it here and the
director resolves it once. This file is that list for the RF Lab. Nothing in it is a
request to another overseer. Every line is for the director.

## 1. The deploy line

One line for `.github/workflows/deploy.yml`, added at integration.

```
cp -r apps/rf-lab/dist _site/rf-lab
```

`release.test.js` holds this file to carrying that line. It also holds the workflow to
shipping the build at that path or at none, so the two texts cannot drift apart while
the director is adding it. The lab deploys dark at `/rf-lab/`, and `RELEASE_STATUS`
reads `dark` until Reed changes it.

## 2. The progression test

`packages/ui/src/progression.test.js` belongs to the seams overseer. These are this
lab's ids and counts for it.

The slug is `rf-lab`. Nine experiments are built, in two groups. Groups C to H are
later sittings, their ids are listed apart, and they do not go into the progression
test until they land.

| Group | Ids | Count |
| --- | --- | --- |
| A The line at one frequency | a1 to a5 | 5 |
| B The Smith chart | b1 to b4 | 4 |

Not built. `RF_LAB_PLAN.md` §9 says which phase each of these waits for, and
`BACKLOG.md` carries them under this lab's heading.

| Group | Ids | Count |
| --- | --- | --- |
| C Matching networks | c1 to c5 | 5 |
| D S-parameters | d1 to d5 | 5 |
| E The transistor near f_T | e1 to e5 | 5 |
| F Noise | f1 to f4 | 4 |
| G Mixers and linearity | g1 to g4 | 4 |
| H Oscillators and power | h1 to h3 | 3 |

Cross-references this lab makes into other labs today: none. Group A leans on the
Fields Lab's transmission-line group, which is not built, so Decision 3 of the plan
applies. `Z_0` and `gamma` are defined in a term panel and the link stays unmade.

Cross-references to add when the labs they name land:

| From | To | What it needs |
| --- | --- | --- |
| a1 to a5 | Fields Lab i1 to i7 | the telegrapher's equations, `Z_0` and `gamma` |
| a5 | Fields Lab, the bounce diagram | the time-domain answer that does exist |
| b1 to b4 | Fields Lab i5 | the chart, derived where the line is |
| c1, d2 | Circuit Lab | a lumped matching network's S21 as an exact H(s) |
| e1 | Electronics Lab K1 and K3 | `f_T` and the Miller effect |
| f1 | Electronics Lab, Group O | thermal and shot densities |
| f3, g3, g4 | System Lab | the cascade record, through `budget.js` |

Cross-references other labs will make into this one, once its later groups land:

| From | To | What it needs |
| --- | --- | --- |
| Fields Lab, group I | b1 to b4 | the chart, if that group wants to point at it |
| Instruments Lab, the analyser group | d1 to d5 | S-parameters as measured quantities |
| System Lab | f3, g3, g4 | cascaded noise figure and cascaded IP3 |

## 3. The Smith chart, promoted to `packages/ui`

`PROGRAM.md` §4 lists the Smith chart with the RF Lab first and the Fields Lab and
the Instruments Lab second and third. Decision 5 of `RF_LAB_PLAN.md` settles it. The
canvas lands in `packages/ui` from the first commit, with the other two labs' needs
in its props.

**What landed.** `packages/ui/src/SmithCanvas.jsx` and
`packages/ui/src/SmithCanvas.test.jsx`, with one export line added to
`packages/ui/index.js`. That is a shared-surface change under `PROGRAM.md` §5, which
gives `packages/ui` to the director by request, and this section is the request. The
canvas comes with its test and both second users named, as that row requires.

**The props, fixed from the first commit.** The plan's §4.2 names five.

```jsx
<SmithCanvas
  mode="z"                 // 'z' | 'y' | 'both'
  normalise={50}           // the reference impedance, printed on the chart
  points={[{ id, gamma, label, kind }]}
  paths={[{ id, points, label, kind }]}
  circles={[{ family, value, cx, cy, radius, label }]}
  caption="…"
/>
```

**What each second user needs, and where it is in the test.** The Fields Lab's
transmission-line group passes one load and the rotation towards the generator, drawn
by `points` and `paths`. Its case is "draws the Fields Lab's load and its rotation
towards the generator". The Instruments Lab's network analyser group passes circles
of families this canvas does not know, so `family` is a class name and a label and is
never switched on. Its case is "draws a family it has never heard of".

**The arithmetic is not in the canvas.** Every centre and radius arrives as a number
from `packages/rf/src/smith.js`, which takes the map and the two impedance families
from `packages/fields/src/line.js`. The Fields Lab's `NEEDS.md` §3.2 asked for that
decision before the drawing existed, and this is the answer. There is one set of
circles in the suite, and one file that computes it.

**Styling.** The canvas carries class names and no colours, as `OneLineCanvas.jsx`
does. The rules live in `apps/rf-lab/src/styles.css` until a second lab draws one,
and then they move to `packages/ui/src/base.css`.

## 4. The S-parameter view, not drawn yet

The plan's §4.2 names a second shared canvas, four magnitude traces against frequency
with a marker and a polar toggle, with the Instruments Lab's network analyser group
as its second user. It belongs to Group D, which is a later sitting.

Nothing is drawn yet. The entry is here so that the decision is taken before the
drawing exists. What that group's props must carry from its own first commit is a
calibration-plane offset, because that is what the Instruments Lab needs and cannot
add afterwards.

## 5. What Groups E to H need from the Electronics Lab

Decision 4 of the plan generates the two curated device sets from a small-signal
netlist this suite solves, rather than from a vendor file. That netlist is the
Electronics Lab's, and it is being built on `lab/electronics-lab`.

- **Group E** needs `smallSignal` and `transferOf` at a stated operating point. It
  also needs the Electronics Lab's Group K, for `f_T` and the Miller effect. The RF Lab converts
  the result to S with `sFromNetlist` and states the operating point on the label, as
  the Electronics Lab requires.
- **Group F** needs the Electronics Lab's Group O, which gives thermal and shot
  densities through an exactly solved network. This lab's `noise.js` is the two-port
  description on top of those, and it is not written.
- **Group G** needs nothing unbuilt. The Signal Lab's nonlinearity group is built,
  and `packages/dsp` has the FFT the two-tone test reads.
- **Group H** needs the Electronics Lab's Group N for the oscillator's amplitude
  limit. Its `leeson.js` is a labelled model and depends on nothing.

The director decides when the Electronics Lab's small-signal output is stable enough
for Group E to be generated from it. Until then the device sets do not exist in this
tree, and no lesson names them.

## 6. The Gilbert cell, with no home

The plan's §1 names it. Group G1's mixer is an ideal multiplier and a switching
mixer, with the Gilbert cell named as the circuit that implements them. The Analog IC
Lab is mapped and not started, so the cross-reference has nowhere to point. Nothing is
blocked, and the entry is here so that the omission is a decision.

## 7. Nothing else

This lab needs no new element in `packages/network`, and no change to any existing
component in `packages/ui`. Its built dependencies are `@ee-labs/network` and
`@ee-labs/fields`, and both are in the tree.
