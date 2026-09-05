# Grid Lab: the plan

Track F's second lab: **power systems**, the subject a department teaches beside power
electronics and never inside it. Power Lab switches a converter at 100 kHz. This lab
holds a network at 60 Hz and asks where the power goes, what happens when a conductor
falls, and whether a machine stays in step. Splash glyph `⌁`, directory
`apps/grid-lab`, engine as a new `packages/grid` on `packages/network`.

The path, in order. Per unit, which is the change of variables the rest of the subject
is written in. Three phase from the circuits side, balanced and then not. The line and
the transformer as π models with numbers a reader can check. Power flow as the
nonlinear problem, solved by Newton on the companion machinery the Electronics Lab
builds. The DC power flow as the approximation it is, with the threshold that governs
it. Symmetrical components, and the four faults they give in closed form. Protection.
The synchronous machine on the grid, the swing equation, and the equal-area criterion.
Economic dispatch.

This is a draft (2026-09-05) for Reed to settle. §0 lists what needs a decision. §1 is
the progression map, and it names every dependency by its status: built, planned, or
being built.

The two rules that govern the other labs govern this one with no exemption. **Every
explanatory sentence is a claim about physics, and a test must measure it.** And
`CORE_SCOPE.md` decides what the engine may state exactly, what it may approximate
behind a guard, and what it declines with a reason. This lab has one guarded object of
real consequence, the DC power flow, and §2.7 gives it a threshold and a number.

---

## 0. Open decisions

### Decision 1: the name (recommended: Grid Lab)

`EE_LABS_MAP.md` §1 already calls it that, and it separates the subject from Power Lab
in one word. The alternative, Power Systems Lab, is the catalogue name and is four
syllables longer in a nav row that is already full. LabNav short form `Grid`.

### Decision 2: where the power-flow Newton lives (recommended: `packages/grid`)

The Electronics Lab's `companion.js` linearises an element at its terminal voltages,
in real coordinates, for `newtonDC`. A power-flow bus linearises a scheduled power
injection at (θ, |V|), and its unknowns are polar. Those are different state vectors
in the same shape. The recommendation is that `packages/grid` owns the polar Newton
and imports `assembleAC` for the admittance matrix. `packages/network` gains nothing,
which keeps the Electronics overseer's surface unchanged (`PROGRAM.md` §5).

### Decision 3: the one-line canvas in `packages/ui` from the first commit

`PROGRAM.md` §4 lists the one-line diagram with power-flow arrows as new. The Grid Lab
is first and the Energy Lab is second. A canvas with a second lab named goes into
`packages/ui`. The recommendation is to put it there on the day it is written. Its
signature carries the Energy Lab's props from the start: a source with a state of
charge, a DC bus, and a day-long time cursor.

### Decision 4: per unit always on, with a volts-and-amperes toggle

Every quantity in this lab has two readings, per unit and SI. The recommendation is
that per unit is the default, that the topbar carries the base beside it, and that one
toggle converts every meter at once. Group A makes that toggle the lesson.

### Decision 5: the swing equation's integrator (recommended: its own, labelled)

`packages/network`'s `dynamics` builds `dx/dt = Ax + Bu` from a netlist and solves it
by the matrix exponential, exactly. The swing equation is not linear and not a
circuit, so it cannot go through that door. The recommendation is a fixed-step RK4 in
`packages/grid`, labelled on the pane, with the step chosen by the guard in §2.8.

### Decision 6: the machine model comes from the Machines Lab

The Machines Lab is being built, and its synchronous machine is this lab's generator.
The recommendation is to import it rather than write a second one, and to hold Group I
behind that import. §1 names the contract, and `NEEDS.md` carries it to the director.

---

## 1. The progression map

Every idea this lab leans on, the experiment that teaches it, and whether that
experiment exists today. Status words are the backlog's. **Built** is on the site.
**Planned** has a plan file. **Being built** has an overseer and a branch.

| Idea the lab leans on | Needed by | Taught at | Status |
| --- | --- | --- | --- |
| The two laws, nodal analysis, Thévenin | everything | Elements A to D | built |
| Phasors, impedance, one sine at a time | B, C, F | Elements h1 to h4 | built |
| AC power: P, Q, apparent power, power factor | A, B, C, I | Elements h5 | built |
| Frequency response of a network | C4 | Elements h6, Circuit Lab | built |
| The complex solve `solveAC` and its per-element `S` | the whole engine | `packages/network/src/phasor.js` | built |
| Newton on a companion linearisation, iterations kept | D | Elements i2, `pwl.js` `newtonDC` | built |
| The companion interface as a contract any element implements | D2, D3 | `ELECTRONICS_LAB_PLAN.md` §2.5, brief §3.2 | planned |
| Source stepping when the direct solve does not converge | D6 | brief §3.2 `sourceStepping` | planned |
| A region change recorded per iteration for the view | D4 | brief §3.2 `region` | planned |
| State space from a netlist, solved exactly | not used, and §2.8 says why | `dynamics.js` | built |
| Three-phase inverter output, six-step and PWM | B5 cross-reference | Power Lab Group I | planned |
| The magnetic circuit behind a transformer | C4 cross-reference | Power Lab Group D | planned |
| The synchronous machine, its reactance and its rotor | I1 onward | Machines Lab | **being built** |
| The dq transform as an exact change of variables | not used in v1 (§10) | Machines Lab | being built |
| The photovoltaic source on a bus | not used, the Energy Lab's | Energy Lab | being built |
| Symmetrical components | F, G, H | nowhere | **gap, F** |
| Per unit | A onward | nowhere | **gap, A** |
| Power flow | D, E, J | nowhere | **gap, D** |
| The swing equation | I | nowhere | **gap, I** |

Three things the map shows that this plan does not fix, so that they are decisions and
not omissions. **The Machines Lab's synchronous machine is being built**, and Group I
imports it. Until that import lands, Group I runs against the contract in §3 and its
experiments do not ship. **The companion interface is planned**, not built, and §2.4
states what this lab needs from it. **Power Lab Groups D and I are planned** with no
overseer, so B5 and C4 cross-reference them by name and the progression test fails on
the reference until they exist. That failure is the design (`PROGRAM.md` §3).

The order of the groups follows the map. Nothing in a group leans on an experiment
that comes later in this lab, and every cross-lab reference names a built or planned
experiment.

---

## 2. The engine: per unit, the bus as a companion, and the machine as one state

### 2.1 What exists, and what is missing

`packages/network` already solves the AC network this lab runs on. `assembleAC` stamps
a capacitor as `jωC`, an inductor as a branch row, and every source as a phasor, and
`readoutAC` returns each element's complex power `S = ½ V I*` and the KCL residual at
every node. A π-model line is two shunt capacitors and a series impedance, so a
transmission network needs no new stamp. What is missing is listed here.

| Need | Today | This plan |
| --- | --- | --- |
| Per unit as a change of variables | nothing | `perUnit.js` (§2.2) |
| Power flow at scheduled injections | `solveAC` at fixed sources only | `powerFlow.js` on the polar Newton (§2.4) |
| Bus types and their limits | nothing | the bus companion (§2.5) |
| The DC power flow | nothing | `dcFlow.js` with its guard (§2.7) |
| Sequence networks | nothing | `sequence.js` (§2.6) |
| The swing equation | `dynamics` is linear and exact | `swing.js`, one mechanical state (§2.8) |
| Relay characteristics | nothing | `relay.js` (§2.9) |
| Economic dispatch | nothing | `dispatch.js` (§2.10) |

### 2.2 Per unit is a change of variables, and it is exact

Pick a three-phase base power `S_b` and a line-to-line base voltage `V_b` at one point.
Every other base follows. `Z_b = V_b²/S_b` and `I_b = S_b/(√3 V_b)`. At 100 MVA and
230 kV that is 529 Ω and 251.022 A. At 13.8 kV on the other side of a transformer it is
1.9044 Ω and 4183.7 A. The transformer's turns ratio disappears, because the two
voltage bases are in the same ratio.

Changing base is one formula. An impedance given on a device's own rating moves as
`Z_new = Z_old (S_new/S_old)(V_old/V_new)²`. A generator at 0.20 pu on 90 MVA is
0.222222 pu on 100 MVA. A transformer at 0.10 pu on 150 MVA is 0.0666667 pu.

Per unit scales every variable by a constant, so it is exact and carries no guard.
`perUnit.js` holds the bases and converts in both directions. Invariant 5 requires that
the network solved in ohms and volts equals the per-unit network scaled back, to
floating point.

### 2.3 The network underneath is the phasor solve

`packages/grid` builds the bus admittance matrix from the same element list
`assembleAC` stamps. A line is `{ R, L }` in series with `{ C }` to ground at each end.
A transformer is a series reactance with an ideal ratio. The matrix `Y = G + jB` is the
nodal part of `assembleAC` at `ω = 2πf`, and the Grid Lab reads it from there rather
than assembling a second one.

For the three-bus system of §4.3 that matrix is:

```
Y11 =  2.5641 − j20.313    Y12 = −1.5385 + j12.308    Y13 = −1.0256 + j8.2051
Y22 =  3.4615 − j27.548    Y23 = −1.9231 + j15.385
Y33 =  2.9487 − j23.406
```

Once the power flow has converged, the bus voltages go back through `readoutAC` as a
known solution vector. Branch flows, per-element complex power and the KCL residual
come from the existing readout, unchanged. That is what makes invariant 1 free.

### 2.4 Power flow as Newton on companion stamps

The Electronics Lab generalises `newtonDC` so that any nonlinear element returns its
tangent at the current guess (`AGENT_BRIEF.md` §3.2). A power-flow bus is that same
object with a different state vector. The element's law is the scheduled injection, the
controlling variables are the bus's own angle and voltage magnitude, and the companion
is the row of the Jacobian the bus contributes.

One change is forced and is worth stating. A constant-power injection draws
`I = (P − jQ)/V*`, and that is not a differentiable function of the complex `V`, so no
complex admittance is its tangent. The tangent exists in the real pair `(θ, |V|)`. So
the power-flow Newton runs in real coordinates over `(θ, |V|)`, and `companion` returns
a real block rather than a complex admittance. The interface's shape is unchanged.
`g` is the block, `i` is the mismatch, `region` is the bus type in force, and `limit`
clamps the step.

The iteration loop is `newtonDC`'s, line for line. Each pass evaluates the injections
at the current guess, forms the mismatch, solves the linear system, applies `limit`,
and stops on the same tolerance. Every iteration is kept in `iters`, so the view shows
the mismatch falling the way Elements i2 shows a diode's voltage settling.

### 2.5 What each bus type contributes

Three bus types, three companions.

- **The slack bus** contributes no equation and no unknown. Its angle is the reference
  and its magnitude is held. It has no row in the Jacobian and no entry in `i`. Its
  `region` is `slack`. At readout it absorbs whatever the network needs, which is the
  load it does not supply plus every watt of loss.
- **A PQ bus** contributes two equations and two unknowns. Its `i` is
  `[P_sch − P(θ, V), Q_sch − Q(θ, V)]`. Its `g` is the 2×2 diagonal block
  `[∂P/∂θ, ∂P/∂|V| ; ∂Q/∂θ, ∂Q/∂|V|]` plus one off-diagonal 2×2 block for every bus it
  shares a branch with. Its `region` is `pq`.
- **A PV bus** contributes one equation and one unknown. Its magnitude is held by a
  generator, so the `∂/∂|V|` column and the `Q` row are both absent. Its `i` is
  `[P_sch − P(θ, V)]` and its `region` is `pv`. Its reactive output is read out after
  convergence, not solved for.

A PV bus with reactive limits is a **region change**. It is handled the way a MOSFET's
triode boundary is handled. When the reading `Q` leaves `[Q_min, Q_max]` the bus becomes
a PQ bus. `Q` is pinned at the limit it crossed and `|V|` is set free. The conversion is
recorded in that iteration's `region` map, and the view prints it. So a reader sees the
bus give up its voltage rather than seeing the answer change for no stated reason. A bus
that converts back is allowed. An oscillation between the two is capped and reported.

For the three-bus system, the first Jacobian at a flat start is:

```
             dθ2        dθ3       d|V3|
 dP2     27.6923   −15.3846    −1.92308
 dP3    −15.3846    23.5897     2.94872
 dQ3      1.92308   −2.94872   23.2217
```

The mismatch falls from 1.600 pu to 6.892 × 10⁻², then 3.480 × 10⁻⁴, then
8.367 × 10⁻⁹, then 2.887 × 10⁻¹⁵. Four iterations reach 10⁻¹² pu from a flat start, and
the error squares each time. That doubling of the exponent is the lesson of D3, and it
is a pinned test rather than an assertion.

### 2.6 Sequence networks

Three unbalanced phasors are three balanced sets. `sequence.js` holds the two matrices,
`A` and `A⁻¹`, with `a = 1∠120°`. The transform is a change of basis, so it is exact
and carries no guard. The round trip is invariant 3.

A sequence network is one network per set. The positive-sequence network is the
ordinary per-phase circuit. The negative-sequence network is the same with the machine
reactances that apply to a reversed field. The zero-sequence network is a different
circuit, because a delta winding gives zero-sequence current nowhere to go and a
grounded wye gives it a path through the neutral. `sequence.js` builds the three from
one element list plus a per-element zero-sequence rule, and each is an ordinary
`packages/network` circuit that `solveAC` solves.

The four shunt faults are four ways to connect the three networks at the fault bus.
A three-phase fault shorts the positive network alone. A single line to ground puts the
three in series. A line-to-line fault puts positive and negative in parallel. A double
line to ground puts negative and zero in parallel across positive. Each connection is
exact and gives a closed form, and §4.3 lists the numbers.

### 2.7 The DC power flow, and the threshold that governs it

The DC power flow drops three things. Branch resistance, so there are no losses. Every
voltage magnitude to 1.00 pu. And `sin θ` to `θ`. What is left is one linear solve,
`θ = B'⁻¹ P`, with `B'` built from `1/x`.

That is an approximation under Rule 3, so it ships with a guard, and the guard's number
comes from measurement rather than from a rule of thumb. On the three-bus system at
five loadings:

| Loading | Largest branch angle | Lowest \|V\| | Largest angle error | Largest branch-flow error |
| --- | --- | --- | --- | --- |
| 0.5× | 2.350° | 0.98585 | 0.0250° | 1.554 % |
| 1.0× | 4.759° | 0.96173 | 0.0748° | 3.675 % |
| 1.5× | 7.313° | 0.93488 | 0.1873° | 6.030 % |
| 2.0× | 10.06° | 0.90457 | 0.5582° | 8.666 % |
| 2.5× | 13.07° | 0.86962 | 1.195° | 11.67 % |

The measurement settles which assumption costs the most, and the answer is not the one
the name suggests. At the base case the largest branch angle is 4.759°, where
`sin θ = 0.0569913` against `θ = 0.0570222`, an error of 0.0542 %. The small-angle step
is worth almost nothing. The branch-flow error of 3.675 % comes from the other two
assumptions, the resistance at `R/X = 0.125` and the voltage magnitude of 0.96173 pu.

So the guard is written on what it measures. The pane warns when any branch angle
exceeds 10°, when any bus magnitude leaves 0.95 to 1.05 pu, or when any branch has
`R/X` above 0.25. It declines the link to the one-line diagram's flow arrows when the
angle exceeds 30°, because past that the linear solve and the AC solve can disagree on
a branch's direction. Both thresholds are stated on the pane and exercised at both
sides by a test.

### 2.8 The swing equation as one mechanical state

A synchronous machine on a grid has one mechanical state pair, the rotor angle `δ` and
its speed deviation. The equation is `M d²δ/dt² = P_m − P_max sin δ`, with
`M = 2H/ω_s`. At `H = 4.0 MJ/MVA` and 60 Hz that is 0.0212207 pu·s²/rad.

Two answers come out of it, and they are of different kinds.

**The equal-area answer is exact.** Integrating the equation once gives an energy
relation with no approximation in it. The critical clearing angle solves

```
cos δ_cr = [P_m(δ_max − δ_0) + P_3 cos δ_max − P_2 cos δ_0] / (P_3 − P_2)
```

and the peak of the first swing after clearing at `(δ_c, ω_c)` solves

```
(M/2) ω_c² + P_m(δ_pk − δ_c) + P_3(cos δ_pk − cos δ_c) = 0.
```

Both are root-finds on a closed form, and both are presented without a hedge
(CORE_SCOPE counter-rule). For the machine of §4.3 the areas agree to 5.3 × 10⁻¹⁵ pu·rad.

**The time solution runs under a labelled integrator.** Getting `δ(t)`, and therefore a
clearing *time* rather than a clearing *angle*, needs numerical integration. The pane
names the method and the step. The method is fixed-step RK4, the step is 0.1 ms, and
the step never crosses the clearing instant. The guard is the energy relation itself.
The integrated peak must match the closed-form peak within 0.01°, and the step halves
until it does. At a 1 ms step the peak after clearing at 0.15 s comes out 89.702°
against the exact 89.7763°, an error of 0.074°, so 1 ms fails the guard and 0.1 ms
passes it.

The machine's electrical side is the Machines Lab's synchronous machine. It sits behind
its transient reactance. This lab does not write a second one.

### 2.9 Protection as a characteristic on the solved network

A relay is a curve and a comparison, and both sides of the comparison come from a
solve this lab already does. `relay.js` holds two characteristics. The inverse-time
overcurrent curve is `t = TDS · K / (M^α − 1)` with the IEC constants, and `M` is the
fault current from §2.6 over the pickup. The distance characteristic is a circle or a
quadrilateral on the R–X plane, and the apparent impedance is the relay's voltage over
its current at the same solve. Nothing here is approximate. The curve is a definition
and the impedance is a ratio of two exact phasors.

### 2.10 Measures, and dispatch

Everything the Elements lab measures in AC, plus the list below. Bus voltage magnitude
and angle. Real and reactive injection per bus. Real and reactive flow per branch end,
branch loss and total loss. The mismatch per iteration and the iteration count. Sequence
currents and voltages at any bus. Fault current per phase and in the ground. Relay
operating time and apparent impedance. Rotor angle and speed. The accelerating and
decelerating areas, and the critical clearing angle and time. The incremental cost per
unit.

Economic dispatch is a small convex problem with a closed answer. Equal incremental
cost sets `λ`, the limits clamp each unit, and a bisection on `λ` closes the balance.
It is exact, and §4.3 gives the numbers.

### 2.11 Invariants, the fuzzer's checklist

Across random loadings, random branch impedances and random bus types on every library
network:

1. **KCL in complex power holds at every bus.** At convergence `readoutAC`'s residual
   at every bus is at floating-point zero, in complex power and not only in current.
2. **The slack absorbs the losses exactly.** The sum of every bus injection equals the
   sum of every branch's `I²R` and `I²X`, to floating point. On the base case both are
   0.0181741 pu and they agree to 5.83 × 10⁻¹⁶.
3. **Sequence and phase are one basis change.** `A A⁻¹ = I`, and the phase currents
   rebuilt from the sequence currents equal the originals to floating point. On the
   stated unbalanced set the largest rebuild error is 5.7 × 10⁻¹⁵ A.
4. **The neutral current is three times the zero-sequence current.** `I_a + I_b + I_c`
   equals `3 I_0` to floating point, in every fault and in every unbalanced load.
5. **Per unit is a change of variables.** The network solved in volts, amperes and ohms
   equals the per-unit solution scaled back, to floating point, at every bus and every
   branch.
6. **Newton converges quadratically.** The base-ten log of the mismatch roughly doubles
   each iteration until the floor. The pinned sequence is 1.600, 6.892 × 10⁻²,
   3.480 × 10⁻⁴, 8.367 × 10⁻⁹, 2.887 × 10⁻¹⁵.
7. **The final solve reproduces the mismatch.** Feeding the converged voltages back
   through `solveAC` gives the scheduled injections to the convergence tolerance.
8. **Sequence networks agree with a direct solve.** The three-phase fault current from
   the positive-sequence network equals a direct phasor solve of the balanced faulted
   circuit, to floating point.
9. **The two areas are equal.** `A_1 = A_2` at `δ_cr` to 10⁻¹⁴ pu·rad, computed by
   quadrature rather than by the formula that produced `δ_cr`.
10. **The integrator matches the closed form.** The integrated first-swing peak equals
    the energy relation's peak within 0.01°, at every clearing time short of critical.
11. **The DC flow is the limit.** Set every branch resistance to zero and pin every
    voltage magnitude at 1.00 pu. The AC angles then approach the DC angles as the
    loading falls. The difference is below 10⁻⁶ rad at a tenth of the base loading.
12. **Cross-lab.** A balanced three-phase circuit solved as three phases in
    `packages/network` gives three times the per-phase power, to floating point, and
    matches Elements h5's AC power measures on one phase.

---

## 3. Models: the element library

Everything in the Elements plan's element table stays. These are added, and each is a
netlist of existing elements unless the table says otherwise.

| Element | Ideal law | Toggles, each labelled |
| --- | --- | --- |
| Line (π) | series `R + jX`, `B/2` shunt at each end | long-line correction (exact `cosh`, `sinh` form) above 250 km, `R = 0` for the lossless case, zero-sequence `R_0 + jX_0` |
| Transformer | series `jX` with an ideal ratio | off-nominal tap in 0.00625 pu steps, phase shift, winding connection (Yg, Y, Δ) which sets the zero-sequence path, `R` for load loss |
| Bus | a node with a type | slack, PV with `Q_min`, `Q_max`, PQ, and a shunt `B` for a capacitor bank or a reactor |
| Load | constant power `P + jQ` | constant current and constant impedance, so the ZIP mix is a knob |
| Generator | `E∠δ` behind `jX_d'` | `X_d''` for the fault study, `X_2`, `X_0`, a neutral grounding impedance, `H` and `P_m` for Group I |
| Fault | a connection between the three sequence networks | three-phase, single line to ground, line to line, double line to ground, with a fault impedance `Z_f` |
| Relay | a characteristic and a setting | IEC and IEEE inverse curves, definite time, a distance circle, a distance quadrilateral |

The line's zero-sequence impedance is a separate number and not a multiple of the
positive-sequence one. Group F states it as a given, and the Fields Lab is where a
reader can later see where it comes from.

**One-line description.** Each library network carries bus positions on a grid, in the
idiom `packages/ui/src/schematicGeometry.js` already uses, and the one-line canvas of
§4.2 draws it. Bus names are fixed, so that `reads` paths and layouts agree across
lanes.

---

## 4. The app

### 4.1 Layout

The Elements lab's shape, unchanged. Sidebar with LabNav, the report link, experiment
groups, a network picker, component NumFields with chips, bus-type and model switches,
and the math panel. Main: topbar meters, the one-line diagram always visible, and one
pane below with a pane selector. Phone-width first, no horizontal scroll at 390 px,
harness-checked.

The topbar shows the base first, `100 MVA, 230 kV`, then the experiment's headline
numbers, then the model in use.

### 4.2 Views

Reused, adapted and new, in the terms of `PROGRAM.md` §4.

**Reused unchanged.** `NumField` with unit chips for every impedance and injection.
`LabNav`, `ReportIssue`, `LessonNav` and `TryLine`. `plot.js`, `scale.js`, `format.js`
and `units.js` for every axis. `MathPanel` and `packages/explain/testing` for the two
rules. `deeplink.js` for the hand-overs in §6.

**Adapted, by a prop and not by a copy.**

- **The phasor canvas** from Elements h2 gains a `sets` prop, so it draws three
  balanced sets of three arrows beside the unbalanced set they add to. That is Group F's
  main picture, and it needs no second canvas.
- **The Newton view** from Elements i2 gains a `residual` series. It then plots the
  power mismatch per iteration on a log axis, in place of a diode voltage.
- **`Schematic.jsx`** draws the sequence networks, which are ordinary circuits.

**New, and named with its second lab.**

- **The one-line diagram with power-flow arrows.** Buses as bars and branches as lines.
  Each branch end carries an arrow whose length is the real flow and whose colour
  carries the reactive flow. Voltage magnitude tints the bus. `PROGRAM.md` §4 assigns
  this canvas to this lab with the Energy Lab second, so it goes into `packages/ui`.
  The Energy Lab's props are present from the start: `sourceKind` for a photovoltaic or
  battery bus, `dc: true` for a DC bus, and a `t` prop for a day-long cursor. It ships
  with its own test and both labs named.
- **The P–δ plane.** The three power curves, the operating point, and the accelerating
  and decelerating areas shaded, with their numbers. Group I's picture.
- **The rotor swing.** `δ(t)` against time with the clearing instant marked, the
  integrator's name and step in the corner, and `δ_max` as a line.
- **The relay plane.** Time against current on log axes for the overcurrent curves,
  with two relays and the margin between them. R–X with the zones and the apparent
  impedance for the distance relay.
- **The sequence pane.** The three networks drawn side by side with the fault
  connection between them, and the currents on each.
- **Equations.** The bus admittance matrix and the Jacobian printed as rows, the way
  the Elements lab prints its MNA rows.

### 4.3 Numbers

Defaults chosen so that every quoted number is checkable and the pictures fit a phone.

- **Bases.** `S_b = 100 MVA` three-phase, `V_b = 230 kV` line to line. So
  `Z_b = 529 Ω`, `I_b = 251.022 A`, and 132.791 kV line to neutral. At 13.8 kV,
  `Z_b = 1.9044 Ω` and `I_b = 4183.7 A`.
- **The line.** 230 kV, `0.05 + j0.40 Ω/km`, `3.0 µS/km`. At 100 km that is
  `5 + j40 Ω`, or `0.0094518 + j0.0756144 pu` with 0.1587 pu of charging. The library
  rounds it to `0.01 + j0.08 pu` per 100 km with `B/2 = 0.08 pu`. Surge impedance
  365.148 Ω, so surge impedance loading is 144.873 MW.
- **The three-bus system.** Bus 1 slack at 1.00∠0. Bus 2 PV at 1.00 pu with 0.60 pu of
  generation. Bus 3 PQ with 1.60 + j0.80 pu of load. Branch 1–2 is 100 km, branch 1–3
  is 150 km, branch 2–3 is 80 km.
- **Its solution.** `V_2 = 1.000 ∠ −1.49154°`, `V_3 = 0.961727 ∠ −4.75867°`. The slack
  supplies 1.01817 + j0.0235318 pu. Bus 2 supplies 0.407676 pu of reactive power. Total
  loss 0.0181741 pu, which is 1.81741 MW. Branch flows leaving their first bus are
  0.32088 − j0.11588, 0.69729 + j0.13941 and 0.91984 + j0.44346 pu.
- **The DC comparison.** `θ_2 = −1.4168°` against −1.49154°, `θ_3 = −4.7503°` against
  −4.75867°. Branch flow errors of −3.675 %, −0.9154 % and −1.169 %.
- **The fault network.** A generator at `X_1 = X_2 = 0.15`, `X_0 = 0.05` pu with a
  solidly grounded neutral, a delta-to-grounded-wye transformer at 0.10 pu, and a line
  at `X_1 = X_2 = 0.20`, `X_0 = 0.60` pu. So `Z_1 = Z_2 = j0.45` and `Z_0 = j0.70`,
  because the delta winding blocks the generator's zero sequence.
- **Its faults**, at 1.00 pu prefault voltage. Three-phase 2.2222 pu, 557.83 A,
  222.22 MVA. Single line to ground 1.875 pu, 470.67 A, with each sequence current
  0.625 pu. Line to line 1.9245 pu in each of two phases. Double line to ground
  2.0883 pu in each of two phases, with 1.6216 pu, 407.06 A, in the ground.
- **The machine.** `H = 4.0 MJ/MVA`, 60 Hz, `P_m = 1.0 pu`. Transfer 2.0 pu before the
  fault, 0.5 pu during it, 1.5 pu after one line trips. So `δ_0 = 30.000°`,
  `δ_max = 138.190°`, `δ_cr = 70.2924°`, and the areas are 0.43883275 pu·rad each.
  Critical clearing time 0.206114 s, which is 12.367 cycles.
- **Its swings.** Clearing at 0.05 s gives a peak of 59.4938°. At 0.10 s, 71.5997°. At
  0.15 s, 89.7763°. At 0.20 s, 122.922°. At 0.25 s the machine does not turn back. The
  small-signal swing frequency after the fault is 1.15523 Hz, a period of 0.865629 s.
- **Three-phase from the circuits side.** A wye load of `100 + j50 Ω` per phase at
  230 kV draws 1187.71 A per phase, 423.2 MW and 211.6 Mvar at a power factor of
  0.894427. The instantaneous three-phase power is flat to 1.1 × 10⁻¹⁵ of its mean. One
  phase alone swings from −16.6507 MW to 298.784 MW.
- **An unbalanced set.** 10∠0°, 6∠−150° and 8∠100° A gives `I_0 = 1.98492∠55.010°`,
  `I_1 = 7.80894∠−14.1732°` and `I_2 = 1.32184∠12.4912°`. The unbalance factor is
  16.927 %, and the neutral carries 5.95477 A.
- **The transformer.** 0.10 pu of reactance feeding 0.8 + j0.6 pu drops the receiving
  voltage to 0.931926 pu. The `QX/V` estimate says 0.06 pu against the true 0.0680742.
  A 1.07305 tap restores 1.00 pu, and so does 40 Mvar of shunt capacitance.
- **Protection.** IEC very inverse, pickup 400 A. At 1600 A with `TDS = 0.1` the relay
  operates in 0.45 s. An upstream relay at `TDS = 0.16667` operates in 0.75 s, a margin
  of 0.30 s. A distance relay on a 40 Ω line reaches 32 Ω in zone 1 and 48 Ω in zone 2.
  A fault 60 km out looks like 24 Ω, and with 50 % remote infeed it looks like 36 Ω.
- **Dispatch.** Three units with quadratic costs, 800 MW of demand. `λ = 8.50 $/MWh`,
  outputs 400, 250 and 150 MW, total cost $6682.50 per hour. Three equal shares would
  cost $6877.78, so the saving is $195.28 per hour. The 801st megawatt costs $8.50189.

---

## 5. Curriculum: 42 experiments in 10 groups

Format, as the other plans. **The claim** the note makes, what the reader turns, and
what is **measured** against what **formula**. Every quoted number becomes a pinned
test. Each experiment ships with `see`, `try` and `why` in the Elements lab's three
registers, within the STYLE.md budgets.

### Group A: Per unit (4) · bridge

- **A1 · One base, every quantity.** Pick 100 MVA and 230 kV and every other base
  follows. `Z_b = 529 Ω`, `I_b = 251.022 A`, `V_LN = 132.791 kV`. Turn the base voltage
  and every meter moves together while the physics does not. Measured: the four bases,
  and the per-unit answer against the answer in ohms and amperes.
- **A2 · The transformer disappears.** A 13.8/230 kV transformer between two zones has
  two voltage bases in its own ratio, so its turns ratio leaves the per-unit circuit.
  `Z_b` on the low side is 1.9044 Ω and `I_b` is 4183.7 A. Measured: the low-side
  bases, and that the per-unit impedance seen from either side is the same number.
- **A3 · Changing base.** A generator marked 0.20 pu on 90 MVA is 0.222222 pu on
  100 MVA. A transformer marked 0.10 pu on 150 MVA is 0.0666667 pu. Measured: both
  conversions, and the fault current that follows from using the wrong base.
- **A4 · A load in per unit.** 60 MW at 0.85 power factor lagging is 37.1847 Mvar, or
  0.6 + j0.371847 pu. As a constant impedance at 1.00 pu voltage it is 1.4167 pu.
  Measured: the reactive power, the per-unit pair, and the difference between the
  constant-power and constant-impedance models at 0.90 pu voltage.

### Group B: Three phase (5)

- **B1 · Line to line and line to neutral.** 230 kV between two lines is 132.791 kV to
  neutral, a ratio of √3. The three phasors add to zero, so the neutral carries nothing.
  Measured: the ratio, the sum of the three phasors, and the neutral current.
- **B2 · One phase carries the whole answer.** A balanced wye load of `100 + j50 Ω` per
  phase draws 1187.71 A. Three-phase power is 423.2 MW at a power factor of 0.894427,
  and `√3 V_LL I_L cos φ` gives the same number. Measured: the current, both power
  expressions, and the per-phase circuit against the three-phase one.
- **B3 · Constant power.** The instantaneous power of a balanced three-phase load is
  flat to 1.1 × 10⁻¹⁵ of its mean. One phase alone swings from −16.6507 MW to
  298.784 MW, and Elements h5 shows that swing. Measured: the ripple in both cases, and
  the mean.
- **B4 · Delta and wye.** A delta of 300 Ω is a wye of 100 Ω, and the two draw the same
  line current from the same source. Measured: the equivalence, and the phase current
  inside the delta against the line current outside it.
- **B5 · An unbalanced set is three balanced sets.** 10∠0°, 6∠−150° and 8∠100° A
  resolve into `I_0 = 1.98492∠55.010°`, `I_1 = 7.80894∠−14.1732°` and
  `I_2 = 1.32184∠12.4912°`. The neutral carries `3 I_0`, which is 5.95477 A. Measured:
  the three sequence currents, the rebuild error, and the unbalance factor of 16.927 %.
  Cross-references Power Lab I3 for the inverter that produces a balanced set.

### Group C: The line and the transformer (4)

- **C1 · The line as a π model.** 100 km of `0.05 + j0.40 Ω/km` is `5 + j40 Ω`, or
  `0.0094518 + j0.0756144 pu`. The charging is 0.1587 pu, split between the two ends.
  Measured: the conversion, and the no-load charging current.
- **C2 · Surge impedance loading.** `√(L/C)` is 365.148 Ω, so a 230 kV line delivering
  144.873 MW absorbs exactly as much reactive power as it produces. Above that it
  consumes, below it produces. Measured: the impedance, the loading, and the reactive
  balance at half and twice it.
- **C3 · Where the π model stops.** An open-ended line rises at the far end by
  `1/cos βl`. At 200 km that is 1.02449, and the nominal π model says 1.02459, an error
  of 0.0098 %. At 800 km the exact rise is 1.56261 and the π model errs by 3.889 %. The
  guard switches to the exact `cosh` form past 250 km. Measured: both forms at four
  lengths, and the guard firing.
- **C4 · The transformer's drop, and the two ways to fix it.** 0.10 pu of reactance
  feeding 0.8 + j0.6 pu leaves 0.931926 pu at the far end. The `QX/V` estimate says
  0.06 pu against the true 0.0680742. A 1.07305 tap restores it, and so does 40 Mvar of
  shunt capacitance. Measured: the exact drop, the estimate's error, the tap, and the
  reactive power. Cross-references Power Lab D1 for the core the winding sits on.

### Group D: Power flow (6)

- **D1 · The question a network asks.** A load takes 1.60 + j0.80 pu whatever the
  voltage, so the current depends on the answer. That makes the network nonlinear, and
  `solveAC` alone cannot state the problem. Measured: the injection at three assumed
  voltages, and the mismatch each one leaves.
- **D2 · Three kinds of bus.** The slack holds angle and magnitude and has no equation.
  A PV bus holds magnitude and contributes one. A PQ bus holds neither and contributes
  two. Turn a bus's type and watch the unknown count change. Measured: the number of
  equations and unknowns for each type, and that they are equal.
- **D3 · Newton, iteration by iteration.** Each bus's rows are its tangent at the
  present guess, the same object a diode contributes in Elements i2. From a flat start
  the mismatch falls 1.600, 6.892 × 10⁻², 3.480 × 10⁻⁴, 8.367 × 10⁻⁹, 2.887 × 10⁻¹⁵.
  Four iterations reach 10⁻¹² pu, and the number of correct digits doubles each pass.
  Measured: the five mismatches, the doubling, and every Jacobian entry against a
  central finite difference to 10⁻⁶ relative.
- **D4 · The generator runs out of reactive power.** Lower bus 2's `Q_max` below
  0.407676 pu and the bus converts to PQ. Its voltage falls below the setpoint and the
  iteration count rises. Measured: the limit at which it converts, the voltage after,
  and the iteration at which the conversion happens.
- **D5 · Where the losses go.** The load takes 1.60 pu and the slack supplies
  1.01817 pu beside bus 2's 0.60 pu. The 0.0181741 pu gap is 1.81741 MW of `I²R`, and
  the sum of the three branch losses equals it to 5.8 × 10⁻¹⁶. Measured: the slack
  injection, the total loss, and the three branch losses.
- **D6 · Loading until there is no answer.** Raise the load and the low bus voltage
  falls, slowly at first. Past the nose of the curve the iteration stops converging,
  and the pane gives the reason rather than a number. Measured: the P–V curve, the last
  loading with a solution, and the refusal message.

### Group E: The DC power flow (3)

- **E1 · Three assumptions, one linear solve.** Drop resistance, pin every magnitude at
  1.00 pu, and replace `sin θ` by `θ`. What is left is `θ = B'⁻¹ P`, solved once. At the
  base case it gives −1.4168° and −4.7503° against the true −1.49154° and −4.75867°.
  Measured: both angle sets, and the largest error of 0.0748°.
- **E2 · Which assumption costs the most.** At the largest branch angle of 4.759°,
  `sin θ` and `θ` differ by 0.0542 %. The branch-flow error is 3.675 %, so the small
  angle is not the expensive assumption. Turning the resistances to zero and pinning
  the magnitudes shows which is. Measured: the error with each assumption imposed
  alone.
- **E3 · The guard, at both sides.** At 2.5× loading the largest branch angle is 13.07°
  and the flow error is 11.67 %, so the pane warns. Past 30° it declines the flow
  arrows, because the two solves can disagree on a branch's direction. Measured: the
  five-loading table, and the warning and the refusal each firing once.

### Group F: Symmetrical components (4)

- **F1 · Three sets, one basis.** Any three phasors are one balanced positive set, one
  balanced negative set and one zero set. The transform is a change of basis, so the
  round trip is exact to 5.7 × 10⁻¹⁵ A. Measured: the transform, the inverse, and the
  round-trip error.
- **F2 · The neutral carries three times the zero sequence.** `I_a + I_b + I_c = 3 I_0`
  in every case, balanced or not. A delta winding has no neutral, so `I_0` is zero
  inside it. Measured: the identity at four settings, and the delta's zero.
- **F3 · Three networks, three impedances.** The positive network is the ordinary
  per-phase circuit. The negative one differs only at the machines. The zero one is a
  different circuit, because a delta winding blocks it. For the stated network
  `Z_1 = Z_2 = j0.45 pu` and `Z_0 = j0.70 pu`. Open that delta into a grounded wye and
  `Z_0` falls to include the generator's 0.05 pu. Ground the generator's neutral through
  0.1 pu and `Z_0` rises by 0.3 pu, because a neutral impedance appears three times in
  the zero network. Measured: the three Thévenin impedances, `Z_0` in three winding
  connections, and the factor of three.
- **F4 · The transform is not a fault.** Resolve a healthy but unbalanced load into its
  three sets and read the negative-sequence current a motor would see as heat. The
  unbalance factor is 16.927 % for the set of B5. Measured: the factor, and the
  negative-sequence current at three unbalance levels.

### Group G: Faults (5)

- **G1 · The three-phase fault.** Short the positive network alone. `I_f = 1/j0.45`,
  which is 2.2222 pu, 557.83 A, or 222.22 MVA at the fault bus. The negative and zero
  networks carry nothing. Measured: the current in both units, the fault level, and the
  two empty networks.
- **G2 · Single line to ground.** The three networks go in series, so
  `I_a = 3E/(Z_0 + Z_1 + Z_2)`. That is 1.875 pu, 470.67 A, with 0.625 pu in each
  sequence. The other two phases carry nothing. Measured: the three sequence currents,
  the phase currents, and the ground current.
- **G3 · Line to line.** Positive and negative go in parallel, and the zero network is
  untouched. Two phases carry 1.9245 pu in opposite directions and the third carries
  nothing. Measured: the two phase currents, the third phase's zero, and the absence of
  ground current.
- **G4 · Double line to ground.** Negative and zero go in parallel across positive.
  `I_1 = 1.3814 pu`, `I_2 = 0.84084 pu`, `I_0 = 0.54054 pu`, and the two faulted phases
  carry 2.0883 pu with 1.6216 pu, 407.06 A, returning through the ground. Measured: the
  three sequence currents, the phase currents, and the ground current as `3 I_0`.
- **G5 · Which fault is the worst.** Compare the four at one bus. The three-phase fault
  gives the largest phase current here at 2.2222 pu, but the single-line-to-ground
  fault gives the largest ground current, and a network with a strong zero-sequence
  path can reverse the first comparison. Measured: the four currents on one table, and
  the `Z_0/Z_1` ratio at which single line to ground overtakes three phase.

### Group H: Protection (4)

The ids below were written as I1 to I4 and the machine group's as H1 to H4, which
crossed the two groups' letters. The build follows the letters, so protection is H1 to
H4 and the machine is I1 to I5. Nothing else about either group moved.

- **H1 · The inverse-time overcurrent relay.** `t = TDS · K/(M^α − 1)`, with `M` the
  fault current over the pickup. At a 400 A pickup and `TDS = 0.1` the IEC very inverse
  curve gives 1.35 s at 800 A, 0.45 s at 1600 A and 0.15 s at 4000 A. A bigger fault
  clears sooner, which is what the word inverse names. Measured: the three times, and
  the curve's slope on log axes.
- **H2 · Coordination is a margin in seconds.** A downstream relay at `TDS = 0.1`
  operates in 0.45 s at 1600 A. An upstream relay needs 0.30 s more, so its `TDS` is
  0.16667 and it operates in 0.75 s. Raise the downstream setting and the upstream one
  has to follow. Measured: both times, the margin, and the `TDS` the margin requires.
- **H3 · Distance, and the two zones.** A relay divides its voltage by its current,
  which gives the impedance to the fault. On a 40 Ω line, zone 1 reaches 32 Ω and trips
  at once, and zone 2 reaches 48 Ω and waits. A fault 60 km along looks like 24 Ω,
  inside zone 1. Measured: the two reaches, the apparent impedance at three fault
  positions, and which zone each falls in.
- **H4 · Infeed lengthens the reach.** A second source feeding the fault from the
  remote bus raises the current through the fault without raising it through the relay.
  With 50 % remote infeed the 60 km fault looks like 36 Ω, which is outside zone 1, so
  the relay waits when it should not. Measured: the apparent impedance with and without
  infeed, and the infeed fraction at which zone 1 stops reaching.

### Group I: The machine on the grid, and stability (5)

- **I1 · The machine as a source behind a reactance.** The Machines Lab's synchronous
  machine, in steady state, is `E∠δ` behind `jX_d'`. Power transferred is
  `P = (E V / X) sin δ`, so the angle is the throttle. Measured: the transfer at four
  angles, and the maximum at 90°.
- **I2 · The swing equation.** `M d²δ/dt² = P_m − P_e` with `M = 2H/ω_s`. At
  `H = 4.0 MJ/MVA` and 60 Hz that is 0.0212207 pu·s²/rad. Disturb the machine and it
  swings at 1.15523 Hz, a period of 0.865629 s. Measured: `M`, the small-signal
  frequency, and the period.
- **I3 · Equal areas.** A fault cuts transfer to 0.5 pu and clearing leaves 1.5 pu. The
  machine accelerates from 30.000° and must decelerate before 138.190°. The two areas
  are equal at `δ_cr = 70.2924°`, and each is 0.43883275 pu·rad. Measured: both angles,
  the critical angle, and the two areas agreeing to 10⁻¹⁴.
- **I4 · From an angle to a time.** The critical clearing angle is a closed form. The
  critical clearing *time* is not, so it comes from integrating the swing equation, and
  the pane names the method and the step. Here it is 0.206114 s, or 12.367 cycles. If
  the fault had cut transfer to zero, the closed form would give 0.172761 s. Measured:
  both times, and the step at which the integrator meets its guard.
- **I5 · The first swing.** Clear at 0.05 s and the peak is 59.4938°. At 0.10 s,
  71.5997°. At 0.15 s, 89.7763°. At 0.20 s, 122.922°. At 0.25 s the machine does not
  turn back. The peak from the energy relation and the peak from the integrator agree
  within 0.001°. Measured: the four peaks both ways, and the unstable case.

### Group J: Dispatch, and the grid as one system (2)

- **J1 · Equal incremental cost.** Three units and 800 MW of demand. The cheapest split
  puts every unit at the same incremental cost, `λ = 8.50 $/MWh`, giving 400, 250 and
  150 MW at $6682.50 per hour. Three equal shares cost $6877.78, so the saving is
  $195.28. Measured: the three outputs, `λ`, and both costs.
- **J2 · What the next megawatt costs.** Raising demand by 1 MW raises the cost by
  $8.50189, and `λ` predicted $8.50. A unit at its limit drops out of the balance, and
  `λ` then follows the units that are still free. Measured: the marginal cost against
  `λ`, and the same comparison with one unit pinned at its maximum.

---

## 6. Hand-overs

- **← Circuit Elements Lab.** Group h1 to h6 are this lab's entire AC prerequisite. B2
  links to h5 for AC power on one phase, and F1 links to h2 for the phasor picture. The
  links are deep links through `deeplink.js`, and the progression test checks both.
- **← Machines Lab** (being built). Group I imports the synchronous machine. The
  contract this lab needs is a steady-state model `E∠δ` behind `jX_d'`, a fault model
  behind `jX_d''`, negative- and zero-sequence reactances, an inertia constant `H`, and
  a mechanical power `P_m`. It goes into `NEEDS.md` on the first commit.
- **↔ Power Lab.** B5 cross-references Power Lab I3 for the balanced three-phase set an
  inverter produces. C4 cross-references Power Lab D1 for the core a transformer winding
  sits on. Both groups are planned with no overseer, so both references fail the
  progression test until they exist, which is the design.
- **→ Energy Lab.** The one-line canvas is built here and used there, with its props
  settled in §4.2. The Energy Lab's microgrid is this lab's network with a
  photovoltaic source and a battery at two of its buses.
- **→ Control Lab.** I2's linearised swing equation is a second-order plant with a
  synchronising coefficient of 1.11803 pu/rad. It crosses as `plant=custom`, and the
  damping a governor adds is Control Lab's subject. The mapping is exact and is
  presented without a hedge.
- **→ Fields Lab** (being built). C1's line parameters are given here as data. The
  Fields Lab computes them from geometry, and a stretch link opens the same conductor
  arrangement there.

---

## 7. Testing discipline

- **Unit** (`packages/grid`): per-unit conversion in both directions against hand
  values. The bus admittance matrix against a hand-built one for the three-bus system.
  Each bus type's companion against a central finite difference of its injection. The
  sequence matrices against `A A⁻¹ = I`. Each of the four faults against its textbook
  closed form. `relay.js` against the IEC curve at five multiples. `dispatch.js`
  against a hand Lagrangian.
- **Invariants** (§2.11), fuzzed across loadings, impedances and bus types. The hostile
  corners are included. A PV bus at its limit. A branch with `R > X`. A radial network
  with no loop. A bus with no generation and no load. A loading past the nose of the
  P–V curve.
- **Experiments**: every number in §5 pinned. Among them 529 Ω, 251.022 A, 0.222222,
  1.81741 MW, 0.961727 pu, four iterations, 3.675 %, 2.2222 pu, 1.875 pu, 470.67 A,
  70.2924°, 0.206114 s, 89.7763°, 8.50 $/MWh and $195.28.
- **The map's promises**: a test walks every experiment's `why` and every
  cross-reference in it, and requires the referenced experiment to exist in the named
  lab. A reference to an experiment that is not built fails the suite, by design.
- **Guards**: the DC power flow's warning at 10° and its refusal at 30°, the long-line
  correction at 250 km, the integrator's step guard at 0.01°, and the non-convergence
  refusal. Each is tested at both sides of its threshold.
- **Cross-lab pins**: a balanced three-phase circuit against three times Elements h5.
  I2's plant against Control Lab's margins. The one-line canvas's Energy Lab props
  against a stub network there.
- **Playwright harness**: the flow arrows follow the loading knob. The Newton view's
  last point matches the topbar mismatch. The P–δ areas shade on the clearing knob. No
  horizontal scroll at 390 px.
- **REVIEW_PLAYBOOK audit** before release, all eleven classes, a screenshot pass, and
  the sittings script with three seats. One seat sits Group A, because per unit is
  where a reader who knows circuits first meets this subject.

---

## 8. Integration and the dark launch

The mechanism Power Lab and the Elements lab share, unchanged.

- Deployed **dark** at `/grid-lab/` from the first vertical slice. Unlisted, not
  secret.
- `apps/grid-lab/RELEASE_STATUS` reads `dark`. A test asserts that while it does, the
  splash, the root README and the other labs' LabNav contain no reference to Grid Lab.
  Flip the word to `released` and the same test demands the splash card, the README row
  and the nav entries, with counts pinned.
- One `cp` line in `deploy.yml`, requested through `NEEDS.md` and added by the
  director at integration.
- The progression test's ids and counts go the same way.
- The flip is **Reed's action**, after the release gate in §9.

---

## 9. Phasing

Each phase ships green and deployable dark.

**Where this stands.** Phases 1 to 8 are built and merged on `lab/grid-lab`.
`packages/grid` carries every module §2 names, and its invariants are fuzzed
across 120 random networks. All ten groups ship, 42 experiments, with every
number pinned as a function of the knobs. Phase 7 did not have to wait, because
the Machines Lab's synchronous machine landed before this lab started and
`swing.js` imports it. What is left is phase 9, the release gate, which is
Reed's. `apps/grid-lab/NEEDS.md` §6 lists six numbers this build computed
differently from §2 and §4.3, each with its reason.

1. **Per unit and three phase.** `perUnit.js`, `sequence.js`, the app shell, the
   one-line canvas in `packages/ui` with the Energy Lab's props, the dark deploy and
   the `RELEASE_STATUS` test. **Groups A, B** (9). Exit: invariants 3, 4 and 5 fuzzed
   green, every A and B number pinned, and the canvas's test naming both labs.
2. **The line and the transformer.** The π model, the long-line correction and its
   guard, taps and shunt compensation. **Group C** (4). Exit: C3's guard tested at both
   sides, and every C number pinned.
3. **The power-flow engine.** `powerFlow.js`, the bus companions, PV-to-PQ conversion,
   source stepping, and the Newton view. No experiments ship in this phase. Exit:
   invariants 1, 2, 6 and 7 fuzzed green, and the Jacobian matching finite differences
   to 10⁻⁶ across the fuzz.
4. **Power flow and the DC approximation.** **Groups D, E** (9). Exit: the five
   mismatches pinned, D6's refusal tested, and E3's warning and refusal each firing.
5. **Faults.** The three sequence networks, the four fault connections. **Groups F, G**
   (9). Exit: invariant 8 green, and every fault current pinned in per unit and in
   amperes.
6. **Protection.** `relay.js` and the relay plane. **Group H** (4). Exit: the IEC curve
   pinned at five multiples, and H2's 0.30 s margin measured.
7. **The machine and stability.** The Machines Lab import, `swing.js`, the P–δ plane
   and the rotor swing. **Group I** (5). Exit: invariants 9 and 10 green, the areas
   agreeing to 10⁻¹⁴, and the integrator's guard tested at 1 ms and 0.1 ms.
8. **Dispatch.** `dispatch.js`. **Group J** (2). Exit: `λ` and the marginal cost
   agreeing to $0.002.
9. **The release gate**, in order, each blocking the next. The full audit. The student
   sittings. Reed's own pass against the dark deployment. Then the flip.

Phase 7 was the only phase that waited on another lab, and it no longer waits.
Phases 1 to 6 and 8 are a complete first power-systems course on their own, and they
ship whether or not the Machines Lab has landed.

Two things named in the phases above are deferred rather than done, and both are in
`BACKLOG.md` under **Grid Lab**. The Playwright harness §7 asks for is not written.
Every number it would check is already pinned in `experiments.test.js`, so what is left
is the 390 px layout, and the release audit needs those screenshots anyway. Group G
runs on §4.3's textbook reactances rather than on the imported machine's own
subtransient reactance, so those numbers move once at the audit rather than twice.

---

## 10. Non-goals (v1, stated so they are decisions rather than omissions)

- **Optimal power flow.** Economic dispatch with a loss formula is a different problem
  from dispatch on a network with constraints. Group J stops at equal incremental cost,
  and the security-constrained version is a course of its own.
- **The unit commitment problem.** Integer decisions over a day, with start-up costs
  and minimum run times. Not physics, and not a closed form.
- **Electromagnetic transients, and harmonics.** Travelling waves, switching surges and
  lightning belong to the Fields Lab's transmission-line group. Harmonics sit between
  this lab and Power Lab's Group M, and neither owns them in v1.
- **State estimation.** Weighted least squares over redundant measurements. It needs
  Random Signals Lab's estimators, and it reads better after them.
- **Machine models past the classical one.** Two-axis models, saturation and damper
  windings are the Machines Lab's, and this lab imports whatever that lab ships.
- **Governor and exciter dynamics.** A second and third state on the machine. I2's
  linearised plant is the door, and Control Lab is the room.
- **Multi-machine stability.** One machine against an infinite bus is the equal-area
  criterion's whole domain. Two machines need a numerical answer with no exact
  companion, so v1 stops at one.
- **HVDC and flexible AC transmission.** Converter stations are Power Lab's Group F
  seen from the network side, and they wait on it.
- **Distribution systems.** Unbalanced three-wire and four-wire feeders, with their own
  solver. The sequence machinery here is built for a balanced network with a fault in
  it.
- **A free-form network editor.** Curated networks with editable values, as in every
  other lab.

---

## 11. Risks, named

- **The Machines Lab's contract.** Group I cannot ship until the synchronous machine
  lands, and the contract in §6 is written before that lab has settled its shape.
  Mitigation: Group I is phase 7 of nine, `NEEDS.md` carries the contract on the first
  commit, and phases 1 to 6 are a complete course without it.
- **The companion interface is planned, not built.** §2.4 leans on the Electronics
  Lab's `companion.js` for its shape rather than its code, since the state vector
  differs. Mitigation: `packages/grid` owns its own polar Newton (Decision 2), so a
  change in the Electronics contract costs a comment and not a rewrite.
- **Newton on a heavily loaded network.** Past the nose of the P–V curve there is no
  solution, and near it the Jacobian is close to singular. Mitigation: source stepping
  in the loading, a flat start with one step of the fast-decoupled form when the direct
  solve fails, and D7's refusal with its reason as a tested feature.
- **The DC power flow's guard set on one network.** The thresholds in §2.7 come from a
  three-bus system with `R/X = 0.125`. Mitigation: the guard is fuzzed across random
  `R/X` and loadings, and the threshold moves if a network inside the guard shows more
  than 5 % of flow error.
- **The integrator's step chosen once.** 0.1 ms passes the guard for the stated
  machine. A stiffer machine could need less. Mitigation: the guard is the closed form,
  the step halves until it passes, and the pane prints the step it settled on.
- **Sequence networks drawn three at a time on a phone.** Three circuits and their
  connection is the widest picture in the suite. Mitigation: the sequence pane stacks
  vertically below 500 px, and the harness checks it at 390 px.
- **Numbers that are right for one system.** Every quoted number is for the defaults in
  §4.3. Mitigation: each pin is re-derived from the parameters, never a constant.
- **Cost.** A new package with a Newton of its own, three sequence networks, an
  integrator and a new shared canvas. Mitigation: every phase ships dark, phase 1 is
  useful on its own, and the canvas is paid for twice because the Energy Lab uses it.
