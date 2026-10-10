# Circuit Elements Lab: the plan

This lab starts with charge, voltage, and the two circuit laws. It covers resistive networks, network theorems, capacitors, inductors, and their differential equations. Second-order response, damping, sinusoids, phasors, op-amps, and diodes follow. It ends where Circuit Lab begins, with the transfer function describing a circuit across frequencies. The reader can then continue there.

Name **Circuit Elements Lab** (Decision 1, settled), directory `apps/circuit-elements-lab`, engine
in a new `packages/network`. Built **before Power Lab**: its engine is the first half
of Power Lab's, so this lab pays for that one.

Decisions already made (Reed, 2026-09-01):

- **From the very top.** KVL/KCL and Ohm's law are experiments, not assumptions.
  Nothing is presumed known except arithmetic and what a graph is.
- **Before Power Lab.** The exact propagator and event machinery Power Lab needs are
  built here first, on the simplest circuits that need them (`§1.6`, `§8`).
- **Ideal first, non-idealities as labelled toggles**, inherited from Power Lab's
  plan: finite op-amp gain, rails, diode drop, source resistance, switch resistance.
- **Not linked from the splash until refined, checked and confirmed**, the same
  `RELEASE_STATUS` dark-launch mechanism as Power Lab (`§7`).

- **Name: Circuit Elements Lab** (Reed, 2026-09-01). "Circuit Elements" reads as the
  parts, "Circuit Lab" as the whole, which is the relationship, since one hands into
  the other. LabNav short form **"Elements"** so five labs fit a phone-width nav.

Decision still open (recommendation in **§0**): whether the splash reorders to put
this lab first.

Every explanatory sentence is a physics claim that a test must measure. Most first-course circuit claims have exact closed forms. The method is also part of the lesson, whether nodal analysis, an ODE solution, or a phasor. A hand-derived expression and a solved network therefore provide two paths to the same number.

---

## 0. Two open decisions

### Decision 1: the name (settled: Circuit Elements Lab)

The honest name for this lab would be "Circuit Lab". It is the lab about circuits *as
circuits*, elements, laws, time, while the existing Circuit Lab is about circuits *as
transfer functions* (its own header: "the circuits, and the transfer function each one
has"). Renaming a live, linked lab has a cost. Calling another URL "Circuit Lab" while `/circuit-lab/` shows different content would confuse readers.

**Circuit Elements Lab**, Reed's choice, avoids the naming collision. Circuit Elements comes first, followed by Circuit Lab. LabNav uses the short form **"Elements"** so five labs fit a 390 px navigation row. The splash card, app header, and report link's `lab` field use the full name. The accepted slug is `apps/circuit-elements-lab` / `/circuit-elements-lab/`. It is long but unambiguous and permanent.

Rejected: *Kirchhoff Lab* (exact, memorable, names nothing to the reader who most
needs to find it). A *rename swap* making the new lab "Circuit Lab" and the old one
"Filter Lab" (most honest, most confusing while the current Circuit Lab carries its
hand-over links).

### Decision 2: the splash order

When released, this is the lab to open first. Place its card first in the row with the kicker "Start here." The card describes the path from circuit laws through theorems, differential equations, and phasors into Circuit Lab. No other card moves.

---

## 1. The engine: exact network analysis (`packages/network`)

### 1.1 Why a solver at all, when Circuit Lab has none

Circuit Lab curates ten topologies with `H(s)` derived by hand. The transfer function was its content. Here the content is **the method**, the
reader watches KCL written at each node, watches the matrix appear, watches it
solve, so the equations must be **generated from the circuit**, not typed per
experiment. That needs a netlist and a solver. It stays small: modified nodal analysis
over a curated library of circuits with editable values. Not a schematic editor
(`§9`).

The hand-derived closed form for each circuit (R_th = R₁‖R₂, τ = R_th·C, …) remains in
each experiment as **the independent path**. The solver is the measurement. The hand
form is the claim. The test is that they agree.

### 1.2 Modified nodal analysis (MNA)

Unknowns `x = [v ; j]`: node voltages (ground removed) and the currents through every
element that has no admittance form, voltage sources, inductors (in DC/state form),
op-amp outputs. The system `M x = r` is assembled by *stamps*:

| Element | Stamp |
| --- | --- |
| Resistor a–b | `G[a,a] += 1/R`, `G[b,b] += 1/R`, `G[a,b] -= 1/R`, `G[b,a] -= 1/R` |
| Current source a→b, value I | `r[a] -= I`, `r[b] += I` |
| Voltage source +a −b, value E | new unknown `j`. Column `+1` at a, `−1` at b. Row `v_a − v_b = E` |
| VCCS (g · (v_c − v_d) into a→b) | `G[a,c] += g`, `G[a,d] -= g`, `G[b,c] -= g`, `G[b,d] += g` |
| VCVS (+a −b = μ(v_c − v_d)) | as voltage source, row `v_a − v_b − μ v_c + μ v_d = 0` |
| Ideal op-amp (p, n → o) | new unknown `j_o` (output current). Column `+1` at o. Row `v_p − v_n = 0`, the **nullor** stamp: the golden rules *are* this row |
| Finite-gain op-amp | VCVS with μ = A from (p, n) to (o, gnd). Rails via `§1.5` |
| Switch | resistor R_on / R_off. Ideal = 0 / ∞ handled as short (node merge) / open (omit) |

Solve by LU with partial pivoting (n ≤ ~30 here. Nothing fancier). Every experiment's
first invariant is the **residual**: recompute each element's current from the solved
voltages by its own law, sum at every node → zero to floating point. That is KCL
*checked*, not assumed.

**The equation printer.** The same stamps emit text: for node A with R₁ to the 12 V
source, R₂ to ground and R₃ to node B,

    Node A:   (V_A − 12)/1 kΩ  +  V_A/2 kΩ  +  (V_A − V_B)/3 kΩ  =  0

live with the current values, then in matrix form, then the solution. Hovering an
equation lights its node and its three branches on the schematic. This is the
"show the equations" view (§3.2) and it is *generated*, so it can never drift from the
circuit.

### 1.3 Degenerate circuits are refused, with the reason

MNA is singular for the ill-posed circuits taught in a first course. The refusal explains why, following CORE_SCOPE Rule 2:

- a loop of voltage sources / ideal wires with inconsistent values → "two sources
  disagree about one voltage";
- a cut-set of current sources → "these currents have nowhere to go";
- an **ideal op-amp with no negative feedback path** → "an ideal op-amp with no
  feedback has no solution, the real one saturates. Switch to the finite-gain model
  with rails to see what it does" (and the switch is one click);
- a capacitor loop or inductor cut-set (§1.4) → "these two capacitors share one
  state. Merge them".

Each refusal has a test that asserts the *message*, per Rule 2.

### 1.4 From netlist to state space, exactly

For a linear circuit, replace each capacitor with a voltage source carrying its state `v_C`. Replace each inductor with a current source carrying `i_L`. The remaining circuit is resistive. One MNA solve gives capacitor currents and inductor voltages as linear functions of the states and independent sources:

```text
i_C = M_x x + M_u u,   v_L = N_x x + N_u u
⇒ dv_C/dt = i_C / C,   di_L/dt = v_L / L
⇒ dx/dt = A x + B u,   y = C x + D u
```

This is the substitution theorem, and it is exact. The rank check on the substituted
MNA is what detects the degenerate cases in §1.3. It also produces the circuit's
**characteristic polynomial** from `det(sI − A)`, which is what the second-order
experiments (§4 Group G) display and test against `s² + (R/L)s + 1/LC`.

### 1.5 Exact time response: no timestep

The state equation is solved in closed form. This is the propagator Power Lab's plan
specifies in its §1.2, built here first and imported there:

    x(t) = φ0(t) x(0) + φ1(t) B u,   φ0 = e^{At},   φ1 = ∫₀ᵗ e^{Aτ} dτ

- **n = 1** (RC, RL): scalar exponential, `x(t) = x∞ + (x₀ − x∞) e^{−t/τ}`, which is
  the formula the lesson derives, so engine and lesson are one statement.
- **n = 2** (RLC, two-cap ladders, Sallen–Key): use the three-case closed form on `Δ = (tr A/2)² − det A`. The cases are cosh/sinh, cos/sin, and linear. Derive `φ1` from the same cases, without **A⁻¹**. Group G5 requires the R = 0 LC case to work despite its singularity.
- **n ≥ 3**: eigendecomposition with balancing (`@ee-labs/systems` already owns
  this), still exact to floating point. Used by the RC ladder and any op-amp circuit
  with two dynamic elements plus a rail model.

Inputs are the standard test signals, each handled exactly:

- **step / DC / switch at t = 0**: constant `u` per segment;
- **square**: a sequence of constant segments (clock edges known in advance);
- **ramp / triangle**: `u = u₀ + u₁ t` per segment → `φ2 = ∫φ1` in the same case
  analysis (equivalently: augment the state with `t`);
- **sinusoid**: the forced response is the **phasor solution**,
  `x_p(t) = Re{ (jωI − A)⁻¹ B U e^{jωt} }`, and the total is
  `x(t) = e^{At}(x₀ − x_p(0)) + x_p(t)`.

That last line is not an implementation detail. It is **the syllabus**. Groups E, F, and G interpret the equation in order. First, total response equals natural plus forced response. Then the transient decays, leaving a sinusoid at the driving frequency. Finally, the phasor converts the ODE into algebra.

**The classic switching problem** assumes a switch closed for a long time that opens at t = 0. The engine solves the pre-switch circuit at DC (C open, L
short) for `x(0⁻)`, applies continuity (`x(0⁺) = x(0⁻)`, capacitor voltage and
inductor current cannot jump), and propagates the post-switch circuit. The math panel
narrates those three steps because they *are* the textbook method.

### 1.6 Piecewise-linear elements and events (Power Lab's §1.3, born here)

Diodes and op-amp rails are piecewise-linear. Within each region, the circuit is linear and §1.2–1.5 apply. Regions are diode on/off and op-amp linear / at +rail / at −rail. Region
boundaries are **events**, a diode's current reaching zero while on, its voltage
reaching `V_f` while off, an op-amp output reaching a rail, found by **bisection on
the exact segment solution**. No timestep, no tolerance knob. The waveform is exact
and the tests can say `= 0`, not `≈ 0`.

For DC, region-finding is the textbook **assumed-state method**, shown as itself:
"Assume D₁ on. Solve. i_D₁ = −2.1 mA < 0: contradiction. Assume off. Solve.
v_D₁ = 0.31 V < 0.7 V: consistent." Two diodes → four cases, enumerated on screen.

**The exponential diode** (`i = I_s(e^{v/nV_T} − 1)`) is nonlinear, not piecewise. It
is supported for **DC operating points only**, by Newton–Raphson with SPICE's
voltage-step limiting, and the iterations are *displayed* (Group I2: "this is what a
simulator does"). Time-domain experiments use one of the three piecewise diode models. The panel names the model and explains the choice. Under Rule 2, the suite excludes timestep solvers whose error cannot be distinguished from physics.
The PWL model fitted at the operating point (`r_d = nV_T / I`) is offered as the
labelled approximation it is (Rule 3), with its tangent error shown.

### 1.7 Phasor solve

The same stamps with complex admittances at `s = jω` (`jωC`, `1/jωL` as a branch
row so ω = 0 is not a division) give the sinusoidal steady state directly. Two
independent paths to one number: the phasor solve, and the long-time limit of the
exact time solution (§1.5 with the natural part decayed). Group H is built on their
agreement.

### 1.8 Measures

Shared by schematic meters, topbar and math panel, all on exact waveforms: node
voltages and branch currents at a time cursor. Per-element instantaneous power,
average power, energy stored (`½Cv²`, `½Li²`) and dissipated (`∫i²R dt`, closed form
per segment). RMS and mean by piecewise closed-form integrals. Peak, time-to-percent,
zero crossings (for `ω_d`), successive peak ratios (for α). Phasor magnitude and angle. The readings also include `P`, `Q`, `S`, and power factor.

### 1.9 Invariants (the fuzzer's checklist)

Across random values on every library circuit:

1. **KCL residual** at every node = 0 (fp). **KVL** around every mesh = 0.
2. **Tellegen**: `Σ_k v_k i_k = 0` over all elements, using KCL + KVL only.
3. **Superposition**: response to (u₁ + u₂) = response to u₁ + response to u₂, for
   every linear circuit. And it *fails* for power, by the cross term `2 i₁ i₂ R`.
4. **Thevenin three ways**: `V_oc / I_sc`, "kill sources and look in", and the slope
   of a load sweep agree.
5. **Energy**: source energy = stored + dissipated, as an identity on the exact
   waveform. For the undamped LC, total energy constant.
6. **Continuity**: every state continuous across every switch and event. Every
   non-state quantity allowed to jump.
7. **Limits agree**: for stable circuits, the exact transient approaches the DC solve as `t → ∞`. The long-time sinusoidal response matches the phasor solve. Roots of `det(sI − A)` match the hand-written characteristic equation.
8. **Cross-lab**: compare each shared catalog circuit's exact step with Circuit Lab's `simulate(transferOf(…))` result. That path uses RK4. Require agreement within RK4's error and measure that error here.

---

## 2. Models: the element library

| Element | Ideal law | Non-ideality toggles (each labelled) |
| --- | --- | --- |
| Wire / node | `v` equal everywhere on it |, (wire resistance is a non-goal) |
| Resistor | `v = iR` | tolerance (±5%, the existing `tolerance.js` idiom) |
| Independent V source | `v = E(t)` | series `R_s` |
| Independent I source | `i = I(t)` | parallel `R_p` |
| Dependent sources | VCVS, VCCS (CCVS/CCCS via a sensing 0 V source) |, |
| Switch | ideal make/break at `t = 0` or on a clock | `R_on`, `R_off` (finite ⇒ the spark in F6) |
| Capacitor | `i = C dv/dt`, `q = Cv`, `w = ½Cv²` | ESR (series R). Initial voltage `v(0)` |
| Inductor | `v = L di/dt`, `w = ½Li²` | winding R (series). Initial current `i(0)` |
| Op-amp | nullor: `v₊ = v₋`, `i₊ = i₋ = 0`, output does what it must | finite `A` (10 … 10⁶). Rails `±V_sat`. (stretch) GBW as `A(s) = ω_t/s`, admissible in `systems`, labelled as a model |
| Diode | ideal switch | constant drop `V_f`. PWL `V_f + r_d`. Exponential `I_s, n` (DC only, §1.6). Zener `V_z` (stretch) |

Sources: DC, step, square, triangle, sine (amplitude, frequency, phase, offset), and
"switched at t = 0", all exact under §1.5.

**Schematic description.** Each library circuit is a netlist whose elements carry a
grid position and orientation. A shared renderer (`packages/ui/Schematic.jsx`)
draws symbols, wires, node dots, and the live meters. Power Lab's conduction scrub
needs the same renderer, which is another reason to build it here. Circuit Lab's
hand-drawn `schematics.jsx` stays as it is.

---

## 3. The app

### 3.1 Layout

The sidebar contains LabNav, the report link, folding experiment groups, and the circuit picker. It also contains component NumFields, engineering units, chips, source controls, non-ideality toggles, and the math panel. LabNav uses "Elements" with one-way visibility while unreleased (§7).

The main area keeps topbar meters and the **schematic** visible above one selectable pane. Reed reviews on a phone. The schematic and pane must fit 390 px without horizontal scrolling, checked by the harness as in Control Lab.

The topbar shows the experiment's headline readings: `V_th`, `R_th`, `τ`, `α`, `ω₀`, `ζ`, `|Z|`, `∠Z`, `P`, and `pf`. It also shows the operating point `(V_D, I_D)`.

### 3.2 Views

- **Schematic with live meters**, the lab's signature. Every node voltage and
  branch current shown on the drawing, current arrows scaled and animated (dot flow,
  direction honest), element power on hover. Click a node to make it ground (A3).
  Click a switch to throw it. When a time pane has a cursor, the meters show the
  values **at the cursor**, the circuit at time t, which is the conduction-scrub
  idea Power Lab inherits.
- **Equations**, the generated KCL (or KVL for mesh) equations with live values,
  the matrix, the solution. Hover links each equation to its node on the schematic.
  For dynamic circuits: the state equations, `det(sI − A)`, the roots. Progressive
  disclosure: one equation per row, expanded on demand, never a wall.

*Entry-level review, 09/01/2026.* The lower pane is now **Analysis**, replacing "Underneath". Its buttons follow `VIEW_ORDER`, with equations before power. Groups A and B open Equations with a primer on KCL, KVL, and Ohm's law. A1–A4 list `kcl` and `kvl`. Tests require Group A to define KCL where its equations first use it.

The pane has three numbered steps. First, each equation row shows signed live values and their sum. Second, a labeled matrix names rows such as "KCL at A" and "V1 holds", with unknowns as columns. Each cell shows its expression, such as `1/R₁ + 1/R₂`, `−1/R₁`, or `E₁`, above its numeric value. Compact symbolic and numeric matrices follow. Third, a legend maps each letter to its part and current value.

`symbolicSystem` in `@ee-labs/network` is checked cell by cell against numeric `M` and `r`. Tests cover all 46 experiments at defaults and random settings. Substituted elements retain their identities: `v_C1`, `i_L1`, `R_S1`, and `A_U1`.

The **Power** view lists v, i, p = v × i, and whether each element delivers or absorbs power. Equal-length bars compare delivered and absorbed totals beside Tellegen's identity. The schematic's voltage meters now show both **+ and −** at every two-terminal element. Labels and node names use the equations' KaTeX fonts, so `R₁ 1 kΩ` matches `R₁` in the matrix. The layout checker includes sign marks and browser-measured label widths.

  *Framed schematics, 09/01/2026.* Layouts share a 420 × 180 canvas and placement rules. Previously, the pane displayed the entire canvas at widths up to 720 px. A one-element circuit could occupy half the screen.

Each experiment now carries `layout.crop`, a padded box around everything drawn in any meter view. It is computed once using the widest plausible readings and labels, such as `−1.23 mV` and a switch that "closes". The frame therefore remains fixed while knobs turn. The layout test checks at random settings
  that nothing leaves it.

The Schematic uses the crop as its viewBox and exposes width and aspect ratio through CSS variables. The scale is 1.71 px per unit, rising to 2 px above a 1400 px viewport. The height budget is 30 vh. Circuits with more elements receive wider frames while keeping resistor sizes consistent.

On desktop, the schematic uses its required height, up to 60 vh, and Analysis receives the remaining space. At 1280 × 900, schematic height fell from 428 px to 296–390 px. On a phone the budget is the height the old frame had (150 px),
  so nothing grew. An oversized header no longer widens the pane beyond the screen. Wide equations scroll inside their tracks. `verify.mjs` fails if any pane, header, or frame is clipped at 390 px.
- **Scope**, states and chosen branch quantities vs t, scrubbable cursor, natural
  and forced components separable as ghost traces (H1), τ-tangent and 63% marker
  (F3), envelope `±e^{−αt}` (G4). Dual y-axis (V / A). Caption band above the plot,
  from Signal Lab.
- **Phasor diagram**, phasors as arrows, tip-to-tail sum, rotating with the time
  cursor. The projection onto the vertical axis is drawn out to the right *as the
  waveform*. The picture that makes phasors click, animated rather than described.
- **i–v plane**, the diode curve (all four models overlaid on request), the load
  line, the operating point. Newton's iterations drawn as the tangent-chasing they
  are.
- **Energy**, stacked `½Cv²`, `½Li²`, `∫i²R` against energy supplied. The identity
  visible as a bar that always closes.
- **Sweep** shows one parameter across a range, with the operating point marked. Examples are `P_L` vs `R_L` (D6), `|Z|` vs ω (H4), and response vs R across damping regimes (G2–4).

### 3.3 Numbers (defaults that make the lessons visible)

Round numbers that land time constants in milliseconds and resonances in the low kHz,
so a phone-width scope shows the shape:

- Resistive: 12 V source, 1 kΩ / 2 kΩ / 3 kΩ, so node voltages are readable and
  currents are milliamps.
- RC: R = 1 kΩ, C = 1 µF → τ = 1 ms, corner 159 Hz. RL: R = 1 kΩ, L = 1 H → τ = 1 ms
  (a big inductor, said so. Or 100 Ω / 100 mH).
- Series RLC: L = 10 mH, C = 1 µF → ω₀ = 10⁴ rad/s, f₀ = 1.59 kHz, `R_crit =
  2√(L/C) = 200 Ω`. Chips: 50 Ω (ζ = 0.25, rings), 200 Ω (critical), 800 Ω (ζ = 2,
  overdamped), 0 Ω (undamped).
- Op-amp: `A = 10⁵`, rails ±12 V, `R_f = 10 kΩ`, `R_g = R_in = 1 kΩ` (gain 11 / −10).
- Diode: `I_s = 1 nA`, `n = 1`, `V_T = 25.85 mV` (300 K), `V_f = 0.7 V`. Rectifiers
  at 60 Hz, `V_p = 10 V`. LED at 2.0 V, 20 mA.

---

## 4. Curriculum: 53 experiments in 9 groups (+2 stretch)

Format: **the claim** the note makes → what the reader turns → what is **measured**
against what **formula**. Every quoted number becomes a pinned test. Order follows a
standard first course (elements and signs → laws → networks → systematic methods →
op-amp → C and L → second order → phasors → diode). The op-amp sits before the
capacitor because it needs only resistive analysis and pays off superposition and
Thevenin immediately.

Groups A–E are built (Phase 1, dark). Their entries below describe what shipped. The
experiment ids are the ones the topbar shows (`A1 · A voltage source holds its
voltage`). Groups F–I are the plan.

### Group A: Elements and signs (4) · built

The first review requested an opening experiment with one element instead of three resistors. It should state the sign convention before analyzing a loop.

- **A1 · A voltage source holds its voltage.** One source, one resistor. The source
  fixes the voltage, the resistor fixes the current: `i = E/R`. Turn R down and
  the current climbs while E does not move. The whole top rail is one node and reads
  E everywhere. Measured: `v_R = E`, `i = E/R`, the source current `−i` (it leaves
  the + terminal), `p_R = E²/R`. E unchanged at R = 10 Ω.
- **A2 · A current source holds its current.** The dual: `i_R = I`, `v = I·R`. Push R
  to a megohm and 5 mA needs 5 kV. Open the switch on the rail and an ideal current
  source into an open circuit has no solution, and the app reports the reason
  (`current-cutset`) and says why. Measured: `i_R = I` at 1 kΩ and 1 MΩ, `v = 5 kV`
  at 1 MΩ, the refusal (code and reason) with the on-screen switch open.
- **A3 · Voltage is a difference. Ground is a choice.** A divider built on top of a
  source `V_ref` instead of on ground. Slide `V_ref`: every node voltage moves by
  exactly that amount. Every element voltage, current, and power stays fixed. `V_ref` carries no current. Measured: node shifts equal `V_ref` to floating-point precision at three lifts. Element quantities remain invariant, and `i_{V_ref} = 0`.
- **A4 · Which way is +: the passive sign convention.** `v = v₊ − v₋`, `i` measured
  into the + terminal, `p = v·i`. Two sources and one resistor: with `E₁ > E₂` the
  resistor's v and i are both positive. Slide `E₂` above `E₁` and both flip together
  while `p_R` stays positive and the pushing source's power comes out negative. A
  negative reading is the answer with its direction attached. Measured: the sign
  flips, `p_R ≥ 0` both ways, the sign of each source's power.

### Group B: Two laws (4) · built

- **B1 · Current in equals current out.** KCL at node A: `i_{R₁} = i_{R₂} + i_{R₃}`
  however the three are set. Make `R₂` tiny and it takes almost everything, but the
  sum never moves. Measured: the equality to fp. The KCL residual at A.
- **B2 · Voltages around a loop add to zero.** KVL: the source lifts by E and the
  resistors drop it all again, in proportion. Measured: `v_{R₁} + v_{R₂} = E`;
  `v_{R₂}/v_{R₁} = R₂/R₁`.
- **B3 · Power, and the sign of it.** Resistors positive, source negative, total
  exactly zero, **Tellegen**, from KVL and KCL alone. Measured: signs and `Σp = 0` to fp (and re-checked on every experiment in the lab, including the dependent-source
  ones, by the suite).
- **B4 · Two sources, one loop.** `i = (E₁ − E₂)/R` flows into the weaker source,
  which absorbs. Raise `E₂` past `E₁` and it reverses. Measured: the current. Which
  source's power is negative, before and after the flip.

### Group C: Series and parallel (4) · built

- **C1 · Series: one current, shared voltage.** `V_k = E · R_k / ΣR`. A resistor ten
  times the others takes ten times the voltage. Measured: the ratio. The shares sum to E.
- **C2 · Parallel: one voltage, shared current.** `1/R_eq = Σ 1/R_k`. The equivalent
  is below the smallest branch and the smallest resistor takes the biggest share.
  Measured: `R_eq` vs `1/ΣG`. The ordering of the shares.
- **C3 · The loaded divider.** `V_out = E · (R₂‖R_L)/(R₁ + R₂‖R_L)`. The droop is
  small only while `R_L ≫ R₂`. Measure the drop against the formula. As `R_L → ∞`, the unloaded value returns. The number that motivates Thevenin (D5) and the buffer (E8).
- **C4 · The Wheatstone bridge.** No two resistors in series or parallel. It balances when `R₁/R₂ = R₃/R₄`, regardless of supply. A 1 % change in `R₄` moves the bridge by about `E/4 × 1 %`. Measured: zero at balance. The small-signal sensitivity.

### Group D: Analysis and theorems (6) · built

- **D1 · Nodal analysis: one equation per node.** `N − 1` KCL equations generated live
  (§1.2), assembled, solved. Measured: KCL at every node. The one-unknown hand form
  `V_A = (E/R₁)/(1/R₁ + 1/R₂ + 1/R₃)`.
- **D2 · A source between two nodes: the supernode.** The textbook supernode and the
  MNA extra unknown are the same move. The printed system has the unknown count the
  topbar claims. Measured: equal solutions. The source current recovered.
- **D3 · Mesh analysis: one equation per loop.** KVL around the meshes. The hand 2×2
  matches nodal exactly. Measured: element currents identical from both methods;
  `E₂` above `E₁R₂/(R₁+R₂)` reverses `i₂`.
- **D4 · Superposition: one source at a time.** Voltages and currents superpose to the
  last digit. Power does not, by `2·i₁·i₂·R`. Measured: both.
- **D5 · Thévenin, three ways.** (i) `V_oc/I_sc`. (ii) kill the sources and look in;
  (iii) sweep `R_L` and fit the terminal line. Measured: all three `R_th` agree with
  `R₁‖R₂‖R₃`. The load line's intercepts are `V_oc` and `I_sc`.
- **D6 · Maximum power transfer.** `P_L` peaks at `R_L = R_s` with 50 % efficiency;
  efficiency climbs past it while power falls. Measured: argmax, peak, η.

### Group E: Op-amps (8 + 1 stretch) · built

- **E1 · A dependent source.** A VCVS in a resistive network: `v_out = A·v_in`
  whatever the load. The dependent source delivers more than the input source works.
  Measured: both. Tellegen still holds (B3's promise).
- **E2 · The op-amp as a black box.** Added after the first review. A dashed frame
  around `R_in`, a VCVS of gain A and `R_out`, the package, with the transistors and
  supply pins left out on purpose. The IDEAL op-amp: `A = ∞`, `R_in = ∞`, `R_out = 0`,
  no offset, no speed limit. A real one: `A ≈ 10⁵`, `R_in` 1 MΩ–10¹² Ω, `R_out` tens
  of ohms. The input divider `R_in/(R_s + R_in)` and the output divider
  `R_out/(R_out + R_L)` each cost a little. The ideal recovers at the limits. The
  payoff over passive circuits: far more power into the load than the source supplies.

  Measure `v_p` and `v_out` against the two dividers. Require `A·E` within 1 % at the knob limits and `p_{R_L} > 1000 × p_{source}`. And the passive bound, every
  single-source resistive experiment in the lab has `|v_node| ≤ E` and load power
  ≤ source power.
- **E3 · Comparator: an op-amp with no feedback.** The ideal model *refuses* (§1.3,
  `opamp-open-loop`), no feedback path, no solution. Finite gain lifts it: 1 mV in,
  100 V out at `A = 10⁵`. Measured: the refusal code and message. The finite-A output.
- **E4 · The golden rules, derived.** Non-inverting: `v_out = GE/(1 + G/A)`,
  `G = 1 + R_f/R_g`. The input difference is `v_out/A` and the gain converges on G as
  A grows. Measured: at each A.
- **E5 · Inverting amplifier and the virtual ground.** The inverting input sits at
  0 V without being grounded. The output is `v_out = −(R_f/R_g)E`. The source sees `R_g`. The load
  current is the op-amp's. Measured: all four.
- **E6 · The summing amplifier.** `v_out = −R_f(E₁/R₁ + E₂/R₂)`. Each input current is
  set by its own resistor alone, D4 in copper. Measured.
- **E7 · The difference amplifier.** Matched: `(R₂/R₁)(E₂ − E₁)`, common mode is rejected. A 1 % mismatch leaks about 1 % of the differential gain. Measured: CMRR
  against the mismatch formula.
- **E8 · The buffer fixes the loaded divider.** A unity-gain follower between C3's
  divider and its load: the output is the *unloaded* divider voltage whatever `R_L`,
  and the sweep is flat. Measured.
- **E9 · Positive feedback: the Schmitt trigger** *(stretch, needs §1.6).* Feed the
  output back to the *non-inverting* input: hysteresis with thresholds
  `±V_sat · R₁/(R₁ + R₂)`. A noisy input crosses cleanly once. Control Lab's "latches
  to a rail", built. Measured: both thresholds. One transition per crossing.
### Group F: Elements that remember, and the first-order equation (7) · built

- **F1 · The capacitor: current only when the voltage changes.** `i = C dv/dt`.
  Drive with a triangle: the current is a square wave, amplitude `C · slope`. Drive
  with DC: zero current, an open circuit at DC. `q = Cv`, `w = ½Cv²`. Measured:
  `i(t)` vs `C dv/dt` on the exact waveform (a ramp input is exact under §1.5).
- **F2 · The inductor: the dual.** `v = L di/dt`. A triangle of current makes a
  square of voltage. It is a short circuit at DC, with stored energy `w = ½Li²`. Measured likewise. The panel
  states the duality table (v↔i, C↔L, series↔parallel) once, and Group G cashes it.
- **F3 · Charging an RC: the equation, solved.** KVL: `RC dv/dt + v = V_s`. The panel
  separates and integrates, step by step, to `v(t) = V_s + (v₀ − V_s) e^{−t/τ}`,
  `τ = RC`. On the scope: 63.2% at τ (`1 − e⁻¹`), 99.3% at 5τ, and the initial
  tangent `V_s/τ` drawn, it meets `V_s` at exactly `t = τ`. Measured: all three
  numbers. And that `v_C` is continuous at the switch while `i_C` jumps.
- **F4 · Every first-order circuit is three numbers.**
  `x(t) = x(∞) + [x(0⁺) − x(∞)] e^{−t/τ}`. Find `x(0⁺)` from continuity and `x(∞)` from a DC solve with C open and L short. Use `τ = R_th · C` or `L / R_th`. Here `R_th` is the **Thevenin resistance seen by the element**, as found in D5. Demonstrated on a
  circuit where `R_th` is no single resistor. Measured: the recipe vs the exact
  solution, on RC, RL, and a divider-fed RC.
- **F5 · Charging a capacitor from a source wastes exactly half, whatever R is.**
  Source energy `∫V_s i dt = CV_s²`. Stored `½CV_s²`. Dissipated `½CV_s²`,
  **independent of R**, R only sets how fast. The energy view shows the bar closing
  at every R. Measured: the three energies at R = 100 Ω, 1 kΩ, 10 kΩ.
- **F6 · The interrupted inductor: where sparks come from.** A steady 12 mA in
  1 H. Open the switch. Ideal: `di/dt → −∞`, `v → −∞`, no solution. Toggle a finite
  `R_off = 1 MΩ`: the inductor forces its 12 mA through it, a 12 kV spike, decaying
  with `τ = L/R_off = 1 µs`. Measured: `V_spike = I₀ · R_off`, `τ`. The note points
  forward: the flyback diode that Power Lab's every converter relies on is the cure.
- **F7 · The integrator, in time.** Op-amp integrator, square in: `v_out = −(1/RC)∫v_in
  dt`, a triangle out with slope `V/RC`. Measured: slope. The cross-lab check uses Circuit Lab, which shows this exact object as `−1/sRC` and its step response as a ramp.
  Toggle finite A: the ramp bends into an exponential toward `−A·V`, the integrator
  is a first-order low-pass with a very long τ, `τ = (A+1)RC`. Measured.

### Group G: Second order: one equation, three faces (7) · built

- **G1 · The equation.** Series RLC, KVL, differentiated once:
  `L d²i/dt² + R di/dt + i/C = dv_s/dt`. Or for the capacitor voltage,
  `LC v'' + RC v' + v = v_s`. Try `v = e^{st}`: the **characteristic equation**
  `s² + (R/L) s + 1/LC = 0`, `α = R/2L`, `ω₀ = 1/√LC`, `ζ = α/ω₀ = (R/2)√(C/L)`.
  Measured: roots of `det(sI − A)` from the engine vs the formula's roots. Measure `α` and `ω₀` from the values. (Circuit Lab's `(f₀, Q)` are the same numbers, `Q = 1/2ζ`, pinned.)
- **G2 · Overdamped (α > ω₀): two exponentials, no overshoot.**
  `s₁,₂ = −α ± √(α² − ω₀²)`, are both real. The response is `v = A₁e^{s₁t} + A₂e^{s₂t}` with the
  coefficients from `v(0)` and `i(0)`. R = 800 Ω. Measured: the two rates. Zero
  overshoot. The slow root dominating the tail.
- **G3 · Critical (α = ω₀): the knife-edge.** `R_crit = 2√(L/C) = 200 Ω`;
  `v = (A + Bt) e^{−αt}`, the fastest settling that never crosses. Nudge R by 1 Ω
  either side and the form changes. Measure the double root and `R_crit`. Settling
  time minimum in a sweep of R (the sweep view). The note: a set of measure zero
  that you *aim at* and never land on.
- **G4 · Underdamped (α < ω₀): a ring at a frequency lower than ω₀.**
  `v = e^{−αt}(A cos ω_d t + B sin ω_d t)`, `ω_d = √(ω₀² − α²)`, damping *slows*
  the ring. Envelope `e^{−αt}` drawn. R = 50 Ω: ζ = 0.25, `Q = 1/2ζ = 2`, overshoot
  `e^{−πζ/√(1−ζ²)} = 44.4%`, each cycle's peak `e^{−2πζ/√(1−ζ²)} = 0.20` of the last. Roughly `Q` cycles are visible. State this rule of thumb, then measure it.
  Measured from the waveform alone, `ω_d`
  from zero crossings, α from the log-decrement of successive peaks, overshoot from
  the first peak, against the formulas. Cross-lab: Circuit Lab's "Resonance, seen
  in time" is the same step by RK4. They must agree.
- **G5 · Undamped (R = 0): energy sloshing.** Pure oscillation at ω₀;
  `½Cv² + ½Li²` constant, trading back and forth twice per cycle. The energy view
  shows two lobes and a flat total. Measured: total energy constant to fp (this is
  the singular-A case §1.5 promised to handle). Period `2π√LC`.
- **G6 · Two states, two initial conditions, the shape is the circuit's, the size
  is the history's.** Same RLC, three different `(v_C(0), i_L(0))`: identical `α`,
  `ω_d`, different amplitudes and phases. Measured: extracted `α, ω_d` equal across
  runs. Coefficients `A, B` vs the closed form from the initial conditions.
- **G7 · The parallel RLC: the dual, with R inverted.** `α = 1/2RC`: *more*
  resistance rings *longer*, the opposite of series, for the reason F2's table
  gave. Measured: α vs formula. The critical `R = ½√(L/C)`. Circuit Lab's "The same
  R, the opposite effect" is this claim in frequency. The two are cross-linked.

### Group H: Sinusoids and phasors (6) · built

Every H circuit includes the phasor view, with arrows turning beside the waveforms their tips draw. The tip-to-tail sum closes on `V_s`. The scope shows steady state as a dashed ghost.

H1–H6 link to Circuit Lab through exact mappings: RC → `rcLow`, RL → `rlLow`, and series RLC → `rlcSeries`. An inductance above Circuit Lab's 1 H limit is declined with an explanation. It is never clamped into a different circuit.

- **H1 · Switching on a sine: natural dies, forced stays.** RC, 5 V at 159.2 Hz.
  `v_C = forced + natural`, the natural part `−v_f(0)·e^(−t/τ)` existing only because
  the forced sinusoid would not have started from zero. Measured: `tr − ghost` equals
  `−v_f(0)e^(−t/τ)` at five instants. Under 1 % of |V_C| after 5τ and under 10⁻⁹ after
  25τ. The source phase sets the natural part's size (φ = 135° largest, 45° none) but
  not its shape.
- **H2 · Phasors: the arrow that draws the wave.** Each steady-state quantity as
  `amp∠φ`, `x(t) = Im{X e^{jωt}}`. Measure `V_R + V_C = V_s` to floating-point precision. `V_C` must lag `I` by 90°, with `|V_C| = |I|/ωC`. At the exact corner `1/(2πRC)` both arrows `|V_s|/√2` and
  `v_C` lags exactly 45° (and the chip's 159.2 Hz to four figures).
- **H3 · Impedance: series RLC.** `Z = R + j(ωL − 1/ωC)` at 1 kHz: `ωL = 62.8 Ω`,
  `1/ωC = 159.2 Ω`, `X = −96.3 Ω`, `|Z| = 138.8 Ω`, current leads 43.9°, `|V_C| = 1.146 V`
  from a 1 V source. Impedance view: `|Z|` and `∠Z` over four decades with the drive
  marked. Measured: every number. Past 1591.5 Hz the current lags and `V_L` outgrows
  `V_C`.
- **H4 · Resonance.** R = 5 Ω, Q = 20, `f₀ = 1591.5 Hz`. Measured: `V_L + V_C = 0` and
  `Z = R` at ω₀ (fresh complex solve, `anyFreq`). Require `|V_C| = 20 V`. Half-power points
  `|Z| = √2·R` exactly 79.6 Hz apart. The build-up envelope `1 − e^(−αt)` reaching
  `1 − 1/e` at `Q/π = 6.4` cycles and within ¼ % (not ⅕ %) in the 40th cycle.
- **H5 · AC power: real, reactive, apparent.** RL 100 Ω / 0.3 H from 10 V peak at
  50 Hz. Use `S = ½V·I*` per element in the AC-power table with Tellegen's row (ΣP = ΣQ = 0).
  Measure `|I| = 72.8 mA` lagging 43.3°. Require `P = 265 mW` entirely in R and `P_L` exactly 0
  (arithmetic noise below 10⁻¹²|S| read as 0). RMS readings are 7.07 V / 51.5 mA, with 364 mVA, pf 0.728, and Q = 250 mvar. The ghost's `p(t)` contains DC and 2f only. Harmonics 1, 3, and 4 remain below 10⁻⁹.
- **H6 · Frequency response: one sine at a time.** RC,
  `H = 1/(1 + jωRC)` swept two decades either side of `f_c`: the Bode view, |H| in dB
  and ∠H, the drive marked from the same solve the meters use. Measure −3.01 dB and −45° at `f_c`. The slope approaches −20 dB/decade, with −19.96 over the first decade and −19.9996 over the next. Require −89.4° at 100 f_c. All 241 sweep points equal the closed form to 10⁻¹². The
  hand-over, **Open in Circuit Lab**, is exact and tested both ways (§8 Phase 3).

### Group I: The diode: the first nonlinear element (7 + 1 stretch) · built

- **I1 · The curve, and four ways to approximate it.** Shockley:
  `i = I_s (e^{v/nV_T} − 1)`, `V_T = kT/q = 25.85 mV`. Overlaid: the ideal switch,
  the constant drop, the PWL `V_f + r_d`, the exponential, each an approximation of
  the next, with its error stated at the operating point. Measured: PWL slope
  `r_d = nV_T/I` equals the exponential's derivative there. A 60 mV/decade rule
  (`nV_T ln 10`) checked.
- **I2 · The load line, and how a simulator finds the point.** Source, resistor,
  diode (or an LED at 2.0 V / 20 mA, the most-built circuit in the world, with its
  `R = (V_s − V_f)/I`). Graphically: the line `i = (V_s − v)/R` meets the curve.
  Numerically: Newton–Raphson on the residual, iterations drawn on the i–v plane,
  quadratic convergence in ~5 steps. Measured: KVL residual < 1e−12. The
  constant-drop answer's error vs the exponential (0.70 V vs the true 0.68 V at this
  current).
- **I3 · Assume, solve, check.** Two diodes, constant-drop model: four assumed
  states, each solved as a linear circuit, three rejected by their own contradiction
  (`i_D < 0` while "on", `v_D > V_f` while "off"). Measured: exactly one consistent
  state. It matches the exponential solve to within the model's stated error.
- **I4 · Half-wave rectifier.** Sine in, positive half out. Ideal: mean `V_p/π`, RMS
  `V_p/2`. Constant-drop: peaks at `V_p − V_f`, conducts for `π − 2 asin(V_f/V_p)` of
  each cycle. Measured on the exact event-based waveform (§1.6): mean, RMS,
  conduction angle.
- **I5 · Full-wave bridge.** `|sin|`: mean `2V_p/π`, RMS `V_p/√2`, two drops, and the
  ripple frequency **doubles**, the spectrum's first line moves from `f` to `2f`.
  Measured: all four. Hand-over of the waveform to Signal Lab's spectrum.
- **I6 · Smoothing: the peak rectifier, exactly and approximately.** Add C: the
  capacitor charges to the peak and decays through R until the next peak catches it.
  The textbook approximation `ΔV ≈ V_p/(fRC)` (half-wave) sits beside the exact
  event-based answer with its error shown, shrinking as RC grows (Rule 3: the
  approximation carries its guard). Measured: exact ripple. Approximation error vs
  RC. Conduction angle narrowing. This is Power Lab's rectifier group in embryo, and
  the proof that the event machinery works.
- **I7 · Clipper and clamper.** Diode + reference clips at `±(V_ref + V_f)`. Diode +
  capacitor shifts the DC level so the waveform's peak sits at `−V_f`. Measured:
  clip levels. The clamped waveform's peak and mean.
- **I8 · The Zener regulator** *(stretch).* Reverse breakdown as a voltage reference:
  `V_out = V_z` while `I_z > 0`. Increase the load until the Zener starves and
  regulation is lost at `R_L = V_z R_s / (V_s − V_z)`. Measured: regulated band;
  the drop-out load.

*Built 09/02/2026 as I1–I7, with two changes.* I3 places two diodes back to back across a node instead of in series. It retains four assumed states and three contradictions. One knob reaches all three outcomes: clamped high, clamped low, and neither conducting. The solver itself rejects the state with opposite diodes conducting, because that forms a short.

I7 contains only the clipper. The clamper and Zener remain optional Phase 5 work if inexpensive. Bridge diodes use ten megohms when blocking. Four ideal open circuits would leave the source terminals disconnected, with undefined voltages, which the solver reports by name.

---

## 5. Hand-overs

- **→ Circuit Lab** (H6): "Open this circuit in Circuit Lab" for every topology in its
  catalog (RC low/high, RL, series/parallel RLC, inverting amp, integrator), an exact
  mapping, presented without hedge (CORE_SCOPE counter-rule). Component values ride
  the existing link grammar. The reverse link ("see this in time, from the ODE") is
  offered from Circuit Lab's math panel for the same set. The deep-link grammar
  itself is owned elsewhere. This lab consumes it.
- **→ Signal Lab** (H5, I5): show the rectified or `p(t)` waveform's spectrum. Measure the "2ω" and "2f" claims with a real FFT.
- **→ Control Lab**: not directly. The RC/RLC plants already reach it through Circuit
  Lab, and this lab does not duplicate that path.
- **→ Power Lab** (future): F6's spark → the freewheel diode. I6 → Power Lab's Group E rectifiers;
  and the engine (§1.5–1.6) itself, imported.

---

## 6. Testing discipline

- **Unit** (`packages/network`): stamps against hand-assembled matrices. LU against
  known solutions. The equation printer against expected strings. State-space
  extraction against hand `(A, B)` for RC, RL, series and parallel RLC. The 2×2
  propagator against series `expm` at random matrices *and* against the scalar
  formulas. Events against analytic crossing times. Newton against a bracketing
  solver. Every refusal message in §1.3.
- **Invariants** (§1.9), fuzzed across the library.
- **Experiments**: every quoted number in §4 pinned, the way `presets.test.js` pins
  Signal Lab, 63.2%, 44.4%, `R_crit = 200 Ω`, `V_p/π`, 50%, `π − 2 asin(V_f/V_p)`…
- **Cross-lab pins**: exact step vs Circuit Lab's RK4 for the shared catalog. This
  lab's `(α, ω₀)` vs Circuit Lab's `(f₀, Q)`. The integrator's ramp slope vs
  `−1/sRC`. These are the first tests in the suite that check RK4 against a closed
  form, and they may well tighten its `sub`-stepping.
- **Playwright harness** (`apps/circuit-elements-lab/scripts/verify.mjs`): schematic meters
  match the solver. The equations view lights the right node. The phasor diagram's
  vector sum closes on canvas. The time cursor drives the meters. No horizontal
  scroll at 390 px. Caption band clear of the trace (the verify-the-claim rule:
  probe the complaint, not a proxy).
- **REVIEW_PLAYBOOK audit** before release, all eleven classes, plus a screenshot
  pass.

---

## 7. Integration: and the dark launch

Identical to Power Lab's §7, so the two labs share one mechanism:

- Deployed **dark** at `/circuit-elements-lab/` from the first vertical slice (Phase 1). Reed
  and the harnesses test the real deployment. Unlisted, not secret.
- `apps/circuit-elements-lab/RELEASE_STATUS` reads `dark`. A test asserts that while it does,
  the splash, root README, and the other labs' LabNav contain **no** reference to
  Circuit Elements Lab. Circuit Elements Lab's own nav may link outward. Flip the word to `released`
  and the same test inverts: it demands the splash card (first position, "Start
  here" kicker, Decision 2), the README row, and the nav entries.
- The flip is **Reed's action**, after the Phase 6 gate.

On acceptance, amend `POWER_LAB_PLAN.md` §1.2–1.3 to locate the propagator and event bisection in `packages/network`, built by Circuit Elements Lab. `packages/switched` imports them and adds the switch-state machine, periodic steady state, and averaging.

---

## 8. Phasing (each phase ships green and deployable-dark)

1. **Phase 1, Resistive.** `packages/network`: netlist, MNA stamps for R/V/I/
   dependent sources/ideal op-amp, LU, residual, equation printer, Thevenin three
   ways, refusals. `packages/ui/Schematic.jsx` renderer with live meters. App shell,
   dark deploy, `RELEASE_STATUS` test. **Groups A–E (E1–E8).** Exit: KCL/KVL/Tellegen/
   superposition invariants fuzzed green. All Group A–E numbers pinned. *Shipped
   dark 2026-08-30. Groups A and E2 added on review 2026-09-01.*
2. **Phase 2, Dynamics.** State-space extraction, exact propagator (n = 1, 2, ≥ 3),
   step/square/ramp/sine inputs, switch-at-t = 0 with continuity, energy measures.
   Scope, energy and sweep views. **Groups F and G**, RC, RL and RLC with the
   differential equations written out, initial conditions, and the three damping
   faces. Exit: energy and continuity
   invariants. Cross-lab pins against Circuit Lab's RK4 green. *Shipped dark
   2026-09-01: `dynamics`/`transient`/`energies` in `packages/network`, scope,
   energy, state-equation and damping-sweep views, F1–F7 and G1–G7, every note
   sentence measured in `experiments.test.js`.*
3. **Phase 3, Phasors.** Complex MNA, phasor diagram view, long-time-limit agreement, AC power measures, hand-over to Circuit Lab. **Group H.** Exit: phasor-vs-time invariant. H6 hand-over exact and tested both ways. *Shipped dark 2026-09-01: `complex`/`solveAC`/`readoutAC`/`acPower`/`drivingPointZ`/`sweepAC` in `packages/network`, the steady-state ghost in `transient`, phasor, impedance, Bode and AC-power views, H1–H6. The hand-over is `circuitLink.js` in `packages/ui` (one grammar, both ends) and `incoming.js` in Circuit Lab, which clamps-and-warns rather than loading a different circuit silently.*

   The phasor/time invariant is measured at 64 instants for every H circuit, using defaults and two random settings. Circuit Lab's transfer function agrees with H at all 241 sweep points within 1e-9. Return links preserve values without warnings.

   The student review on 09/02/2026 scored all 46 experiments. Scores out of 10 were information 6, layout 5, flow 5, and plots 7.

   Grok supplied a second review, checked against the source. The target became 9.5/10, with a separate commit for each remediation step. The lab remained unreleased, and Group I waited for the first three steps. Deep links belonged to the parallel session.

   The sequence was 0 claim bugs, 1 opening lessons, 2 lesson quantities in Analysis, and 3 plots. Steps 4–6 covered numbers and names, content order and circuits, and live notes. Steps 7–9 covered plot conventions, screen composition, and student scoring. Step 1 included knobs above notes, questions in notes, and A1 without a matrix. Step 2 included headlines, bridge sentences, and theorem drawings.

   **Step 0, claim bugs, shipped 2026-09-02:** A2's refusal is now reachable from a switch knob on screen, not only from a test's private netlist. D2's "printed system" count is five (three node voltages and two source currents, the math panel computing the words from the unknown list). H1 points at F3, the RC experiment, not F2 (the RL one). The topbar gives a refusal's reason in words (`refusalReason`) and keeps the code for the report.

   H2, H4, and H6 open with the source at its peak instead of a zero crossing. H2's KVL meters read 2.5 V + 2.5 V = 5 V. The angle display changed from "turned 1080.0°" to "3 cycles + 90.0°" through `turned` and `turnedLabel`.

   New tests cover claims outside numeric comparison rows. Every cross-reference must name an existing experiment that supports the sentence. The reference table grows with new links. Written unknown counts must match the solver. Refusals must reach readers as sentences. Every sine experiment must open with |v_s| ≥ A/2.

   **Step 1 shipped 09/02/2026.** It revised the opening experience and added questions to lessons. Notes no longer appear as single blocks.

   Each experiment has three registers in `src/lessons.js`. The `see` section describes the default picture in at most 70 words, fitting beside the schematic on a phone. The `try` section gives two to four knob moves, each within 45 words and naming its setting and reading. The `why` section contains reasoning under a "Deeper" details fold. `experiments.js` contains no prose.

   It takes the lesson by id and builds `note` as `see` + `why` for the places that still quote one paragraph. The sidebar shows the picker, `see`, the numbered `try` list and the "Deeper" fold. A phone gets a "Knobs ↓" pill because the knobs sit below the plots there.

   Tests require every `set` to name a knob and remain in range. Each `at` must remain inside the time window, and each `reads` entry is solved. `readQuantity` accepts analysis functions or `v.`, `vd.`, `state.`, `thevenin.`, `mag.`, `deg.`, `lead.`, `energy.`, `H.`, `Z.`, and `ac.` paths.

   Every number with a unit in `see`, `try`, and `why` must trace to a reading, knob default, cursor time, or step setting. Lessons cannot quote numbers that the solver does not produce.

   A2 with its switch open and F6 with an ideal switch both request and receive refusals. For all 46 experiments, `verify.mjs` checks that the note and Analysis switch fit the first screen at 390 px. At 1280×900, the note begins above 230 px and the first knob remains visible.

   **Step 4 shipped 09/02/2026.** It revised numbers, names, and the package description. Every displayed number now passes through `src/format.js`.

   `num(v, unit, sig, scale)` snaps values below one part in 1e9 of their scale to zero. Without a scale, it uses a femto threshold. The residual reads "0 A" instead of "0.00087 fA". E2's 9.9 nA and 99 pW remain because they exceed their own relative floors.

   `forReading` rescales comparison rows into units such as 100 µA, 20 1/ms, and 898 million ×. The shared `MathPanel` then formats them. That peer-owned component uses exponential notation outside 1e-3…1e4.

   Predictions below the row's floor display as zero. For example, cos 6π leaves ½Cv² = 2.7e-37 J after three cycles. A zero prediction met within its floor also displays zero. Σ power joins the topbar from B3, the experiment that introduces power. The "N nodes · M unknowns" chip explains both words on hover. Knobs take the drawing's names: Source V₁, V₁/V₂, I₁, Lift V₀, R_off of S₁ (`of: 'S1'`).

   Preset chips carry their unit (1.59 kHz, not 1591.5). E3's op-amp is a switch, ideal by default, with a gain knob that applies when it is "finite gain", no more "0 = ideal". The hand-over keeps its URL fragment on `data-fragment` instead of printing it. H6 is "Frequency response: one sine at a time". The package description covers F–H.

   Lesson prose and matrix symbols retain E for source voltage. The legend explains that V₁ holds E₁. Step 6 will regenerate roughly five hundred sentences from solver-bound notes instead of editing them manually. No "non-linear elements come later" promise was found in the source to remove. Tests: `format.test.js` (noise floor, prefixes, agreement preserved through rescaling).

   Every element named by a knob must appear on the schematic. Bare R, L, or C is allowed only when the drawing has one. No knob is named E. Preset chips use `fmt(value, unit, 3)` and remain within knob limits. E3 must refuse in ideal mode and solve with the selected finite gain.

   `verify.mjs` scans every experiment and view for femto units, exponential notation, and `#circuit=`, requiring zero occurrences. It checks that Σ power is absent on A1 and present on B3. The size chip must have a title. Every preset chip must fit one line ending in its unit.

   **Step 2 shipped 09/02/2026.** Each experiment names its lesson's headline quantity in `src/headlines.js`. Examples include amplifier v_out, ladder R_eq, and dynamic τ, ζ, ω₀, and |H|. `insight.jsx` displays it first in Analysis as tag = value, read from the solution.

   Tests compare all 46 headlines with closed forms at defaults and 25 random settings. Tolerances are 1e-9 for static values, 1e-6 for dynamic values, and 1e-7 absolute for dB. Ideal E3 and F6 instead print amber refusals.

   The headline also appears as a schematic callout. `placeCallout` keeps it inside the crop and reserves the width of its widest possible value. Tests check both placement and text size.

   A bridge sentence below the headline connects the view to the lesson. It combines the view's lead with lesson sentences until reaching 20 characters. F2's "The dual." therefore cannot form the whole bridge.

   Groups A–E open a `reading` table with each drawn element's voltage and current, followed by node voltages. Power appears once B3 introduces it. Columns use their own scales, so E2's femtowatts read 0 W.

   The matrix sits under "The solver's own working, N equations in N unknowns". Group A has a one-line KCL/KVL primer, and Group B has the three-law card. D5 opens its equivalent view, and G1 opens the scope.

   `src/theorems.js` draws six experiments' theorems. B2 shows three loop voltages summing to zero. D3 displays both live mesh equations. D4 draws one schematic per source, marks the inactive source "I1 → 0 A", and adds the partial responses.

   D5 places V_th behind R_th, with the open-port reading beside the load line. E3 opens the matrix fold to mark two contradictory rows. H5 shows the power triangle, p(t), and its mean.

   `tagLatex` gives v_out a subscript and renders ω₀ and τ as Greek symbols. `insight.test.jsx` renders every headline, bridge, table, and theorem block, then reads its numbers.

   `experiments.test.js` checks theorem quantities against closed forms. Checks include B2 |Σv| < 1e-9·|E|, balanced D3 rows, summed D4 responses, D5 V_th/R_th and load-line points, and H5 P/Q/S/pf/mean.

   `verify.mjs` checks every experiment and view. The headline must be the pane's first child and the bridge its second. The callout must display the headline value after removing typesetting. Refusals must draw no callout.

   **Step 3 shipped 09/02/2026.** `src/marks.js` computes lesson marks for eight experiments. F3 marks E, the 63.2 % point at τ, and the initial-slope tangent reaching E at τ.

   F4 the level, the exponential approach and v_A(0). F6 the spark v_S1(0⁺) and the trickle E/(R + R_off), none when the switch is ideal. G4 the first peak from `extrema`, the level alone when the ringing is gone. C3 the unloaded divider value E·R₂/(R₁ + R₂) from `x.thevenin.voc`. D6 the peak power at R_L = R_s and the 50 % efficiency there. H4 |Z| = R and |H| = Q at ω₀ with a curve of the resonant peak.

   H6 the −3.01 dB point at f_c, the −20 dB/decade asymptote and its slope, each a kind (level, point, segment, curve, time) with a label naming the quantity. One shared `drawDataMarks` in `timePlot.js` draws them on the scope, the frequency plots and the load sweep. Rings are kept inside the frame and their labels move beside the ring when there is no room above.

   Below 380 px of frame the marks lose their on-canvas labels and the caption `PlotMarks` under the plot names them, glyph, label, value in the plot's unit, so a phone reads the same lesson. Hidden traces are gone. A dimmed second trace is thin, dashed and translucent instead of a lighter copy of the first. F6's v_switch is dashed over i_L, F7 no longer draws an i_in that sat under i_L.

   `rightSpan` gives the right axis its own range when aligning zeros would compress a trace below 40 % of the frame. Separate zeros receive separate dashed lines. G4–G7's v_C occupies 0.81 of the frame instead of a narrow band.

   G3's damping sweep uses `settleAnalytic`, a closed form with bisection at the envelope's final band crossing. Replacing the step-limited transient makes the curve smooth. Its fastest-R minimum lies inside (0.75·R_crit, R_crit).

   The engine still gives the dot at the knob's R and the test checks both agree to six places. C3's knob label ducks under the level line. D6 reads its ticks in mW and its efficiency on a 0–100 % right axis. H1's cursor sits near 2τ so the natural part is still visible. H2's angle reads as turns plus degrees (`turnedLabel`). The DampingCanvas dot now lands on its log axis.

   The 18 `marks.test.jsx` tests compare marks with engine readings, including F3's tangent, F6's `tr.at(0).sol.volt.S1`, and D6's p_RL/−p_V1 efficiency. H6's asymptote endpoint must agree within 0.001 dB. Tests also cover caption markup and plot repairs. Across all 46 experiments, traces must fill ≥ 0.4 of the frame. Identically styled traces must differ by more than 1e-9 normalized.

   `verify.mjs` reads every caption back and requires a number in each. At least eight experiments must have captions, and F3's must include 63.2 %.

   **Step 5 shipped 09/02/2026.** It revised content order and circuits. Concepts appear in teaching order, and experiments use distinct pictures.

   A1 defines voltage as energy per coulomb and current as charge per second before presenting numbers. `charge` is first in `terms.js` and A1's term list. The new `OhmLine` primer (`primer="ohm"`) builds the resistor row from Ohm's law. It names KCL as the junction rule developed in Group B, without introducing KVL.

   App.jsx's `primerFor` selects that primer for A1, a brief line for the rest of A, and the three-law card for B.

   Thévenin's name first appears in D5. `VIEW_LABELS` moved to experiments.js beside `viewLabel(view, exp)`. Earlier experiments use the tab "Seen from the load" and `TheveninPane named={false}`. Its rows say "the voltage with nothing connected" and "the current a short would draw". C3 therefore uses the equivalent before naming it.

   C4 explains why its bridge differs from the textbook diamond. Each half is B2's series-resistor loop, read at its midpoint.

   E7 drives both inputs, with V₂ = 1.2 V on its own stub and ground beside V₁'s. Every element is active at defaults. The lower row positions V₂ at 97, in2 at 140, R₃ at 190, and the riser at 215. Across all seeds, in2's name and reading clear both symbols.

   B3 differs from B2 through a third resistor, R₃ = 3 kΩ. B4 differs from A4 through a 9 V source. G3 opens overdamped at 400 Ω, with chips 800/400/160/50. Its marker therefore differs from G2's critical point. Tests: no view label or title before D5 matches /Th[ée]venin/ and every one from D5 on is the named label. No two experiments share `[layout.items, defaults]`.

   A1's terms start with charge and its note defines voltage and current before its first digit. C4's note says diamond, two dividers side by side and B2 (registered in the cross-reference table as "two resistors and a source"). E7's output is 10·(1.2 − 1) and every |i| > 1 µA. The Ohm primer names Ohm's law and Group B and not KVL. G3's zeta at the defaults is 2 and `damping.Rcrit` is a quantity path the note's "200 Ω" is measured against.

   **Step 6, notes that are alive, shipped 2026-09-02:** the lesson answers back instead of retiring.

   `live.js` binds note numbers to measurements. `quoted(see)` tokenizes figures with units and bare figures after = or ≈. `bindSee(exp)` matches each to a named knob, knob default, `seeReads` path or function, or cursor. A `flip` supports reversed signs such as −α. Six permitted literals are listed in live.test.js.

   `liveSee(exp, x, p)` rereads each binding. Text remains when `stands` finds agreement within 0.6 % or half the last digit. Otherwise, `printLike` updates the number in the note's existing format.

   `LiveNote.jsx` renders segments as `b.live[data-changed]`. The provenance line reports updated readings or departure from the note's original regime. `regimeOf` distinguishes overdamped, critical, underdamped, and refused states.

   Terms now appear where first used instead of in the "Terms used here" fold. `terms.js` supplies one `MATCH` pattern per term. `glossary.js` finds `firstUses(exp)` across see, try, and why. The longest match wins at a shared start, with one placement per term.

   `Prose.jsx` renders tappable `dfn` elements that open a `DefCard` below their paragraph. A "since A3" chip links to the introducing experiment. Unmentioned terms appear as chips below the note. `earlyUses()` must remain empty. The why section may point ahead by naming a later experiment or group through `pointsAhead`.

   `predict.js` replaces the first knob-turning step with a question. `predictFor(exp)` compares its quantity at defaults and the requested setting. It offers the solver's answer and two nearby misconception-based options: same, proportional, inverse, double, or half. Picking one sets the knob and reveals the step's sentence with the habit named. 39 experiments pose one. The seven whose first knob step is a toggle or a refusal do not.

   `course.js` supplies each group's `GROUP_INTRO`. It appears folded in the opening experiment and as a picker description. `BUILDS` records prerequisites, while `leadsTo` reverses those links into chips below the try list. Tests for live notes, predictions, glossary, and course require default notes to render as written.

   At five settings per experiment, each live segment must represent its reread value. The correct option must equal the solver's result at the step setting. All three options must differ. Every MATCH has a term and vice versa. The intros are under thirty words.

   Every experiment except A1 builds on an earlier one, and all 46 are reachable from A1. `verify.mjs` checks that B1's R₂ change updates `b.live`. A1's "voltage" opens and closes its card, and the old glossary fold is absent.

   Choosing "12 mA" in A1's question must report an error and name the misconception. It sets R to 100 Ω, and the meters read 120 mA. The A2 chip must open A2.

   **Step 7 shipped 09/02/2026.** Plots use one color per quantity and captions instead of legends. `palette.js` maps voltage to blue, current to orange, power to green, energy to gold, and angle to purple. `HUE` uses shared `COLORS` for the first four. Each has three `SHADES`.

   A second voltage trace uses a lighter blue and a dash. `familyOf(q)` and `familyOfLabel` classify traces. `styleTraces` assigns shade, dash, and weight. Declared dim traces are thin, translucent, and dotted.

   Schematic meters, `.readout [data-q] b`, and bold caption numbers share `--q-*` color tokens. Current remains orange everywhere. `drawEndLabels` names traces at the frame edge, with backing plates behind text. Values move left of their dots when the right side is occupied. `frameArea` widens gutters for these names, replacing legends.

   `captions.js` supplies a sentence under every plot through `captionFor(exp, view, x, params, marks, drive)`. It reads cursor time, bright-trace value, energy ledger, |Z| at f, sweep setting and value, R_crit, and settling time. `PlotCaption` stays within 50 words. Every printed number is formatted from the engine's current value.

   `trackText(ctx)` wraps `fillText` to record canvas text boxes. `placeLabels` finds a clear row for a mark's name, using the shorter path around obstacles. `clearRow` moves individual labels past occupied positions. Pinned values are omitted when a labeled ring already identifies the point. Phasor-tip labels try fourteen positions and choose the least obstructed.

   Tests (palette 7, plotText 14, captions 27, marks +4): the hues equal the shared faces and the CSS tokens. No two bright traces of one family share colour and dash. Every scope trace is in its family's shades. Label tests cover clearing, separation, clamping, short paths around obstacles, and escape from between two obstacles. At defaults and two seeded random settings, every caption must name its claimed values and format them from `x`.

   Bright features occupy ≥ 40 % of the frame. Exceptions are F7 and H6, where the drive sets the height, and H5, which has no bright trace. E8's flat sweep is also exempt.

   `verify.mjs` reads text boxes in all 43 plot views at 1920, 1280, and 390 px. Boxes must stay on canvas and avoid overlap after a 1-px shrink. Every plot needs a numeric caption, and meter colors must match mode tokens. Playing F3 must move its cursor to 5 ms and release the button.

   **Step 8, the screen as one composition, shipped 2026-09-02:** the lesson, the knobs and the circuit are one thing on one screen. `progress.js` keeps where the student is.

   `stepMet` requires exact toggle agreement, numeric agreement within 0.5 %, and cursor agreement within 2 % of the window. `meterOf` checks the meter mode named by the step. A watch step completes when checked or when a later step completes. Completion remains recorded in localStorage under `ee-labs/elements/progress`. `load` and `save` tolerate storage errors.

   The Try list is a path: done steps ticked and dim, the active step in full, the steps ahead one line each with an ellipsis and open on a tap. The posed prediction is the active step's question. A "next up" chip appears when every step is done. The picker ticks finished experiments (`data-done`), counts each group (`.group-arc`) and the course (`.picker-arc`).

   Knobs are one column with one knob open, the active step's, else the first, and the rest compact (`NumField compact`, label and entry on one row; `.knob-slot[data-named]` marks the step's knob). The window knob moved to the cursor row it scales. Deeper is one fold (why, the working, the hand-over) that refolds on a new experiment.

   Shared `Schematic` props `lit`, `reference`, `onNode`, and `onElement` support interaction. `readsOf` highlights quantities read by the active step. `EquationsPane onHover` highlights rows through `data-node` and `data-el`.

   Tapping A3's node calls `reference.js rereference`. Node voltages shift together, element readings stay fixed, and ground reads minus the shift. Tapping a switch operates it. `switchKnob` finds the corresponding toggle by trying each one. Time switches restart the clock.

   The topbar says "N numbers to find" and "every node balances". Solver terms "unknowns" and "residual" remain in hover text. Its outcome truncates with an ellipsis when t / ω / τ chips need space.

   At viewport widths from 1200 px, the sidebar is 380 px wide. All 46 experiments show the entire Knobs section at 1280×900. Previously, they overflowed by 42–697 px.

   The phone has a fixed tab bar: Lesson · Circuit · Plot · Knobs. Scroll position lights the current tab. At the foot of a short page, the last tab lights. A new experiment scrolls to its top. On phones, base.css makes `#root` the page's scroller. The bar calls `scrollIntoView`, with `scroll-margin-top` on its targets. It reads the page's end from `pageScroller()` and listens for scroll events in the document's capture phase.

   The narrower plot frame put F6's spark label under the τ mark's name. `drawMark` now steps its name down a row through `clearRow`, like every other label. At 390 px, the cursor row fits on one line. It contains "the circuit at t = 24 ms", the window knob as "− 40 cycles +", and play. The plot's view switch now sits on the first screen for all fifteen experiments with a window knob. They previously overflowed by 1–14 px once the page scrolled to its top.

   Tests (progress 67, reference 8, plotText +1): every lesson's every measurable step is met by its own setting and by nothing at the defaults, the first step is active on arrival. A3's re-reference arithmetic. Every switch is a knob's or a time switch and the knob really throws it. A time mark's name steps under a mark label already on the top row. verify.mjs checks that the active step's knob is the marked open one and its element is lit.

   A1's three steps tick off by turning the knobs and switching the meters, the picker marks it and a reload keeps it. A node tapped on A3 reads 0 with the others shifted and the ammeters unmoved. The switch on F3 restarts the sweep. Equations rows light their node and element. The tab bar's Knobs and Lesson go where they say. Knobs ends above 900 px for all 46 at 1280×900. No solver-speak on the topbar's face.

   Deep links between labs are the parallel session's (`packages/ui/src/deeplink.js`) and are not part of this step.

**Step 9, students score it, built 2026-09-02, sittings Reed's:** the last half point of the 9.5 is not the lab's to award itself. Three people new to circuits sit with three experiments each (A1, then C2 or D5, then F3 or G4), on Reed's phone and a laptop, with a four-line script read as written: open it. Do what the lesson says. One sentence on what it showed you. Rate clarity from 1–5.

   Each sitting records three numbers: seconds to the first act, whether the sentence matches the experiment's `see`, and the rating. First act must take ≤ 10 s in every sitting. Recall must reach ≥ 8 of 9, with clarity mean ≥ 4.5 per experiment. Any missed target blocks the 9.5 for that experiment's group. It becomes a fix with a test, and that sitting is repeated once.

   `apps/circuit-elements-lab/SITTINGS.md` gives the script, seats, rules and recording format. Reed appends the record to `sittings.json`. `src/sittings.js` validates each entry and scores the record with `score`. Its `statusLine` function prints the one status line the document may carry.

   The 11 tests in `sittings.test.js` hold the record and document to each other. Every entry must be well formed and name a course experiment. Each seat must have a `see` to match and a first step the student acts on. The tests enforce the documented scoring rules. A slow first knob blocks only its group. One recall miss is allowed. A second blocks the groups where the misses fell.

   Clarity is a mean per experiment. SITTINGS.md's `Status:` line must equal the computed one. The document cannot claim what the record has not measured. The record is empty until Reed sits people down. The status line says so.
4. **Phase 4, Piecewise-linear.** Regions, events by bisection, assumed-state DC, Newton for the exponential diode (DC only, with the refusal in time), rails on the op-amp, i–v plane view. **Group I, E9.** Exit: I6's exact-vs-approximate. Event continuity invariant.

   *Shipped dark 09/02/2026.* `packages/network/src/diode.js` holds four models: ideal switch, constant drop, V_f + r_d, and Shockley. It defines each device's regions and their guards. `pwl.js` provides three ways to decide a region. `assumedState` assumes, solves and checks, keeping each rejection's contradiction. `newtonDC` uses SPICE's junction limiting and GMIN, keeping every iteration. `pwlTransient` solves exactly within each region. Bisection on that solution finds when the region ends, and states carry across.

   `mna.js` gains one stamp, `GI`, a conductance beside a current source. It represents both the sloped diode and Newton's linearization. `dynamics.js` returns the affine term a conducting diode adds. This is exactly zero for every circuit without one. The new **i–v plane** view shows the curve, four models, load line, operating point, and Newton's iterates approaching it. The **assumed states** view shows all four combinations, with three rejecting themselves. I1–I7 and E9 bring the total to 54 experiments.

   Three refusals give their reasons. Exponential diode responses in time are unsupported. An ideal diode connected directly to a capacitor is also unsupported. A Schmitt trigger cannot give one DC answer when it has three. Measured claims caught two engine bugs. A guard violated at the first sample never crossed inside the run. The bridge's second diode never turned on, losing half the output. The peak remained right. Only an average over multiple cycles exposed the loss.

   The second bug published overlapping segments in a stitched walk. The energy integral then picked the wrong propagator. Tests include 30 in `pwl.test.js` and Group I's claims in `experiments.test.js`, with 2528 across the monorepo.
5. **Phase 5, Polish.** Stretch items (I8, GBW toggle) if cheap. Mobile pass. Tune the equations view's progressive disclosure on a phone.

   *Shipped dark 09/02/2026.* **I8, the Zener regulator**, was cheap because the engine already had breakdown as a third region. The load sweep shows the output flat while it regulates, then falling below the knee at `R_L = V_z R_S/(E − V_z)`. The plot demonstrates the lesson.

   The sweep re-decides the region at every load. `sweepKnob` solves through `solveRegions`. The Thévenin equivalent is withheld from circuits with regions, because a nonlinear circuit does not have one. An `R_th` beside that knee would claim behavior the circuit does not obey. A conducting diode's equations row now names its region instead of calling it a voltage source.

   **The GBW toggle is not built.** `A(s) = ω_t/s` makes the op-amp dynamic. It needs a new stamp in the complex solve and a new state in the time solve. Every other experiment in Groups F–H depends on those paths. That is a phase of work. Finite gain and rails, the two non-idealities that change these lessons, are built in E2, E3 and E9.

   The plan's §9 calls slew rate and offset datasheet facts. GBW belongs with them until an experiment needs it.
6. **Phase 6, Release gate.** REVIEW_PLAYBOOK audit, screenshot pass, Reed's hands-on review, then Reed flips `RELEASE_STATUS`. Splash card goes first. *Audit and screenshot pass done 2026-09-02.*

   *The review and flag are Reed's.* The playbook found four defects in Group I. Each was fixed with the test or picture that would have caught it. **(1, sentences frozen while controls move)** A diode lesson describes one arrangement: "D₁ conducting, D₂ blocking", or "it holds 5.1 V". A knob can move the circuit to another arrangement. The provenance line already handled damping regimes.

   It now reports the regions too, so I3 with its supply reversed says *written for a circuit with D1 conducting. At your settings it is D1 blocking*. **(4, a fixed range the content escaped)** the i–v plane started at 0 V, so a reverse-biased operating point was drawn outside its own frame. The frame now opens to hold it and the load line runs the width of it.

   **(6, rendering honesty)** The ideal and constant-drop models were drawn as functions of v, rising from zero to the frame's top. That suggests maximum current passes at every voltage above V_f, the opposite of switch behavior. They now appear as two segments that stop. **(4 again, axes)** The i–v plane lacked ticks. Its one x label collided with the axis title.

   The pass also placed each model's name beside its line, replacing the legend. A conducting diode's equations row now names its region.

   *What is left before the flag: Reed's own hands-on review, on a phone and a
   laptop, and the three student sittings the 9.5 waits on (`SITTINGS.md`). Whoever flips `RELEASE_STATUS` writes the splash card, README line, and LabNav entry. `release.test.js` fails if those entries exist while the flag remains `dark`.*
7. **Then Power Lab Phase 1**, starting from `packages/network`.

---

## 9. Non-goals (v1, stated so they are decisions rather than omissions)

- **A free-form schematic editor.** Curated circuits with editable values, as every
  other lab. The day a circuit is wanted that the library cannot express is the day
  an editor earns its keep, and it will be a large day.
- **Transistors** (BJT, MOSFET). That is the next lab, Electronics, and it reuses
  this engine (DC Newton for the bias point, then small-signal LTI) plus one more
  nonlinear element type. Not here. Its plan is `ELECTRONICS_LAB_PLAN.md`.
- **The exponential diode in the time domain** (§1.6). Refused with the reason.
- **Coupled inductors / transformers**, Power Lab's Group D.
- **Three-phase, wire resistance, noise, temperature.**
- **Op-amp slew rate, offset, bias current.** Finite gain, rails and (stretch) GBW
  are the non-idealities that change the lessons. The rest are datasheet facts.
- **Laplace transforms as a topic.** The characteristic equation is reached by trying
  `e^{st}`, which is all a first course needs. The transform proper is Circuit Lab's
  and Control Lab's currency, and H6 is the door to it.

---

## 10. Risks, named

- **Two labs with "circuit" in their nature.** Readers may open the wrong one first.
  Mitigations: Decision 2's "Start here", H6's hand-over as the visible seam,
  cross-links in both directions, and the card texts stating the boundary in one
  line each.
- **The equations view as a wall of text.** MNA on a six-node circuit is six rows of
  fractions. Mitigation: one equation per row, expanded on tap, each lit on the
  schematic. The matrix form behind a fold. Checked on a phone before release.
- **Solver and printer are one path.** Both come from the stamps, so a stamp bug
  prints a wrong equation *and* solves it consistently. Mitigation: every experiment
  carries a hand closed form as the independent path (§1.1), and the residual check
  recomputes currents from element laws rather than from the matrix.
- **Degenerate topologies in the library.** Source loops, C loops, no-feedback
  op-amps. Mitigation: refusals are features with tested messages (§1.3), and the
  library is fuzzed for rank before any values are touched.
- **Scope creep toward SPICE.** The engine will be able to do more than the lessons
  need. Mitigation: `§9` and CORE_SCOPE. A new element type needs a new experiment
  that needs it, not the other way round.
- **The event solver's edge cases** (grazing events, simultaneous events, chattering
  at a rail). Mitigation: bisection on exact segments has no stiffness problem. Cap
  events per render and say so, as Power Lab's plan already requires. Fuzz the
  rectifier and Schmitt circuits specifically.
- **Cost.** Eight groups, forty-nine experiments, a new package and a shared
  renderer: this is the suite's largest lab. Phasing keeps every phase shippable dark
  and each phase's engine work pays into Power Lab. But the plan is honest that Phase
  2 (exact dynamics) is where the hard engine work lives, and it should not be
  hurried.
