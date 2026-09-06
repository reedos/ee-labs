# The backlog: what is not built yet, and what it waits for

The director's ledger for the program in `PROGRAM.md`. Every lab in `EE_LABS_MAP.md`
has a row. Every item deferred by an overseer has a line under its lab's heading,
with the dependency that unblocks it. When a dependency is built, the director walks
this file and reopens what it unblocks. Nothing leaves this file by being forgotten.

Status words. **Built** is on the site. **Building** has an overseer and a branch.
**Planned** has a plan file and no overseer yet. **Waiting** has a plan or a map
entry and a named blocker. **Mapped** has a map entry only.

## 1. The ledger

| Lab | Status | Branch | Blocked on | Plan |
| --- | --- | --- | --- | --- |
| Circuit Elements Lab | released 2026-09-05, v1.1 | | | `CIRCUIT_ELEMENTS_LAB_PLAN.md` |
| Circuit Lab | built | | | |
| Signal Lab | built | | | |
| Control Lab | built | | | |
| Power Lab | built in part, dark | merged, Groups A to G | Groups H to N unassigned | `POWER_LAB_PLAN.md` |
| The two seams and the progression test | built, merged | | | `CURRICULUM.md` §3, §6 |
| Electronics Lab | built in part, dark | merged, Groups A and C to O | Group B, which is Elements I9 and I10 by Decision 3 | `ELECTRONICS_LAB_PLAN.md` |
| Logic Lab | built, dark | merged | Electronics D6 for one cross-reference | `LOGIC_LAB_PLAN.md` |
| DSP Lab | built, dark | merged | | `DSP_LAB_PLAN.md` |
| Random Signals Lab | built, dark | merged | Electronics O1 for one cross-reference | `RANDOM_LAB_PLAN.md` |
| Control Lab II | built, dark | merged | | `CONTROL_LAB_II_PLAN.md` |
| Random Signals Lab | building | `lab/random-lab` | Electronics O1 for one cross-reference | to write |
| Control Lab II | building | `lab/control-lab-ii` | | `CONTROL_LAB_II_PLAN.md` |
| Instruments Lab | built, dark | merged | RF Lab for the network analyser group | `INSTRUMENTS_LAB_PLAN.md` |
| Instruments Lab | building | `lab/instruments-lab` | RF Lab for the network analyser group | `INSTRUMENTS_LAB_PLAN.md` |
| Fields Lab | built, dark | merged | | `FIELDS_LAB_PLAN.md` |
| Energy Lab | built, dark | merged | Machines Lab for the wind group | `ENERGY_LAB_PLAN.md` |
| Machines Lab | built, dark | merged | Power Lab L for the drives group, F now merged | `MACHINES_LAB_PLAN.md` |
| Communications Lab | built, dark | merged | | `COMMUNICATIONS_LAB_PLAN.md` |
| Information Lab | built, dark | merged | | `INFORMATION_LAB_PLAN.md` |
| Applied Analog Lab | waiting | | Electronics L, M | `APPLIED_ANALOG_LAB_PLAN.md` |
| Analog IC Lab | waiting | | Electronics H to M | `ANALOG_IC_LAB_PLAN.md` |
| Mixed-Signal Lab | waiting | | Analog IC Lab, `switched` charge conservation | `MIXED_SIGNAL_LAB_PLAN.md` |
| RF Lab | waiting | | Analog IC Lab, Fields Lab's line | `RF_LAB_PLAN.md` |
| System Lab | waiting | | RF Lab | `SYSTEM_LAB_PLAN.md` |
| VLSI Lab | waiting | | Logic Lab, Analog IC Lab | `VLSI_LAB_PLAN.md` |
| Computer Lab | built, dark | merged | | `COMPUTER_LAB_PLAN.md` |
| Interfaces Lab | waiting | | Logic Lab, Electronics D, Mixed-Signal Lab | `INTERFACES_LAB_PLAN.md` |
| Grid Lab | built, dark | merged | Power Lab I3 and D1 for two cross-references | `GRID_LAB_PLAN.md` |
| Photonics Lab | waiting | | Electronics O, Applied Analog Lab | `PHOTONICS_LAB_PLAN.md` |
| Devices Lab | built, dark | merged | | `DEVICES_LAB_PLAN.md` |
| Fields Lab | building | `lab/fields-lab` | Groups I to L unbuilt | `FIELDS_LAB_PLAN.md` |
| Energy Lab | building | `lab/energy-lab` | Machines Lab for the wind group | to write |
| Machines Lab | building | `lab/machines-lab` | Power Lab F for the drives group | to write |
| Communications Lab | waiting | | Random Signals Lab | to write |
| Information Lab | waiting | | Communications Lab | to write |
| Applied Analog Lab | waiting | | Electronics L, M | to write |
| Analog IC Lab | waiting | | Electronics H to M | to write |
| Mixed-Signal Lab | waiting | | Analog IC Lab, `switched` charge conservation | to write |
| RF Lab | waiting | | Analog IC Lab, Fields Lab's line | to write |
| System Lab | waiting | | RF Lab | to write |
| VLSI Lab | waiting | | Logic Lab, Analog IC Lab | to write |
| Computer Lab | waiting | | Logic Lab | to write |
| Interfaces Lab | waiting | | Logic Lab, Electronics D, Mixed-Signal Lab | to write |
| Grid Lab | waiting | | Machines Lab, Electronics companion Newton | to write |
| Photonics Lab | waiting | | Electronics O, Applied Analog Lab | to write |
| Devices Lab | waiting | | Electronics C | to write |
| Signal Integrity | out of this repo | | | |

## 2. Deferred items, by lab

Each overseer appends here. One line per item: what, why deferred, and the
dependency or decision that reopens it.

### Circuit Elements Lab

- **Released 2026-09-05 as v1.1.0.** It is the first card on the splash page, with
  the "Start here" kicker the plan decided, first in every lab's nav, and in the
  README. The master merge behind it brought Reed's in-order try-step test and
  the rule that every experiment poses a quiz. H7's third step and I10's fourth
  now set back what an earlier step changed. I9's load step reads the output at
  the cursor on the drop model it restores.
- I9 the clamper and I10 the doubler: assigned to the seams overseer.
- H7 "the roots are the poles": assigned to the seams overseer.
- The GBW toggle: superseded by the Electronics Lab's op-amp macro, which Elements
  may import once it lands.

### Circuit Lab

- The impulse-response experiment (`CURRICULUM.md` seam 2): assigned to the seams
  overseer.
- A gain-bandwidth knob on the op-amp circuits: waits for the Electronics macro.

### Power Lab

Groups **D** (magnetics), **F** (inverters) and **G** (losses) are built on
`lab/power-lab-dfg`, twelve experiments on top of the twenty-two the lab
already carried. The lab now runs in the plan's own order, A to G, at
thirty-four experiments, and stays dark. `packages/switched` gained the
piecewise-linear core and its shooting solver, the flyback and the
half-bridge, the fixed-pattern solver with exact Fourier integrals, the PWM
comparator, the two inverter bridges and the loss ledger. Every existing
signature stands. One line moved, and `apps/power-lab/AGENT_BRIEF_DFG.md`
names it.

Deferred, with what reopens each:

- **D5, the leakage spike, is not built.** It is the plan's own stretch
  (§4, §10). The flux that does not link both windings needs a third state
  and a clamp, which is a new state variable rather than a new lesson. Every
  other experiment in the group works without it. Reopens with anyone
  extending `packages/switched/src/isolated.js` to three states.
- **The half-bridge holds its divider midpoint stiff at V_in/2**, as the plan
  says v1 would. So it carries no magnetising current and stores nothing by
  construction, and the duty-asymmetry demonstration D4 mentions has nothing
  to walk. The drawing puts the blocking capacitor in the primary loop, which
  is the part that does the forgiving. Reopens with the midpoint as a third
  state.
- **`verify.mjs` has not been run against the new groups.** This environment
  has no browser. The three new panes (flux, scrub, ledger), the two new
  sweeps and the four new drawings have been held as geometry and as rendered
  markup rather than as pixels. Nobody has read a screenshot of them as a
  student would (`REVIEW_PLAYBOOK.md` §11). The group tab row is now seven
  wide, which is the first thing a browser pass should measure against the
  1366×768 fold. Reopens with anyone who has a browser.
- **The half-bridge declines rather than solving** where its secondary pulse
  n·V_in/2 is smaller than its rectifier's drop. The output inductor is then
  never fed and the model's assumption fails. `conv.deliverable` and
  `conv.headroom` carry it, and the app's knob ranges keep a reader clear of
  it. A gate message on screen is the missing half. Reopens with the first
  experiment that lets a reader reach it.
- **Groups H to N have no overseer in this program.** H, closing the loop,
  needs Control Lab's `plant=custom` round trip, which is a hand-over rather
  than machinery. I, J, K, L, M and N are curriculum on machinery that now
  exists. I and J sit on D4's half-bridge and F's comparator, K and L on E's
  diode events, M and N on Signal and Circuit Lab's own tools. The Machines
  Lab's drives group and the Energy Lab's inverters wait on F and L. F is now
  built, so the inverter half of that wait is over.
- **`npm ci` does not run on this branch.** `package-lock.json` is missing
  `random-lab`, so `npm ci` refuses and the worktree was installed with
  `npm install --no-save`. Nothing in this lab needs a new dependency, and the
  lock file was not touched. Reopens at integration, where the director's
  `npm install` regenerates it.

### Instruments Lab

- **The network-analyser group.** Four experiments the plan names and does not build.
  A reflection coefficient read on a mismatched line, a one-port measured against a
  known standard, the two-port that a through and a reflect calibrate, and the Smith
  chart the whole group is read on. It waits on the RF Lab for the line model and the
  chart, per Decision 2 of the plan. Nothing in the built lab references any of it.
- **The browser harness is written and unrun.** `apps/instruments-lab/scripts/verify.mjs`
  drives the built page, reads every check row off the screen, switches every view and
  holds the page to 390 px. Reed's instruction for the sitting that wrote it was no
  Playwright, so the first run belongs to the next sitting. `app.test.jsx` renders the
  shell and the panes on the server in the meantime, which is what found the missing
  export the harness would have found first.
- **Elements' progress path, prediction, headlines, marks and captions.** The shell was
  built without those five modules. A try step is a button that turns its knobs rather
  than a step that ticks itself off when the screen shows what it asked for. The
  schematic carries no callout and the plots carry no caption. Each is a copy of an
  Elements module and a sitting of its own, and none of them changes a number.
- **The sample-and-hold, aperture time and hold droop.** Decision 4 of the plan. They
  need scheduled switch events in `packages/network`, and the contract is in
  `NEEDS.md`.
- **A four-quadrant multiplier as an element.** Not needed here: the lock-in's mixer is
  written as the two sinusoids its product is, exactly. Group E is the second consumer
  to name if another lab asks for the element itself.

### Electronics Lab

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

- **Group O should import `@ee-labs/random`** rather than write a second
  generator or a second periodogram. O1 calls `whiteNoise` and
  `averagedPeriodogram`, O2 calls `capacitorNoise`, O3 calls `shotDensity`. The
  contracts are frozen in `apps/random-lab/AGENT_BRIEF.md` §3.5 and §3.6, and
  the numbers are in `apps/random-lab/NEEDS.md` §5.
- **O1's cross-reference to the Random Signals Lab is pending.** That lab's A1
  now teaches "a random signal has a density, not a spectrum", so O1 references
  A1 by id instead of teaching it. Reopens when Electronics Group O is built.
- **O2's cross-reference to F3 is pending**, on the same terms. F3 is the
  `kT/C` experiment, and both labs call one function for the number.
- **Groups D to I are built and merged, 2026-09-05.** Three lanes, each built
  and then reviewed by a second agent that fixed what it found, took the lab
  from 10 experiments to 43 over eight groups. The first entry above, which
  says Groups D to O wait on the symbol, is superseded for D to I. Groups J to
  O are in flight on `lab/electronics-jk`, `lab/electronics-lm` and
  `lab/electronics-no`.
- **The director resolved six term collisions at the merge.** Four terms were
  defined by two lanes, and the earlier group keeps each. Output resistance is
  now D2's and matching is D6's, because both words did work there before the
  lane that defined them. The numbers a term's definition quotes are still
  measured by no test, which the file's owner should take up.
- **C4's cross-reference to Group E can be restored.** E4 is built, and the
  sentence is in `apps/electronics-lab/src/lessons/c.js`, which no lane owned
  this wave.
- **`layoutCheck.js` still checks a transistor as a two-terminal element.** The
  real boxes are exported by `schematicGeometry.js`, and every lane worked
  around it with a designator-only label. Item 7 of each lane's section in
  `NEEDS.md` has the arithmetic.
- **`readQuantity` resolves none of the brief's small-signal paths.** Groups F
  to I read their gains and port resistances through functions instead, and a
  transistor's schematic reading is a dash because a companion-stamped device
  files its currents under `Q1.g0`. Items 9 and 11 of the F and G section in
  `NEEDS.md`.
- **`math.js` produces `x.curves` since the D lane, and still no `x.spectrum`.**
  F5 and H2 measure their second harmonic through the quasi-static
  characteristic instead. The first group that needs distortion from a
  spectrum wants the same hook.
- **G2 measures the loading rule at both ends of one box, not across two.** Nine
  elements and six legs do not fit the 420-wide canvas. I5 carries the
  two-stage case now.
- **The transfer view draws no tangent while its title promises one.** The
  scope's y axis is volts only, so G1 cannot show its test current beside the
  port voltage. Items 12 and 13 of the F and G section in `NEEDS.md`.
- **Nobody has looked at Groups D to I in a browser.** Thirty-three drawings
  and the device-curve pane were checked as geometry only. The harness wave
  covers the Electronics Lab last, after its lanes have merged.
- **Groups J to O are built and merged, 2026-09-05.** The second wave of three
  lanes, each built and then reviewed, took the lab from 43 experiments to 75
  over fourteen groups. Only Group B remains, and it is Elements I9 and I10 by
  Decision 3. The entries above that wait on Group O or on a later Electronics
  group can now be taken up.
- **K5 is the follower alone.** The plan's K5 is the follower and the common
  base, and the lane built half of it without saying so until the review
  caught it. One experiment cannot swap its topology while its layout is a
  fixed object. Reed decides whether the plan's line moves or a K7 is added.
  Item 7 of the J and K section in `NEEDS.md`.
- **The plan's section 5 still carries the planned numbers.** Eleven moved in J
  and K, five in L and M, and the lanes tabulated each with the engine's value
  in their sections of `NEEDS.md`. The plan is the director's to bring into
  line, and it is not done yet.
- **The two-stage op-amp reaches a gain of 3 240, not the plan's 100 000.** Its
  second stage is loaded by a resistor rather than by a current source, so the
  numbers in M1 to M5 are measured against the smaller gain. Reopens with
  Group I's mirror used a second time as the load.
- **`pwlTransient` records an event whose new region is the one it just left.**
  Where a crossing lands exactly on a sample of the walk's grid, the settle
  returns the same region. About one amplitude in a few dozen of M6 then ends
  in the chatter refusal after a few seconds. The fix is two lines in
  `packages/network/src/pwl.js`, which is the Electronics overseer's.
- **`loop.js` declines an op-amp by type**, so N1's return ratio at the
  oscillation frequency is measured as the Wien network's transfer rather
  than as the loop's own ratio. Item 15 of the N and O section in `NEEDS.md`.
- **The Control Lab hand-over beside L5 and M3 is not wired.** The margins are
  measured and printed, and the deep link needs a pane and a view-registry
  entry, both outside any lane.
- **The director resolved nine more term collisions at the second wave's
  merge.** J and K redefined six terms that D, E, H and I introduce. L and M
  redefined the test source, the mirror and Miller. G1 says oscillator first
  and M6 says total harmonic distortion first, so they list those terms. N's
  oscillation threshold and distortion patterns were narrowed to N's own
  phrasing, because D4 and H2 use the same words for other quantities.
- **M1's drawing is 840 by 530.** At a phone width its labels scale to about 5
  px. It is the first thing to look at in a browser.
- **The plan's section 5 now quotes the measured numbers**, 22 of them across
  Groups E to O, each traced to a pin in the tests or a reads pair in the
  lessons. Thirteen places differ from the plan in shape rather than number,
  and each is Reed's to rule on. The plan's line stands until he does.
  - D3 refuses below its own saturation voltage rather than disagreeing by 10 %.
  - D7 turns the base current, not v_BE, because the three-region model cannot take both.
  - E5 holds the gate with a source, not a divider. The gate draws no current, so the numbers agree.
  - H2's second harmonic falls by the square of 1 + g_m R_E, a ratio of 20.8, not 4.87.
  - K5 is the follower alone. The common-base half against H4 is not built.
  - L2 measures desensitivity alone. The stage's distortion falling by 1 + T is not built.
  - L4 presents the four topologies as prose, not as the plan's table.
  - L5 shows poles and readings. Its closed-loop response peaks, so the Bode view has no corner to read.
  - M1's open-loop gain is 3 240, not 100 000, because the second stage is resistor-loaded.
  - M2 prints the measured unity-gain frequency beside the estimate, not the fold's error at ten times the pole.
  - M6's largest drive is 9 V, supply-limited, and its distortion reads 4.61 % there against the plan's 4.3 % at 10 V.
  - N1 measures the Wien network's own transfer, because the loop breaker declines an ideal op-amp.
  - N4 draws the transistor as its tangent with a current limit, not as the three-region device.

### Random Signals Lab

Built on `lab/random-lab`. Thirty experiments in nine groups, all pinned. The
engine is `packages/random`, fuzzed green against the plan's §3 before any user
interface existed.

Deferred, with what reopens each:

- **The Playwright harness has not been run.** `apps/random-lab/scripts/verify.mjs`
  is written and covers every experiment, every view, the fold and the phone
  width. This environment has no browser. Reopens with anyone who has one.
- **No screenshots were read as a student would read them**
  (`REVIEW_PLAYBOOK.md` §11). Nearly half the defects that playbook records were
  invisible to a test suite and obvious in a picture. This lab has had no such
  pass. Reopens with the harness.
- **F3 derives `kT/C` from the density rather than from a netlist**, because
  Electronics O2 is not built. The formula is stated as physics with its
  constants named. Reopens when Electronics Group O lands, at which point O2
  solves the netlist and the two labs cross-reference each other.
- **Spectral estimation by a fitted model is out**, meaning the autoregressive
  spectrum. It belongs to the DSP Lab, which owns `packages/dsp`. E4's note says
  so. Reopens if the DSP Lab wants it earlier.
- **The multivariate Kalman filter is out.** This lab's is scalar, and Control
  Lab II owns the vector form. I2 is the door.
- **A deep link to or from another lab.** Nothing crosses yet, because the two
  labs that would receive one (Communications, Control Lab II) are not built.
  The plan's §6 names the four hand-overs.

Needed from elsewhere, mirrored in `apps/random-lab/NEEDS.md`:

- The `deploy.yml` line, `cp -r apps/random-lab/dist _site/random-lab`.
- The progression-test ids and counts, 30 experiments in 9 groups.
- A decision on the ensemble canvas's data props at promotion. This lab passes
  `ensemble`, `x` and `y`. The Applied Analog Lab's plan passes `runs`,
  `summary` and `axes`. The `band` and `count` props the director asked for are
  identical in both and are carried here from the first commit.
- A fix for two timeouts in `apps/circuit-elements-lab/src/experiments.test.js`,
  which are the only failures in a whole-suite run on this branch. They sit
  behind the branch point and this branch touches nothing they use. The lab that
  owns the file decides whether to lengthen the timeout, shorten the sweep or
  split the three walks.

### Machines Lab

**Built.** `packages/machines`, and `apps/machines-lab` dark with 35 experiments
in five groups. A the DC machine (8), B the transformer (6), C the rotating
field and the induction machine (9), D the synchronous and permanent-magnet
machines (7), E losses and the thermal limit (5).

Every number a lesson quotes is a `reads` pair measured against the model in
`experiments.test.js`, and a sentence carrying a figure nothing pinned fails
that file. The plan's seven invariants are fuzzed in
`packages/machines/src/invariants.test.js`. `RELEASE_STATUS` reads `dark`, and
`release.test.js` holds the three public surfaces clear of the lab.

**Needed from elsewhere.** `apps/machines-lab/NEEDS.md` carries all of it. The
deploy line, the progression ids and counts, the phase plane offered to
`packages/ui`, two stamps offered to `packages/network`, and the Grid Lab's
synchronous-machine contract, which is met rather than deferred.

**Deferred.**

- The drives group, four experiments specified in `MACHINES_LAB_PLAN.md`
  Decision 4: a chopper into the DC machine, an inverter into the induction
  machine, and a field-oriented drive. All four wait on Power Lab's Groups F
  and L, which have no overseer. No lesson in this lab references them.
- Three-phase from the circuits side has no home in the suite. C1 and C2 carry
  the Y and Δ relations as term definitions and one experiment, because the
  rotating field cannot be shown without them. Power Lab Group I is the
  recommended home once it is built, and the director then picks one owner.
- The phase-plane canvas (`apps/machines-lab/src/components/canvases.jsx`,
  `PhasePlaneCanvas`) is offered for promotion to `packages/ui` once Control
  Lab II needs it. It is minimal by Decision 5, and `NEEDS.md` records what
  Control Lab II's fuller version will still want.
- The ideal transformer construction (`packages/machines/src/port.js`,
  `senseBranch`) is offered to whoever writes Elements F8. Two stamps it would
  make unnecessary, a current-controlled current source and a coupled
  inductor, are offered to `packages/network`, both named in `NEEDS.md`.

### Energy Lab"

`BACKLOG.md` is not on this branch. The entry is written here for the director
to paste at integration, rather than added to a file this branch does not
carry.

### Energy Lab

- **The wind group.** Not started. A turbine's electrical half is a machine,
  and no lab in the suite teaches machines yet, so it waits on the Machines
  Lab. What it needs from there is a generator with a torque input and
  electrical terminals. Until it exists, this lab's sources are the
  photovoltaic cell and the battery, and the plan says so as a decision rather
  than an omission.
- **A starting point for `newtonDC`.** Deferred, and §4 above is the contract.
  The lab is complete without it. The current drive converges everywhere, and
  the reason it is the primitive is a sentence the lab teaches.
- **No small-signal model offered to `packages/systems`.** A cell is
  exponential and a string is twelve of them, so it is inadmissible under Rule
  1 of `CORE_SCOPE.md`. The small-signal resistance at an operating point would
  be admissible, and no experiment here needs one. That is a decision rather
  than a gap.
- **The reverse branch has no breakdown.** The model's only reverse path is the
  shunt resistance, so a shaded cell's reverse voltage is the model's rather
  than a real cell's. `src/guards.js` carries the sentence that says so, and
  the pane prints it under every picture that shows a reverse voltage. Adding
  a breakdown region would be a new element in `packages/network`, and no
  experiment here needs the exact volts.

### Logic Lab

All eight groups are built, 45 experiments, and the app is dark. What is left
is Reed's release gate (`LOGIC_LAB_PLAN.md` §9, phase 6) and the four items
below.

- **The Playwright harness**, `apps/logic-lab/scripts/verify.mjs`, is not
  written. The plan's §7 names it and nothing else in the lab depends on it.
  Two of the three things it would catch are now covered by
  `src/components/canvases.test.jsx`, which measures every canvas prop against
  the geometry it produces. What is left uncovered is the app end to end and
  the 390 px layout. Deferred to the sitting that does the REVIEW_PLAYBOOK
  audit, because the audit needs the screenshots anyway.
- **The Electronics D6 cross-reference.** Track D opens after the CMOS
  inverter, which is not built. A1 states the two-level abstraction as this
  lab's own starting point instead (Decision 7), and no lesson names D6.
  `release.test.js` takes the experiment ids that exist and refuses a reference
  to anything else, so the day D6 lands the director reopens one sentence in A1
  and one hand-over link. No experiment moves.
- **`TimingCanvas` and `StateCanvas` wait for a second lab.** Both carry the
  Interfaces, VLSI and Computer Labs' props already, named in
  `AGENT_BRIEF.md` §3.7 and `NEEDS.md` §3, and both compute their geometry as
  data so the tests move with them. Promotion to `packages/ui` waits for the
  first of those three labs to start. `RatePane` is a third candidate and a
  weaker one, and `NEEDS.md` §3 says why.
- **The engine contract differs from the three track D plans** in three ways:
  naming, the meaning of `from` on an event, and where setup and hold are
  measured. None blocks a lab, and each of the three plans already says it
  changes to match. `apps/logic-lab/NEEDS.md` §4 reconciles all three, and
  `packages/events/src/contract.test.js` holds every promise that was met.
- **`τ` and `T0` are this lab's parameters, not a measurement** (Decision 4).
  Group H prints both with every answer and names the three assumptions the
  law rests on. The Analog IC Lab's latch replaces them when it exists, and
  nothing in Group H changes but two numbers.

### Communications Lab

Built on `lab/comms-lab`. All eight groups, 50 experiments, all pinned. The
engine is `packages/comms`, fuzzed green against the plan's §2.11 before any
user interface existed. The app is dark.

Deferred, with what reopens each:

- **The Playwright harness has not been written or run.** The plan's §7 names
  one. This environment has no browser, and the Logic and Random Signals labs
  record the same deferral. What the tests do not reach is the app end to end
  and the 390 px layout. `src/components/canvases.test.jsx` measures every
  canvas prop against the geometry it produces, which covers two of the three
  classes the harness would find. Reopens with anyone who has a browser.
- **No screenshots have been read as a student would read them**
  (`REVIEW_PLAYBOOK.md` §11). Nearly half the defects that playbook records were
  invisible to a test suite and obvious in a picture. Reopens with the harness.
- **`createComplexChain` is in `packages/comms` rather than in `packages/dsp`.**
  The plan's Decision 5 asks the DSP Lab overseer for it. It does not exist
  there, so this lab built it against the signature the plan states, which is
  the fallback the plan's §11 names. Nothing in `dsp` was edited. Reopens when
  the director decides whether the move is worth making, and the contract is in
  `apps/comms-lab/NEEDS.md` §4.
- **The constellation and eye canvases are in the app.** Both carry the
  Mixed-Signal Lab's two props already, a decision grid that is not a
  constellation and a per-trace colour key, and both compute their geometry as
  data so the tests move with them. Promotion to `packages/ui` waits for that
  lab to start. The error rate canvas stays in the app under `PROGRAM.md` §4,
  because only the Information Lab claims it, and it takes the `limits` prop
  that lab needs from its first commit.
- **Group H assumes a noise figure rather than deriving one.** The RF Lab owns
  the front end and the Electronics Lab's Group O owns `4kTR`. H1 names both and
  states its constants. Reopens when either lands.
- **The hard-decision loss in H4 is a parameter, not a measurement.** Measuring
  it needs a decoder that reads soft metrics, which is the Information Lab's.
  `detect.js` ships the soft metric that decoder will read.
- **No deep link crosses to another lab.** The four hand-overs are named in the
  plan's §6, and three of the four receiving labs are not built.
- **Coding, MIMO, spread spectrum and the high-speed serial link are out**, as
  the plan's §10 states. Group D's uncoded curve is the baseline the Information
  Lab measures against, and the private simulator keeps the serial link.

Needed from elsewhere, mirrored in `apps/comms-lab/NEEDS.md`:

- The `deploy.yml` line, `cp -r apps/comms-lab/dist _site/comms-lab`.
- The progression-test ids and counts, 50 experiments in 8 groups.
- A decision on promoting the two canvases when the Mixed-Signal Lab starts, and
  on whether `createComplexChain` moves to `packages/dsp`.

Three numbers the plan quotes that the engine does not reproduce, each recorded
rather than rounded away and each for the director:

- **The residual ISI figures** in §2.3 and C6 are the nearest-neighbour measure.
  `residualIsi` returns that as `near`, beside `peak` over every symbol lag and
  `sum` over all of them. The three differ by more than an order of magnitude at
  a span of 12, and `near` reproduces the plan exactly. The plan's sentence
  should say which of the three it quotes.
- **G3's equaliser length.** A 21-tap zero-forcing equaliser leaves 1.17e-2 on
  the two-ray channel rather than the 1e-3 the plan asks for. At 41 taps it
  leaves 3.66e-4. The app defaults to 41 and the lesson quotes both.
- **H1's cascaded noise figure.** Friis over the two stages the plan names gives
  1.784 dB and 4.071 dB, against the plan's 1.944 and 4.166.
### Devices Lab

All seven groups are built, 30 experiments, and the app is dark. The engine
landed whole, so nothing after Group A waited on anything, and the plan's
phasing is updated to say so. What is left is Reed's release gate
(`DEVICES_LAB_PLAN.md` §9) and the items below.

- **The Playwright harness**, `apps/devices-lab/scripts/verify.mjs`, is not
  written, and no one has read a screenshot of this lab as a student would
  (`REVIEW_PLAYBOOK.md` §11). This environment has no browser. What the harness
  would catch and the unit tests do not is the app end to end and the 390 px
  layout. Deferred to the sitting that does the audit, because the audit needs
  the screenshots anyway.
- **`ProfileCanvas` is app-local and merges into the Fields Lab's field map.**
  It is written against the props that overseer was sent, listed in
  `apps/devices-lab/NEEDS.md` §4, so the merge is a rename rather than a
  rewrite. Reopens when `lab/fields-lab` lands the one-dimensional mode.
- **The hand-overs of the plan's §6 name no experiment by id.** Electronics
  Group C is built and Groups D and E are not. So B3, B5, C5, D2 and E2 name
  the other lab in words and cite nothing. `experiments.test.js` refuses a
  reference to an experiment this lab does not carry. The day those groups land
  the director restores five sentences and the deep links with them.
- **Five of the plan's quoted numbers moved when they were computed** rather
  than rounded. They are the three breakdown voltages, the Early voltage, `n_i`
  at 250 and 400 K, the depletion approximation's edge error, and invariant 5's
  stated tolerance. `apps/devices-lab/NEEDS.md` §5 gives each one and why. The
  plan's §4.3 is left as written, because the measured numbers are in the
  lessons and the tests.
- **`mos.js` was folded into `junction.js`** by the director's ruling, which
  named one file. The plan's Decision 2 asked for a sibling. `junction.js` is
  now 830 lines and splitting it is a refactor its owner can take at any time.
- **The sittings script is not written and Decision 6 is unsettled.** The plan
  asks two of three seats to enter at Group B and at Group C, to settle which
  entry point a reader prefers. That waits on the same sitting as the audit.
- **`npm ci` does not run on this branch.** `package-lock.json` is out of sync
  with six workspaces that are not this lab's. The director regenerates it once
  at integration.
### Grid Lab

All ten groups are built, 42 experiments, and the app is dark. Group I ships
with the rest, because the Machines Lab's synchronous machine is merged and
`packages/grid`'s `stability` imports it rather than writing a second one. What
is left is Reed's release gate (`GRID_LAB_PLAN.md` §9, phase 9) and the items
below.

- **The Playwright harness**, `apps/grid-lab/scripts/verify.mjs`, is not
  written. The plan's §7 names it and nothing else in the lab depends on it.
  Every number is covered by `src/experiments.test.js`, and every canvas draws
  from geometry the tests can read. What is left uncovered is the app end to
  end and the 390 px layout, including the sequence pane, which is the widest
  picture in the suite and stacks vertically below 500 px. Deferred to the
  sitting that does the REVIEW_PLAYBOOK audit, because the audit needs the
  screenshots anyway.
- **Two cross-references to Power Lab stay deferred.** B5 names Power Lab I3
  for the inverter that produces a balanced three-phase set, and C4 names Power
  Lab D1 for the magnetic core a transformer winding sits on. Both groups are
  planned with no overseer. Neither reference is a link today, so nothing is
  red on their account, and `src/release.test.js` carries both as data so they
  can be found without reading the lessons. Each reopens when its Power Lab
  group lands.
- **Group G runs on a textbook machine rather than the Machines Lab's.** The
  reactances in `library.js`'s `FAULT_NETWORK` are the plan's §4.3 set. Wiring
  the fault study to the imported machine's own subtransient reactance is one
  line in `faults.js`, and it waits for the release audit so the numbers move
  once rather than twice.
- **The DC power flow's guard is written on one network.** The thresholds are
  10° to warn, 30° to decline the flow arrows, `R/X` above 0.25, and a
  magnitude outside 0.95 to 1.05 pu. `invariants.test.js` fuzzes them across
  120 random networks and holds the promise that nothing inside the guard errs
  by more than 5 % of the largest flow the network carries. That measure is
  against the largest flow rather than per branch, because a branch carrying a
  hundredth of a per unit can be wholly wrong in relative terms and nearly
  right in megawatts. The per-branch reading is what E1 and E2 quote.
- **Six numbers differ from `GRID_LAB_PLAN.md`**, each recomputed from the
  engine and listed with its reason in `apps/grid-lab/NEEDS.md` §6. Three are
  substantive. The closed-form clearing time at zero transfer is 0.146827 s
  rather than 0.172761 s. The integrator's guard fires at a 50 ms step rather
  than at 1 ms, because fourth-order Runge–Kutta is already accurate there.
  The shunt that restores 1.00 pu is 63.2051 Mvar rather than 40 Mvar. The
  plan's §5 also crosses the Group H and Group I letters, and the ids here
  follow the group letters.
- **No optimal power flow, no unit commitment, no state estimation.** The
  plan's §10 lists ten non-goals and each is a decision rather than an
  omission. The two most likely to be asked for are a dispatch with a loss
  formula and a second machine for multi-machine stability, and both are named
  there with the reason.
### Computer Lab

All seven groups are built, 30 experiments, and the app is dark. The engine, the
app and the two documents are on `lab/computer-lab`. What is left is Reed's
release gate (`COMPUTER_LAB_PLAN.md` §9, phase 7) and the items below.

- **The browser harness**, `apps/computer-lab/scripts/verify.mjs`, is not
  written. The plan's §7 names it. Two of the three things it would catch are
  covered without a browser. `App.smoke.test.jsx` mounts every pane of every
  experiment against that experiment's own analysis.
  `components/canvases.test.jsx` measures every canvas prop through the
  geometry it produces. It checks that no two datapath blocks overlap and that
  every block fits inside 390 px. What is left uncovered is the app end to end
  and the layout as a picture. Deferred to the sitting that does the
  REVIEW_PLAYBOOK audit, because the audit needs the screenshots anyway.
- **Invariant 7 of the plan is false**, and the correction is in
  `apps/computer-lab/NEEDS.md` §5. A fully associative cache with least
  recently used replacement can miss more than a direct-mapped one of the same
  size, and the fuzzer found a four-reference trace that does it. The
  counter-example is pinned in `engine/engine.test.js`, and what does hold is
  tested beside it. The plan's §2.8 needs the wording changed.
- **The model card's ALU entry is 8 gate delays and the netlist measures 17**,
  which `NEEDS.md` §5 puts to the director. Both numbers are on screen in A3
  and the difference is named there. Making the card follow the netlist would
  move the clock period and change every number in Groups C and E.
- **The VLSI Lab's gate delays** are quoted rather than extracted (plan
  Decision 5). The card states 37.65 ps for a NAND2 and 22.59 ps for an
  inverter, and every other delay in the lab is a whole multiple of one of
  them. Invariant 10 compares the two labs' cards, and it waits for that lab.
  Nothing else in this lab waits for anything.
- **The two canvases are copied rather than imported.** `TimingCanvas` and
  `StateCanvas` are the Logic Lab's, and `PROGRAM.md` §4 names this lab as
  their second claimant. `NEEDS.md` §3 asks the director to promote both into
  `packages/ui`, and this app deletes its copies when that lands.
- **Three plan numbers moved**, because this lab computes them rather than
  quoting them. The even-split pipeline period is 444.3 ps against the plan's
  414.1, because the plan divided the single-cycle path rather than the five
  stage delays. The multicycle count is 4.05 cycles an instruction against
  4.35, from the five-state machine the lab actually walks. And E3's chain
  costs four stall cycles without forwarding rather than three, because the
  second dependent instruction meets the first one where the schedule puts it.
- **Carry select is specified and not built.** The plan's §4.3 quotes it at 13
  gate delays and no experiment in §5 measures it. Group A builds the ripple
  carry and the two-level lookahead, which are the two A1 and A2 need.

### Seams

The two seams of `CURRICULUM.md` §3 and the progression test of its §6.

- The hand-over half of §6, "every hand-over this document names has a test at both
  ends", is not measured. Seam 3 has no far end until the Electronics Lab is built and
  seam 5 none until Power Lab's Group H is. Reopens with either.
- Circuit Lab's step view draws the step and not h(t). The note reads h(t) as the step
  curve's own slope, and the test measures that slope against the closed form, so the
  claim is checked and the picture is one trace short. Reopens when the step view takes
  a second trace, which is the Circuit Lab owner's file rather than the seams overseer's.
- Elements H7 reads its two roots as numbers, in the state view and as two distances in
  the math panel. It does not draw them on a plane. `PoleZeroCanvas` in `packages/ui` is
  the picture the experiment wants. Reopens when the director grants that canvas an
  Elements view.
- I9 and I10 pose no predict question. Their knob steps move a number, but what they
  promise is a mean over the last cycle and a cycle's peak. `readQuantity` has a path for
  neither, so no answer card can print one. Reopens when those two quantities have paths.
- The progression test carries the plan file for Power Lab in its own table, because §2's
  Power section names no plan. The Electronics section does name one, and the test checks
  that the two agree. Reopens if the director gives every planned lab's section the same
  sentence.

### Seams

The two seams of `CURRICULUM.md` §3 and the progression test of its §6.

- The hand-over half of §6, "every hand-over this document names has a test at both
  ends", is not measured. Seam 3 has no far end until the Electronics Lab is built and
  seam 5 none until Power Lab's Group H is. Reopens with either.
- Circuit Lab's step view draws the step and not h(t). The note reads h(t) as the step
  curve's own slope, and the test measures that slope against the closed form, so the
  claim is checked and the picture is one trace short. Reopens when the step view takes
  a second trace, which is the Circuit Lab owner's file rather than the seams overseer's.
- Elements H7 reads its two roots as numbers, in the state view and as two distances in
  the math panel. It does not draw them on a plane. `PoleZeroCanvas` in `packages/ui` is
  the picture the experiment wants. Reopens when the director grants that canvas an
  Elements view.
- I9 and I10 pose no predict question. Their knob steps move a number, but what they
  promise is a mean over the last cycle and a cycle's peak. `readQuantity` has a path for
  neither, so no answer card can print one. Reopens when those two quantities have paths.
- The progression test carries the plan file for Power Lab in its own table, because §2's
  Power section names no plan. The Electronics section does name one, and the test checks
  that the two agree. Reopens if the director gives every planned lab's section the same
  sentence.

### Control Lab II

Thirty-two of the plan's thirty-five experiments are built, dark, on
`lab/control-lab-ii`. Groups A to F, with F at two of five. What is not built:

- **F3, F4 and F5, the Kalman filter's statistical half.** The covariance
  recursion, the steady state it settles to, and the ensemble that shows the
  spread landing on the covariance the recursion predicted. Each needs a noise
  model with a variance and a way to run many realisations, which is the Random
  Signals Lab's `random` package. Decision 4 of the plan split the group for
  this reason, and F1 and F2 are the deterministic half and stand on their own.
  **Reopens when `random` lands.** No text in this lab names that lab until it
  does, so nothing has to be unsaid when it arrives.
- **The Kalman and Random Signals cross-reference.** The same dependency read
  the other way. Once both labs are built, F1's note should point at the
  ensemble that makes the covariance visible, and the Random Signals Lab's
  estimation group should point back at F2's duality. Neither pointer exists
  yet, and neither should until both ends do. **Reopens with the same
  dependency.**
- **The Playwright harness, `apps/control-lab-ii/scripts/verify.mjs`.** Four
  checks were planned and two are now held by unit tests instead. The phase
  canvas's whole drawing plan is arithmetic in `phaseGeometry.js` and is tested
  there. `verdict.test.js` walks every experiment and fails any mode that shows
  an approximation without its guard. The two that remain are the layout ones,
  that no view scrolls sideways at 390 px and that the guard banner sits where a
  reader will see it. Both need a browser. **Reopens at the release gate**,
  phase 7 of the plan, which is the only phase outstanding.
- **The step and loop canvases, promoted.** `StepCanvas.jsx` and
  `LoopDiagram.jsx` are second copies of Control Lab's. `PROGRAM.md` section 4
  makes a third copy the signal to promote, and `NEEDS.md` records both.
  `PhaseCanvas.jsx` is a separate case and is ready to move the day the Machines
  Lab claims it, with no change to its interface. **Reopens when a third lab
  copies one, or when Machines Lab starts.**

### Fields Lab

Built and dark. 36 experiments in groups A to H, on `packages/fields`, which is
complete for the whole lab and not only for the built half. `FIELDS_LAB_PLAN.md`
§9.1 says what shipped in each sitting.

- **Group I, transmission lines, i1 to i7.** Not built. Nothing blocks it. The
  engine is done and tested, `line.js` and `bounce.js` both, and the app's
  analysis and quantity paths are wired for it. It is a sitting's work, and it
  is the one the RF Lab waits on.
- **Group J, the lossy line, j1 and j2.** Not built, and it follows group I in
  the same sitting. J2 is the lab's second refusal, a lossy line in time, which
  `refuseLossyTime` already declines with its reason and a test.
- **Groups K and L, waveguides and antennas, k1 to k3 and l1 to l5.** Not built.
  `waveguide.js` and `antenna.js` are done and tested. The System Lab's link
  budget waits on L5.
- **The Smith chart.** Not drawn. It belongs to group I's sitting, and
  `apps/fields-lab/NEEDS.md` §3.2 puts the decision to the director before the
  drawing exists rather than after.
- **The bounce diagram on `@ee-labs/events`.** The loop is self-contained inside
  `packages/fields/src/bounce.js` because the Logic Lab was building that package
  in parallel. `NEEDS.md` §4 says what the swap would need. Reopens when the
  package lands.
- **The field map's promotion to `packages/ui`.** Waits on the Devices Lab
  claiming it. `NEEDS.md` §3.1 carries the requirement, and the profile mode is
  built to it.
- **`scripts/verify.mjs`.** Written and not run. It needs a browser and a served
  build, and no Playwright ran in these sittings. A first run reviews the script
  as much as the page.

## 3. The director's queue

Items that cross labs and land at integration.

- `deploy.yml`: one `cp` line per new dark lab, from each lab's `NEEDS.md`.
- `progression.test.js`: every new lab's ids and counts, from each lab's `NEEDS.md`.
- Shared canvases promoted to `packages/ui` when a second lab claims them
  (`PROGRAM.md` §4).
- One error-rate canvas on a log axis for `packages/ui`, with `counts` and `gain`
  props, would serve both the Communications and Information labs, which each drew
  their own. Shapes are in the Information Lab's `NEEDS.md` §4.
- `TimingCanvas` and `StateCanvas` now have their second claimant, the Computer Lab,
  which carries copies with provenance comments. Promotion is due.
- The nav fold (`ELECTRONICS_LAB_PLAN.md` Decision 5) in the first release commit
  that makes a sixth lab public.
- Three decisions raised by the Grid and Devices planner, for Reed. The suite's
  `n_i` pin is 1.5 × 10¹⁰ cm⁻³, and the band-edge densities give 1.08 × 10¹⁰, a
  20.7 mV shift in `V_0` if changed. The MOSFET threshold is 0.7 V in Electronics and
  0.32 V derived, which the Devices plan closes with a threshold implant. The Grid
  plan recommends `packages/grid` owning its own power-flow Newton.
- The one-line diagram canvas goes to `packages/ui` on its first build. The Energy
  Lab's props go in its signature (Grid plan, Decision 3).
- The Fields Lab's field-map canvas needs a one-dimensional profile mode for the
  Devices Lab. Sent to the Fields overseer as a need.
- The ensemble canvas's data props at promotion. The Random Signals Lab passes
  `ensemble`, `x`, `y`, and the Applied Analog plan's §4.3 passes `runs`, `summary`,
  `axes`. The `band` and `count` props agree. One shape is chosen at promotion.
- `createComplexChain` lives in `packages/comms` for now, built against the plan's
  signature because `packages/dsp` had not gained it. It moves to `dsp` when a second
  consumer appears.
- House policy on a guard's fuzzed promise (Grid Lab, E1 and E2): the DC power
  flow's error is promised against the network's largest flow, while the lessons
  quote it per branch. One of the two becomes the rule.
- The Grid plan's §5 had its group letters crossed between protection and the
  machine. The build follows the letters. Reed confirms.
- Two Elements experiment walks (the Newton diode sweeps in `experiments.test.js`)
  exceed the 90 s timeout on a loaded four-core machine. Their owner chooses a
  longer timeout, a shorter sweep, or a split, before CI gates on one command.

### Paused at Reed's request, 2026-09-05, usage near its limit

Two workflows were stopped mid-run: `power-h-to-n` (all three lanes had at
least one commit) and `rf-system-photonics` (RF and Photonics each had a
first sitting committed and a second sitting in flight). Nothing was lost.
Every worktree's uncommitted state was found and dealt with before the
worktrees were removed:

- `lab/power-lmn` and `lab/system-lab` are new branches this session made,
  pushed as committed, no uncommitted work at the pause.
- `lab/power-hi`, `lab/power-jk`, `lab/rf-lab` and `lab/photonics-lab`
  silently forked away from the branches of the same name already on
  origin. Those already carried the original cut-off session's partial work
  (`HANDOFF.md` §4 named it). The workflow scripts' setup line is
  `git checkout -b <branch> <from> 2>/dev/null || git checkout <branch>`.
  The `-b` half succeeds and creates a fresh branch whenever no *local*
  branch of that name exists yet, even when a same-named branch already sits
  on origin with different history. Four agents built on the integration
  branch from scratch instead of continuing what was there.
- Origin's original three branches are untouched, still at their
  session-limit commits. This session's much larger body of work on the same
  names is pushed under `lab/power-hi-2`, `lab/power-jk-2`, `lab/rf-lab-2`
  and `lab/photonics-lab-2`. Before Wave 3 resumes, fix the setup line: check
  `git ls-remote --exit-code --heads origin <branch>` and track it
  explicitly, rather than relying on checkout's fallback. Then decide,
  branch by branch, whether the original three commits or this session's
  rebuild is the one to keep. They were not compared.
- Two agents on `lab/rf-lab` were working against each other at the pause.
  One had staged the deletion of `packages/rf/src/match.js` and its test.
  The other had uncommitted additions to the same two files, plus a new
  `apps/rf-lab/src/groups/c.js`. Both are saved, unreviewed, as
  `wip/rf-lab-teardown-match` and `wip/rf-lab-extend-match`. They disagree on
  match.js's fate and need reading side by side before either lands.
- The System Lab's whole first-sitting app tree, untracked at the pause, is
  saved as `wip/system-lab-first-sitting`.
- The Photonics Lab's rate-equations module, untracked at the pause, is saved
  as `wip/photonics-rate-equations`.
- A scratch worktree from the Power Lab review held disposable probe scripts
  and a `zzprobe.test.js`, per house rules against committing scratch. Left
  on disk, not committed, not important.
- One worktree directory would not delete under Windows, a locked handle,
  likely a lingering node process. Harmless. `git worktree prune` already
  dropped it from git's own bookkeeping. A manual `rm -rf
  .claude/worktrees` once the lock clears is cosmetic only.

Nothing is merged to master. The suite was last confirmed green at e1b7d0a,
312 files and 9176 tests, before the pause. Nothing in the main tree changed
after that commit.

**Resumed later on 2026-09-05.** The teardown branch was a phantom. Two
worktrees shared `lab/rf-lab`, and the first one's index was older than the
branch, so its status showed the second one's commit as a deletion. It is
deleted. The three real WIP branches are folded onto their lane branches as
fast-forwards, so the resumed sittings find their own partial work where they
left it.

Origin's four original branches are kept under `lab/*-orig`, and this
session's tips sit under `lab/*-2` until Reed replaces origin's `lab/*` with
them. That is a force push, which the director's tools refuse. The setup
line is fixed in the four scripts that were not mid-run. Both workflows were
resumed from their journals, with the Power H and I lane and the RF and
Photonics first sittings replayed from cache.

### Cut off at the session limit, 2026-09-05 19:50 UTC

Every lane below ran as a workflow of Opus agents. Every agent fell to the
account's session limit within its first hour. What each left is committed on its
branch, so a fresh sitting continues it rather than restarts it. The workflow
scripts are in `.claude/workflows/`. Each one's setup checks the branch out if it
already exists, and tells the agent to read what is there first.

| Work | Branches | Script, and its args | Left on the branch |
| --- | --- | --- | --- |
| Electronics Groups D to I | `lab/electronics-de`, `-fg`, `-hi` | `electronics-lanes` with `["de","fg","hi"]` | merged 2026-09-05, 33 experiments, three lanes each reviewed |
| Electronics Groups J to O | `lab/electronics-jk`, `-lm`, `-no` | `electronics-lanes` with `["jk","lm","no"]` | merged 2026-09-05, 32 experiments, three lanes each reviewed |
| Power Lab Groups H to N | `lab/power-hi`, `-jk`, `-lmn` | `power-h-to-n` | untested `loop.js`, `threePhase.js`, `resonant.js`, and the three isolated siblings with a commit |
| RF A to D, System A, Photonics A, C to F | `lab/rf-lab`, `lab/system-lab`, `lab/photonics-lab` | `rf-system-photonics` | the RF brief, `packages/rf`'s exact core, an untested Smith canvas; the Photonics brief, package and first app files |
| Harnesses, nine labs that have one | `verify/<slug>` | `verify-harnesses` | Elements: two fixes; Circuit Lab: fixes to the axis, the step readout and two canvases, untested |
| VLSI and Interfaces | `lab/vlsi-lab`, `lab/interfaces-lab` | `vlsi-interfaces` | not started |
| Harnesses, the ten labs without one | `verify/<slug>` | `harness-wave-2`, args a list of slugs, `electronics-lab` last | not started |

Each script runs at most two agents at once on a four-core box, and every agent
throttles vitest to two workers. Run the scripts in the table's order, and integrate
each branch a reviewer marks mergeable before the next tier starts.

Waiting behind those, with what each waits on:

- the Applied Analog, Analog IC and Mixed-Signal labs, on the Electronics lanes, all merged on 2026-09-05, so they wait on nothing now;
- RF Groups E to H and System Phases 2 to 6, on Electronics K and O, both merged;
- Photonics Group B, on Electronics O, merged;
- the Machines Lab's drives, on Power Lab Group L, in flight since 2026-09-05.

## 4. Planner entries

### Planner: Grid, Devices

Two plans, written together on `plan/grid-devices`. `GRID_LAB_PLAN.md` is 42
experiments in ten groups. `DEVICES_LAB_PLAN.md` is 30 experiments in seven groups.
Each line below is a dependency, what it blocks, and what unblocks it.

**Grid Lab.**

- Group I, the machine on the grid and stability (5 experiments): waits on the Machines
  Lab's synchronous machine, which is being built. The contract is a steady-state model
  behind a transient reactance, a fault model behind a subtransient reactance,
  negative- and zero-sequence reactances, an inertia constant and a mechanical power.
  Reopens when `lab/machines-lab` lands that model.
- `packages/grid`'s power flow: leans on the Electronics Lab's companion interface for
  its shape (`AGENT_BRIEF.md` §3.2), which is planned and not built. The Grid Lab owns
  its own polar Newton (Decision 2), so this is a shape dependency and not a code one.
  Reopens if the Electronics contract changes.
- B5's cross-reference to Power Lab I3, and C4's to Power Lab D1: both groups are
  planned with no overseer. The progression test fails on each reference until they
  exist, by design.
- The one-line diagram with power-flow arrows: new in `packages/ui`, with the Energy
  Lab named as the second user (`PROGRAM.md` §4). Its props carry that lab's needs from
  the first commit. The director's queue item is the promotion.
- `deploy.yml` and `progression.test.js` entries for `/grid-lab/`: through `NEEDS.md`,
  as every dark lab.
- The DC power flow's guard thresholds (10° warn, 30° refuse, `R/X` 0.25, magnitude
  0.95 to 1.05 pu) are set on one three-bus system. They move if the fuzz finds more
  than 5 % of branch-flow error inside the guard.

**Devices Lab.**

- `junction.js` additions: the file is owned by the Electronics Lab's lane 3
  (`PROGRAM.md` §5). The additions are new exports and no existing signature changes.
  The contract goes into `apps/devices-lab/NEEDS.md` and the director resolves it once.
  Reopens when Electronics lane 3 lands.
- Every group: leans on Electronics Group C's four closed forms, which are planned and
  not built. Cross-references rather than copies, so the progression test fails on each
  until Group C exists.
- The 1-D profile view: adapts the Fields Lab's field map, which is being built. The
  props needed are a one-dimensional mode, a stacked triple of charge density, field
  and potential on one position axis, and a bias knob that redraws all three. Phase 2
  runs against a local stub, and no group ships behind the stub. Reopens when
  `lab/fields-lab` lands the canvas.
- The value of `n_i`: `AGENT_BRIEF.md` §3.7 pins 1.5 × 10¹⁰ cm⁻³, and the band-edge
  densities give 1.079 × 10¹⁰ cm⁻³. Keeping the pin is Decision 1 and needs Reed's word.
  Changing it moves `V_0` by 20.7 mV and every Electronics C number with it.
- The threshold voltage: derived here as 321.769 mV, used in the Electronics Lab as
  700 mV. Decision 4 closes the gap with a threshold-adjust implant of
  8.1519 × 10¹¹ cm⁻². The cross-lab pin in phase 5 fails if the two labs disagree.
- F1 and F2 hand the photovoltaic cell to the Energy Lab, which is being built. F3's
  emission wavelengths hand to the Photonics Lab, which is waiting.
- `deploy.yml` and `progression.test.js` entries for `/devices-lab/`: through
  `NEEDS.md`, as every dark lab.

### Planner: Communications, Information

Two plans, written together on `plan/comms-info`. `COMMUNICATIONS_LAB_PLAN.md` is 50
experiments in eight groups. `INFORMATION_LAB_PLAN.md` is 25 experiments in six
groups. Each line below is a dependency, what it blocks, and what unblocks it.

**Communications Lab.**

- Group D, the AWGN channel and the bit error rate (8 experiments): waits on the
  Random Signals Lab, which is being built. Four objects are needed. The Q function as
  the tail of a Gaussian, a seeded Gaussian generator, the power spectral density, and
  the matched filter's `2E/N_0`. Reopens when `lab/random-lab` lands them. Nothing
  else in this lab reads any of the four.
- `createComplexChain(registry)` in `packages/dsp`: the chain runs one real number per
  sample and a constellation needs two. The contract is a mirror of `createChain` over
  an interleaved `Float64Array` of length `2n`, about eighty lines, changing nothing
  that exists. `packages/dsp` belongs to the DSP Lab overseer under `PROGRAM.md` §5,
  so this goes into `apps/comms-lab/NEEDS.md` and the director resolves it once. Phase
  1 needs none of it, and phases 2 to 7 all do. This is the plan's Decision 5.
- The constellation and eye canvases: new in `packages/ui`, with the Mixed-Signal Lab
  named as the second user (`PROGRAM.md` §4). Their props carry that lab's needs from
  the first commit, which are a decision grid that is not a constellation and a
  per-trace colour key. The director's queue item is the promotion.
- The BER canvas takes a `limits` prop from its first commit, because the Information
  Lab is its second user. That link is the only thing the two plans share.
- Group E's loops hand to Control Lab II, which is being built. The reference is to
  that lab rather than to one of its experiments, so the progression test allows it
  before that lab ships.
- Group H names the System Lab, which is waiting with no plan file. The four link
  budget experiments compute the noise floor, the path loss, one margin and one
  implementation-loss table. Antenna patterns, a real front end's cascaded noise
  figure and interference budgets are that lab's. The progression test fails on the
  reference until the System Lab exists.
- G5's LMS equaliser is the DSP Lab's adaptive filter, used rather than rebuilt. That
  lab is being built on `lab/dsp-lab`.
- H1's `4kTR` cross-references the Electronics Lab's Group O, which is planned and not
  built. The noise figure is assumed here rather than derived.
- The private `waveform-simulator` boundary (Decision 2): this lab models the link at
  the symbol rates its own chain renders and declines the high-speed serial and
  optical link, as `README.md` records. Reed's word settles where the line sits.
- `deploy.yml` and `progression.test.js` entries for `/comms-lab/`: through
  `NEEDS.md`, as every dark lab.
- The counted BER's hollow-point threshold, 30 errors, and the root raised cosine's
  span guard at 6 symbols are set on the defaults of §4.3. They move if the fuzz finds
  a case where the printed interval and the measured spread disagree.

**Information Lab.**

- Group F, the coding gain measured (3 experiments), and B4: wait on the
  Communications Lab's Group D, which waits on the Random Signals Lab. The contract is
  one function, the uncoded BER closed form, and one canvas, the BER plot with its
  `limits` prop. Reopens when the Communications Lab lands Group D.
- E2 and F3 read the soft metric, the per-bit log-likelihood ratio from the
  Communications Lab's `detect.js`. Same dependency, same reopening.
- Phases 1 to 5 build 21 of the 25 experiments and need nothing that is not built
  today. `EE_LABS_MAP.md` §4 puts this lab in step 11 with a note that it can slot in
  earlier, and this plan is the evidence that it can. The build order is the first
  decision for the director.
- Reed-Solomon's decoder is a stretch (Decision 4). C5 shows the code's distance and
  its erasure correction from the field arithmetic alone. The Berlekamp-Massey or
  Euclidean decoder reopens in a second version.
- The regular `(3,6)` LDPC threshold of 1.11 dB is quoted from Richardson and Urbanke
  and is not computed. Density evolution over message densities is a lab of its own,
  and no test pins the number.
- The trellis walker stays in the app under `PROGRAM.md` §4, because no second lab
  claims it. It is built against the Logic Lab's state machine prop shape, so a later
  promotion to `packages/ui` is a move rather than a rewrite. The Computer Lab is the
  candidate second user.
- Turbo codes and iterative demapping: declined by both plans. They need this lab's
  decoder and the Communications Lab's demapper iterating across two engines and two
  apps. Recorded as a seam, and it reopens only if a director decides the two apps
  should share a runtime.
- `deploy.yml` and `progression.test.js` entries for `/info-lab/`: through `NEEDS.md`,
  as every dark lab. No other shared surface changes, which is the smallest
  integration footprint in the map.

### Planner: VLSI, Computer, Interfaces

Three plans written on branch `plan/digital-upper`, from `PROGRAM.md` §3 item 1.
`VLSI_LAB_PLAN.md`, `COMPUTER_LAB_PLAN.md` and `INTERFACES_LAB_PLAN.md`, thirty
experiments each. No overseer for any of the three yet. The ledger rows in §1 stay
"waiting", and the plan column changes from "to write" to the three file names.

Dependencies, by what unblocks them.

- **`packages/events` from the Logic Lab.** All three plans state an assumed API in
  their §2.3 and mark it a contract to reconcile against the Logic Lab's brief when
  that brief exists. Reconciliation is a phase boundary in each plan, not an
  assumption carried through the build. The VLSI Lab needs `simulate` and
  `criticalPath`. The Computer Lab needs the same plus exact rational event times.
  The Interfaces Lab needs a net driven by more than one gate, for the open-drain
  bus, and its invariant 4 is the test for that.
- **Two canvases from the Logic Lab.** The timing diagram and the state machine
  diagram, per `PROGRAM.md` §4. The Computer Lab claims both as second lab. The
  Interfaces Lab claims the timing diagram with one added prop, which is a line drawn
  as its analog waveform with two threshold levels and a measurement cursor pair.
  The VLSI Lab reuses the timing diagram unchanged. The director promotes both to
  `packages/ui` when the Logic Lab ships them.
- **Three new modules under `packages/events`**, each owned by the lab that needs it
  and each requested through that lab's `NEEDS.md`. `extract.js` for the VLSI Lab's
  delay-extraction bridge. `cache.js` and `datapath.js` for the Computer Lab.
  `pin.js` and `protocol.js` for the Interfaces Lab. The Logic Lab owns the package
  under `PROGRAM.md` §5, so the director resolves each request once.
- **Electronics D5 and D6.** All three plans cross-reference the switch and the CMOS
  inverter by id, and the progression test fails on a reference to an experiment that
  does not exist. Each plan's Group A restates the results from its own model card so
  the group stands alone, and the cross-reference lands in the release commit once
  the Electronics Lab ships those two.
- **Electronics lane 1's MOSFET element.** The VLSI Lab and the Interfaces Lab both
  use the `switch` model of `apps/electronics-lab/AGENT_BRIEF.md` §3.1. Neither adds
  a field to that schema.
- **The Analog IC Lab's subthreshold model**, for VLSI E4's leakage. That lab has no
  plan. VLSI Decision 4 states leakage here from a stated 80 mV per decade as a
  labelled one-parameter model. Reopens when the Analog IC Lab is planned.
- **The Mixed-Signal Lab's converters**, for the Interfaces Lab's F4. That lab has no
  plan. Interfaces Decision 5 models the converter as a timing budget rather than a
  circuit, quoting only times and impedances. Reopens when the Mixed-Signal Lab is
  planned, and the two models do not overlap in the meantime.
- **The VLSI Lab, for the Computer Lab's gate delays.** Computer Decision 5 quotes
  them from the VLSI model card and pins them as functions of two unit values. A test
  compares both labs once both exist.
- **Signal Lab's Sampling group**, for Interfaces F5. Built today, so this is the one
  cross-lab link in the three plans that works now.
- **The Computer Lab's G2, for Interfaces G2.** The interrupt's cost in cycles is the
  Computer Lab's and the jitter it causes is the Interfaces Lab's. Cross-referenced
  by id in both directions.

Deferred inside the three plans.

- The VLSI Lab's gate-level half, Groups F and G, waits on `events`. Phases 1 to 4
  are twenty-three experiments and ship without it.
- The Computer Lab has one group that ships without `events`, which is the cache.
  The other twenty-four experiments wait.
- The Interfaces Lab's Groups B to E wait on `events`. Groups A and F, ten
  experiments, ship without it.
- Every plan's §10 lists what it declines rather than defers. Those lines are
  decisions and are not backlog items.

### Planner: RF, System, Photonics

Three plan files landed on `plan/rf-system-photonics` for labs whose dependencies are
not all built. `RF_LAB_PLAN.md`, `SYSTEM_LAB_PLAN.md` and `PHOTONICS_LAB_PLAN.md`.
Each lists what it can build today and what it waits on. The lines below are the
waits, with the plan's own section named beside each.

**RF Lab.**

- Groups A and B derive `Z_0` and `γ` from a term panel until the Fields Lab's
  transmission-line group ships. Reopens on `lab/fields-lab`. Plan Decision 3.
- Group E needs the Electronics Lab's `smallSignal` and its Group K for `f_T` and the
  Miller effect. Reopens on `lab/electronics-lab`. Plan §9 phase 4.
- Group F needs the Electronics Lab's Group O for thermal and shot densities. Reopens
  on `lab/electronics-lab`. Plan §9 phase 5.
- Group H's oscillator needs the Electronics Lab's Group N amplitude limit. Reopens on
  `lab/electronics-lab`. Plan §9 phase 7.
- G1 ships with an ideal multiplier and a switching mixer. The Gilbert cell waits on
  the Analog IC Lab's translinear group, which is mapped and not started.
- H3 covers classes A through C. Class E and class F wait on Power Lab's Group F and
  the switched engine.
- `SmithCanvas.jsx` and the S-parameter view go into `packages/ui` with the Fields Lab
  and the Instruments Lab named as second users. Director's queue, `PROGRAM.md` §4.
- `packages/rf` is a new package and needs a row in `EE_LABS_MAP.md` §3. Director's
  queue, `PROGRAM.md` §5.

**System Lab.**

- Groups B, C and D need `budget.js` and `linearity.js` in `packages/rf`, which the RF
  Lab's overseer owns. Reopens at the RF Lab's phases 5 and 6. Plan Decision 3.
- Group E needs antenna gain and the Friis equation from the Fields Lab's antenna
  group. Until then both gains are numbers in a term panel. Reopens on
  `lab/fields-lab`.
- A1 and F1 need the Electronics Lab's Group G for port measurements and its M6 for
  the efficiency ceiling. Reopens on `lab/electronics-lab`.
- D4 uses the ideal `6.02N + 1.76` law with jitter as a second term. The converter as
  a circuit waits on the Mixed-Signal Lab, which is mapped and not started.
- E4 stops at `E_b/N_0` and a margin. The bit error rate waits on the Communications
  Lab's channel group. Plan Decision 5.
- The budget table stays in the app until a second lab claims it. The Applied Analog
  Lab's specification pane is the likely claimant. Director's queue, `PROGRAM.md` §4.

**Photonics Lab.**

- Groups A and C need the Electronics Lab's Group C for the junction's closed forms.
  Reopens on `lab/electronics-lab`. Plan §9 phase 3.
- Group B needs the Electronics Lab's Group O for shot and thermal densities. Reopens
  on `lab/electronics-lab`. Plan §9 phase 4.
- B2 and B3 model the receiver as a photodiode into a load resistance. The
  transimpedance amplifier waits on the Applied Analog Lab's front-end group, which is
  mapped and not started. Plan §1.
- B4 stops at the Q factor. The bit error rate waits on the Communications Lab's
  channel group.
- E4 and F1 cite the Fields Lab's wave group for the refractive index and reflection
  at an interface. Reopens on `lab/fields-lab`.
- E5's waterfall is the System Lab's with optical units. Either the System Lab lands
  it first or this lab keeps a local copy, and the director decides which. Plan §9
  phase 5.
- `packages/photonics` is a new package and needs a row in `EE_LABS_MAP.md` §3.
  Director's queue, `PROGRAM.md` §5.
- The modulated high-speed link, the eye diagram and jitter stay with the private
  `waveform-simulator`. This is a boundary rather than a wait, and no dependency
  reopens it.

### Planner: analog upper

The three upper-tier analog plans are written, and none of the three labs can be
built yet. One line per plan, with the dependency that reopens it. The ledger rows
for these three labs still read "to write" in the Plan column, and the director owns
that edit.

- `APPLIED_ANALOG_LAB_PLAN.md` (tier 2, 45 experiments, 9 groups). Waits on
  Electronics Lab Groups A, C, D, F, G, I, J, L, M and O, on `lab/electronics-lab`.
  Its Phase 1 engine work needs none of them and can start now.
- Applied Analog's specification pane and the DSP Lab's filter group need the same
  canvas at the same time. `PROGRAM.md` §4 names Applied Analog as its first lab and
  the DSP Lab as its second, and the DSP Lab is building on `lab/dsp-lab` today. The
  contract is in that plan's §4.3, and the director picks which lab lands it.
- Applied Analog's Monte Carlo needs the Random Signals Lab's ensemble view with two
  extra props, a spec band and a yield count. The Random Signals Lab is building on
  `lab/random-lab` today, and the props are stated in that plan's §4.3.
- Applied Analog H5 and D4 need Power Lab Group N's thermal network, which has no
  overseer.
- `ANALOG_IC_LAB_PLAN.md` (tier 3, 45 experiments, 10 groups). Waits on Electronics
  Lab Groups C, D, F, G, H, I, J, K, L, M, N and O, and on the Applied Analog Lab's
  Phase 1 for `monteCarlo` and `sensitivity`. Its Phase 1 device work needs only the `M`
  element's companion from `lab/electronics-lab`.
- Analog IC D4's switched-capacitor common-mode sensor waits on the Mixed-Signal
  Lab's Group B. It ships as the continuous version with a note until then.
- Analog IC's `GmIdView` is an app-local canvas whose second lab is the VLSI Lab. It
  moves to `packages/ui` when that lab claims it, and its `extra` prop is written for
  that lab's leakage group.
- `MIXED_SIGNAL_LAB_PLAN.md` (tier 4, 40 experiments, 7 groups). Waits on three
  labs. Electronics Lab Groups D, M and O, the Applied Analog Lab's Phase 1 with C4
  and E5, and the Analog IC Lab's Groups A, C, E and F.
- The charge-conservation event needs `packages/switched` to depend on
  `packages/network`. `PROGRAM.md` §5 records `packages/switched`'s owner as the
  Power Lab owner, who is not in this program, so the director settles ownership
  before that work starts. The event is self-contained and worth building before the
  lab it belongs to.
- Mixed-Signal D5's eye diagram waits on the Communications Lab, which owns that
  canvas and has no plan file. The experiment ships with the sampled-output view
  alone until then.

### Information Lab

Built on `lab/info-lab`: `packages/codes`, `apps/info-lab` dark, and 21 of the 25
experiments in five of the six groups (`INFORMATION_LAB_PLAN.md` §9, phases 1 to 5).
The lines below are what is not built, and what reopens each one.

- **Group F, the coding gain measured (3 experiments), and B4**: wait on the
  Communications Lab, which has no package on the integration branch. Two things are
  needed and both are written as code in `apps/info-lab/NEEDS.md` §3. The BER canvas
  with its `limits` prop, which that plan's Decision 3 builds with this lab named as
  its second user. And the uncoded curve as a function, so a gain is measured as a
  distance between two curves rather than read off a picture. Reopens when
  `packages/comms` lands.
- **The uncoded closed form is available today**, which narrows that dependency.
  `@ee-labs/random` exports `errorRateAntipodal(ebN0)`, the `Q(√(2 E_b/N_0))` those
  four experiments need. What is missing is the canvas and the agreement between the
  two labs, not the arithmetic. The director may prefer to unblock Group F with a
  canvas in `packages/ui` rather than wait for the whole of the Communications Lab.
- **The soft metric seam.** E2 and E3 read a per-bit log-likelihood ratio, and this
  lab computes its own in `packages/codes/src/channel.js` rather than waiting. Bit 0
  is sent as +1 and the belief is `2y/σ²`. When the Communications Lab lands
  `detect.js`, one test compares the two over a seeded run and this lab drops its own.
  A detector with the other sign convention would give a decoder here the wrong answer
  with no error message, which is why the contract is written down.
- **The Reed-Solomon error decoder** is a stretch (Decision 4). C5 shows the distance,
  the erasure decoder and the field arithmetic, and the pane prints what is missing.
  Berlekamp-Massey or the Euclidean algorithm reopens it in a second version.
- **`gain.js` is not written.** It belongs with Group F, because every function in it
  is a distance between two curves and one of the two curves is the other lab's.
- **The `(3,6)` LDPC threshold of 1.11 dB** is quoted from Richardson and Urbanke in
  the plan's §10 and no test pins it, so no lesson in this lab quotes it. Density
  evolution over message densities is a lab of its own.
- **Two numbers of the plan moved under measurement**, and the director settles both.
  The twelve-bit LDPC code has rate five twelfths rather than one third. Two checks
  per bit leaves the eight rows dependent, and E1 now measures the design rate and the
  true rate together. The `(5,1)` repetition code is perfect, so C3 offers it as a
  third perfect code rather than as a counter-example.
- **No Playwright harness.** The four checks this lab wants from one are in
  `INFORMATION_LAB_PLAN.md` §7 and in `apps/info-lab/NEEDS.md` §5. Until there is one,
  the screenshot pass is the only check on a pane fed stale state.
- **`deploy.yml` and `progression.test.js` entries for `/info-lab/`**: through
  `NEEDS.md`, as every dark lab. The app's own release test fails until the deploy
  line exists, which is how the request stays on the record.
- **The trellis walker and the Tanner graph** stay in the app under `PROGRAM.md` §4,
  because no second lab claims either. Both are built against the Logic Lab's state
  diagram prop shape. Both compute their picture as data before drawing it, so a
  promotion to `packages/ui` is a move that carries its own tests.

### Information Lab, closed

The Communications Lab merged, and the four experiments that waited on it are
built. `packages/codes` gains `gain.js`, the app gains B4 and Group F, and the
lab is 25 of 25 in six of six groups. What follows is what remains, which is now
one stretch item and one request.

- **Group F and B4 are built.** The uncoded curve is `berClosed` from
  `@ee-labs/comms`, and a test compares it with this lab's own form at every
  point of the grid. The two agree to floating point, so the lab draws that
  lab's function rather than a copy of it.
- **The soft metric hand-over is a thing on screen.** F3 sends its bits through
  that lab's mapper, channel and detector, reads the beliefs back, and decodes
  them here. The two labs map a zero to opposite levels and write a belief the
  same way, so `levelsFromLlr` is the whole of the conversion. That is recorded
  in `packages/codes/src/crosslab.test.js`, which fails if either convention
  moves.
- **The plan's own F1 and F2 numbers found a defect in this lab's first
  arithmetic.** A hard-decision block curve weights a decoding failure by
  `(i + t)/n` rather than `i/n`, because a bounded-distance decoder that fails
  adds its own error pattern. The optimistic weighting reached 10⁻⁵ at 9.000 dB
  and the plan said 9.174 dB. The plan was right, and the engine now is.
- **The error rate view is this lab's own canvas**, not the Communications Lab's
  BER plot. The two draw different pictures of the same axes, and they should
  become one canvas in `packages/ui` when a third lab wants either. The request
  is in `apps/info-lab/NEEDS.md` §4, with the prop shapes both would need. Until
  a director takes it, the duplication is one log axis and one `limits` prop.
- **The Reed-Solomon error decoder** is still a stretch (Decision 4). C5 shows
  the distance, the erasure decoder and the field arithmetic, and the pane prints
  what is missing. Berlekamp-Massey or the Euclidean algorithm reopens it.
- **The `(3,6)` threshold of 1.11 dB** is still quoted from Richardson and
  Urbanke in the plan's §10, and still no lesson quotes it. Density evolution
  over message densities is a lab of its own.
- **No Playwright harness.** The four checks this lab wants from one are in
  `INFORMATION_LAB_PLAN.md` §7 and in `apps/info-lab/NEEDS.md` §5. The screenshot
  pass is the only check on those four.
- **`progression.test.js` needs the last four ids.** `NEEDS.md` §2 now reads
  `a1` to `a5`, `b1` to `b4`, `c1` to `c5`, `d1` to `d5`, `e1` to `e3`, `f1` to
  `f3`, and 25 of 25.
The director's ledger for the program in `PROGRAM.md`. Every item an overseer
defers gets a line under its lab's heading, with the dependency that reopens it.
This file does not exist yet on `lab/dsp-lab`, so this overseer starts it with
only its own section. The director folds it into the shared ledger at merge.

## Deferred items, by lab

### DSP Lab

- **All six groups are built, and the report is 40 experiments.** `A` 7, `B` 8,
  `C` 7, `D` 7, `E` 6, `F` 5, in `DSP_LAB_PLAN.md` §5's order. Nothing from §5
  is missing. What follows is what the lab does not yet have.
- **`scripts/verify.mjs` (the Playwright harness) is not written.** The brief
  asks for it in lane 2. The six views this lab now has are exactly what a unit
  test cannot check: a canvas that stopped redrawing, a pane fed stale state, a
  prop not passed. Two passes of this lab have excluded Playwright, so
  the harness and its screenshots at 390 px and 1280 by 900 are still deferred.
  It is the largest single gap before a release gate.
- **The Random Signals Lab gap.** `DSP_LAB_PLAN.md` §1 names two rows with no
  built prerequisite: group D leans on a periodogram bin's distribution, and
  group C's Wiener solution is stated instead as the answer to a linear system.
  Both are written to need no unbuilt fact. D1 measures the scatter rather than
  quoting a theorem about it, and C1 derives the normal equations from an
  average. When the Random Signals Lab lands, both become cross-references and
  each becomes one sentence shorter.
- **E5 states overflow at the section's own word length, not at eight bits.**
  `DSP_LAB_PLAN.md` §5 quotes a range of -1 to 0.9921875 and a value of 1.2
  saturating and wrapping. An eight-bit state with no bits above the point
  cannot hold this section's numerator at all: the whole of b0 x is under half a
  step, so the filter produces zeros rather than overflowing. The lesson makes
  the same two claims at twelve bits with one bit above the point, where the
  section asks for 2.530 and the range stops at 1.999. The plan's numbers are
  still correct about the quantiser and wrong about the filter.
- **E6's noise gain reads 10502, not the plan's 10433.8.** The plan computed it
  from the exact coefficients and the lab computes it from the sixteen-bit ones
  the block actually runs. The lab's figure is the filter that exists.
- **Group C runs at a frame of 8192 and group D at 16384.** The lab's default is
  4096 (Decision 2), which is right for a spectrum and too short for a settled
  average or a slow convergence. Both are set per experiment and the reason is
  in each group's header comment. A reader who changes the frame changes the
  numbers, and every pin is computed from the frame rather than typed.
- **D3 reaches K of 256 by shortening the segment, not by lengthening the
  record.** The plan's table runs to 65536 samples. The frame control stops at
  16384, so at K of 256 the segments are 64 samples and the bin is 750 Hz. The
  scatter still lands within 4 % of one over root K, which is the claim.
- **`packages/ui` promotion candidates**, copied from Signal Lab into
  `apps/dsp-lab/src/components/` rather than shared: `ScopeCanvas.jsx`,
  `SpectrumCanvas.jsx`, `Controls.jsx`. Four canvases are new and app-local
  until a second lab needs them: `WeightCanvas`, `PoleGridCanvas`,
  `DensityCanvas`, `ButterflyCanvas`. `SpecPane.jsx` is the one candidate with a
  second lab already named, and it ships to the Applied Analog Lab's contract.
  Full detail in `apps/dsp-lab/NEEDS.md`.
- **The non-goals of `DSP_LAB_PLAN.md` §10 are all still non-goals.** Filter
  banks and wavelets. Arbitrary rational rate changes. Kaiser and
  Dolph-Chebyshev windows, elliptic filters, lattice and coupled structures.
  The affine projection algorithm, multitaper estimation, radix-4 and
  split-radix. Fixed point on the whole chain, and a free-form design tool.
  None became cheaper to add while the six groups were built.

### RF Lab

- **Two sittings are built, and they are nineteen experiments of thirty-five.**
  `A` 5, `B` 4, `C` 5 and `D` 5, in `RF_LAB_PLAN.md` §5's order, which is that
  plan's phases 2 and 3 in full. The engine is `packages/rf` with `sparam.js`,
  `convert.js`, `cascade.js`, `smith.js`, `line.js` and `match.js`, and the
  plan's invariants 1 to 7 are fuzzed over 240 seeds each. The Smith chart is
  `packages/ui/src/SmithCanvas.jsx`. The S-parameter view and the equations pane
  are `apps/rf-lab/src/components/`. What follows is what the lab does not yet
  have.
- **Groups E to H are not built, which is four of the plan's eight.** Each waits
  for a named module, and `apps/rf-lab/NEEDS.md` §2 lists them with the ids they
  will claim. G and H wait for `linearity.js`, `mixer.js`, `leeson.js` and
  `pa.js`, and neither needs anything outside the suite. Those two groups could
  be built beside each other today. E and F are the two that are gated.
- **E and F need the Electronics Lab.** They need `smallSignal` with its
  capacitances, `transitFreq`, and the Group O noise densities. Plan Decision 4
  generates the two curated S-parameter sets from a small-signal netlist this
  suite solves rather than from a vendor file, so the gate is the netlist and not
  the data. `apps/rf-lab/NEEDS.md` §4 states each dependency by function name.
- **Invariants 8 to 13 are not checked, and each is named where a reader looks
  for it.** Invariant 4 went green with `match.js`, solved through `solveAC` so
  that nothing which designed a network also grades it.
  `packages/rf/src/invariants.test.js` ends with the six that remain and the
  module each waits for.
- **`scripts/verify.mjs`, the Playwright harness, is not written.** The plan's §7
  asks for three checks. A dragged point on the chart moves the topbar reading.
  The stability circle shades the correct side. Nothing scrolls sideways at
  390 px. The first needs a drag handler the chart does not have, and the second
  needs Group E. What exists instead is a server-rendered mount of every
  experiment in every one of its views, in `components/panes.test.jsx`, which
  catches a prop the shell forgot to pass but not a canvas that stopped redrawing.
- **The chart still has no drag, and this sitting did not add it.** The first
  sitting said the drag belonged with the matching lane. The matching lane has
  landed and the drag has not, because a pointer gesture is a claim no test in
  this tree can measure. It needs `scripts/verify.mjs` first. A reader moves a
  point by turning the load knobs, and Group C's chart draws the arcs the
  elements trace either way.
- **The S-parameter view is in the app rather than in `packages/ui`.** Plan
  Decision 5 puts it beside the Smith chart, and the brief's lane table gives the
  file to the app. The prop the Instruments Lab needs is in it from the first
  commit and is tested, so the promotion is a move rather than a rewrite. The
  director decides which reading holds, and `apps/rf-lab/NEEDS.md` §3 states the
  disagreement.
- **`budget.js` is not written, and the System Lab is its second user.** Plan
  Decision 2 puts the cascaded noise figure and the cascaded IP3 in `packages/rf`
  rather than in a package of their own, which makes the System Lab depend on a
  package this overseer owns. The director resolves that the way `PROGRAM.md` §5
  resolves every shared package.
- **The line's loss is the same at every frequency.** `uniformLine` puts the
  attenuation in as R and G per metre with R over L equal to G over C, which
  makes γ exactly α + jω/v_p and Z_0 exactly real. That is the distortionless
  line, and it is a definition rather than an approximation. A real conductor's α
  rises as the square root of frequency, which the plan's §3 lists as a labelled
  non-ideality, and A4's `why` says which line is on the bench.
- **Nothing in Groups A to D carries a guard, and a test says so.** Every object
  these four groups touch is exact, and `CORE_SCOPE.md`'s counter-rule says an
  exact mapping is never hedged. The first guarded object in this lab is the
  unilateral approximation in Group E, and the first labelled model is Leeson's
  in Group H.
- **Two cross-references into the Fields Lab are written and not made.** A3 would
  cite where the characteristic impedance and the propagation constant come from,
  and A5 would cite the bounce diagram as the time-domain answer that does exist.
  That lab's transmission-line group is not built, and a lesson may not name an
  experiment that does not exist, so Group A defines both terms in its own panel
  instead. Decision 3 anticipated exactly this.
- **C3 quotes two bandwidth numbers rather than the plan's one.** The plan's §5
  gives 100.00 per cent for the 50 Ω to 100 Ω match, which is one over the loaded
  Q. That is the fractional bandwidth of a single resonance read at its
  half-power points. The same network read at a standing-wave ratio of 1.500
  measures 60.58 per cent, and at 1.2222 it measures 28.72 per cent. Both are on
  screen, because quoting only the first would state a width the app does not
  measure.
- **C4's bandwidth reads 36.697 per cent and the plan says 36.700.** The
  difference is the target ratio. The closed form for the section's width uses a
  reflection magnitude of exactly 0.1, which is a standing-wave ratio of eleven
  ninths. The knob holds 1.2222. The brief's §6 now pins the measured figure at
  the knob's own setting.
- **D3 ships three two-ports where the plan named one.** The plan's §5 gives the
  ideal transformer as the object with no Z-matrix. Two resistors with no path
  between them are the other half of the same lesson, because that two-port has
  S, Z and Y and no chain matrix. With the pi attenuator, which has all four, the
  experiment shows every case the conversion can be in.
- **Four defects the first sitting left, found while building on it.** A
  dimensionless headline went through engineering notation, so a reflection
  magnitude of 0.3333 printed as "333.3 m". The report summary threw on the name
  of a choice position. The shell rendered a choice knob as a NumField and drew
  NaN. And the sweep pane's test demanded a repeat spacing above zero from every
  experiment offering the view, which a network of lumped elements does not have.
  All four are fixed, and the fourth was the test rather than the app.
- **The two numerical corners the first sitting paid for.** The largest singular
  value of a lossless S-matrix read 1 + 5e-9 through the trace and the
  determinant, because those two terms are equal there and eight digits cancel.
  And the two cascade routes do not agree to a flat epsilon, because the chain
  matrix divides by S21 on the way in and multiplies it back on the way out. Both
  are in `apps/rf-lab/AGENT_BRIEF.md` §9 so the next lane does not pay for them
  again.
- **This sitting added a third numerical corner.** A resistance of zero handed to
  the solver as 1e-12 ohms makes the node equations singular rather than
  lossless. So a zero resistance is left out of the netlist instead of made tiny,
  and D5's lossless case is a network of two elements rather than three.
- **A review pass over the two sittings found five defects, and all five are
  fixed.** Four are readings that did not follow the knob that changes them,
  reached by turning the knobs of Groups C and D and reading what came back,
  which is `REVIEW_PLAYBOOK.md` §11's method. The fifth is a pane Group C could
  not reach. Each fix carries a test that fails without it.
- **The band search was the same width either side of the design frequency.**
  Above it the quarter-wave section's response repeats at twice the design
  frequency, so the search has to stop short of the repeat. Below it nothing
  repeats and the edge can sit under half the design frequency. At a
  standing-wave ratio of 1.8 the section holds a band from 361 MHz to
  1.639 GHz, and C4 reported no band at all. `bandwidthOf` now takes `down` and
  `up`, and `quarterWaveMatch` sets both from the repeat it computes.
- **A band with no edge on one side named the wrong side.** The low-pass L
  network has no lower edge at a standing-wave ratio of two and the high-pass
  one has no upper edge, and the pane said "no lower edge" for both. The
  quarter-wave section printed a dash where it never crosses at all. The panes
  now name the side, and the sweep legend adds the frequencies the crossing was
  looked for between, because a search that found nothing measured less than
  "it never crosses".
- **A trace on the decibel floor read as a measurement.** Five pads of 30 dB put
  the transmission 90 dB below an axis that stops at 60 dB down, and the trace
  was drawn flat along the floor in silence. The legend now names the entries
  that reach it.
- **An entry the solve returns as its own noise printed as a measurement.** The
  pi attenuator's S11 comes back as 3.3e-16, which the pane showed as
  −309.5 dB. D2's note beside it says S11 is zero. An entry below a billionth of
  the largest in its own matrix is now reported as zero with no decibels. The
  chip says which of the two kinds of nothing it is. Nothing comes back at a
  reflection, and nothing gets through at a transmission.
- **Group C could not reach the equations pane.** `RF_LAB_PLAN.md` §9.3 ships
  that pane with matching and two-ports. `matchEquations` and `qwaveEquations`
  were written and tested, and no experiment in Group C listed the view, so the
  only way to see either was from a test. All five now offer it, and a test
  holds every experiment of Groups C and D to offering it.
- **The plan's 1.1437 at 900 MHz is computed and not pinned.** The plan's §5
  quotes that standing-wave ratio for the 50 Ω to 100 Ω match. It is one point
  inside the band C3 states by its two edges, so the lesson quotes the edges and
  nothing quotes the point. `scripts/pins.mjs` still computes it, and
  `apps/rf-lab/AGENT_BRIEF.md` §6 says so under its pin table.
- **A second review pass found six more, and all six are fixed.** Five are what
  a reader sees rather than what the engine computes, which is the half a
  numeric suite cannot check by itself. Each fix carries a test that fails
  without it.
- **Three exact answers were spoiled between the analysis and the screen.**
  Groups C and D print every complex number through one formatter, which puts
  the minus sign in front of the j and drops a part far below the pair's own
  scale. Groups A and B built theirs by hand. A3's note says a quarter wave
  turns 100 Ω into exactly 25 Ω, and the row beside it read
  "25 + j-2.2962e-15 Ω". A capacitive load read "0.6 + j-0.8". D2's equations
  pane printed 2.2204e-16 for an S11 the column next to it called zero.
- **A normalised reactance of zero printed NaN.** It is the one member of that
  family which is a straight line, so its circle is centred at infinity with an
  infinite radius, and B2 divided by that radius. The pane names the real axis
  now, and the chart is not handed a centre it cannot place. The knob reaches
  zero and a reader types it.
- **The refusal printed sixteen digits of a length.** A5's pane carries the
  engine's sentence under the plot, and the reference line's length is computed
  rather than typed, so the message read "A line 0.0517191125540973 m long". The
  delay beside it was already quoted to four figures and the length now is too.
- **The standing wave was drawn on a scale the picture did not name.** The line
  view divides the wave by its own largest voltage, and there was no axis at all
  beside it. A ripple of a few per cent and one that reaches zero looked the
  same. The axis runs from one to zero and says what the division is.
- **B4 opened with two markers on the same pixel.** With no susceptance added
  the moved point is the load itself, and both were drawn and labelled, with an
  arc of no length between them. The moved point arrives when a susceptance
  does, and the constant-conductance circle is drawn either way.
- **Invariant 1 claimed three digits fewer than the plan promises.** The plan's
  §2.13 says the conversion round trip returns the input to 1e-12 relative, and
  the fuzzer held it to 1e-9. The engine was never the reason. Over the same
  seeds the worst residual is 1.359e-13, so both bounds now read the plan's
  number.
- **Two guards use a scale this suite has already been bitten by, and neither
  bites today.** `reflection` measures its denominator against
  `max(1, |Z_L|)`, and `abcdToS` measures a dimensionless denominator against
  the largest entry of a chain matrix, whose entries are in ohms and siemens.
  Both are the floor-under-the-scale shape `AGENT_BRIEF.md` §9 names. Neither is
  reachable at this lab's knob ranges, because a reference impedance is at least
  5 Ω, so they are recorded rather than changed.
- **No lab pins the numbers inside a term definition, and this one does not
  either.** Group C and D definitions quote 17.61 Ω, 292.4 Ω, 0.10080 and
  60.58 per cent, and each is a figure a lesson pins at the same defaults. The
  definition itself is not measured. That is the suite's arrangement rather than
  this lab's, and moving it belongs with the director.
- **The non-goals of `RF_LAB_PLAN.md` §10 are all still non-goals.**
  Electromagnetic field solving. Microstrip synthesis from physical dimensions. A
  Padé model of the line. Distributed matching with stubs. Filter synthesis
  tables. Class E and class F amplifiers. Phase noise derived rather than
  modelled. Antennas, modulation, vendor S-parameter files and a free-form layout
  editor. None became cheaper to add while these four groups were built.
