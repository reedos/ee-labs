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
| Circuit Elements Lab | built, dark | | | `CIRCUIT_ELEMENTS_LAB_PLAN.md` |
| Circuit Lab | built | | | |
| Signal Lab | built | | | |
| Control Lab | built | | | |
| Power Lab | built in part, building | `lab/power-lab-dfg` | Groups H to N unassigned | `POWER_LAB_PLAN.md` |
| The two seams and the progression test | building | `lab/seams` | | `CURRICULUM.md` §3, §6 |
| Electronics Lab | built in part, dark | merged, Groups A and C | the transistor symbol in `Schematic.jsx` for Groups D to O | `ELECTRONICS_LAB_PLAN.md` |
| Logic Lab | built, dark | merged | Electronics D6 for one cross-reference | `LOGIC_LAB_PLAN.md` |
| DSP Lab | building | `lab/dsp-lab` | | to write |
| Random Signals Lab | built, dark | merged | Electronics O1 for one cross-reference | `RANDOM_LAB_PLAN.md` |
| Control Lab II | building | `lab/control-lab-ii` | | to write |
| Instruments Lab | building | `lab/instruments-lab` | RF Lab for the network analyser group | to write |
| Fields Lab | building | `lab/fields-lab` | | to write |
| Energy Lab | built, dark | merged | Machines Lab for the wind group | `ENERGY_LAB_PLAN.md` |
| Machines Lab | built, dark | merged | Power Lab F for the drives group | `MACHINES_LAB_PLAN.md` |
| Communications Lab | built, dark | merged | | `COMMUNICATIONS_LAB_PLAN.md` |
| Information Lab | built in part, dark | merged, 21 of 25 | the Communications Lab's BER canvas for Group F and B4, now merged | `INFORMATION_LAB_PLAN.md` |
| Communications Lab | built, dark | `lab/comms-lab` | Electronics O and the RF Lab for one cross-reference | `COMMUNICATIONS_LAB_PLAN.md` |
| Information Lab | waiting | | | `INFORMATION_LAB_PLAN.md` |
| Applied Analog Lab | waiting | | Electronics L, M | `APPLIED_ANALOG_LAB_PLAN.md` |
| Analog IC Lab | waiting | | Electronics H to M | `ANALOG_IC_LAB_PLAN.md` |
| Mixed-Signal Lab | waiting | | Analog IC Lab, `switched` charge conservation | `MIXED_SIGNAL_LAB_PLAN.md` |
| RF Lab | waiting | | Analog IC Lab, Fields Lab's line | `RF_LAB_PLAN.md` |
| System Lab | waiting | | RF Lab | `SYSTEM_LAB_PLAN.md` |
| VLSI Lab | waiting | | Logic Lab, Analog IC Lab | `VLSI_LAB_PLAN.md` |
| Computer Lab | building | `lab/computer-lab` | | `COMPUTER_LAB_PLAN.md` |
| Interfaces Lab | waiting | | Logic Lab, Electronics D, Mixed-Signal Lab | `INTERFACES_LAB_PLAN.md` |
| Grid Lab | building | `lab/grid-lab` | Power Lab I3 and D1 for two cross-references | `GRID_LAB_PLAN.md` |
| Photonics Lab | waiting | | Electronics O, Applied Analog Lab | `PHOTONICS_LAB_PLAN.md` |
| Devices Lab | built, dark | merged | | `DEVICES_LAB_PLAN.md` |
| Signal Integrity | out of this repo | | | |

## 2. Deferred items, by lab

Each overseer appends here. One line per item: what, why deferred, and the
dependency or decision that reopens it.

### Circuit Elements Lab

- I9 the clamper and I10 the doubler: assigned to the seams overseer.
- H7 "the roots are the poles": assigned to the seams overseer.
- The GBW toggle: superseded by the Electronics Lab's op-amp macro, which Elements
  may import once it lands.

### Circuit Lab

- The impulse-response experiment (`CURRICULUM.md` seam 2): assigned to the seams
  overseer.
- A gain-bandwidth knob on the op-amp circuits: waits for the Electronics macro.

### Power Lab

- Groups D, F to N: no overseer in this program. The Machines Lab's drives group and
  the Energy Lab's inverters wait on F and L.

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

## 3. The director's queue

Items that cross labs and land at integration.

- `deploy.yml`: one `cp` line per new dark lab, from each lab's `NEEDS.md`.
- `progression.test.js`: every new lab's ids and counts, from each lab's `NEEDS.md`.
- Shared canvases promoted to `packages/ui` when a second lab claims them
  (`PROGRAM.md` §4).
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
- Two Elements experiment walks (the Newton diode sweeps in `experiments.test.js`)
  exceed the 90 s timeout on a loaded four-core machine. Their owner chooses a
  longer timeout, a shorter sweep, or a split, before CI gates on one command.

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
