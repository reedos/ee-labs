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
