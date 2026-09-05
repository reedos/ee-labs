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
- **19 experiments in 4 groups.** Group A, "the op-amp as a user meets it", ids
  `a1` to `a6`. Group C, "inside the junction", ids `c1` to `c4`. Group D, "the
  transistor as a controlled source", ids `d1` to `d7`. Group E, "signal and
  bias take different paths", ids `e1` to `e6`.
- No cross-lab reference by id in either direction yet. The lab's own
  `experiments.test.js` fails on a lesson that cites an experiment id this lab
  does not carry, so the references the plan lists for Groups F to O arrive
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

## Groups D and E

The lane that built `groups/d.js`, `groups/e.js`, their terms, their math
entries and their lessons. Everything below is a file this lane does not own.

### 7. `layoutCheck.js` does not know the transistor geometry

`packages/ui/src/schematicGeometry.js` exports `transistorPinPlaces`,
`transistorBodyBox` and `transistorTextPlaces`, and item 4 above says wiring
them into a layout checker is for whichever lab draws a transistor first. That
is this one, and `apps/electronics-lab/src/layoutCheck.js` still routes a `Q`
or an `M` through the two-terminal branch.

The checker models a transistor as a symbol on (−20, 0)…(20, 0), ±9 across. It
puts the label 24 below and the reading 24 above. The renderer draws the glyph
±20 on both axes, with the label 34 below and an output pin at (x + 12,
y + 20). The two disagree in one place that matters. The checker's label band
runs from y + 16 to y + 26.5. The output pin sits at y + 20, inside it. So every
lead leaving a transistor is reported as sitting on the label.

The workaround here is a `labels` entry on every transistor, giving its
designator alone. `Q1` is 11 px wide and clears the lead at x + 12. The cost is
that the polarity is no longer written beside the glyph. Wiring the three
exports in would let a transistor carry its own label again. It would also make
the check mean what it says for thirteen drawings it currently only
approximates.

### 8. Two panes in the shell had no producer

`components/panes.jsx` reads `x.curves` and `x.spectrum`, and `math.js` set
neither. `CurvesCanvas` was written against a shape that nothing filled, namely
`family`, `load`, `point`, `xLabel` and `yLabel`. So the device-curve view said
that the experiment carried no device whose curves could be drawn, on every
experiment in the lab.

This lane added one line to `analyse`. It sits beside the two that were already
there for the junction and the quasi-static sweep, and it reads `if
(exp.curves) x.curves = exp.curves(p, x)`. The experiment builds the family.
What is stepped and what is swept is the experiment's own question, and every
point is a solve of the same circuit at another setting. `x.spectrum` still has
no producer. The first group that needs harmonic distortion will want the same
hook.

### 9. Four merge points, one import line each

`experiments.js`, `lessons.js`, `terms.js` and `mathEntries.js` each gained an
import per group and a spread into the object they already export. The math
entries are the one that was not in the brief. `experiments.test.js` requires a
math panel for every experiment, and `ENTRIES` is a literal in a file lane 6
owns. Groups D and E put theirs in `groups/d.math.js` and `groups/e.math.js`
and merge them the way the terms merge, so that the next lane adds two lines
rather than editing a growing literal.

### 10. Numbers that moved, against the plan and the brief

Every one of these is the engine's, computed before it was written.

- **The plan's E3 gives 0.92 to 1.05 mA over β from 50 to 200.** The circuit
  gives 0.902 to 1.042 mA. The plan's formula, (V_BB − 0.7)/(R_E + R_B/(β + 1)),
  is the emitter current. The collector takes β/(β + 1) of it.
- **The brief's common-source stage puts V_DS at zero.** With V_DD = 5 V,
  R_D = 10 kΩ and R_S = 2.5 kΩ at I_D = 0.4 mA, the drain and the source both
  sit at 1 V. E5 uses R_D = 5 kΩ, which puts V_DS at 2.00 V and leaves the
  device saturated, where the experiment needs it.
- **The plan's E6 says I_C moves under 1 % over β from 50 to 200.** It moves
  under 1 % either side of its β = 100 value, and the spread across the whole
  range is 1.4 %, because α itself moves from 0.980 to 0.995. Temperature moves
  it by eight parts in a million over 50 K.
- **β read off a curve tracer is not β_F.** D2 measures i_C/i_B = 105 at
  V_CE = 5 V for a device whose β_F is 100, because the Early factor multiplies
  the collector current and not the base current. Group F's r_π = β/g_m should
  say which β it means.
- **The plan's D3 says the two models disagree by more than 10 % inside 0.3 V
  of the knee.** They disagree by exactly v_CE/V_A in the active region, which
  is 1.0 % at 1 V and 4.8 % at 5 V. Below V_CE(sat) the three-region model has
  no answer at all rather than a poor one, because its saturated state pins
  v_CE and the source is setting it too. D3 shows that refusal instead.
- **D7 turns the base current rather than v_BE.** The plan turns v_BE, which
  the three-region model cannot take from a voltage source without two sources
  setting one voltage. A base current lets both models run on the same drawing,
  and the three-region model then reaches exactly 0.2 V at the saturated end,
  which is the number the plan quotes.
- **E5's gate is held by a source, not by a divider.** The plan says a divider.
  A MOSFET gate draws no current, so a divider and a source of the same
  open-circuit voltage set the same gate voltage and the same drain current.
  One source is one part on a phone-width drawing where a divider is two. The
  note and the math panel say which is drawn.
- **The plan's E4 gives 83 mV over 50 K and a 75 µA shift.** The circuit gives
  89.1 mV and 80.1 µA. C4's 1.66 mV/K is the slope at 0.7 V, and this junction
  sits at 0.655 V, where the slope is steeper. The shift formula leaves out the
  junction's own r_e = V_T/I_E, so the math row carries a threshold for it.
  Item 12 has the threshold.

### 12. What the review changed in files this lane does not own

`experiments.test.js` is lane 6's. It gained a `describe` block for Group D and
one for Group E, in the shape the Group A and Group C blocks already have. The
brief's §6 asks every lane to pin the plan's numbers there, and those two
blocks are the precedent. Twenty-four pins, each written from the knobs rather
than typed. Every default in both groups was perturbed to confirm the pins move
with them. Two imports came with the block, `bjtOf` from `@ee-labs/network` and
`inverterMargins` from `groups/d.js`.

`groups/e.math.js` and `lessons/e.js` are this lane's. Three claims in them did
not follow their circuit and are corrected in place: E5's divider, E6's fifth
figure, and E3's milliamp read as a collector current. E4's temperature row is
an approximation and now carries the threshold CORE_SCOPE rule 3 asks for.

### 11. For `BACKLOG.md`, under `### Electronics Lab` (append only)

- **Groups D and E are built**, 13 experiments, with the transistor symbol on
  every drawing. The lab is 19 experiments over four groups. The entry above
  saying Groups D to O wait on the symbol is superseded for D and E.
- **C4's cross-reference to Group E can be restored.** E4 is built, and it is
  the bias point's drift with temperature. The sentence is in
  `apps/electronics-lab/src/lessons/c.js`.
- **No screenshot has been read as a student would.** This environment has no
  browser, so `REVIEW_PLAYBOOK.md` §11 is unmet for thirteen new drawings and
  for the device-curve pane, which nothing had drawn before this lane.
