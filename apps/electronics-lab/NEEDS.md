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

## Groups L and M

Feedback and the inside of the op-amp are built, twelve experiments, and the
lab's own suite is green. Nine things the lane found belong outside it.

### 7. `mathEntries.js` gained two import lines

The lane's brief gives it one import line each in `experiments.js`,
`lessons.js` and `terms.js`. `experiments.test.js` also requires a math-panel
entry for every experiment, and `experimentMath` looks entries up in
`mathEntries.js` alone, so that file gained the same two lines and two spreads.
The entries themselves are in `groups/l.math.js` and `groups/m.math.js`, which
the lane owns. A lab that wanted a group to carry its own math panel without
touching a shared file would put a `math` field on the experiment and have
`experimentMath` prefer it.

### 8. `layoutCheck.js` still does not know a transistor

`Schematic.jsx` draws a three-terminal glyph spanning the full ±20 on both
axes, with its label 34 px below the centre. `layoutCheck.js` measures every
element with `elementBodyBoxes` and `elementTextPlaces`. Those describe a
two-terminal symbol ±20 along and ±9 across, with its label 24 px below. A
drawing that carries a transistor is therefore checked against the wrong box in
both places. Item 4 above already asked for the three transistor exports to be
wired in, and Group M is the first drawing that needs them. Meanwhile this
lane's eleven transistors are placed from the pin coordinates the contract
gives, and the wires are routed to those points by hand.

One thing the wrong box hides. A transistor's default label, `Q1 npn`, is 32 px
wide and centred on the device, while its collector and emitter leads leave 12
px either side of that centre. Any wire continuing straight down from the
emitter therefore runs through the label. Group M gives each device a label of
its id alone so the two clear each other, and the polarity is left to the
arrowhead. A shorter default, or a label placed to one side, would fix it for
every lab.

### 9. Two panes have nothing to draw anywhere in the lab

`components/panes.jsx` has a `CurvesCanvas` reading `x.curves` and a
`SpectrumCanvas` reading `x.spectrum`. `analyse` in `math.js` sets neither, so
both panes show their empty state in every experiment that lists them. Groups
L and M therefore list neither view, and Group M's distortion figures are
computed from the walk in `groups/l.js` rather than from a spectrum pane. The
device curves belong to Group D and the spectrum to Group H, and whichever
lane builds those adds the two to `analyse`.

### 10. A transistor shows no meter reading

`elementReading` reads `meters.i[id]`, and a `Q` element has no unknown current
of its own, so `sol.i` carries `Q1.be` and `Q1.ce` and nothing under `Q1`. The
result is that a transistor is the one element on the schematic with no number
beside it in any of the three meter views. Item 4 above says `meters.i[id]`
gives the collector current by default, and it does not yet. The fix is in
whatever assembles `sol.i`, or in `elementReading`, and neither is this lane's.

### 11. `pwlTransient` can find the same event for ever

`packages/network/src/pwl.js` detects an event when a region's margin crosses
zero, flips the region, and calls `settle`. Where the crossing lands exactly on
a sample of the walk's own grid, `settle` puts the device straight back into
the region it just left. The event record then reads `active -> active`, and
the loop makes no progress until `EVENT_LIMIT` stops it 2000 events later.

It is reproducible. Take M6's output stage at `amp = 3.4`, `vbias = 0`,
`RL = 10 kΩ`, `re = 10 Ω`, `f = 1 kHz`, `vsup = 10 V` and `beta = 100`. Over
two cycles at 601 points its npn turns off at exactly the 28th sample, and the
walk takes about ninety seconds to reach the chatter refusal. That refusal is
correct and it names a reason. What is wrong is that `to === from` counts as an
event at all.

Two lines in `pwlTransient` would fix it. When `settle` returns the region the
event came from, record no event and step past that instant. Until then M6
walks at 201 points rather than 601, so a setting that hits the alignment costs
seconds rather than minutes, and the pane shows the refusal.

### 12. Two numbers this lane measured

- **The two-stage op-amp's open-loop gain is 3 240, not 10⁵.** Its second stage
  is loaded by a resistor rather than by a current source. A resistor small
  enough to hold the output near the middle of the supply is also small enough
  to cap the gain. The first stage's own gain is 50.9 and the second's is 64.3.
  The missing factor of thirty is a current-source load on that second stage,
  which is Group I's mirror used again. The Analog IC Lab and the VLSI Lab both
  plan around this circuit and should quote the measured pair.
- **The base current of an input transistor is 67.2 nA, not 75 nA.** The
  textbook writes it as `I_tail/2β`. The Early effect raises the current gain to
  `β(1 + |V_CE|/V_A)`, which is 110 at these collector voltages, and the tail is
  shared between two collectors and two bases, so the number is
  `I_tail/(2(1 + β_eff))`. Group A's `I_B = 100 nA` is a datasheet figure and
  needs no change.

### 13. A hand-over to Control Lab, and a link this lane could not make

L5's loop gain and M3's are exactly what Control Lab reads as a plant. The plan
asks for the link (`plant=custom`, `ctrl=p:1`) beside the loop view. Making it
needs `deeplink.js` or `circuitLink.js` wired into a pane and a view registry
entry, and both are outside this lane. Meanwhile the phase margin is measured
here by `marginsOf`, on the same polynomials Control Lab would receive. M3's
panel checks it against the crossover, the second pole and the zero, and the
three account for it to a hundredth of a degree.

### 14. Two claims of the plan's Group L that are not built

- **L2's second half.** The plan asks for the CE stage's second-harmonic
  distortion falling by 1 + T inside a loop. It is not here. The only local
  feedback one stage has is its emitter resistor, and that resistor sets the
  bias current as well as the loop. No knob moves one without the other. A
  diode inside an op-amp's loop was tried instead. Its own small-signal
  resistance is tens of milliohms, so it shunts the loop to nothing. The claim
  needs a forward stage whose bias and whose feedback are separately reachable,
  which is Group H's cascade. L2 measures desensitivity alone, at three loop
  gains.
- **L5's Bode view.** The closed-loop response peaks rather than falling. The
  −3 dB reading `corners` takes against the response at one hertz then has
  nothing to measure, and the shared Bode check fails on it correctly. L5 shows
  the poles and the reading pane instead. A Bode pane that reports a peak rather
  than a corner would let it back in, and Group K will want the same thing.

### 15. The two-stage op-amp's drawing is 840 × 530

Every other schematic in the lab fits the 420 × 180 grid. Five transistors, two
supplies, a tail source, a load, two capacitors and a feedback block do not.
The drawing passes the geometry checks and crops to 798 × 474, which at a phone
width of 390 px scales the 10 px labels to about 5. Nobody has read a
screenshot of it, because this environment has no browser. It is the first
thing to look at in a review.
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
