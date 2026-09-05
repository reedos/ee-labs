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

## Groups J and K

Five differential-pair experiments and six on frequency response, on branch
`lab/electronics-jk`. The lane owns `src/groups/{j,k}.js`, `src/groups/{j,k}.terms.js`
and `src/lessons/{j,k}.js`, plus one import line each in `experiments.js`,
`lessons.js`, `terms.js` and `mathEntries.js`.

### 1. `layoutCheck.js` does not know what a transistor is

`apps/electronics-lab/src/layoutCheck.js` collects a `Q` or an `M` through
`elementBodyBoxes` and `elementTextPlaces`. Those are the two-terminal rules,
and a transistor is not a two-terminal element. `schematicGeometry.js` gives it
a body of ±20 on both axes rather than ±20 by ±9. It puts the label and the
reading 34 off the centre rather than 24. The checker therefore measures the
wrong boxes on every drawing in these two groups. A real collision between a
lead and its own reading would pass.

The eleven layouts here were checked against both geometries, by a script that
repeats `layoutProblems`' rules with `transistorPinPlaces`, `transistorBodyBox`
and `transistorTextPlaces` in place of the two-terminal ones. All eleven are
clean under both. The fix is three lines in `collect`, beside the `OPAMP`
branch that already exists:

```js
} else if (e.type === 'Q' || e.type === 'M') {
  bodies.push({ box: G.transistorBodyBox(it), what: `${e.id} symbol`, owner: e.id })
  const at = G.transistorTextPlaces(it)
  addText(at.label, labelOf(e), G.FONT.label, `${e.id} label`)
  addText(at.reading, reading, G.FONT.meter, `${e.id} reading`)
}
```

That file belongs to the app shell rather than to a group lane, so the change is
recorded here. `apps/circuit-elements-lab/src/layoutCheck.js` needs the same
three lines whenever that lab draws a device.

### 2. A wire that crosses another and does not join it

`Schematic.jsx` draws every wire as a straight segment, so two crossing wires
meet on screen with nothing to say they are not connected. `layoutProblems`
reports the crossing rather than drawing it, which is the right default. J5's
mirror needs one crossing that no planar arrangement removes, because the two
load devices have their bases on the far side from everything they connect to.
It is drawn as a gap in the crossing wire, which is one of the two conventions
a schematic uses. The other, a semicircular hop, would be a renderer change and
would read better. `layoutProblems` would need to know that a hop is not a
junction.

### 3. The progression test

`packages/ui/src/progression.test.js` belongs to the seams overseer. These two
groups add, after Group C:

- Group J, "the differential pair", ids `j1` to `j5`.
- Group K, "frequency response", ids `k1` to `k6`.

The lab's entry becomes **21 experiments in 4 groups**. No lesson here names an
experiment outside the lab, and the only ids cited are `a5`, `k3` and each
group's own.

### 4. Numbers that moved from the plan

Each of these is the engine's answer at the plan's own component values, and
each is what the lesson quotes. `ELECTRONICS_LAB_PLAN.md` §5 should carry the
measured column when it is next revised.

| Plan §5 | Measured | Why |
| --- | --- | --- |
| J1, 98.2 % of the tail at 4V_T | 98.12 % | the two collectors sit at different voltages, so the Early factor differs between the sides |
| J1, linear within 7.6 % out to ±V_T | 7.14 % | the tangent is measured on the circuit, and the Early effect adds to the slope at the origin |
| J2, g_m = 19.3 mA/V, A_d = 96.7 | 19.16 mA/V, 93.67 | I_C is α times half the tail, and the collector load is R_C ∥ r_o |
| J3, CMRR 3868, 71.8 dB | 3793, 71.58 dB | the same two corrections |
| J4, V_OS = V_T ΔR_C/R_C = 0.26 mV | 0.2572 mV | the exact law is V_T ln(1 + ΔR_C/R_C), of which V_T ΔR_C/R_C is the first term. A mismatch of I_S gives the same expression |
| J5, A_d = 1934 | 2034 | r_o is (V_A + V_CE)/I_C, not V_A/I_C |
| K1, f_T = 280 MHz | 280.0 MHz | agrees |
| K2, bypass sees 34.6 Ω, corner near 98 Hz | 33.87 Ω, 99.98 Hz | the divider settles at 1.035 mA rather than 1 mA |
| K3, f_H 548 kHz, estimate 3.2 % high | 539.5 kHz, 3.17 % | the tangent carries the Early effect in r_π and r_o, as `NEEDS.md` §5 already records |
| K4, Σ τ = 291 ns, 0.16 % | 295.5 ns, 0.16 % | the same tangent |
| K6, f_H about 9.2 MHz, seventeen times | 7.712 MHz, 14.3 times | the cascode's own base resistance and the Early effect at the middle node |

### 5. Two shapes the app's contracts do not carry

Neither of these stopped the work, and both would tidy it.

- **A quantity path for a derived number.** `readQuantity` resolves paths
  against the analysis, and a rejection ratio or an f_T is neither a node
  voltage nor a pole. J3's headline is therefore one collector voltage and K1's
  is the corner of the current gain, while the numbers those experiments are
  about are read in the lesson steps by a function. A `derived.<name>` path,
  filled by the group file, would let the topbar print what the experiment is
  named for.
- **`mathEntries.js` merges a fourth group file.** `experiments.js`,
  `lessons.js` and `terms.js` each take one import line per group by design.
  `ENTRIES` now does too, and the entries for a group live beside its netlists
  rather than in one file that every lane would edit.

### 6. What these groups changed about the brief's netlists

- **Group J's two inputs are two sources to ground.** `Vb1` sits at
  v_cm + v_id/2 and `Vb2` at v_cm − v_id/2, in place of the brief's floating
  `Vid` between the bases. The two are the same circuit at every setting, and
  the node names the brief fixes are unchanged. A floating source between the
  two bases needs a wire from one base across to the other. That wire has to
  cross the emitters, and no arrangement of these symbols avoids it.
- **The tail returns to ground** rather than to a negative rail, so the drawing
  carries one supply. The emitters sit at −0.63 V, which an ideal sink allows.
- **`REE` beside the tail source** is that source's own output resistance. It
  is a knob in J3 and absent elsewhere.
- **K1's collector is held through a one-ohm sense resistor.** Without it C_π
  and C_μ lie across the same pair of nodes and `dynamics` refuses the netlist,
  with the state-loop message. The same reason puts 100 Ω in the cascode's base
  bias in K6.
- **The drawings are larger than 420 × 180.** A transistor's label and reading
  hang 34 above and below its centre, so a device needs a clear band of ±42 and
  a row of them costs eighty pixels of height. Group J's are 540 × 340 and
  Group K's between 460 × 270 and 640 × 330. A phone renders them at about the
  height Group A's drawings reach.

### 7. Half of K5, and where the other half went

`ELECTRONICS_LAB_PLAN.md` §5 names K5 "no Miller effect: the follower and the
common base", and asks for the dominant poles of H3 and H4 against H1's. This
lane built the follower alone. Two reasons, and the director should decide
whether the plan's line or the built experiment moves.

- Group H is not built, so H1, H3 and H4 cannot be cited. `experiments.test.js`
  fails on a lesson that names an experiment this lab does not carry, which is
  the rule working. K5 therefore compares itself against K3's common emitter,
  solved at K5's own knobs rather than quoted.
- A second topology inside one experiment needs a layout that follows the
  netlist. `e.layout` is one object and `e.net` is a function of the knobs, so
  a choice knob that swapped the follower for a common base would draw the
  wrong circuit. The test that every element solved is drawn catches it.

The common base is not absent from the group. K6's cascode is a common base
standing on a common emitter, and its lesson measures what the lower collector
sees because of it. What is missing is the direct comparison of a common base
against the same device as a common emitter, at the same source resistance.
Reopens with Group H, or as a seventh experiment in this group.

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
