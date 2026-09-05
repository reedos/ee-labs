# What the Electronics Lab needs from outside its own directory

The lab lives in `apps/electronics-lab/` and `packages/network/`. One shared
surface was touched, and it is listed first. Everything under "at release" is
deliberately not done while `RELEASE_STATUS` says `dark`, and
`src/release.test.js` fails if any of it is.

## Electronics overseer

### 1. The deploy line

`.github/workflows/deploy.yml` needs one line, after the Circuit Elements Lab's:

```
cp -r apps/electronics-lab/dist _site/electronics-lab
```

The lab then ships unlinked at `/electronics-lab/` for review. `release.test.js`
does not pin the line, because until the director integrates this branch the
line does not exist and this test must not require an action that is not the
overseer's to take.

### 2. The progression test

`packages/ui/src/progression.test.js` belongs to the seams overseer. The
Electronics Lab's entry today is:

- Slug `electronics-lab`, splash glyph `⊳`, short nav name **Electronics**.
- **10 experiments in 2 groups.** Group A, "the op-amp as a user meets it", ids
  `a1` to `a6`. Group C, "inside the junction", ids `c1` to `c4`.
- No cross-lab reference by id in either direction yet. The lab's own
  `experiments.test.js` fails on a lesson that cites an experiment id this lab
  does not carry, so the references the plan lists for Groups D to O arrive
  with those groups.

The count moves as groups land. Whoever adds Group D onward updates this entry
in the same commit.

### 3. `@ee-labs/random`, for Group O

Group O should import the Random Signals Lab's package rather than write a
second generator or a second periodogram. That lab is built and merged, and its
brief freezes the contracts. The dependency to add to
`apps/electronics-lab/package.json` when Group O is built:

```json
"@ee-labs/random": "*"
```

O1 calls `whiteNoise` and `averagedPeriodogram`, O2 calls `capacitorNoise`, O3
calls `shotDensity`. The sources side is already built here:
`packages/network/src/noise.js` holds `thermalCurrent`, `shotCurrent`,
`noiseSources`, `noiseDensity`, `noiseRms` and `ktOverC`, fuzzed against
invariant 9 in `noise.test.js`. The two packages meet at the number, not at the
code: Random Signals makes a random signal in time, this one makes densities on
a netlist.

### 4. A transistor symbol in `packages/ui/src/Schematic.jsx`

**This is what stops Groups D to O, and it is a shared surface this overseer
does not own.** The renderer draws two-terminal symbols on the segment
(−20, 0)…(20, 0) plus the op-amp's triangle as a special case. A transistor has
three terminals and no symbol. Every experiment past Group C has one on screen,
and the schematic is the one pane that is always visible, so the groups cannot
ship without it.

The contract, which is the plan's §3 and needs a test and a second lab named
(`PROGRAM.md` §4):

- Four glyphs: NPN and PNP, NMOS and PMOS, chosen by `e.type` (`Q` or `M`) and
  `e.polarity`.
- A layout item `{ el, x, y, dir, flip }` as today. The base or gate sits on
  the left at (x − 20, y). The collector or drain sits at (x + 12, y − 20) and
  the emitter or source at (x + 12, y + 20). A vertical device then stacks
  between two rails.
- The same live-meter slots every other element has. A `schematicGeometry`
  entry gives the body box and the label and reading places, so
  `layoutCheck.js` can check a drawing that carries one.
- Second labs: the Analog IC Lab and the VLSI Lab, both of which are planned
  around this element (`BACKLOG.md` §4). The Devices Lab needs the same glyph
  for its junction group.

Until it lands, the lab ships Groups A and C, which need no transistor on the
drawing.

The transistor symbol has landed in `Schematic.jsx` and `schematicGeometry.js`.
Four glyphs draw from `e.type` (`Q` or `M`) and `e.polarity`: NPN, PNP, NMOS
and PMOS, one row per glyph in a shared table. The layout item is unchanged,
`{ el, x, y, dir, flip }`, with `dir` and `flip` rotating and mirroring it
like any other element. `meters.i[id]` gives the collector or drain current
by default. `schematicGeometry.js` exports `transistorPinPlaces`,
`transistorBodyBox` and `transistorTextPlaces` for a layout checker to use.
Pin coordinates for all four glyphs under every dir and flip are pinned in
`schematicGeometry.test.js`, and one Q and one M render together in
`Schematic.test.jsx`. Wiring these exports into `layoutCheck.js` is for
whichever lab draws a transistor first.

### 5. Numbers this lab found that other plans quote

Two figures move, and the labs that quote them should quote the measured ones:

- **The CE stage's poles.** The brief's §3.4 numbers, 547.76 kHz and
  336.69 MHz, are the textbook hybrid-π, with `r_o = V_A/I_C` and
  `r_π = β/g_m`. The tangent of the exponential device carries the Early effect
  in both, which is a factor of (V_A + V_CE)/V_A on each, and gives 539.55 kHz
  and 336.51 MHz. Both are tested in `transfer.test.js`. The RF Lab's Group E
  and the Analog IC Lab quote the first pair.
- **The CE stage's noise figure.** The plan's O4 pins 0.41 dB at a source
  resistance of 259 Ω, which is the textbook's 1 + 1/√β. The circuit gives
  0.455 dB at 258.5 Ω, because that closed form sends the base's noise current
  through `R_s` alone and in the circuit `r_π` sits across the same node. The
  System Lab and the Photonics Lab quote this figure.

### 6. Four failures in other labs, all of them clocks

A whole-suite run on this branch is green except for four tests in two files
this lab does not touch. None of them is an assertion about physics.

- `apps/circuit-elements-lab/src/experiments.test.js`, three tests: the math
  panel walk, the headline walk and the callout walk. Each fails with "test
  timed out", at 180 s, 90 s and 90 s. The callout walk alone takes 112 s on
  this machine. The Random Signals overseer recorded the same file's timeouts
  in `BACKLOG.md` before this branch existed.
- `apps/power-lab/src/experiments.test.js`, one test: "a sweep is worth about
  the solves in it" measures a ratio of wall-clock times and wants it under
  150. It reads 209 here.

Both are measurements of how fast this machine is, and this machine is running
many agents at once. The owning labs decide whether to lengthen the limit,
shorten the walk or split it. Nothing in this lab's own suite is near a limit:
`packages/network` runs in 99 s and `apps/electronics-lab` in 9 s.

## At release: flip `RELEASE_STATUS` to `released`, then `release.test.js` demands

1. **Splash page** `site/index.html`: a lab card linking `electronics-lab/`, in
   the style of the other cards.
2. **README** `README.md`: a row in *The tools* table. The lab covers the
   op-amp's limits, the junction, and (as they land) the transistor, bias,
   small signals, ports, amplifiers, frequency response, feedback, oscillators
   and noise, with the experiment count at the time.
3. **Nav** `packages/ui/src/LabNav.jsx`: `{ id: 'electronics-lab', label:
   'Electronics' }` in `LABS`. Until then the lab passes
   `currentLabel="Electronics"` so its own nav names it without the released
   labs listing it back. This is also where the nav fold of the plan's Decision
   5 lands, because a sixth lab is what makes the fold necessary.
4. **Usage counter** `apps/electronics-lab/index.html`: the GoatCounter tag the
   other labs carry. Add the page to the pinned list in
   `packages/ui/src/analytics.test.js` at the same time.

## For `BACKLOG.md`, under `### Electronics Lab` (append only)

`BACKLOG.md` is not on this branch. Its text is here for the director to
append, rather than edited into a file this branch does not carry.

- **Groups D to O are not built.** They wait on a transistor symbol in
  `packages/ui/src/Schematic.jsx`, which is a shared surface (item 4 above).
  The engine they need is built and green: `Q` and `M`, the companion
  interface, `smallSignal`, `transferOf`, `returnRatio`, `macro.js`,
  `junction.js` and `noise.js`, with invariants 1 to 9 of the plan's §2.12
  fuzzed. Reopens with the symbol.
- **Elements I9, I10 and H7 are the seams overseer's**, and this lab's Group B
  is I9 and I10 by Decision 3. Nothing here references them by id, so the
  progression test stays green until they land.
- **C4's cross-reference to Group E** was removed rather than left dangling.
  Its note named E4, the bias point's drift with temperature, which is not
  built. Reopens with Group E, and the sentence to restore is in
  `apps/electronics-lab/src/lessons/c.js`.
- **The Playwright harness has not been run.** `scripts/verify.mjs` is not
  written either. This environment has no browser. The layout is checked as
  geometry instead, in `layoutCheck.js`, which catches what the first
  screenshots of the Elements lab caught. No one has read a screenshot of this
  lab as a student would (`REVIEW_PLAYBOOK.md` §11). Reopens with anyone who
  has a browser.
- **The op-amp macro is ready for the two labs that asked for it.** Circuit
  Elements Lab's deferred GBW toggle and Circuit Lab's gain-bandwidth knob are
  both `gbw` on the `OPAMP` element, which expands at `normalize` and needs no
  change in either lab's solver.

## Seams overseer

Lanes 4, 5 and 7 of `AGENT_BRIEF.md` §1: Elements H7, I9 and I10, the Circuit Lab
impulse lesson, and `packages/ui/src/progression.test.js`.

- **A second trace on Circuit Lab's step view**, so the impulse lesson can draw h(t)
  beside the step it is the slope of. Owned by `apps/circuit-lab/src/components/` and
  `stepReadout.js`, neither of which the seams overseer owns. Meanwhile the note says
  h(t) is the step's own slope and `lessons.test.js` measures a centred difference of
  the drawn step against the closed form, so the claim holds without the picture.

- **Quantity paths for a mean over a cycle and for a cycle's peak**, so that Elements
  I9 and I10 can pose a predict question. `readQuantity` in the Elements `lessons.js`
  would gain the paths, and `unitOf` and `nameOf` in `predict.js` would have to name
  them. That second file is not the seams overseer's. Meanwhile `predict.test.js` lists
  the two as posing no question and says why.

- **An s-plane view for Elements H7.** `PoleZeroCanvas` is in `packages/ui` and the
  experiment's roots are exactly what it draws. A new Elements view is a change to the
  app's view registry and its components, outside this lane. Meanwhile H7 reads the
  roots as numbers in the state view and as two distances in the math panel, and the
  test pins them against Circuit Lab's own poles to 1e-9.

- **A sentence in `CURRICULUM.md` §2's Power Lab section naming `POWER_LAB_PLAN.md`,**
  as the Electronics section names its own plan. The progression test needs a plan file
  for every lab with a planned row. It reads the Electronics one out of the document and
  checks that the two agree. It carries Power's in its own table, because the document
  does not say it. Only the Elements and Circuit Lab counts in that document are the
  seams overseer's.

- **A decision on Electronics Group B.** The brief's lane 4 built the clamper and the
  doubler as Elements I9 and I10, and `ELECTRONICS_LAB_PLAN.md` still specifies them as
  B1 and B2 inside the Electronics total of 77. The progression test is satisfied either
  way, because a planned row need only be specified in a plan. Until the director says
  which lab owns them, the two circuits are counted twice.

- **Three counts outside `CURRICULUM.md` are now behind the code.** `EE_LABS_MAP.md`
  §1 says 55 for the Elements lab and 15 for Circuit Lab, `ANALOG_ROADMAP.md`'s tier 0
  row says "55 + 15, plus two seam experiments", and `PROSE_REWRITE_PROPOSAL.md` says
  55 lessons. The right numbers are 58 and 16, and the two seam experiments are no
  longer a promise. All three are the director's maps and roadmaps, and only the
  Elements and Circuit Lab counts in `CURRICULUM.md` are this lane's. The progression
  test reads `CURRICULUM.md` alone, so it cannot catch these.

- **Two shared surfaces were changed by one number each, and the director should
  review it.** Circuit Lab is released, and both `README.md` and `site/index.html`
  quote its size. Its sixteenth experiment made both wrong, and
  `apps/signal-lab/src/readme-claims.test.js` fails on exactly that. `PROGRAM.md` §5
  gives those two files to the director in a release commit. The change made here is
  "15 experiments, 10 circuits" to "16", in one line of each file, and nothing else.
  The alternative was to hand back a red suite.

- **A stray export in the Elements lab.** `headlines.js` exports `lastGap`, and
  nothing imports it. It is near enough to `lastBlock` in the same lab's `math.js`
  that one of the two should go. Both files belong to the Elements lab rather than to
  this lane.

- **Power Lab has three tests that a shared machine can fail.** `experiments.test.js`
  compares a sweep's cost against one solve, and `App.smoke.test.jsx` mounts every
  experiment inside sixty seconds. Six worktrees ran vitest at once on four cores here.
  The sweep ratio came out 427 against a cap of 400 on one run and 186 against 150 on
  the next. Both smoke tests timed out once and passed once. None of the three reads a
  file this lane touched. The ratio is the one to look at first, since it is only fair
  when both halves meet the same load.

- **A row per new lab in `packages/ui/src/progression.test.js`.** Its `LABS` table names
  every lab's own list, its group names, and its plan file. A lab that adds ids to
  `CURRICULUM.md` without a row here is not checked at all. That file belongs to the
  seams (`PROGRAM.md` §5), so the request comes through this file.

## Groups N and O

Oscillators and noise, built as one lane. Both groups are in the app and
green. What follows is what the lane could not do inside its own files, and
what it decided differently from the plan.

### 7. The dependency Group O needed, and where it went

`apps/electronics-lab/package.json` gained `"@ee-labs/random": "*"`, which is
item 3 of this document arriving. O1 calls `whiteNoise` and
`averagedPeriodogram` from it and reads `asd`, `integral`, `flatness` and
`relativeSe`, which is the shape that lab's `psd.js` froze for this caller.
Nothing else in the group imports it. The sources side is `packages/network`'s
`noise.js`, unchanged.

### 8. Registry files the two groups had to touch

A group cannot be reached from the app without an entry in each registry. The
lane owns `groups/n.js`, `groups/o.js`, their terms and math files, the two
lesson files and `components/NoiseCanvas.jsx`. Everything below is one import
line and one entry per group in a file the lane does not own, and the director
should check that no other lane wrote the same lines.

- `src/experiments.js`: two imports, two `GROUPS` entries, two spreads into
  `RAW`, and the `noise` view added to `VIEW_ORDER` and `VIEW_LABELS`.
- `src/lessons.js`: two imports of the lesson files, two of the measuring
  functions, two spreads into `LESSONS`, and two cases in `readQuantity` for
  the `osc.` and `noise.` paths. Both cases delegate to the group's own file,
  so no physics moved into `lessons.js`.
- `src/terms.js` and `src/mathEntries.js`: one import and one spread each.
- `src/components/panes.jsx`: one import and one entry in `PANES`, for the
  noise view.

`src/math.js` is untouched. Every quantity the two groups measure is computed
in `groups/n.js` or `groups/o.js` from the analysis object, so `analyse` did
not have to learn about oscillators or noise.

### 9. The transistor geometry `layoutCheck.js` still does not know

`packages/ui` has the transistor symbol (item 4 above), and
`schematicGeometry.js` exports `transistorPinPlaces`, `transistorBodyBox` and
`transistorTextPlaces` for it. `apps/electronics-lab/src/layoutCheck.js` does
not use them. It sends a `Q` or an `M` through `elementBodyBoxes` and
`elementTextPlaces`, which describe a two-terminal symbol. That is a box of
±20 by ±9 rather than ±20 by ±20, and a label 24 below rather than 34. A
layout carrying a transistor would pass the geometry test while the drawing
overlapped on screen.

Neither group draws one. Groups N and O are op-amps, passives and controlled
sources throughout, and Group O's amplifiers are drawn as their own tangent
(item 11). Whichever lane draws the first transistor should wire those three
exports into `collect` in `layoutCheck.js`. Until then the check is quietly
weaker than it looks.

### 10. The progression test entry, updated

`packages/ui/src/progression.test.js` belongs to the seams overseer. The
Electronics Lab's entry becomes **19 experiments in 4 groups**:

- Group A, "the op-amp as a user meets it", ids `a1` to `a6`.
- Group C, "inside the junction", ids `c1` to `c4`.
- Group N, "oscillators", ids `n1` to `n4`.
- Group O, "noise", ids `o1` to `o5`.

No lesson in either group cites an experiment by id outside the four groups
built here, so the progression test stays green.

### 11. Three places the engine disagreed with the plan, or the lane did

**N4's transistor is drawn as its tangent.** The plan's N4 is a Colpitts with
the three-region BJT and is marked a stretch, for the reason §2.8 gives. The
exponential device has no closed-form answer in time. The lane built the same
tank driven by a transconductance with a current limit, which is what
`smallSignal` makes of the transistor, and the limit is piecewise-linear so
`pwlTransient` solves the amplitude exactly. The frequency, the tap fraction
and the growth rate are all measured against closed forms. What is not built
is the device's own curvature, and reopening it needs the transistor geometry
of item 9.

**N2's limiter is the rails rather than a diode pair.** The plan allows
either. The rails are exact under `pwlTransient`, and the amplitude comes out
as the supply to floating point. The distortion then runs from 0.73 % at a
gain of 3.02 to 24.1 % at four, which is the trade the experiment exists to
show. A diode limiter would need two more elements on a drawing that is
already 480 units wide.

**O4 and O5 draw the hybrid-π rather than the transistor.** A noise density is
a small-signal quantity and the sources sit on the small-signal netlist, so
the circuit on screen is the netlist the stack is a stack over. This is also
what `packages/network`'s own `noise.test.js` does for the same stage. The
figures agree with it: 1.1105, or 0.455 dB, at a source resistance of 258.5 Ω,
which is the number item 5 of this document already records.

### 12. Two canvases the plan asked for, one of them built

The plan's §4.2 lists a spectrum pane and a noise pane. The lane built the
noise pane, `components/NoiseCanvas.jsx`, in the two shapes Group O needs. The
spectrum pane is still the app shell's stub. `panes.jsx` draws `x.spectrum`
and nothing sets it. N2's and N3's harmonics are measured in `groups/n.js` by
correlating whole settled periods against their own fundamental, and the
distortion is printed in the math panel, but there is no picture of the
harmonics. Whoever builds Group M's output stage will want that pane, and the
numbers are already there to draw.

### 13. What the sittings should look at first

- **The noise pane has not been read as a student would.** No browser has run
  in this environment. Its data is checked, and its geometry is not. Every
  curve is finite, the pane renders, and the numbers agree with the panel.
- **Two layouts are 480 by 190 rather than the lab's 420 by 180.** N1 and N2
  carry eight elements and five named nodes, and at 420 a reading lands on a
  symbol. On a 390 px phone that is a 23 % shrink of every label. If it reads
  badly, the fix is to move the Wien network's parallel arm onto a second row
  rather than to widen the canvas further.
- **N2's frequency is 1562.5 Hz where the network alone would set 1591.5 Hz.**
  That is the rail-limited loop and the lesson states it, but it is the one
  number in the two groups a reader is most likely to query.
- **O1's circuit is a prop.** The generator and its load are drawn and solved,
  and nothing the pane or the lesson quotes comes off that solve. The density,
  the spread and the integral are all properties of the record
  `@ee-labs/random` makes. `R_L` therefore changes no number the experiment
  states. Whoever reads this one on screen should decide whether the drawing
  earns its place or whether the load should set something.

### 14. What the review changed, and in whose files

The lane's own files carry the fixes. Three edits landed outside them, all in
the app shell's lane and none in a shared surface.

- `src/App.jsx`: the sidebar's one line read "19 experiments, from the op-amp
  a user meets to the junction underneath it", which stopped describing the
  lab when the oscillators and the noise landed. It reads off `GROUPS` now, so
  it follows the registry. That is the first item of `REVIEW_PLAYBOOK.md`.
- `src/experiments.test.js`: the lab had no KaTeX check on its math panel, so
  a formula that lost a backslash would have shipped as red literal text. One
  test now typesets every entry, for Groups A and C as well.
- `src/components/NoiseCanvas.jsx` is the lane's own, and its per-source lines
  were all one colour with no names. The loudest four take a colour each and
  are named in the canvas.

### 15. Two claims the engine cannot yet measure

- **`returnRatio` declines an `OPAMP` by type.**
  `packages/network/src/loop.js` refuses to break a loop at an `OPAMP` element.
  It says "give it a finite gain, the macro's A₀, and the loop has a number".
  N1's op-amp already carries `A₀ = 10⁵`, so the message names a fix that is
  already in place, and the plan's N1 pin of "T at f₀" cannot be read.

  The Wien network's own β is measured instead. The two arms are driven from
  where the output sits, which is exact only while the + input draws no
  current. `packages/network` is the Electronics overseer's, so this is a
  request rather than an edit. The change wanted is for `loopSource` to accept
  an `OPAMP` whose gain is finite, keeping the refusal for the ideal one.
- **The distortion is counted over twelve harmonics.** A square wave's own
  figure is 48.3 % and twelve harmonics of one make 43.9 %. The term, the why
  and the panel now all say which is quoted. Counting further needs
  `harmonics` in `groups/n.js` to take the count from the experiment, and a
  waveform sampled fine enough to carry them.
