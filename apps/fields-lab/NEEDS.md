# Fields Lab: what it needs from elsewhere

`PROGRAM.md` §1 says two overseers who need the same thing write it here and the
director resolves it once. This file is that list for the Fields Lab. Nothing in
it is a request to another overseer. Every line is for the director.

## 1. The deploy line

One line for `.github/workflows/deploy.yml`, added at integration.

```
cp -r apps/fields-lab/dist _site/fields-lab
```

`release.test.js` holds this file to carrying that line. It also holds the
workflow to shipping the build at that path or at none, so the two texts cannot
drift apart while the director is adding it. The lab deploys dark at
`/fields-lab/`, and `RELEASE_STATUS` reads `dark` until Reed changes it.

## 2. The progression test

`packages/ui/src/progression.test.js` belongs to the seams overseer. These are
this lab's ids and counts for it.

These are the ids that exist today. The slug is `fields-lab` and the total is
36. Groups I to L are planned and not built. Their ids are listed apart, and
they do not go into the progression test until they land.

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

Not built. `FIELDS_LAB_PLAN.md` §9.1 says which sitting each of these waits for,
and `BACKLOG.md` carries them under this lab's heading.

| Group | Ids | Count |
| --- | --- | --- |
| I Transmission lines | i1 to i7 | 7 |
| J The lossy line | j1, j2 | 2 |
| K Waveguides and the cavity | k1 to k3 | 3 |
| L Antennas | l1 to l5 | 5 |

Cross-references this lab makes into other labs, which the progression test
should hold:

| From | To | What it says |
| --- | --- | --- |
| b1 | Circuit Elements Lab F | the capacitor as an element, given a value here |
| e4 | Circuit Elements Lab F | the inductor as an element, given a value here |

Two more arrive with group I and are not to be added before it. One is i5 into
Circuit Lab, for the same sweep with length on the axis. The other is j1 into
that lab, for a frequency response on a line instead of on a network.

Cross-references other labs will make into this one, once they are built:

| From | To | What it needs |
| --- | --- | --- |
| RF Lab | i1 to i7 | the transmission-line group, which is not built |
| System Lab | l5 | Friis and the link budget, which is not built |
| Power Lab group D | e5, e6 | the magnetic circuit it assumes, which is built |
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

### 3.2 The Smith chart, not drawn yet

The RF Lab owns the Smith chart in `PROGRAM.md` §4, with the Fields Lab and the
Instruments Lab second. The RF Lab is not built and is blocked on this lab's
group I, so the chart cannot be borrowed.

**Nothing is drawn yet.** Group I is not built either, and the chart belongs to
it. This entry is here so the decision is taken before the drawing exists rather
than after.

The arithmetic is already in the package and will not be in the canvas.
`packages/fields/src/line.js` holds `zToGamma`, `gammaToZ`, `normalise`,
`resistanceCircle`, `reactanceCircle` and `towardsGenerator`, all tested. The RF
Lab inherits the mathematics whatever it does with the drawing.

**The director's decision.** Either this lab draws a minimal chart in group I's
sitting and the RF Lab adopts it, or this lab draws none and waits for the RF
Lab's. The plan recommends the first. Minimal means the two circle families, one
load marker and the rotation towards the generator, and nothing of matching
networks, admittance overlays or constant-Q arcs. Two charts in the suite would
be two sets of circles that drift apart.

## 4. The events package

`EE_LABS_MAP.md` §3 says the Fields Lab's lossless line runs on `events`, and §4
says the Logic Lab builds that package. The Logic Lab is being built in
parallel, so `@ee-labs/events` was not available for this sitting.

`packages/fields/src/bounce.js` carries a self-contained event loop instead. It
is about seventy lines. A wave record is `{ amp, dir, launchedAt, arrivesAt,
from, xStart }`, which is the shape an events queue carries, so the swap is a
rewrite of the loop and not of the module. Nothing in the app or the lessons
touches the loop directly, and group I is not built yet, so today the loop has
no caller outside its own tests.

**What this lab asks for.** When `@ee-labs/events` lands, the director decides
whether the bounce diagram moves onto it. The behaviour must not change. The
diagram is exact today, its steady state equals the direct-current divider to
floating point, and any replacement has to keep both.

**What the events package would need to carry.** A queue of events at exact
times. A reflection rule at each end. A query for the state at a position and a
time. The last of those is the one a general events engine may not have. The
line's answer at a point is the sum of the waves that have reached it, rather
than the value of a signal at that instant.

## 5. The field map, if a third lab wants it

Every picture groups G and H draw is the field map's profile mode. A plane wave
against distance, a standing wave in front of a boundary, and two Fresnel
coefficients against an angle are each one scalar against one axis with regions
marked. That is worth knowing before the canvas is promoted, because it says the
profile mode is not a favour to the Devices Lab. It is the shape most
one-dimensional pictures in this suite already have.

## 6. Three findings from the first verification sitting

The Playwright harness had never been run against a browser. Running it, and
reading a screenshot of every view as a student would, turned up three things
this lab cannot fix inside its own directory.

### 6.1 The lab is in no suite list, so it deploys with no way back

`REVIEW_PLAYBOOK.md` §11 says to run each harness against the layout a student
loads. Assembled and served at `/fields-lab/`, this lab's page carries exactly
the same 162 elements as the bare preview does, because it is in neither list
the cross-lab chrome reads:

- `packages/ui/src/deeplink.js`'s `APPS` is `['signal-lab', 'circuit-lab',
  'control-lab', 'circuit-elements-lab', 'power-lab']`. With `fields-lab`
  absent, `homeUrl()` and `siblingUrl()` both return null on the deployed path
  as well as on a bare port, so `LabNav` renders nothing at all. A reader who
  lands on the Fields Lab has no link back to the splash page and no link to a
  sibling.
- `scripts/assemble-site.mjs`'s `LABS` does not list `fields-lab` either, while
  `.github/workflows/deploy.yml` already carries the `cp` line §1 asks for. The
  playbook says that script mirrors the workflow's assembly step and the two
  move together. They have drifted. Assembling this lab today needs
  `--labs fields-lab` on the command line.

Both files are the director's. Adding `fields-lab` to both is one edit each,
and it is what makes §1's deploy line reach a reader.

### 6.2 A bare number typed into a metres field can be read a thousand-fold out

`packages/ui/src/NumField.jsx` in engineering mode reads a bare number in the
prefix on display. That is right, and `engEcho` announces what it did. The trap
is the unit strip in `parseEng`. The caller's own unit is stripped before the
prefix is read. So a field whose unit is `m` reads a typed "1.475m" as bare
1.475, and then reads that in the prefix already on screen. In a field showing
micrometres the result is 1.475 µm, a thousand times out. The echo line says
nothing, because it sees no typed prefix.

Every length knob in this lab has the unit `m`, so every one of them is
exposed. `parseEng`'s own comment says a unit that collides with a prefix
letter has to be spelled out by the caller. Here `m` is that collision. Two
fixes are open to the director. Strip the caller's unit only when what remains
still parses, or have a field whose unit is a prefix letter pass a spelled-out
name.

### 6.3 The phone has no tab bar

Circuit Elements Lab's phone layout ends with a fixed bar naming the four parts
of the page. The knobs are one tap away from the plot there. This lab copied
the dissolved sidebar and not the bar. At 390 px its note, its try line and its
view switch are now all in the first screen. That is the released lab's own
standard, and `verify.mjs` measures it. The first knob is still a scroll below
the view.

The bar is four buttons and a `scrollIntoView`. It names the same four parts in
every lab, so it is a candidate for `packages/ui` rather than a fourth copy.

## 7. Nothing else

This lab needs no new element in `packages/network` and no experiment from
another lab. Its only external dependencies are Circuit Elements Lab and
Circuit Lab, and both are built.
