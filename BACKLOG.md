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
| Power Lab | built in part | | Groups D, F to N unassigned | `POWER_LAB_PLAN.md` |
| The two seams and the progression test | building | `lab/seams` | | `CURRICULUM.md` §3, §6 |
| Electronics Lab | building | `lab/electronics-lab` | | `ELECTRONICS_LAB_PLAN.md` |
| Logic Lab | building | `lab/logic-lab` | Electronics D6 for one cross-reference | to write |
| DSP Lab | building | `lab/dsp-lab` | | to write |
| Random Signals Lab | building | `lab/random-lab` | | `RANDOM_LAB_PLAN.md` |
| Control Lab II | building | `lab/control-lab-ii` | | to write |
| Instruments Lab | building | `lab/instruments-lab` | RF Lab for the network analyser group | to write |
| Fields Lab | building | `lab/fields-lab` | | to write |
| Energy Lab | building | `lab/energy-lab` | Machines Lab for the wind group | to write |
| Machines Lab | built, dark | merged | Power Lab F for the drives group | `MACHINES_LAB_PLAN.md` |
| Communications Lab | waiting | | Random Signals Lab | `COMMUNICATIONS_LAB_PLAN.md` |
| Information Lab | waiting | | Communications Lab | `INFORMATION_LAB_PLAN.md` |
| Applied Analog Lab | waiting | | Electronics L, M | `APPLIED_ANALOG_LAB_PLAN.md` |
| Analog IC Lab | waiting | | Electronics H to M | `ANALOG_IC_LAB_PLAN.md` |
| Mixed-Signal Lab | waiting | | Analog IC Lab, `switched` charge conservation | `MIXED_SIGNAL_LAB_PLAN.md` |
| RF Lab | waiting | | Analog IC Lab, Fields Lab's line | `RF_LAB_PLAN.md` |
| System Lab | waiting | | RF Lab | `SYSTEM_LAB_PLAN.md` |
| VLSI Lab | waiting | | Logic Lab, Analog IC Lab | `VLSI_LAB_PLAN.md` |
| Computer Lab | waiting | | Logic Lab | `COMPUTER_LAB_PLAN.md` |
| Interfaces Lab | waiting | | Logic Lab, Electronics D, Mixed-Signal Lab | `INTERFACES_LAB_PLAN.md` |
| Grid Lab | waiting | | Machines Lab, Electronics companion Newton | `GRID_LAB_PLAN.md` |
| Photonics Lab | waiting | | Electronics O, Applied Analog Lab | `PHOTONICS_LAB_PLAN.md` |
| Devices Lab | waiting | | Electronics C | `DEVICES_LAB_PLAN.md` |
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

- Group B lives in Elements as I9 and I10 (Decision 3).
- Groups D to O wait on lane 1's gate, inside the lab's own brief.
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
