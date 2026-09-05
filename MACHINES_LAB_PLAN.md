# Machines Lab: the plan

Track C's second lab, and the suite's seventh: **electric machines**, the course
that follows circuits and runs beside control. Splash glyph `⊙`, directory
`apps/machines-lab`, engine in a new package `packages/machines`.

The path, in order. The DC machine, which is an R–L with a speed in it. The
transformer, which is a machine that does not turn. The rotating field three
phases make, and the induction machine that runs on it. The synchronous and
permanent-magnet machines, their phasor diagram, and the dq transform that turns
one into a plant Control Lab can close a loop around. Then losses, efficiency and
the thermal limit that sets a machine's rating.

This is a draft (2026-09-05) for Reed to settle. §0 lists what needs a decision.
§1 is the progression map against what the suite has built. Every number quoted
below was computed by a script before it was written, and §7 says which script.

The two rules that govern the other labs govern this one. **Every explanatory
sentence is a claim about physics, and a test must measure it.** And
`CORE_SCOPE.md` decides what the engine states exactly, what it approximates
behind a guard, and what it declines with a reason. A machine is where the first
rule pays, because a machine's claims are power claims, and power balance is
measurable to floating point.

---

## 0. Open decisions

### Decision 1: the name (recommended: Machines Lab)

`EE_LABS_MAP.md` §1 already calls this lab "Machines Lab", and the course it
mirrors is "Electric Machines" or "Electromechanical Energy Conversion" in most
catalogues. LabNav short form **"Machines"**. The splash card names the path in
one line: "the DC machine, the transformer, induction, synchronous, and what
sets a machine's rating".

Alternatives considered. *Drives Lab* names the group this plan cannot build,
because the inverters it needs are Power Lab's Groups F and L. *Energy
Conversion Lab* is the catalogue name and reads as thermodynamics.
*Electromechanics Lab* names the physics and not the course.

### Decision 2: where the mechanical state lives

Recommended: **in the netlist, as one more node**, solved by
`@ee-labs/network`'s existing `dynamics` and `transient`.

The rotor obeys `J dω/dt = T_e − B ω − T_L`. A capacitor obeys `C dv/dt = i_C`.
Fix the analogy once and the rotor is a capacitor at a node called the shaft.
The friction is then a resistor across that node, and the load torque is a
current source drawing out of it. Nothing about the solver changes. §2.1 gives
the whole table.

The alternative is a separate mechanical integrator in `packages/machines`,
coupled to the electrical solve at each step. That would be a fixed-step method
where an exact one exists, and it would put the power balance beyond the reach
of the engine's own energy ledger. It is declined.

### Decision 3: how the torque source is stamped

Recommended: **the cancelled sense branch of §2.2**, with no change to
`packages/network`.

A back-EMF is a voltage set by a speed, and `mna.js` stamps that as a VCVS
today. A torque is a current set by a current, and no stamp takes a current as
its control. The construction in §2.2 makes a branch current readable as a node
voltage at no cost in accuracy, so a VCCS can read it. The result is exact and
uses only stamps that exist.

The alternative is a CCCS stamp in `packages/network`, which is the Electronics
overseer's file. The contract for it is written into
`apps/machines-lab/NEEDS.md` so the director can decide separately. This lab
does not wait on it.

### Decision 4: the drives group

Recommended: **specify it here and build none of it.** A chopper into a DC
machine, an inverter into an induction machine, and a field-oriented drive all
need Power Lab's Groups F and L, which have no overseer. `BACKLOG.md` carries
the four experiments with the dependency named. No lesson in this lab
cross-references them.

### Decision 5: the phase plane

Recommended: **build a minimal one in the app, and offer it for promotion.**
`PROGRAM.md` §4 gives the phase plane to Control Lab II, which is being built in
parallel and is not available. Group A's run-up is a two-state trajectory, and
the plane is the clearest view of it. `apps/machines-lab/src/components/PhasePlaneCanvas.jsx`
is written against the props Control Lab II will need, and `NEEDS.md` records it
as a promotion candidate.

---

## 1. The progression map

This lab opens after Circuit Elements Lab's Group H, which is built, and after
Power Lab's inverters, which are not. This section lists every idea the lab
leans on, the experiment that teaches it, and whether that experiment exists.

| Idea the lab leans on | Needed by | Taught at | Status |
| --- | --- | --- | --- |
| The two laws, nodal analysis, dependent sources | everything | Elements A to E | built |
| The capacitor and the inductor as states, `ẋ = Ax + Bu` | A, C9, E3 | Elements F1 to F4 | built |
| First-order response, the time constant, energy in L and C | A6, E3 | Elements F | built |
| Second-order response, damping, the characteristic equation | A6 | Elements G | built |
| Phasors, impedance, one sine at a time | B, C, D | Elements H1 to H4 | built |
| AC power, real and reactive, the power factor | B6, C5, D3 | Elements H5 | built |
| `H(jω)`, the Bode view | D7 hand-over | Elements H6, Circuit Lab | built |
| Loop gain, margins, the step's overshoot | D7 | Control Lab, 13 built | built |
| Three-phase from the circuits side, Y and Δ | C1, C2 | nowhere | **gap, C1 and C2 carry it** |
| The ideal transformer and the turns ratio | B, C4 | nowhere | **gap, B1** |
| Magnetic saturation as a toggle | E5 | Power Lab Group D, planned | not built, E5 carries it |
| Volt-seconds and flux | E5 | Power Lab D1, planned | not built, not blocking |
| The inverter, sine PWM, the harmonic families | drives | Power Lab F, planned | **not built, drives deferred** |
| The chopper and the H-bridge | drives | Power Lab L, planned | **not built, drives deferred** |
| The state space as a control object | D7 hand-over | Control Lab II, building | not built, not blocking |

Three rows matter. **Three-phase from the circuits side** has no home in the
suite, and `CURRICULUM.md` §4 recommends Power Lab Group I for it. Power Lab I
is not built either, so C1 and C2 carry the Y and Δ relations as term
definitions and one experiment. **The ideal transformer** has no home, and
`CURRICULUM.md` §4 recommends `packages/network` and then Elements F8. This lab
builds it in `packages/machines` instead, out of the stamps that exist, and
`NEEDS.md` offers the construction to whoever takes Elements F8.

**The drives group is the one thing this plan cannot build.** Power Lab's
inverters gate it. §9 phases the lab so nothing else waits on that.

Nothing in a group below leans on a later experiment or on a lab that is not
built. Group C's per-phase circuit uses the transformer of Group B, which is why
B comes before C. The course order is the file order.

---

## 2. The engine: `packages/machines`

### 2.1 The mechanical port

A machine is a circuit with a shaft on it. The shaft's equation and the
capacitor's equation are the same equation under one analogy:

| Mechanical | Unit | Carried as | Unit |
| --- | --- | --- | --- |
| speed ω | rad/s | a node voltage | V |
| torque T | N·m | a current into that node | A |
| inertia J | kg·m² | a capacitance | F |
| friction B | N·m·s/rad | a conductance, a resistor of 1/B | S |
| load torque T_L | N·m | a current source out of the node | A |

The analogy is exact rather than decorative. The engine's stored energy for a
capacitor is `½Cv²`, and under the table that is `½Jω²`, the rotor's kinetic
energy. So `energies(tr)` closes the machine's energy ledger without being told
what a shaft is. `packages/machines/src/port.js` holds the table in one place,
so no other file guesses at it, and the app converts to rev/min for the reader.

The starting speed is an initial condition, not something a DC solve can find. A
frictionless unloaded shaft has no resistive path to ground, and the solver
gives that reason. `shaft()` takes `omega0`, which defaults to rest.

### 2.2 The coupling, without a new stamp

The two coupling equations are `e = k_e ω` and `T_e = k_t i_a`. The first is a
voltage controlled by a voltage, which `mna.js` stamps as a VCVS. The second is
controlled by a current, and MNA has no such stamp.

`senseBranch(id, from, to, rs)` solves it. Put a resistor `R_s` in the branch,
then a VCVS of gain −1 across that resistor, in series with it. The two drops
are `i·R_s` and `−i·R_s`, so the pair together is a short. It changes no node
voltage and no current anywhere. What it leaves behind is a node pair whose
difference is exactly `i·R_s`, and any VCCS can be controlled by that.

Nothing here is a limit or an approximation. The cancellation is algebraic, so
the answer does not depend on `R_s` at all. `port.test.js` sweeps it over eight
decades and finds no change beyond `10⁻¹⁰` of the answer.

One measured proviso. The cancellation is exact in algebra and the LU solve is
not. A sense resistance far below the branch's own resistance puts a large
conductance in the matrix beside small ones, and the solve loses digits to it.
At `R_s` equal to the circuit's resistance the drift is `10⁻¹⁶` of the answer,
and at a millionth of it the drift is `1.1 × 10⁻⁷`. The rule is one line. Pick
`R_s` at or above the branch's own resistance. The tests measure both ends of
that statement rather than asserting it.

### 2.3 The gyrator, and why power balance is free

Put the two together and the coupling is a gyrator. The VCVS absorbs `k_e ω i_a`
and the VCCS delivers `k_t i_a ω`. When `k_e = k_t`, and in SI units they are the
same number, those are equal and the pair neither stores nor loses energy.

So Tellegen's theorem over the whole netlist is the machine's power balance.
Nothing extra is asserted, and nothing is bookkept twice. `powerAudit(sol)`
names the terms a reader wants, and the pair's residual is reported as
`coupled`. It is `3.6 × 10⁻¹⁵ W` on the reference machine, against `21.5 W`
supplied. Setting `k_t` away from `k_e` on purpose makes `coupled` large, and
A3's experiment does exactly that.

### 2.4 The DC machine

One netlist, two states. `dynamics()` reads

```
A = [ −R_a/L_a   −k/L_a ]      B = [ 1/L_a   0    ]
    [   k/J      −B/J   ]          [   0    −1/J  ]
```

off the same resistive solve as any circuit, with the inputs `V_a` and `T_L`.
For the reference machine of §4.3 that is `[[−400, −20], [300, −0.05]]`, and
`dc.test.js` checks every entry against the two equations over a fuzzed machine.

The steady state is one straight line, `T_e(ω) = k V_a/R_a − (k²/R_a) ω`. It runs
from the stall torque to the no-load speed, and its slope is the machine's
stiffness. `operating()` crosses it with the load, in closed form.

### 2.5 The ideal transformer

Same construction as §2.2. A VCVS on the secondary sets `v_s = v_p/n`. A sense
branch in the secondary loop makes `i_s` readable. A VCCS on the primary draws
`i_s/n`. Both ratios are then exact, and Tellegen across the four elements sums
to `10⁻¹⁰` of the load's own power or less, over a fuzzed transformer.

The sign differs from the DC machine's, and the reason is worth stating. In the
machine the armature is a load and its current enters the sense branch at the
positive end. In the transformer the secondary is a source and its current
leaves at the positive end. The gain carries the sign.

A winding with no connection to the rest of the circuit has no defined voltage,
and the solver gives that reason. The lab grounds one secondary terminal, which
changes no current. That is the isolation lesson rather than a workaround.

### 2.6 The induction machine

The per-phase equivalent circuit is a netlist for `solveAC`, with `R₂/s` as one
resistor. At a fixed slip the circuit is linear, which is why the slip is a knob
and not a state.

The torque is a closed form, by Thévenin from the same circuit:

```
T(s) = (3/ω_s) |V_th|² (R₂/s) / [ (R_th + R₂/s)² + (X_th + X₂)² ]
```

`torqueOfSlip` and a `solveAC` of `perPhase` agree to `5 × 10⁻¹⁶` relative over
a fuzzed machine at seven slips each. At `s = 0` the rotor branch is open, no
current crosses the gap, and the torque is exactly zero.

Breakdown is a closed form too. Differentiate with respect to `R₂/s` and the
maximum sits at `R₂/s = |Z_th + jX₂|`, so `s_max = R₂/√(R_th² + (X_th + X₂)²)`
and `T_max = 3|V_th|²/(2 ω_s [R_th + √(R_th² + (X_th + X₂)²)])`. `T_max` does not
contain `R₂`, which is the whole of C9.

**Declined.** The machine's dq model with the rotor speed as a state is
bilinear. It is not a linear state space and it has no transfer function, so
this package does not offer one. The run-up is given instead, as a different
object with its own label.

### 2.7 The dq transform

Two conventions are in use and they differ by a constant. The package's default
is power-invariant, where `K Kᵀ = I`, the inverse is the transpose, and `v · i`
is the same number in both frames. The amplitude-invariant convention maps a
balanced set of peak `V` to a radius of `V`, and carries a `3/2` in every power
and torque expression.

Both are exact. Every function takes `convention` and every result says which
one it used, because a torque constant quoted in the wrong convention is wrong
by `3/2`. That is the commonest error in the subject, and D5 makes it an
experiment.

### 2.8 The rotating field

Three windings 120 electrical degrees apart, carrying three currents 120 degrees
apart in time, make one magnetomotive force that travels:

```
cos ωt cos θ + cos(ωt − 2π/3) cos(θ − 2π/3) + cos(ωt + 2π/3) cos(θ + 2π/3) = (3/2) cos(ωt − θ)
```

exactly, at every θ and every t. `dq.test.js` measures the identity at 500
random pairs to nine decimals rather than quoting it. The wave travels at
`2ω/poles` mechanically, which is `1500 rev/min` on four poles at `50 Hz`.

### 2.9 The synchronous and permanent-magnet machines

The phasor diagram is `V = E + jX_s I` in the motor convention, and the
three-phase power is `3 V E sin δ / X_s` with `R_a` neglected. Pull-out is at
`δ = 90°`. A salient rotor adds `3V²(X_d − X_q) sin 2δ / (2 X_d X_q)`, which
needs no field at all, and moves the maximum below 90 degrees. `pullOut` finds
the salient maximum by bisection on the closed form.

The PMSM's dq current equations are linear at a fixed electrical speed.
`pmsmState` returns an exact `A`, `B` and affine term, and the transient engine
solves them with no step. With `i_d` held at zero the q-axis loop is first
order. `focPlant` hands two rational transfer functions to Control Lab with no
guard and no hedge.

### 2.9a The machine on a network, for the Grid Lab

`GRID_LAB_PLAN.md` Decision 6 imports this lab's synchronous machine rather than
writing a second one, and its §2.8 names the contract. This package meets it,
and `swing.test.js` pins the Grid Lab's own numbers so the two cannot drift.

`reactance(spec, kind)` names four reactances and the question each answers.
The steady-state `X_d` is for seconds after an event. The transient `X_d'` is
for the first cycles, and is what the swing equation runs behind. The
subtransient `X_d''` is for the first cycle, and is what a breaker sees. `X₂`
and `X₀` are the negative and zero sequences an unbalanced fault needs.

`internalEmf(spec, {V, P, Q, kind})` puts `E∠δ` behind whichever of them is
asked for, from a terminal condition, in one consistent unit.

`swing(spec, {Pmax, Pm, damping})` is the one-mechanical-state model,
`M d²δ/dt² = P_m − P_max sin δ` with `M = 2H/ω_elec`. δ is an electrical angle,
which is why `M` divides by the electrical synchronous speed. At `H = 4 MJ/MVA`
and 60 Hz that is `0.0212207 pu·s² per radian`, which is the Grid Lab's figure.

Two objects come out of it, and they are of different kinds. `accel` is the
nonlinear equation, for the Grid Lab's own labelled integrator. `plant` is its
exact linearisation about the equilibrium, a second-order rational transfer
function that crosses to Control Lab with no hedge. `area` is the energy
relation the equal-area criterion integrates. For the Grid Lab's machine the
synchronising coefficient is `1.118034 pu/rad` and the small-signal swing
frequency is `1.15523 Hz`, and the two areas balance at a critical clearing
angle of `70.2924°` to `10⁻¹²`.

### 2.10 What is approximated, and what carries its error

Two objects, both labelled where they are made.

**Saturation** is a model of a curve. `saturation.js` offers `linear` (the
default, and exact), `knee` (piecewise-linear, and exact inside each piece), and
`atan` (smooth, and refused for a transient). Every result carries `exact:
false` once the toggle is on, and `saturationLabel()` is the sentence the app
prints. Power Lab's Group D takes the same stance.

**The induction machine's run-up** integrates `J dω/dt = T(s(ω)) − T_L − Bω`,
which has no closed form. `integrate.js` runs the whole trajectory at step `h`
and again at `h/2`, and Richardson puts the error at `|y_h − y_{h/2}|/15` for a
fourth-order method. That number is returned with every answer. `integrate`
throws rather than returning a trajectory whose relative error exceeds the
guard, and the message names the step count that would meet it. The default
guard is one part in `10⁶`, and the reference run-up reports `6.9 × 10⁻¹¹`.

The run-up also carries a second guard, on the model rather than the method. The
quasi-static picture assumes the stator transient is over before the speed has
moved. `separated` is the ratio of the two time constants, `guardMet` is whether
it clears ten, and the reference machine's ratio is `17.6`.

### 2.11 Invariants, the fuzzer's checklist

`invariants.test.js` holds all seven, each over random machines.

1. **Power balance closes.** At every sample of a fuzzed run-up, `powerAudit`'s
   gap is under `10⁻¹⁰` of the power supplied, and the coupling pair's residual
   is under the same. The energy ledger's gap is under `10⁻⁹` of the energy
   supplied on a grid that resolves the fastest transient.
2. **The steady-state line is the settled time solution.** Speed and current
   agree to `10⁻⁸` of the machine's own scale.
3. **The dq transform inverts and carries power.** Both conventions, 300 random
   triples each, to nine decimals.
4. **The ideal transformer is exact.** Both ratios to `10⁻⁹`, and Tellegen
   across the four elements to `10⁻¹⁰` of the load's power.
5. **The sense resistance never reaches an answer.** Eight decades, no change
   beyond `10⁻⁸`.
6. **The induction machine at rest and at breakdown.** Zero torque at zero slip
   exactly, linear in the slip near it, and the phasor circuit agreeing with the
   closed form at the breakdown slip to nine decimals.
7. **Every integration reports its error.** The Richardson estimate falls by
   more than `2³·⁵` when the step halves, and the guard refuses rather than
   returning an answer it cannot state.

A fuzz that draws parameters independently draws machines nobody builds. The DC
fuzzer draws the two time constants as a ratio between 5 and 200, which is the
range a drives course works in, and §11 says why.

---

## 3. Models: the element library

Every machine below is a `spec` object with defaults, a validator that names the
value that is wrong, and a netlist builder. Nothing takes an unnamed positional
argument.

| Model | File | Netlist? | Closed form? |
| --- | --- | --- | --- |
| DC machine, separately excited or permanent magnet | `dc.js` | two states, exact | line, operating point, roots |
| Ideal transformer | `transformer.js` | four elements, exact | ratios |
| Transformer equivalent circuit | `transformer.js` | phasor, exact | reflected impedance, open and short |
| Induction machine, per phase | `induction.js` | phasor, exact | torque, breakdown, Thévenin |
| Induction machine, run-up | `induction.js` | no | guarded integration |
| Synchronous machine, round and salient | `sync.js` | no | phasor, power angle, pull-out |
| Synchronous machine on a network | `sync.js` | no | four reactances, the internal EMF, the swing model |
| PMSM in dq | `sync.js` | state space, exact | torque, the two loops |
| Loss budget and thermal | `losses.js` | thermal RC, exact | efficiency, peak, limit |
| Saturation | `saturation.js` | no | labelled model |

Three-phase quantities are per phase throughout, and every three-phase result
says so by carrying the factor three where it belongs. A phasor is `[re, im]`
and an rms value divides a peak by `√2`, which is `packages/network`'s own
convention.

---

## 4. The app

### 4.1 Layout

Circuit Elements Lab's shape, unchanged. A left sidebar carries the experiment
picker, folded by group. A topbar carries the flow. The centre holds a schematic
with live meters, then a knob row, then the note in its three registers with
terms folded under it. A lower pane carries the view switch.

### 4.2 Views

Eight views. Four are the suite's and four are new to this lab.

| View | Shows | New? |
| --- | --- | --- |
| Reading | every meter on the machine at once | reused |
| Scope | voltages, currents, speed and torque against time | reused |
| State equation | `ẋ = Ax + Bu` as built, with the rotor's row named | reused |
| Power | where every watt goes, with the two totals matching | reused |
| Phasors | the machine's phasor diagram, arrows and the waveform | reused |
| Torque–speed | torque against speed, the load line, the crossing | **new** |
| Rotating field | the three phase currents and the wave they sum to | **new** |
| Phase plane | current against speed, the trajectory to the operating point | **new** |
| dq | the abc set and the dq pair, at the same instant | **new** |

The torque–speed canvas takes a list of machine curves and a list of load
curves, and marks every crossing. It is what a drives course draws on a
whiteboard, and Group A, Group C and Group D all use it.

The rotating-field canvas draws the three winding axes, the three instantaneous
currents as arrows on them, and their sum as one arrow with its locus. Its
`poles` prop is what makes the mechanical angle differ from the electrical one.

The phase-plane canvas is minimal by Decision 5. Two states, a trajectory, the
equilibrium marked, and the direction field off by default. Control Lab II's
needs are in its props from the start, and `NEEDS.md` records it.

### 4.3 Numbers: the defaults every lesson is written against

**The DC machine.** `V_a = 24 V`, `R_a = 1.2 Ω`, `L_a = 3 mH`, `k = 0.06 V·s/rad`,
`J = 2 × 10⁻⁴ kg·m²`, `B = 10⁻⁵ N·m·s/rad`, `T_L = 0.05 N·m`. That gives a stall
torque of `1.20 N·m`, a no-load speed of `400 rad/s` or `3819.7 rev/min`, and an
operating point at `3648.4 rev/min` drawing `0.897 A`. The two time constants are
`2.5 ms` and `66.4 ms`, a ratio of `26.6`.

**The transformer.** `240 V`, `60 Hz`, `n = 2`, `R₁ = 0.6 Ω`, `X₁ = 1.2 Ω`,
`R₂ = 0.15 Ω`, `X₂ = 0.3 Ω`, `R_c = 1800 Ω`, `X_m = 800 Ω`, `R_L = 6 Ω`. That
gives `113.57 V` at the load, `18.93 A` through it, `2149.7 W` out, and an
efficiency of `93.9 %`.

**The induction machine.** Four poles, `400 V` line, `50 Hz`, so `1500 rev/min`
synchronous. `R₁ = 1.4 Ω`, `X₁ = 2.4 Ω`, `R₂ = 1.2 Ω`, `X₂ = 2.4 Ω`,
`X_m = 65 Ω`, `R_c = 1200 Ω`, `J = 0.05 kg·m²`, `B = 0.002 N·m·s/rad`,
`T_L = 20 N·m`. That gives a slip of `2.77 %`, `1458.5 rev/min`, `6.25 A`, a
power factor of `0.801`, and an efficiency of `88.0 %`.

**The synchronous machine.** Four poles, `400 V` line, `50 Hz`, `E = 260 V` per
phase, `X_s = 8 Ω`, `X_d = 8 Ω`, `X_q = 5 Ω`. At `δ = 20°` that is `7701 W` and
`49.03 N·m`, against a pull-out of `22 517 W`.

**The PMSM.** `R = 0.5 Ω`, `L_d = L_q = 2 mH`, `λ_m = 0.08 Wb`, three pole
pairs, `J = 5 × 10⁻⁴ kg·m²`, `B = 10⁻⁴ N·m·s/rad`. The torque constant is
`0.36 N·m/A` in the amplitude-invariant convention, the current loop's time
constant is `4 ms`, and the speed loop's is `5 s`.

**The loss budget.** `3000 W` out, `252 W` copper at full load, `116 W` core,
`46 W` friction, `0.5 %` stray, `R_th = 0.17 K/W`, `C_th = 6000 J/K`, ambient
`40 °C`, class F at `155 °C`. Those first four numbers are the induction
machine's own split at its operating point, so Group E audits Group C's machine
rather than a new one.

---

## 5. Curriculum: 35 experiments in 5 groups

Each experiment names its claim and the number that measures it. Every number
below came from `scripts/numbers.mjs` and is pinned in `experiments.test.js` as
a function of the knobs.

### Group A: The DC machine (8)

- **A1 · The armature is an R–L with a speed in it.** The state equation view
  shows two states, `i_a` and `ω`, and the `A` matrix read off the netlist is
  `[[−400, −20], [300, −0.05]]`. Measured: every entry against `−R_a/L_a`,
  `−k/L_a`, `k/J` and `−B/J`.
- **A2 · Back-EMF, the voltage the shaft makes.** Drive the machine and the
  armature voltage splits into `i_a R_a` and `k ω`. At the operating point that
  is `1.076 V` and `22.92 V` out of `24 V`. Measured: the split, and `k` from
  the slope of `e` against `ω`.
- **A3 · Torque is the same constant.** `T_e = k i_a` with the same `k` as A2.
  At `0.897 A` the torque is `0.0538 N·m`. Then set `k_t` to `0.09` on purpose,
  and the coupling's power residual goes from `3.6 × 10⁻¹⁵ W` to more than a
  tenth of the input. Measured: both, and the residual as the reason `k_e = k_t`
  is not a coincidence.
- **A4 · The torque–speed line.** Stall torque `1.20 N·m` at zero speed, no-load
  speed `3819.7 rev/min`, slope `−0.003 N·m per rad/s`. The load line crosses it
  at `3648.4 rev/min`. Measured: the three, and the crossing against the time
  solution's settled point.
- **A5 · Starting current, and the resistance that limits it.** With a flywheel
  the speed barely moves while the current rises, and the peak is `19.80 A`
  against `V/R = 20 A`, reached `15.8 ms` in. That is `22` times the running
  current. A `3.6 Ω` starter drops it to `5 A` and the stall torque to
  `0.30 N·m`. Measured: the peak, its time, and both ratios.
- **A6 · The two time constants.** `τ_e = L_a/R_a = 2.5 ms` and
  `τ_m = J R_a/k² = 66.4 ms`, and the roots of the second-order polynomial are
  `−15.66` and `−384.4 per second`. Measured: the roots from the netlist against
  the polynomial, and the ratio `26.6` that the quasi-static picture rests on.
- **A7 · Speed control by armature voltage.** At `8 V`, `16 V` and `24 V` the
  no-load speeds are `1273`, `2546` and `3820 rev/min`, and the slope does not
  move. Measured: the three speeds, and the slope equal across all three.
- **A8 · Speed control by field.** Weakening the field to `0.5` doubles the
  no-load speed to `7639 rev/min` and halves the stall torque to `0.60 N·m`. The
  running current rises from `0.897 A` to `1.908 A` for the same load. Measured:
  the two ratios, and the current, which is what field weakening costs.

### Group B: The transformer, a machine that does not turn (6)

- **B1 · Volts per turn, and ampere-turns.** The ideal transformer alone, `n = 2`.
  The secondary voltage is exactly half the primary's and the primary current is
  exactly half the secondary's, at any load. Measured: both ratios over a swept
  load, and the four coupling elements summing to no power at all.
- **B2 · Reflected impedance.** A `6 Ω` load looks like `24 Ω` from the primary.
  Measured: the driving-point impedance against `n²R_L` over a swept `n`.
- **B3 · The equivalent circuit.** Add the winding resistances, the leakage
  reactances and the magnetising branch. The load voltage falls from the ideal
  `120 V` to `113.57 V`. Measured: the drop, and the same voltage rebuilt from
  `R_eq = 1.2 Ω` and `X_eq = 2.4 Ω` referred to the primary.
- **B4 · Open circuit and short circuit.** With no load the reading is the shunt
  branch, `|Z_oc| = 732.4 Ω` and `31.9 W`. With the secondary shorted it is the
  series branch, `|Z_sc| = 2.68 Ω`. Measured: both against a solve of the same
  netlist with the load removed or shorted.
- **B5 · Regulation.** The secondary sits at `119.78 V` unloaded and `113.57 V`
  loaded, a regulation of `5.47 %`. A lagging load of the same size takes it to
  `8.07 %`. Measured: both, and the phasor diagram that explains why the lagging
  case is worse.
- **B6 · Efficiency, and where it peaks.** At full load `2149.7 W` out,
  `109.2 W` copper, `30.2 W` core, `93.9 %`. Copper rises with the square of the
  load and core does not move, so the peak is at `52.6 %` of full load.
  Measured: the peak against `√(P_core/P_cu)`, and the curve either side of it.

### Group C: The rotating field and the induction machine (9)

- **C1 · Three phases make one travelling wave.** Three windings, three
  currents, one arrow that turns at constant speed and constant length. Its
  amplitude is `3/2` of one winding's. Measured: the sum against
  `(3/2) N I cos(ωt − θ)` at 500 random pairs.
- **C2 · Synchronous speed.** Four poles at `50 Hz` gives `1500 rev/min`, and two
  poles gives `3000`. Measured: `120 f / poles`, and the wave's own speed on the
  rotating-field canvas.
- **C3 · Slip.** The rotor cannot turn at synchronous speed, because at zero slip
  no flux cuts it. At `2.77 %` slip the shaft turns at `1458.5 rev/min` and the
  rotor sees `1.38 Hz`. Measured: the slip from the two speeds, the rotor
  frequency, and the torque being exactly zero at `s = 0`.
- **C4 · The per-phase equivalent circuit.** `R₁`, `jX₁`, the shunt branch, then
  `jX₂` and `R₂/s`. At the operating point the stator draws `6.25 A` at a power
  factor of `0.801` and the rotor branch carries `4.95 A`. Measured: both
  currents, the power factor, and the input power from the phasors.
- **C5 · R₂/s splits into copper and shaft.** The air-gap power is `3189.6 W`.
  The slip fraction of it, `88.3 W`, is rotor copper. The rest, `3101.3 W`, is
  mechanical. Measured: the split against `s` and `1 − s`, and the two summing to
  the air-gap power.
- **C6 · The torque curve.** Sweep the slip from 1 to 0 and the torque rises,
  peaks and falls to zero. At the load's `20 N·m` the curve crosses at `2.77 %`.
  Measured: the closed form against a phasor solve at seven slips, and the
  crossing against the run-up's settled speed.
- **C7 · Breakdown.** The largest torque is `76.0 N·m` at a slip of `0.2443`,
  which is `1133.6 rev/min`. That is `3.74` times the rated torque, and it is the
  load past which the machine stalls. Measured: the closed form against the
  curve's peak, and the refusal when the load asks more.
- **C8 · Starting.** At standstill the machine draws `43.1 A` and makes
  `39.5 N·m`. That is `6.89` times the running current for `1.95` times the
  running torque, and it is why a large machine is not started across the line.
  Measured: both ratios.
- **C9 · Rotor resistance moves the breakdown point.** Multiply `R₂` by four and
  the breakdown slip moves from `0.2443` to `0.9774`, and the peak torque does
  not move at all. At `4.09` times `R₂` the peak sits exactly at standstill.
  Measured: the slip ratio, the peak unchanged, and the resistance that puts the
  peak at `s = 1`.

### Group D: Synchronous and permanent-magnet machines (7)

- **D1 · The phasor diagram.** `V = E + jX_s I`, drawn. At `δ = 20°` with
  `E = 260 V` the current is `11.24 A` at a power factor of `0.989` leading.
  Measured: the current from the phasor triangle, and the power from `3 V I cos φ`
  matching `3 V E sin δ / X_s`.
- **D2 · Power angle and pull-out.** Power follows `sin δ`, so it peaks at
  `90°` at `22 517 W`. The operating point at `20°` sits at `7701 W`, a margin of
  `2.92`. Measured: the closed form against the swept curve's maximum.
- **D3 · Excitation, and the V curve.** At `E = 180 V` the machine draws
  `10.90 A` lagging. At `260 V` it draws `11.24 A` leading. The minimum current
  is where the reactive power is zero. Measured: the current at four excitations,
  the sign of `Q`, and the minimum's location.
- **D4 · Saliency and reluctance torque.** With `X_d = 8 Ω` and `X_q = 5 Ω` a
  second term appears, `3856 W` at `20°` beside the field term's `7701 W`. With
  no field at all the machine still makes `6000 W` at `45°`. Measured: both
  terms, and the pull-out angle moving to `67.7°`.
- **D5 · The dq transform is a change of variables.** A balanced set at peak
  `325 V` maps to a radius of `325` in the amplitude-invariant convention and
  `398.0` in the power-invariant one, a ratio of `√(3/2)`. Both invert exactly.
  Measured: the round trip, both radii, and each convention's own power law.
- **D6 · The PMSM in dq, two states at a fixed speed.** At `628.3 rad/s`
  electrical the state matrix is exact and the cross terms are `±ω_e L/L`. The
  magnet's own EMF is the affine term, `−25 133` in the q row. Measured: the
  matrix, and the q-axis current step against an R–L with a source.
- **D7 · Field-oriented control, and the hand-over.** With `i_d` held at zero the
  torque is `0.36 N·m` per amp of `i_q`, the current loop is
  `1/(L_q s + R)` with a time constant of `4 ms`, and the speed loop is
  `1/(J s + B)` with `5 s`. The two are `1250` apart, which is why they nest.
  Measured: both transfer functions, both DC gains, and the ratio. Hands to
  Control Lab as `plant=custom`.

### Group E: Losses, efficiency and the thermal limit (5)

- **E1 · Where the power goes.** Group C's machine at full load loses `252 W` in
  copper, `116 W` in the core, `46 W` to friction and `15 W` to stray, out of
  `3429 W` in. Measured: the five terms summing to the input, and each against
  Group C's own phasor solve.
- **E2 · Efficiency against load.** `87.5 %` at full load, `86.8 %` at half,
  `80.8 %` at a quarter. The peak is at `77.9 %` of full load, where the variable
  loss equals the fixed loss. Measured: the peak against
  `√(P_fixed/P_var,full)`, and the curve either side.
- **E3 · The thermal circuit.** The loss is a current, the thermal resistance a
  resistance, the rise a voltage. `429 W` gives a rise of `72.9 K` with a time
  constant of `17.0 minutes`. Measured: the closed form against a transient of
  the same netlist, and the rise at one time constant.
- **E4 · The insulation class sets the rating.** Class F at `155 °C` from a
  `40 °C` ambient allows `676 W` of loss. This machine reaches it at `1.39`
  times full load, and takes `29.4 minutes` to pass `100 °C`. Measured: the
  allowed loss, the overload that reaches it, and the time.
- **E5 · Saturation, a labelled toggle.** With the toggle off every number on
  screen is exact. Turn it on and the magnetising inductance falls past the knee,
  from `8 H` to `0.4 H`, so `0.45 A` gives `1.32 Wb` where a linear model
  predicted `3.60`. Measured: the flux, the incremental inductance either side of
  the knee, and the label saying which model produced them.

---

## 6. Hand-overs

| From | To | What crosses | Test at both ends |
| --- | --- | --- | --- |
| Machines D7 | Control Lab | the current loop and the speed loop as `{b, a}` | the margins agree with Control Lab's for the same plant |
| Machines A6 | Control Lab | the DC machine's second-order plant, `ω/V_a` | the roots agree with the plant's poles |
| Elements H5 | Machines B, C, D | AC power, the power factor, `Q` | the terms are defined on contact |
| Elements F, G | Machines A | states, the time constant, the characteristic equation | the state equation view is Elements F4's |
| Machines B1 | Elements F8, when written | the ideal transformer construction | `NEEDS.md` carries the contract |
| Machines D | Grid Lab Group I | `reactance`, `internalEmf`, `swing`, the pu conventions | `swing.test.js` pins the Grid Lab's numbers |
| Machines C | Energy Lab, when written | the machine behind a turbine's power curve | `BACKLOG.md` names it |
| Power Lab F, L | Machines drives | inverters and choppers | deferred, `BACKLOG.md` |

Elements H5 and Elements F4 are cross-referenced by name in the lesson text, and
`progression.test.js` checks that both exist. The ids are in `NEEDS.md`.

---

## 7. Testing discipline

**The engine.** `packages/machines/src/*.test.js`, 127 tests. Seven of them are
the fuzzed invariants of §2.11, thirteen are the Grid Lab contract of §2.9a, and
the rest are per-module. Every closed form is
checked against a solve of the same model, never against a constant.

**The numbers.** `apps/machines-lab/scripts/numbers.mjs` prints every number in
§4.3 and §5 from the package. It was run before this plan was written, and its
output is the source of every figure quoted here. A number that changes changes
in one place.

**The lessons.** `experiments.test.js` loads every experiment at its defaults,
solves it, and checks every `reads` pair and every number-with-unit in the
sentence against the solve. A number is computed from the knobs and never typed
as a constant.

**The prose.** `prose.test.js` runs every `see`, `try`, `why`, term and chrome
string against `packages/prose`. `npm run lint:prose` runs the markdown pass
over this file and the brief.

**The harness.** `apps/machines-lab/scripts/verify.mjs`, adapted from Circuit
Elements Lab. It loads every experiment, opens every math panel, reads every
check mark, switches every view, moves knobs and confirms the meters follow. It
is written in this lab's first phase and run when a browser is available.

---

## 8. Integration and the dark launch

`RELEASE_STATUS` reads `dark` from the first commit. `release.test.js` is
Elements' file with the paths changed, and while the status is `dark` it fails if
`site/index.html`, `README.md` or `packages/ui/src/LabNav.jsx` mentions the lab.
It also requires the deploy workflow to ship the build either way, so the dark
URL exists to review.

The director adds one line to `.github/workflows/deploy.yml`:

```
cp -r apps/machines-lab/dist _site/machines-lab
```

`apps/machines-lab/NEEDS.md` carries that line, the progression-test ids and
counts, the promotion candidate of Decision 5, and the `packages/network`
contract of Decision 3.

---

## 9. Phasing

Each phase ships green and deployable on its own.

1. **The engine.** `packages/machines` with the seven invariants fuzzed green.
   No app exists.
2. **The plan and the brief.** This file and `apps/machines-lab/AGENT_BRIEF.md`.
3. **The app shell, dark.** `RELEASE_STATUS`, `release.test.js`, the picker, the
   schematic, the note, the view switch, and one experiment.
4. **Group A, then Group B.** The torque–speed canvas lands with A4 and the
   phase plane with A6. Group B needs no new canvas.
5. **Group C.** The rotating-field canvas lands with C1.
6. **Group D, then Group E.** The dq view lands with D5.
7. **The drives group.** Waits on Power Lab Groups F and L. Not in this lab's
   scope, and recorded in `BACKLOG.md`.

Groups A and B need only Elements, so they can be built in parallel by two
agents. Group C needs Group B's transformer, which is why the brief gates it.

---

## 10. Non-goals, stated so they are decisions

- **The drives group.** Deferred by Decision 4, with the dependency named.
- **The induction machine's dq model with speed as a state.** Bilinear, so not a
  linear state space and not a transfer function. Declined in §2.6, with the
  quasi-static run-up offered in its place.
- **Finite-element magnetics, slot harmonics, cogging torque.** No closed form
  the suite could state, and no lesson that survives without the tool.
- **Space-vector modulation and the inverter's own switching.** Power Lab's
  subject, and this lab would duplicate it badly.
- **Unbalanced three-phase and symmetrical components.** The Grid Lab's, by
  `EE_LABS_MAP.md` §2. C1 shows a balanced set only.
- **Machine design.** Winding layouts, slot fill, magnetic circuit sizing. A
  different course, and one with no interactive form the suite has.
- **Real motor data.** Nothing is loaded from a datasheet or a dynamometer, by
  the rule that governs the whole suite.

---

## 11. Risks, named

**The mechanical analogy reads as a trick.** A reader who sees a capacitor
labelled `kg·m²` may not believe it. The answer is A1, which shows the state
equation with the rotor's row named in mechanical units, and the energy view,
which shows `½Jω²` as the rotor's kinetic energy in joules.

**Stiffness.** A machine whose mechanical time constant is a million times its
electrical one asks the propagator to hold `e⁻¹⁰⁰⁰⁰⁰⁰` beside `e⁻¹` in one
matrix. The fuzzers draw the ratio between 5 and 200, and the app's knob ranges
keep it under `10³`. A knob that leaves that range needs a guard, and §2.10's
pattern is the model for it.

**Three-phase with no home.** C1 and C2 carry the Y and Δ relations that no lab
teaches. If Power Lab Group I is built first, the two labs will state the same
thing twice. The director resolves it, and `NEEDS.md` names it.

**The convention trap.** A torque constant is wrong by `3/2` in the other dq
convention. Every function carries `convention` and every result repeats it, and
D5 makes the trap an experiment rather than a footnote.

**The canvas count.** Three new canvases in one lab is more than any lab in the
suite has added at once. Two of them, the torque–speed and the rotating field,
have no second lab named yet, so they stay in the app. The phase plane has one,
and it is offered for promotion.
