# Fields Lab: what it needs from elsewhere

`PROGRAM.md` §1 says two overseers who need the same thing write it here and the
director resolves it once. This file is that list for the Fields Lab. Nothing in
it is a request to another overseer. Every line is for the director.

## 1. The deploy line

One line for `.github/workflows/deploy.yml`, added at integration.

```
cp -r apps/fields-lab/dist _site/fields-lab
```

`release.test.js` already checks for it, and that test is red until the line
lands. The lab deploys dark at `/fields-lab/`, and `RELEASE_STATUS` reads `dark`
until Reed changes it.

## 2. The progression test

`packages/ui/src/progression.test.js` belongs to the seams overseer. These are
this lab's ids and counts for it.

| Group | Ids | Count |
| --- | --- | --- |
| A Charge and the field | a1 to a5 | 5 |
| B Capacitance | b1 to b5 | 5 |
| C Laplace on a grid | c1 to c5 | 5 |
| D Current and resistance | d1 to d4 | 4 |
| E Magnetostatics | e1 to e6 | 6 |
| F Induction | f1 to f4 | 4 |
| G Maxwell and the plane wave | g1 to g4 | 4 |
| H Reflection at an interface | h1 to h3 | 3 |
| I Transmission lines | i1 to i7 | 7 |
| J The lossy line | j1, j2 | 2 |
| K Waveguides and the cavity | k1 to k3 | 3 |
| L Antennas | l1 to l5 | 5 |

The slug is `fields-lab` and the total is 53.

Cross-references this lab makes into other labs, which the progression test
should hold:

| From | To | What it says |
| --- | --- | --- |
| b1 | Circuit Elements Lab F | the capacitor as an element, given a value here |
| e4 | Circuit Elements Lab F | the inductor as an element, given a value here |
| i5 | Circuit Lab | the same sweep with length on the axis |
| j1 | Circuit Lab | frequency response, on a line instead of a network |

Cross-references other labs will make into this one, once they are built:

| From | To | What it needs |
| --- | --- | --- |
| RF Lab | i1 to i7 | the whole transmission-line group |
| System Lab | l5 | Friis, and the link budget |
| Power Lab group D | e5, e6 | the magnetic circuit it assumes |
| Devices Lab B1 | a3 | Gauss's law, which that lab states and this one derives |

## 3. Promotion candidates

Two canvases built in this app that a second lab has already claimed.
`PROGRAM.md` §4 says a new canvas goes into `packages/ui` when a second lab
needs it, and carries that lab's needs in its props from the start. Both do.

### 3.1 The field map, `src/components/FieldMapCanvas.jsx`

First lab: Fields Lab. Second lab: Devices Lab, named in `PROGRAM.md` §4.

**The second lab's requirement, from the director and from
`/DEVICES_LAB_PLAN.md` Decision 5.** The canvas takes `mode: '2d' | 'profile'`.
The profile mode draws a scalar against one spatial axis, with region boundaries
marked, and an optional second scalar on a right axis. The Devices Lab's own use
is a stacked triple of charge density, field and potential over one position
axis, with the depletion edges marked, and a bias knob that redraws all three.

That shape is built in from the first commit and is not a later addition:

```js
profile: {
  axis,        // 'x' or 'y', the spatial axis the curve runs along
  cut,         // the cut's position in the other coordinate, in metres
  scalar:    { read(t), label, unit },        // the left axis
  secondary: { read(t), label, unit } | null, // the right axis, optional
  regions:   [{ from, to, label, edge }],     // boundaries drawn as marked lines
  stack:     [{ scalar, secondary, regions }] | null, // panels over one position axis
}
```

Every panel in a stack shares the position axis and its ticks, so one knob moves
all of them together. `regions` is what draws a depletion edge.

**What promotion needs.** Move the file to `packages/ui/src/FieldMapCanvas.jsx`,
export it from `packages/ui/index.js`, and move
`components/FieldMapCanvas.test.jsx` beside it. The canvas imports nothing from
this app. It takes readers and data, and it draws what it is given.

### 3.2 The Smith chart, `src/components/SmithCanvas.jsx`

First lab in the map: RF Lab. `PROGRAM.md` §4 lists the Fields Lab and the
Instruments Lab as second. The RF Lab is not built and is blocked on this lab's
group I, so the chart could not be borrowed and was built here instead.

This is a minimal chart. It draws the two circle families, one load marker, and
the rotation towards the generator. It does not draw matching networks,
admittance overlays or constant-Q arcs, which are the RF Lab's work.

The arithmetic is already in the package and not in the canvas.
`packages/fields/src/line.js` holds `zToGamma`, `gammaToZ`, `normalise`,
`resistanceCircle`, `reactanceCircle` and `towardsGenerator`. The RF Lab
inherits the mathematics whatever it does with the drawing.

**The director's decision.** Either the RF Lab adopts this canvas when it is
built, or it builds its own and this one is deleted. Two charts in the suite
would be two sets of circles that drift apart.

## 4. The events package

`EE_LABS_MAP.md` §3 says the Fields Lab's lossless line runs on `events`, and §4
says the Logic Lab builds that package. The Logic Lab is being built in
parallel, so `@ee-labs/events` was not available for this sitting.

`packages/fields/src/bounce.js` carries a self-contained event loop instead. It
is about seventy lines. A wave record is `{ amp, dir, launchedAt, arrivesAt,
from, xStart }`, which is the shape an events queue carries, so the swap is a
rewrite of the loop and not of the module. Nothing in the app or the lessons
touches the loop directly.

**What this lab asks for.** When `@ee-labs/events` lands, the director decides
whether the bounce diagram moves onto it. The behaviour must not change. The
diagram is exact today, its steady state equals the direct-current divider to
floating point, and any replacement has to keep both.

**What the events package would need to carry.** A queue of events at exact
times. A reflection rule at each end. A query for the state at a position and a
time. The last of those is the one a general events engine may not have. The
line's answer at a point is the sum of the waves that have reached it, rather
than the value of a signal at that instant.

## 5. Nothing else

This lab needs no new element in `packages/network`, no change to
`packages/ui`'s existing components, and no experiment from another lab. Its
only external dependencies are Circuit Elements Lab and Circuit Lab, and both
are built.
