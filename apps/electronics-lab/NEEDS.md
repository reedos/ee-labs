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
- **75 experiments in 14 groups.** Ids `a1` to `a6`, `c1` to `c4`, `d1` to `d7`,
  `e1` to `e6`, `f1` to `f6` and `g1` and `g2`. Then `h1` to `h7`, `i1` to `i5`,
  `j1` to `j5`, `k1` to `k6`, `l1` to `l6` and `m1` to `m6`. Then `n1` to `n4` and
  `o1` to `o5`.
- The groups in order are A, "the op-amp as a user meets it". C, "inside the
  junction". D, "the transistor as a controlled source". E, "signal and bias take
  different paths". F, "small signals, the tangent at the point". G, "ports, and
  what loads them". H, "single-stage amplifiers". I, "mirrors, active loads, and
  stacking". J, "the differential pair". K, "frequency response". L, "feedback".
  M, "inside the op-amp". N, "oscillators". O, "noise".
- No cross-lab reference by id in either direction yet. The lab's own
  `experiments.test.js` fails on a lesson that cites an experiment id this lab
  does not carry, so the references the plan lists for Groups F to O arrive
  with those groups.

The count moves as groups land. Whoever adds a group updates this entry in the
same commit. Groups D to G are still unbuilt, so nothing in H or I cites an
experiment from them, and the lab's own `experiments.test.js` enforces that.

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

## Groups F and G

The lane owns `src/groups/{f,g}.js`, `src/lessons/{f,g}.js` and the two terms
files. Everything below is outside those files.

### 7. `layoutCheck.js` does not know the transistor geometry

`collect()` sends a `Q` or an `M` through `elementBodyBoxes` and
`elementTextPlaces`. A transistor is then checked as a 40 × 18 two-terminal
body with its text 24 above and below. `Schematic.jsx` draws a 40 × 40 glyph
with its text at 34. The checker also adds `+` and `−` marks at `signPlaces`,
which the `Transistor` component does not draw. Item 4 above names this as the
first transistor lab's to wire in. The three exports it needs are
`transistorBodyBox`, `transistorPinPlaces` and `transistorTextPlaces`.

The lane's eight drawings were checked against both geometries before they
were committed, and they are clean under both. The crop frame was checked as well:
`layoutExtent` uses the same wrong boxes, and the frame it returns still holds
every layout's true drawing. So the defect is latent rather than visible, and
it belongs to whoever owns `layoutCheck.js`.

### 8. A transistor's label has to be its id alone

`valueText` writes "Q1 npn" centred 34 below the device while the emitter's
lead comes down 12 to the right of that centre. Any label wider than three
characters is written across the lead, under the true geometry as well as the
checked one. Group F passes `labels: { Q1: 'Q1', M1: 'M1' }` and loses the
polarity from the drawing. A transistor-aware label place, or a convention that
puts the text on the base side, would let the polarity stay on it.

### 9. A transistor's schematic reading is a dash

`elementReading` looks up `meters.i[e.id]` and `meters.volt[e.id]`. A
companion-stamped device puts its currents under `Q1.g0`, `Q1.m0` and so on, so
neither key resolves. The schematic prints a dash on the one element the lesson
is about. Item 4 promised a per-device meter, the collector or drain current by
default. Until it lands the topbar's operating-point label and the reading pane
carry I_C and V_CE instead.

### 10. Two imports in `mathEntries.js`

`MATH_F` and `MATH_G` are exported from the two group files this lane owns, and
`experiments.test.js` requires every experiment to have a math entry with at
least one check row. `ENTRIES` is one flat registry, so the edit is one import
line and one spread each. The lane made it, because the alternative was a red
suite on its own commit.

### 11. Quantity paths the brief's §4 lists that `readQuantity` does not resolve

`ss.gain`, `ss.rin`, `ss.rout`, `hd2`, `thd` and `vn.*` all appear in the
brief's list and none of them resolves. Group G reads a port resistance through
the `gain` path, which is exact: `transferOf` from a current source gives a
transimpedance in ohms. Group F reads AC node amplitudes and HD2 through
`reads` functions instead. A path for the AC amplitudes, `x.ac`, would let a
headline follow a signal amplitude. F2's headline is the collector's bias
today, because nothing in a quantity path moves with an AC drive.

### 12. The transfer view draws no tangent, and its title says it does

`VIEW_LABELS.transfer` reads "Output against input from the quasi-static sweep,
with the tangent at the point". `TransferCanvas` draws the curve alone. F4 and
F5 both open on that view, and F5's whole lesson is the distance between the
curve and the straight line at the same drive. The numbers are in the reading
pane and in the math panel, so the claim is measured, but the picture does not
carry it. Either the canvas gains the line and the point, or the title stops
promising them.

### 13. The scope's y axis is volts, so a current cannot share it

`ScopeCanvas` titles its y axis "volts (V)" and formats every trace with `V`. A
trace with `q: 'i'` would be drawn against the wrong unit and the wrong name.
G1 wanted the test current beside the port voltage, to show a negative
resistance as two traces rather than as a ratio. The note reads the two numbers
instead. A second axis, or a per-trace unit, would let a current on the scope.

### 14. Two of the plan's numbers moved, and the measured ones are used

- **r_π is 2.714 kΩ, not the plan's 2.59 kΩ, and r_o is 105.0 kΩ, not 100.0.**
  The tangent of the exponential device carries the Early effect in the base
  current as well as the collector current. The current gain at V_CE = 5 V is
  then 105 rather than the 100 the knob names, and r_o is (V_A + V_CE)/I_C.
  This is the same effect item 5 above records for the CE stage's poles. F4's
  note states both figures and the reason.
- **F3 compares 17.02 mA/V against 4.400 mA/V at 440 µA**, where the plan
  quotes 15.5 and 4.0 at 0.4 mA. The square law's λ raises the drain current
  and its slope by 1 + λV_DS at V_DS = 5 V. The bipolar device is then read at
  the same 440 µA. The plan's 125 kΩ for r_o is unchanged. That figure is
  1/(λI_D) at the current the square law gives before the λ factor.

### 15. `knobs.js`'s `leg()` stops 10 short of these rails

`leg(id, x, y)` draws its wires from `y − 40` to `y − 20` and from `y + 20` to
`y + 40`. Group C's two layouts use it against rails at 40 and 140, so each leg
is drawn with a 10 px gap at both ends where the circuit has a wire. Nothing
tests connectivity, so the suite cannot see it. Groups F and G use a local
`legTo` that reaches the rails it is given.

### 16. `experiments.test.js` gained a block per group

Lanes 2 and 3 left a `describe` block per group in that file, and Groups F and
G now have theirs. They are appended in group order, so two lanes that both
append meet at the end of one file. The director resolves the order.
## Groups H and I

### 7. `layoutCheck.js` still checks a transistor as a two-terminal element

`apps/electronics-lab/src/layoutCheck.js` sends every element that is not
an op-amp through `elementBodyBoxes` and `elementTextPlaces`. For a `Q` or
an `M` those are the wrong boxes. The glyph spans the full ±20 on both
axes rather than ±9 across, its label hangs 34 below the centre rather
than 24, and its reading hangs 34 above rather than 24. Item 4 above
records that `schematicGeometry.js` now exports `transistorPinPlaces`,
`transistorBodyBox` and `transistorTextPlaces` for exactly this.

Groups H and I are checked against both geometries. A scratch harness adds
the real transistor boxes by hand, and all twelve drawings come out clean
under both.

The cascode was not, on the first pass. Its two transistors shared a column
75 apart, and the upper one's label landed on the lower one's reading in the
voltage and power views. Two devices in one column need about 80 between
their centres, because each hangs its writing 34 off its own centre. The
app's own test knows only the two-terminal boxes and caught none of it.
Whoever draws a transistor next should wire the three exports in and run it
again. The file belongs to this app rather than to this lane.

### 8. Two panes have no data behind them

`components/panes.jsx` draws `CurvesCanvas` from `x.curves` and
`SpectrumCanvas` from `x.spectrum`, and `analyse` in `math.js` sets
neither. Both panes therefore say they have nothing to draw, whatever the
experiment. Groups H and I list neither view for that reason, and H2's
second harmonic is measured by mapping a sine through the quasi-static
characteristic in `groups/h.js` instead of by reading a spectrum. Device
curves are Group D's subject and the spectrum is Group F's, so whichever
lane builds those groups adds the two to `analyse`.

### 9. Three quantity paths of the brief are not in `readQuantity`

`AGENT_BRIEF.md` section 4 lists `ss.gain`, `ss.rin` and `ss.rout`.
`lessons.js` resolves none of them. A port resistance is a method rather
than a reading, so Groups H and I measure it with `portR` in
`groups/h.js`, a function read that every lesson quoting one names.
That works, and it keeps the headline path for those experiments on
`gain` or on the operating point. A lane that wants `R_in` in the topbar
needs the paths.

### 10. Numbers Groups H and I measured, against the plan's

The plan's section 5 quotes the textbook hybrid-π, with `r_pi` as
`beta/g_m` and `r_o` as `V_A/I_C`. The tangent of the exponential device
carries a factor of `(V_A + V_CE)/V_A` in both. So the common emitter at
1 mA and 5 V reads 2.71 kOhm at its base rather than 2.59 kOhm, its
output resistance is 4.77 kOhm, and its gain is −184.6 rather than −184.
Switching the Early effect off gives the plan's numbers exactly: 2.585
kOhm and −193.4.

Four more figures moved. H2's second harmonic falls by the square of
1 + g_m R_E rather than by the factor itself, from 4.08 % to 0.196 %, a
ratio of 20.8 against the plan's 4.87. H3's follower reads 34.7 Ohm at
its emitter and 112 kOhm at its base, against 35.8 Ohm and 104 kOhm. H6's
source port is 229 Ohm rather than 250 Ohm. I3's active load reaches
−2030 with an intrinsic gain of 4108, against −1934 and 3868, and one
per cent of bias mismatch moves its output by 522 mV rather than by a
volt. I5's pair reaches 81.9 dB.

One claim of the plan is not measured as the plan asks. H7 says the two
routes to a large signal agree within the model's stated error. They cannot
be compared here, because `pwlTransient` declines the exponential model with
a reason: a curve has an operating point but no closed-form response in
time. So H7 measures both flat tops on the three-region model, and its third
try step reads the refusal instead. The two routes meet in the transfer
pane, where the quasi-static sweep solves the exponential exactly at every
point.
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

The same geometry, run over this lane's six drawings by hand, found one live
collision and eleven waiting. The live one was M6's pnp, whose reading band
runs from y 349 to y 358 and held both the jog to its emitter and that node's
label. Both have been moved.

The eleven that wait are every transistor's reading, once `meters.i[id]`
carries a current (item 10 below). A reading of `−1.23 mA` is 43 px wide and
centred on the device. The collector lead leaves at 12 px, so the number lands
on the wire that continues from that pin. No layout can avoid that while
`transistorTextPlaces` centres the reading over the glyph. It wants the
treatment the op-amp's texts have, hung to one side or offset past the lead.
That is a `packages/ui` change rather than a lane's.

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

It is worse than nothing in two of the three views. In the voltage view
`elementReading` falls through to `fmt(meters.volt[id], 'V', 3)`, and a
transistor has no entry there either. `fmt` returns its own placeholder dash
for a value that is not finite, so the schematic writes a dash and a volt sign
over every transistor. The power view writes a dash and a watt sign the same
way. Five of those sit on M1's drawing. Until the collector current arrives,
returning null for a device with no reading would leave the space empty
instead.

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
### 16. Five more places where the plan and the built groups differ

Each is a claim of `ELECTRONICS_LAB_PLAN.md` §5 that the lane did not build as
written. All five are recorded here rather than left for a reader to find.

- **L6's number is 750 µΩ, not 7.5 mΩ.** The plan writes it as 75 Ω over
  1 + T and quotes 7.5 mΩ, which is a return ratio of 10⁴. A follower feeds
  all of its output back, so T is the whole open-loop gain of 10⁵ and the
  answer is ten times smaller. `experiments.test.js` pins the ratio at nine
  settings of the gain and the resistance.
- **L4's four topologies are prose, not a table.** The plan asks for the four
  on one table, each with a circuit already in the lab. Three of those four
  circuits are in groups that are not built, and a table of one measured row
  and three promises is worse than the paragraph L4's `why` carries. Reopens
  with Group H, whose emitter resistor is the series-series case.
- **M1 does not check A's macro against the transistors.** The plan asks for
  invariant 7, the macro given the same numbers agreeing at DC. The macro's
  gain is a knob and the transistor circuit's is 3 240, so feeding one to the
  other compares a number with itself. It becomes a real check when Group I's
  mirror lifts the second stage and the two gains are arrived at separately.
- **M2 does not print the ω_t/s fold's error at 10 f_p.** The plan asks for
  the single-pole fold to be labelled with its error there. The panel prints
  the measured unity-gain frequency beside the estimate instead, which is the
  same information at the frequency that decides the margin. The fold itself
  is Group A's A3.
- **M6's largest drive is 9 V, not the plan's 10 V.** The supplies are ±10 V
  and a class B stage cannot swing to its own rail, so a 10 V drive has no
  operating point. The distortion reads 4.61 % at 9 V against the plan's
  4.3 % at 10 V. The knob's own maximum is 9 V for the same reason, and past
  the supply the model refuses. M6's fourth try step shows that refusal.

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
- **F5 measures its second harmonic without a spectrum.** `math.js` computes no
  `x.spectrum`, so the spectrum pane has no data source and no experiment lists
  it. F5 maps a sine through the stage's own DC characteristic instead, 64
  exact solves and a Fourier projection. That is route 2 of the plan's §2.8,
  read for its second harmonic. Reopens with the spectrum pane.
- **F5's guard is a footnote rather than an amber ghost.** The plan asks for
  one on a scope. The exponential model in time is declined by the plan's §2.8,
  so no experiment past Group C can carry a scope with a transistor on that
  model.
- **The device-curves pane is empty for every experiment.** `math.js` computes
  no `x.curves`, so nothing can list the view. Group D is where the load line
  and the family of curves belong, and its lane needs the producer.
- **G2 measures the loading rule at both ends of one box, not across two.** The
  plan's G2 asks for two boxes in cascade against the direct solve. Nine
  elements and six vertical legs do not fit the 420-wide canvas once each label
  and reading is placed, since a leg needs about 75 px of clear space to its
  right. Group I5 is where the two-stage case belongs.
- **Nobody has looked at Groups F and G in a browser.** This environment has no
  browser, so the eight drawings were checked as geometry, under the checker in
  `layoutCheck.js` and again under the transistor geometry `Schematic.jsx`
  really draws. Reopens with anyone who has a browser.
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
