# Circuit Elements Lab — the plan

A lab that starts **at the very top of circuits**: charge, voltage, the two laws,
resistive networks and their theorems, the elements that remember (C and L) and the
differential equations they write, second-order response and damping, sinusoids and
phasors, the op-amp, and the diode. It ends exactly where Circuit Lab begins — at
"this circuit's response across all frequencies is a transfer function" — and hands
the reader over there.

Name **Circuit Elements Lab** (Decision 1, settled), directory `apps/circuit-elements-lab`, engine
in a new `packages/network`. Built **before Power Lab**: its engine is the first half
of Power Lab's, so this lab pays for that one.

Decisions already made (Reed, 2026-09-01):

- **From the very top.** KVL/KCL and Ohm's law are experiments, not assumptions.
  Nothing is presumed known except arithmetic and what a graph is.
- **Before Power Lab.** The exact propagator and event machinery Power Lab needs are
  built here first, on the simplest circuits that need them (`§1.6`, `§8`).
- **Ideal first, non-idealities as labelled toggles** — inherited from Power Lab's
  plan: finite op-amp gain, rails, diode drop, source resistance, switch resistance.
- **Not linked from the splash until refined, checked and confirmed** — the same
  `RELEASE_STATUS` dark-launch mechanism as Power Lab (`§7`).

- **Name: Circuit Elements Lab** (Reed, 2026-09-01). "Circuit Elements" reads as the
  parts, "Circuit Lab" as the whole — which is the relationship, since one hands into
  the other. LabNav short form **"Elements"** so five labs fit a phone-width nav.

Decision still open (recommendation in **§0**): whether the splash reorders to put
this lab first.

The suite's one rule applies: **every explanatory sentence is a claim about physics,
and a test must measure it.** This lab is unusually well placed for it — almost every
claim in a first circuits course has an exact closed form, and here the *method* that
produces the number (nodal analysis, the ODE solution, the phasor) is itself content,
so the hand-derived form and the machine-solved network are two paths to one number.

---

## 0. Two open decisions

### Decision 1 — the name (settled: Circuit Elements Lab)

The honest name for this lab would be "Circuit Lab": it is the lab about circuits *as
circuits* — elements, laws, time — while the existing Circuit Lab is about circuits *as
transfer functions* (its own header: "the circuits, and the transfer function each one
has"). But renaming a live, linked lab has a cost, and a "Circuit Lab" at any URL other
than `/circuit-lab/` while `/circuit-lab/` shows something else is a trap for readers.

**Circuit Elements Lab** (Reed's choice) resolves it: the word *circuit* goes where it
belongs without a collision, and the pair reads as parts and whole — "Circuit Elements"
is what you learn first, "Circuit Lab" is what they become. A beginner scanning the
row knows which to open. Costs, accepted: it breaks the one-word pattern, so the
LabNav uses the short form **"Elements"** (five labs must fit a 390 px nav), with the
full name on the splash card, the app header and the report link's `lab` field; and
the slug `apps/circuit-elements-lab` / `/circuit-elements-lab/` is long but
unambiguous, and it is the one permanent choice.

Rejected: *Kirchhoff Lab* (exact, memorable, names nothing to the reader who most
needs to find it); a *rename swap* making the new lab "Circuit Lab" and the old one
"Filter Lab" (most honest, most confusing while the current Circuit Lab carries its
hand-over links).

### Decision 2 — the splash order

When released, this is the lab to open first. Recommendation: the card goes **first**
in the row, with a one-line kicker "Start here." Its card text names the path: "the
two laws → the theorems → the differential equations → phasors — and out into Circuit
Lab." No other card moves.

---

## 1. The engine: exact network analysis (`packages/network`)

### 1.1 Why a solver at all, when Circuit Lab has none

Circuit Lab curates ten topologies with `H(s)` derived by hand, and that was right for
it: the transfer function *was* the content. Here the content is **the method** — the
reader watches KCL written at each node, watches the matrix appear, watches it
solve — so the equations must be **generated from the circuit**, not typed per
experiment. That needs a netlist and a solver. It stays small: modified nodal analysis
over a curated library of circuits with editable values. Not a schematic editor
(`§9`).

The hand-derived closed form for each circuit (R_th = R₁‖R₂, τ = R_th·C, …) remains in
each experiment as **the independent path**. The solver is the measurement; the hand
form is the claim; the test is that they agree.

### 1.2 Modified nodal analysis (MNA)

Unknowns `x = [v ; j]`: node voltages (ground removed) and the currents through every
element that has no admittance form — voltage sources, inductors (in DC/state form),
op-amp outputs. The system `M x = r` is assembled by *stamps*:

| Element | Stamp |
| --- | --- |
| Resistor a–b | `G[a,a] += 1/R`, `G[b,b] += 1/R`, `G[a,b] -= 1/R`, `G[b,a] -= 1/R` |
| Current source a→b, value I | `r[a] -= I`, `r[b] += I` |
| Voltage source +a −b, value E | new unknown `j`; column `+1` at a, `−1` at b; row `v_a − v_b = E` |
| VCCS (g · (v_c − v_d) into a→b) | `G[a,c] += g`, `G[a,d] -= g`, `G[b,c] -= g`, `G[b,d] += g` |
| VCVS (+a −b = μ(v_c − v_d)) | as voltage source, row `v_a − v_b − μ v_c + μ v_d = 0` |
| Ideal op-amp (p, n → o) | new unknown `j_o` (output current); column `+1` at o; row `v_p − v_n = 0` — the **nullor** stamp: the golden rules *are* this row |
| Finite-gain op-amp | VCVS with μ = A from (p, n) to (o, gnd); rails via `§1.5` |
| Switch | resistor R_on / R_off; ideal = 0 / ∞ handled as short (node merge) / open (omit) |

Solve by LU with partial pivoting (n ≤ ~30 here; nothing fancier). Every experiment's
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

MNA is singular for exactly the circuits a first course tells you are ill-posed, and
the refusal message is the lesson (CORE_SCOPE Rule 2):

- a loop of voltage sources / ideal wires with inconsistent values → "two sources
  disagree about one voltage";
- a cut-set of current sources → "these currents have nowhere to go";
- an **ideal op-amp with no negative feedback path** → "an ideal op-amp with no
  feedback has no solution — the real one saturates; switch to the finite-gain model
  with rails to see what it does" (and the switch is one click);
- a capacitor loop or inductor cut-set (§1.4) → "these two capacitors share one
  state; merge them".

Each refusal has a test that asserts the *message*, per Rule 2.

### 1.4 From netlist to state space, exactly

For a linear circuit with capacitors and inductors: replace each capacitor by a
voltage source of value `v_C` (a state) and each inductor by a current source of
value `i_L` (a state). The remaining circuit is resistive, so **one MNA solve** gives
every capacitor's current and every inductor's voltage as linear functions of the
states and the independent sources:

    i_C = M_x x + M_u u,   v_L = N_x x + N_u u
    ⇒  dv_C/dt = i_C / C,   di_L/dt = v_L / L   ⇒   dx/dt = A x + B u,   y = C x + D u

This is the substitution theorem, and it is exact. The rank check on the substituted
MNA is what detects the degenerate cases in §1.3. It also produces the circuit's
**characteristic polynomial** from `det(sI − A)`, which is what the second-order
experiments (§4 Group G) display and test against `s² + (R/L)s + 1/LC`.

### 1.5 Exact time response — no timestep

The state equation is solved in closed form; this is the propagator Power Lab's plan
specifies in its §1.2, built here first and imported there:

    x(t) = φ0(t) x(0) + φ1(t) B u,   φ0 = e^{At},   φ1 = ∫₀ᵗ e^{Aτ} dτ

- **n = 1** (RC, RL): scalar exponential — `x(t) = x∞ + (x₀ − x∞) e^{−t/τ}`, which is
  the formula the lesson derives, so engine and lesson are one statement.
- **n = 2** (RLC, two-cap ladders, Sallen–Key): the three-case closed form on
  `Δ = (tr A/2)² − det A` — cosh/sinh, cos/sin, or linear — with `φ1` from the same
  case analysis and **no A⁻¹** (an LC with R = 0 is singular in the way that matters
  and must still work: Group G5 depends on it).
- **n ≥ 3**: eigendecomposition with balancing (`@ee-labs/systems` already owns
  this), still exact to floating point; used by the RC ladder and any op-amp circuit
  with two dynamic elements plus a rail model.

Inputs are the standard test signals, each handled exactly:

- **step / DC / switch at t = 0**: constant `u` per segment;
- **square**: a sequence of constant segments (clock edges known in advance);
- **ramp / triangle**: `u = u₀ + u₁ t` per segment → `φ2 = ∫φ1` in the same case
  analysis (equivalently: augment the state with `t`);
- **sinusoid**: the forced response is the **phasor solution**,
  `x_p(t) = Re{ (jωI − A)⁻¹ B U e^{jωt} }`, and the total is
  `x(t) = e^{At}(x₀ − x_p(0)) + x_p(t)`.

That last line is not an implementation detail; it is **the syllabus**. "Total =
natural + forced", "the transient dies and the steady state is a sinusoid at the same
frequency", "the phasor turns the ODE into algebra" — every one is a term in that
equation, and Groups E, F and G read it in that order.

**The classic switching problem** is first-class: *the switch has been closed a long
time and opens at t = 0.* The engine solves the pre-switch circuit at DC (C open, L
short) for `x(0⁻)`, applies continuity (`x(0⁺) = x(0⁻)` — capacitor voltage and
inductor current cannot jump), and propagates the post-switch circuit. The math panel
narrates those three steps because they *are* the textbook method.

### 1.6 Piecewise-linear elements and events (Power Lab's §1.3, born here)

Diodes and op-amp rails are piecewise-linear: within one *region* (diode on/off;
op-amp linear / at +rail / at −rail) the circuit is linear and §1.2–1.5 apply. Region
boundaries are **events** — a diode's current reaching zero while on, its voltage
reaching `V_f` while off, an op-amp output reaching a rail — found by **bisection on
the exact segment solution**. No timestep, no tolerance knob; the waveform is exact
and the tests can say `= 0`, not `≈ 0`.

For DC, region-finding is the textbook **assumed-state method**, shown as itself:
"Assume D₁ on. Solve. i_D₁ = −2.1 mA < 0: contradiction. Assume off. Solve.
v_D₁ = 0.31 V < 0.7 V: consistent." Two diodes → four cases, enumerated on screen.

**The exponential diode** (`i = I_s(e^{v/nV_T} − 1)`) is nonlinear, not piecewise. It
is supported for **DC operating points only**, by Newton–Raphson with SPICE's
voltage-step limiting, and the iterations are *displayed* (Group I2: "this is what a
simulator does"). In time-domain experiments the diode is one of the three
piecewise models, and the panel says so and says why — a timestep solver's error is
something this suite cannot tell apart from physics, so it does not ship one (Rule 2).
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
voltages and branch currents at a time cursor; per-element instantaneous power,
average power, energy stored (`½Cv²`, `½Li²`) and dissipated (`∫i²R dt`, closed form
per segment); RMS and mean by piecewise closed-form integrals; peak, time-to-percent,
zero crossings (for `ω_d`), successive peak ratios (for α); phasor magnitude and
angle; `P`, `Q`, `S`, power factor.

### 1.9 Invariants (the fuzzer's checklist)

Across random values on every library circuit:

1. **KCL residual** at every node = 0 (fp); **KVL** around every mesh = 0.
2. **Tellegen**: `Σ_k v_k i_k = 0` over all elements, using KCL + KVL only.
3. **Superposition**: response to (u₁ + u₂) = response to u₁ + response to u₂, for
   every linear circuit; and it *fails* for power, by the cross term `2 i₁ i₂ R`.
4. **Thevenin three ways**: `V_oc / I_sc`, "kill sources and look in", and the slope
   of a load sweep agree.
5. **Energy**: source energy = stored + dissipated, as an identity on the exact
   waveform; for the undamped LC, total energy constant.
6. **Continuity**: every state continuous across every switch and event; every
   non-state quantity allowed to jump.
7. **Limits agree**: `t → ∞` of the exact transient = the DC solve (stable circuits);
   long-time sinusoidal response = the phasor solve; `det(sI − A)` roots = the
   hand-written characteristic equation.
8. **Cross-lab**: for every circuit also in Circuit Lab's catalog, this lab's exact
   step response agrees with `simulate(transferOf(…))` — which is RK4, a genuinely
   different method — to within RK4's own error, which this pins for the first time.

---

## 2. Models — the element library

| Element | Ideal law | Non-ideality toggles (each labelled) |
| --- | --- | --- |
| Wire / node | `v` equal everywhere on it | — (wire resistance is a non-goal) |
| Resistor | `v = iR` | tolerance (±5%, the existing `tolerance.js` idiom) |
| Independent V source | `v = E(t)` | series `R_s` |
| Independent I source | `i = I(t)` | parallel `R_p` |
| Dependent sources | VCVS, VCCS (CCVS/CCCS via a sensing 0 V source) | — |
| Switch | ideal make/break at `t = 0` or on a clock | `R_on`, `R_off` (finite ⇒ the spark in F6) |
| Capacitor | `i = C dv/dt`, `q = Cv`, `w = ½Cv²` | ESR (series R); initial voltage `v(0)` |
| Inductor | `v = L di/dt`, `w = ½Li²` | winding R (series); initial current `i(0)` |
| Op-amp | nullor: `v₊ = v₋`, `i₊ = i₋ = 0`, output does what it must | finite `A` (10 … 10⁶); rails `±V_sat`; (stretch) GBW as `A(s) = ω_t/s` — admissible in `systems`, labelled as a model |
| Diode | ideal switch | constant drop `V_f`; PWL `V_f + r_d`; exponential `I_s, n` (DC only, §1.6); Zener `V_z` (stretch) |

Sources: DC, step, square, triangle, sine (amplitude, frequency, phase, offset), and
"switched at t = 0" — all exact under §1.5.

**Schematic description.** Each library circuit is a netlist whose elements carry a
grid position and orientation; a shared renderer (`packages/ui/Schematic.jsx`)
draws symbols, wires, node dots, and the live meters. Power Lab's conduction scrub
needs the same renderer, which is another reason to build it here. Circuit Lab's
hand-drawn `schematics.jsx` stays as it is.

---

## 3. The app

### 3.1 Layout

Sidebar: LabNav ("Elements" — the short form — added, visibility one-way while dark — §7), report link,
experiment groups (folding), circuit picker within the group, component NumFields with
engineering units and chips, source controls, non-ideality toggles, math panel. Main:
topbar meters + the **schematic** always visible + one pane below it with a pane
selector. Reed reviews on a phone: the schematic and one pane must fit 390 px wide
without horizontal scroll (harness-checked, as Control Lab does).

Topbar: the circuit's headline numbers for the current experiment — e.g. `V_th`,
`R_th`; `τ`; `α, ω₀, ζ`; `|Z|, ∠Z`; `P, pf`; operating point `(V_D, I_D)`.

### 3.2 Views

- **Schematic with live meters** — the lab's signature. Every node voltage and
  branch current shown on the drawing, current arrows scaled and animated (dot flow,
  direction honest), element power on hover. Click a node to make it ground (A3).
  Click a switch to throw it. When a time pane has a cursor, the meters show the
  values **at the cursor** — the circuit at time t — which is the conduction-scrub
  idea Power Lab inherits.
- **Equations** — the generated KCL (or KVL for mesh) equations with live values,
  the matrix, the solution; hover links each equation to its node on the schematic.
  For dynamic circuits: the state equations, `det(sI − A)`, the roots. Progressive
  disclosure: one equation per row, expanded on demand — never a wall.

  *Entry-level review (2026-09-01).* The lower pane is headed **Analysis** (was
  "Underneath"), and the view buttons follow one canonical order (`VIEW_ORDER`:
  equations first, then power) so no experiment shows power before the equations.
  Groups A and B open the Equations view with a **primer** — KCL, KVL and Ohm's law in
  plain words — so "KCL at in" is never a name without a meaning; A1–A4 list the
  `kcl`/`kvl` terms and the suite checks Group A defines KCL where its equations first
  use it. The pane then runs in three numbered steps: (1) the rows, each term with its
  signed live value and the row's sum; (2) the same rows as a **labelled matrix grid**
  — rows named "KCL at A" / "V1 holds", columns the unknowns, every cell in letters
  (`1/R₁ + 1/R₂`, `−1/R₁`, `E₁`) with its number beneath — followed by the compact
  matrix in letters alone (`symbolicSystem` in `@ee-labs/network`, checked cell by
  cell against the numeric `M`/`r` for all 46 experiments at defaults and random
  settings) and in numbers; (3) a **legend** tying every letter to a part and its
  present value. Substituted elements keep their identity: a capacitor's row shows
  `v_C1`, an inductor's `i_L1`, a switch `R_S1`, an op-amp `A_U1`. The **Power** view is
  a ledger (v, i, p = v × i, "which means it delivers/absorbs") over two equal-length
  bars, delivered against absorbed, with the Tellegen sentence. On the **schematic**,
  the voltage meter mode draws both **+ and −** at every two-terminal element (the −
  was missing), and labels and node names are typeset in the KaTeX faces the equations
  use — `R₁ 1 kΩ` on the drawing is the `R₁` in the matrix — with the layout checker
  extended to the sign marks and its label-width estimate measured in a browser.
- **Scope** — states and chosen branch quantities vs t, scrubbable cursor, natural
  and forced components separable as ghost traces (H1), τ-tangent and 63% marker
  (F3), envelope `±e^{−αt}` (G4). Dual y-axis (V / A). Caption band above the plot,
  from Signal Lab.
- **Phasor diagram** — phasors as arrows, tip-to-tail sum, rotating with the time
  cursor; the projection onto the vertical axis is drawn out to the right *as the
  waveform*. The picture that makes phasors click, animated rather than described.
- **i–v plane** — the diode curve (all four models overlaid on request), the load
  line, the operating point; Newton's iterations drawn as the tangent-chasing they
  are.
- **Energy** — stacked `½Cv²`, `½Li²`, `∫i²R` against energy supplied; the identity
  visible as a bar that always closes.
- **Sweep** — one parameter across a range with a marked operating point: `P_L` vs
  `R_L` (D6), `|Z|` vs ω (H4), response vs R across the three damping regimes (G2–4).

### 3.3 Numbers (defaults that make the lessons visible)

Round numbers that land time constants in milliseconds and resonances in the low kHz,
so a phone-width scope shows the shape:

- Resistive: 12 V source, 1 kΩ / 2 kΩ / 3 kΩ, so node voltages are readable and
  currents are milliamps.
- RC: R = 1 kΩ, C = 1 µF → τ = 1 ms, corner 159 Hz. RL: R = 1 kΩ, L = 1 H → τ = 1 ms
  (a big inductor, said so; or 100 Ω / 100 mH).
- Series RLC: L = 10 mH, C = 1 µF → ω₀ = 10⁴ rad/s, f₀ = 1.59 kHz, `R_crit =
  2√(L/C) = 200 Ω`. Chips: 50 Ω (ζ = 0.25, rings), 200 Ω (critical), 800 Ω (ζ = 2,
  overdamped), 0 Ω (undamped).
- Op-amp: `A = 10⁵`, rails ±12 V, `R_f = 10 kΩ`, `R_g = R_in = 1 kΩ` (gain 11 / −10).
- Diode: `I_s = 1 nA`, `n = 1`, `V_T = 25.85 mV` (300 K), `V_f = 0.7 V`; rectifiers
  at 60 Hz, `V_p = 10 V`; LED at 2.0 V, 20 mA.

---

## 4. Curriculum — 53 experiments in 9 groups (+2 stretch)

Format: **the claim** the note makes → what the reader turns → what is **measured**
against what **formula**. Every quoted number becomes a pinned test. Order follows a
standard first course (elements and signs → laws → networks → systematic methods →
op-amp → C and L → second order → phasors → diode); the op-amp sits before the
capacitor because it needs only resistive analysis and pays off superposition and
Thevenin immediately.

Groups A–E are built (Phase 1, dark). Their entries below describe what shipped; the
experiment ids are the ones the topbar shows (`A1 · A voltage source holds its
voltage`). Groups F–I are the plan.

### Group A — Elements and signs (4) · built

Added after the first review: the lab opened on a three-resistor circuit and the
reviewer wanted it to open on *one element*, with the sign convention stated before a
single loop is walked.

- **A1 · A voltage source holds its voltage.** One source, one resistor. The source
  decides the voltage, the resistor decides the current: `i = E/R`. Turn R down and
  the current climbs while E does not move; the whole top rail is one node and reads
  E everywhere. Measured: `v_R = E`, `i = E/R`, the source current `−i` (it leaves
  the + terminal), `p_R = E²/R`; E unchanged at R = 10 Ω.
- **A2 · A current source holds its current.** The dual: `i_R = I`, `v = I·R`. Push R
  to a megohm and 5 mA needs 5 kV; an ideal current source into an open circuit has
  no solution, and the solver refuses it (`current-cutset`). Measured: `i_R = I` at
  1 kΩ and 1 MΩ, `v = 5 kV` at 1 MΩ, the refusal code for a source with no path.
- **A3 · Voltage is a difference; ground is a choice.** A divider built on top of a
  source `V_ref` instead of on ground. Slide `V_ref`: every node voltage moves by
  exactly that amount; every element voltage, current and power stays put; `V_ref`
  carries no current. Measured: node shifts equal `V_ref` to fp at three lifts;
  element quantities invariant; `i_{V_ref} = 0`.
- **A4 · Which way is +: the passive sign convention.** `v = v₊ − v₋`, `i` measured
  into the + terminal, `p = v·i`. Two sources and one resistor: with `E₁ > E₂` the
  resistor's v and i are both positive; slide `E₂` above `E₁` and both flip together
  while `p_R` stays positive and the pushing source's power comes out negative. A
  negative reading is the answer with its direction attached. Measured: the sign
  flips, `p_R ≥ 0` both ways, the sign of each source's power.

### Group B — Two laws (4) · built

- **B1 · Current in equals current out.** KCL at node A: `i_{R₁} = i_{R₂} + i_{R₃}`
  however the three are set; make `R₂` tiny and it takes almost everything, but the
  sum never moves. Measured: the equality to fp; the KCL residual at A.
- **B2 · Voltages around a loop add to zero.** KVL: the source lifts by E and the
  resistors drop it all again, in proportion. Measured: `v_{R₁} + v_{R₂} = E`;
  `v_{R₂}/v_{R₁} = R₂/R₁`.
- **B3 · Power, and the sign of it.** Resistors positive, source negative, total
  exactly zero — **Tellegen**, from KVL and KCL alone. Measured: signs; `Σp = 0` to
  fp (and re-checked on every experiment in the lab, including the dependent-source
  ones, by the suite).
- **B4 · Two sources, one loop.** `i = (E₁ − E₂)/R` flows into the weaker source,
  which absorbs; raise `E₂` past `E₁` and it reverses. Measured: the current; which
  source's power is negative, before and after the flip.

### Group C — Series and parallel (4) · built

- **C1 · Series: one current, shared voltage.** `V_k = E · R_k / ΣR`; a resistor ten
  times the others takes ten times the voltage. Measured: the ratio; the shares sum to E.
- **C2 · Parallel: one voltage, shared current.** `1/R_eq = Σ 1/R_k`; the equivalent
  is below the smallest branch and the smallest resistor takes the biggest share.
  Measured: `R_eq` vs `1/ΣG`; the ordering of the shares.
- **C3 · The loaded divider.** `V_out = E · (R₂‖R_L)/(R₁ + R₂‖R_L)`; the droop is
  small only while `R_L ≫ R₂`. Measured: the drop vs the formula; `R_L → ∞` recovers
  the unloaded value. The number that motivates Thevenin (D5) and the buffer (E8).
- **C4 · The Wheatstone bridge.** No two resistors in series or parallel. Balanced
  when `R₁/R₂ = R₃/R₄` whatever the supply; 1 % of `R₄` moves the bridge by about
  `E/4 × 1 %`. Measured: zero at balance; the small-signal sensitivity.

### Group D — Analysis and theorems (6) · built

- **D1 · Nodal analysis: one equation per node.** `N − 1` KCL equations generated live
  (§1.2), assembled, solved. Measured: KCL at every node; the one-unknown hand form
  `V_A = (E/R₁)/(1/R₁ + 1/R₂ + 1/R₃)`.
- **D2 · A source between two nodes: the supernode.** The textbook supernode and the
  MNA extra unknown are the same move; the printed system has the unknown count the
  topbar claims. Measured: equal solutions; the source current recovered.
- **D3 · Mesh analysis: one equation per loop.** KVL around the meshes; the hand 2×2
  matches nodal exactly. Measured: element currents identical from both methods;
  `E₂` above `E₁R₂/(R₁+R₂)` reverses `i₂`.
- **D4 · Superposition: one source at a time.** Voltages and currents superpose to the
  last digit; power does not, by `2·i₁·i₂·R`. Measured: both.
- **D5 · Thévenin, three ways.** (i) `V_oc/I_sc`; (ii) kill the sources and look in;
  (iii) sweep `R_L` and fit the terminal line. Measured: all three `R_th` agree with
  `R₁‖R₂‖R₃`; the load line's intercepts are `V_oc` and `I_sc`.
- **D6 · Maximum power transfer.** `P_L` peaks at `R_L = R_s` with 50 % efficiency;
  efficiency climbs past it while power falls. Measured: argmax, peak, η.

### Group E — Op-amps (8 + 1 stretch) · built

- **E1 · A dependent source.** A VCVS in a resistive network: `v_out = A·v_in`
  whatever the load; the dependent source delivers more than the input source works.
  Measured: both; Tellegen still holds (B3's promise).
- **E2 · The op-amp as a black box.** Added after the first review. A dashed frame
  around `R_in`, a VCVS of gain A and `R_out` — the package, with the transistors and
  supply pins left out on purpose. The IDEAL op-amp: `A = ∞`, `R_in = ∞`, `R_out = 0`,
  no offset, no speed limit; a real one: `A ≈ 10⁵`, `R_in` 1 MΩ–10¹² Ω, `R_out` tens
  of ohms. The input divider `R_in/(R_s + R_in)` and the output divider
  `R_out/(R_out + R_L)` each cost a little; the ideal recovers at the limits. The
  payoff over passive circuits: far more power into the load than the source supplies.
  Measured: `v_p`, `v_out` vs the two dividers; `A·E` recovered within 1 % at the
  knob limits; `p_{R_L} > 1000 × p_{source}`; and the passive bound — every
  single-source resistive experiment in the lab has `|v_node| ≤ E` and load power
  ≤ source power.
- **E3 · Comparator: an op-amp with no feedback.** The ideal model *refuses* (§1.3,
  `opamp-open-loop`) — no feedback path, no solution; finite gain lifts it: 1 mV in,
  100 V out at `A = 10⁵`. Measured: the refusal code and message; the finite-A output.
- **E4 · The golden rules, derived.** Non-inverting: `v_out = GE/(1 + G/A)`,
  `G = 1 + R_f/R_g`; the input difference is `v_out/A` and the gain converges on G as
  A grows. Measured: at each A.
- **E5 · Inverting amplifier and the virtual ground.** The inverting input sits at
  0 V without being grounded; `v_out = −(R_f/R_g)E`; the source sees `R_g`; the load
  current is the op-amp's. Measured: all four.
- **E6 · The summing amplifier.** `v_out = −R_f(E₁/R₁ + E₂/R₂)`; each input current is
  set by its own resistor alone — D4 in copper. Measured.
- **E7 · The difference amplifier.** Matched: `(R₂/R₁)(E₂ − E₁)`, common mode
  rejected; 1 % mismatch leaks about 1 % of the differential gain. Measured: CMRR
  against the mismatch formula.
- **E8 · The buffer fixes the loaded divider.** A unity-gain follower between C3's
  divider and its load: the output is the *unloaded* divider voltage whatever `R_L`,
  and the sweep is flat. Measured.
- **E9 · Positive feedback: the Schmitt trigger** *(stretch, needs §1.6).* Feed the
  output back to the *non-inverting* input: hysteresis with thresholds
  `±V_sat · R₁/(R₁ + R₂)`; a noisy input crosses cleanly once. Control Lab's "latches
  to a rail", built. Measured: both thresholds; one transition per crossing.
### Group F — Elements that remember, and the first-order equation (7) · built

- **F1 · The capacitor: current only when the voltage changes.** `i = C dv/dt`.
  Drive with a triangle: the current is a square wave, amplitude `C · slope`. Drive
  with DC: zero current — an open circuit at DC. `q = Cv`, `w = ½Cv²`. Measured:
  `i(t)` vs `C dv/dt` on the exact waveform (a ramp input is exact under §1.5).
- **F2 · The inductor: the dual.** `v = L di/dt`; a triangle of current makes a
  square of voltage; a short circuit at DC; `w = ½Li²`. Measured likewise. The panel
  states the duality table (v↔i, C↔L, series↔parallel) once, and Group G cashes it.
- **F3 · Charging an RC: the equation, solved.** KVL: `RC dv/dt + v = V_s`. The panel
  separates and integrates, step by step, to `v(t) = V_s + (v₀ − V_s) e^{−t/τ}`,
  `τ = RC`. On the scope: 63.2% at τ (`1 − e⁻¹`), 99.3% at 5τ, and the initial
  tangent `V_s/τ` drawn — it meets `V_s` at exactly `t = τ`. Measured: all three
  numbers; and that `v_C` is continuous at the switch while `i_C` jumps.
- **F4 · Every first-order circuit is three numbers.**
  `x(t) = x(∞) + [x(0⁺) − x(∞)] e^{−t/τ}`. `x(0⁺)` from continuity; `x(∞)` from a DC
  solve (C open, L short); `τ = R_th · C` or `L / R_th` — **the Thevenin resistance
  seen by the element**, which D5 already knows how to find. Demonstrated on a
  circuit where `R_th` is no single resistor. Measured: the recipe vs the exact
  solution, on RC, RL, and a divider-fed RC.
- **F5 · Charging a capacitor from a source wastes exactly half — whatever R is.**
  Source energy `∫V_s i dt = CV_s²`; stored `½CV_s²`; dissipated `½CV_s²`,
  **independent of R** — R only sets how fast. The energy view shows the bar closing
  at every R. Measured: the three energies at R = 100 Ω, 1 kΩ, 10 kΩ.
- **F6 · The interrupted inductor: where sparks come from.** A steady 12 mA in
  1 H; open the switch. Ideal: `di/dt → −∞`, `v → −∞`, no solution. Toggle a finite
  `R_off = 1 MΩ`: the inductor forces its 12 mA through it — a 12 kV spike, decaying
  with `τ = L/R_off = 1 µs`. Measured: `V_spike = I₀ · R_off`, `τ`. The note points
  forward: the flyback diode that Power Lab's every converter relies on is the cure.
- **F7 · The integrator, in time.** Op-amp integrator, square in: `v_out = −(1/RC)∫v_in
  dt`, a triangle out with slope `V/RC`. Measured: slope; and the cross-lab pin —
  Circuit Lab shows this exact object as `−1/sRC` and its step response as a ramp.
  Toggle finite A: the ramp bends into an exponential toward `−A·V` — the integrator
  is a first-order low-pass with a very long τ, `τ = (A+1)RC`. Measured.

### Group G — Second order: one equation, three faces (7) · built

- **G1 · The equation.** Series RLC, KVL, differentiated once:
  `L d²i/dt² + R di/dt + i/C = dv_s/dt`; or for the capacitor voltage,
  `LC v'' + RC v' + v = v_s`. Try `v = e^{st}`: the **characteristic equation**
  `s² + (R/L) s + 1/LC = 0`, `α = R/2L`, `ω₀ = 1/√LC`, `ζ = α/ω₀ = (R/2)√(C/L)`.
  Measured: roots of `det(sI − A)` from the engine vs the formula's roots; `α`, `ω₀`
  from the values. (Circuit Lab's `(f₀, Q)` are the same numbers, `Q = 1/2ζ` — pinned.)
- **G2 · Overdamped (α > ω₀): two exponentials, no overshoot.**
  `s₁,₂ = −α ± √(α² − ω₀²)`, both real; `v = A₁e^{s₁t} + A₂e^{s₂t}` with the
  coefficients from `v(0)` and `i(0)`. R = 800 Ω. Measured: the two rates; zero
  overshoot; the slow root dominating the tail.
- **G3 · Critical (α = ω₀): the knife-edge.** `R_crit = 2√(L/C) = 200 Ω`;
  `v = (A + Bt) e^{−αt}` — the fastest settling that never crosses. Nudge R by 1 Ω
  either side and the form changes. Measured: the double root; `R_crit`; settling
  time minimum in a sweep of R (the sweep view). The note: a set of measure zero
  that you *aim at* and never land on.
- **G4 · Underdamped (α < ω₀): a ring at a frequency lower than ω₀.**
  `v = e^{−αt}(A cos ω_d t + B sin ω_d t)`, `ω_d = √(ω₀² − α²)` — damping *slows*
  the ring. Envelope `e^{−αt}` drawn. R = 50 Ω: ζ = 0.25, `Q = 1/2ζ = 2`, overshoot
  `e^{−πζ/√(1−ζ²)} = 44.4%`, each cycle's peak `e^{−2πζ/√(1−ζ²)} = 0.20` of the last —
  so roughly `Q` cycles are visible, the rule of thumb stated and then measured.
  Measured from the waveform alone — `ω_d`
  from zero crossings, α from the log-decrement of successive peaks, overshoot from
  the first peak — against the formulas. Cross-lab: Circuit Lab's "Resonance, seen
  in time" is the same step by RK4; they must agree.
- **G5 · Undamped (R = 0): energy sloshing.** Pure oscillation at ω₀;
  `½Cv² + ½Li²` constant, trading back and forth twice per cycle. The energy view
  shows two lobes and a flat total. Measured: total energy constant to fp (this is
  the singular-A case §1.5 promised to handle); period `2π√LC`.
- **G6 · Two states, two initial conditions — the shape is the circuit's, the size
  is the history's.** Same RLC, three different `(v_C(0), i_L(0))`: identical `α`,
  `ω_d`, different amplitudes and phases. Measured: extracted `α, ω_d` equal across
  runs; coefficients `A, B` vs the closed form from the initial conditions.
- **G7 · The parallel RLC: the dual, with R inverted.** `α = 1/2RC`: *more*
  resistance rings *longer* — the opposite of series, for the reason F2's table
  gave. Measured: α vs formula; the critical `R = ½√(L/C)`. Circuit Lab's "The same
  R, the opposite effect" is this claim in frequency; the two are cross-linked.

### Group H — Sinusoids and phasors (6) · built

Every H circuit has the phasor view (arrows turning with the cursor beside the
waveforms their tips draw, tip-to-tail sum closing on `V_s`), the scope with the
steady state as the dashed ghost, and a hand-over to Circuit Lab (H1–H6 all map:
RC → `rcLow`, RL → `rlLow`, series RLC → `rlcSeries`; an L above Circuit Lab's 1 H
knob is declined with the reason, never clamped into a different circuit).

- **H1 · Switching on a sine: natural dies, forced stays.** RC, 5 V at 159.2 Hz.
  `v_C = forced + natural`, the natural part `−v_f(0)·e^(−t/τ)` existing only because
  the forced sinusoid would not have started from zero. Measured: `tr − ghost` equals
  `−v_f(0)e^(−t/τ)` at five instants; under 1 % of |V_C| after 5τ and under 10⁻⁹ after
  25τ; the source phase sets the natural part's size (φ = 135° largest, 45° none) but
  not its shape.
- **H2 · Phasors: the arrow that draws the wave.** Each steady-state quantity as
  `amp∠φ`, `x(t) = Im{X e^{jωt}}`. Measured: `V_R + V_C = V_s` to fp; `V_C` 90° behind
  `I` with `|V_C| = |I|/ωC`; at the exact corner `1/(2πRC)` both arrows `|V_s|/√2` and
  `v_C` lags exactly 45° (and the chip's 159.2 Hz to four figures).
- **H3 · Impedance: series RLC.** `Z = R + j(ωL − 1/ωC)` at 1 kHz: `ωL = 62.8 Ω`,
  `1/ωC = 159.2 Ω`, `X = −96.3 Ω`, `|Z| = 138.8 Ω`, current leads 43.9°, `|V_C| = 1.146 V`
  from a 1 V source. Impedance view: `|Z|` and `∠Z` over four decades with the drive
  marked. Measured: every number; past 1591.5 Hz the current lags and `V_L` outgrows
  `V_C`.
- **H4 · Resonance.** R = 5 Ω, Q = 20, `f₀ = 1591.5 Hz`. Measured: `V_L + V_C = 0` and
  `Z = R` at ω₀ (fresh complex solve, `anyFreq`); `|V_C| = 20 V`; half-power points
  `|Z| = √2·R` exactly 79.6 Hz apart; the build-up envelope `1 − e^(−αt)` reaching
  `1 − 1/e` at `Q/π = 6.4` cycles and within ¼ % (not ⅕ %) in the 40th cycle.
- **H5 · AC power: real, reactive, apparent.** RL 100 Ω / 0.3 H from 10 V peak at
  50 Hz; `S = ½V·I*` per element in the AC-power table with Tellegen's row (ΣP = ΣQ = 0).
  Measured: `|I| = 72.8 mA` lagging 43.3°; `P = 265 mW` all in R, `P_L` exactly 0
  (arithmetic noise below 10⁻¹²|S| read as 0); RMS 7.07 V / 51.5 mA; 364 mVA, pf 0.728,
  Q = 250 mvar; `p(t)` on the ghost has DC and 2f only — harmonics 1, 3, 4 below 10⁻⁹.
- **H6 · Frequency response: one sine at a time, then all of them.** RC,
  `H = 1/(1 + jωRC)` swept two decades either side of `f_c`: the Bode view, |H| in dB
  and ∠H, the drive marked from the same solve the meters use. Measured: −3.01 dB and
  −45° at `f_c`; −20 dB/decade (−19.96 for the first decade above, −19.9996 the next);
  −89.4° at 100 f_c; all 241 sweep points equal the closed form to 10⁻¹². The
  hand-over — **Open in Circuit Lab** — is exact and tested both ways (§8 Phase 3).

### Group I — The diode: the first nonlinear element (7 + 1 stretch)

- **I1 · The curve, and four ways to approximate it.** Shockley:
  `i = I_s (e^{v/nV_T} − 1)`, `V_T = kT/q = 25.85 mV`. Overlaid: the ideal switch,
  the constant drop, the PWL `V_f + r_d`, the exponential — each an approximation of
  the next, with its error stated at the operating point. Measured: PWL slope
  `r_d = nV_T/I` equals the exponential's derivative there; a 60 mV/decade rule
  (`nV_T ln 10`) checked.
- **I2 · The load line, and how a simulator finds the point.** Source, resistor,
  diode (or an LED at 2.0 V / 20 mA — the most-built circuit in the world, with its
  `R = (V_s − V_f)/I`). Graphically: the line `i = (V_s − v)/R` meets the curve.
  Numerically: Newton–Raphson on the residual, iterations drawn on the i–v plane,
  quadratic convergence in ~5 steps. Measured: KVL residual < 1e−12; the
  constant-drop answer's error vs the exponential (0.70 V vs the true 0.68 V at this
  current).
- **I3 · Assume, solve, check.** Two diodes, constant-drop model: four assumed
  states, each solved as a linear circuit, three rejected by their own contradiction
  (`i_D < 0` while "on", `v_D > V_f` while "off"). Measured: exactly one consistent
  state; it matches the exponential solve to within the model's stated error.
- **I4 · Half-wave rectifier.** Sine in, positive half out. Ideal: mean `V_p/π`, RMS
  `V_p/2`. Constant-drop: peaks at `V_p − V_f`, conducts for `π − 2 asin(V_f/V_p)` of
  each cycle. Measured on the exact event-based waveform (§1.6): mean, RMS,
  conduction angle.
- **I5 · Full-wave bridge.** `|sin|`: mean `2V_p/π`, RMS `V_p/√2`, two drops, and the
  ripple frequency **doubles** — the spectrum's first line moves from `f` to `2f`.
  Measured: all four; hand-over of the waveform to Signal Lab's spectrum.
- **I6 · Smoothing: the peak rectifier, exactly and approximately.** Add C: the
  capacitor charges to the peak and decays through R until the next peak catches it.
  The textbook approximation `ΔV ≈ V_p/(fRC)` (half-wave) sits beside the exact
  event-based answer with its error shown, shrinking as RC grows (Rule 3: the
  approximation carries its guard). Measured: exact ripple; approximation error vs
  RC; conduction angle narrowing. This is Power Lab's rectifier group in embryo, and
  the proof that the event machinery works.
- **I7 · Clipper and clamper.** Diode + reference clips at `±(V_ref + V_f)`; diode +
  capacitor shifts the DC level so the waveform's peak sits at `−V_f`. Measured:
  clip levels; the clamped waveform's peak and mean.
- **I8 · The Zener regulator** *(stretch).* Reverse breakdown as a voltage reference:
  `V_out = V_z` while `I_z > 0`; increase the load until the Zener starves and
  regulation is lost at `R_L = V_z R_s / (V_s − V_z)`. Measured: regulated band;
  the drop-out load.

---

## 5. Hand-overs

- **→ Circuit Lab** (H6): "Open this circuit in Circuit Lab" for every topology in its
  catalog (RC low/high, RL, series/parallel RLC, inverting amp, integrator) — an exact
  mapping, presented without hedge (CORE_SCOPE counter-rule). Component values ride
  the existing link grammar; the reverse link ("see this in time, from the ODE") is
  offered from Circuit Lab's math panel for the same set. The deep-link grammar
  itself is owned elsewhere; this lab consumes it.
- **→ Signal Lab** (H5, I5): the rectified or `p(t)` waveform's spectrum, for the
  "2ω" and "2f" claims to be seen on a real FFT.
- **→ Control Lab**: not directly; the RC/RLC plants already reach it through Circuit
  Lab, and this lab does not duplicate that path.
- **→ Power Lab** (future): F6's spark → the freewheel diode; I6 → Power Lab's Group E rectifiers;
  and the engine (§1.5–1.6) itself, imported.

---

## 6. Testing discipline

- **Unit** (`packages/network`): stamps against hand-assembled matrices; LU against
  known solutions; the equation printer against expected strings; state-space
  extraction against hand `(A, B)` for RC, RL, series and parallel RLC; the 2×2
  propagator against series `expm` at random matrices *and* against the scalar
  formulas; events against analytic crossing times; Newton against a bracketing
  solver; every refusal message in §1.3.
- **Invariants** (§1.9), fuzzed across the library.
- **Experiments**: every quoted number in §4 pinned, the way `presets.test.js` pins
  Signal Lab — 63.2%, 44.4%, `R_crit = 200 Ω`, `V_p/π`, 50%, `π − 2 asin(V_f/V_p)`…
- **Cross-lab pins**: exact step vs Circuit Lab's RK4 for the shared catalog; this
  lab's `(α, ω₀)` vs Circuit Lab's `(f₀, Q)`; the integrator's ramp slope vs
  `−1/sRC`. These are the first tests in the suite that check RK4 against a closed
  form, and they may well tighten its `sub`-stepping.
- **Playwright harness** (`apps/circuit-elements-lab/scripts/verify.mjs`): schematic meters
  match the solver; the equations view lights the right node; the phasor diagram's
  vector sum closes on canvas; the time cursor drives the meters; no horizontal
  scroll at 390 px; caption band clear of the trace (the verify-the-claim rule:
  probe the complaint, not a proxy).
- **REVIEW_PLAYBOOK audit** before release, all eleven classes, plus a screenshot
  pass.

---

## 7. Integration — and the dark launch

Identical to Power Lab's §7, so the two labs share one mechanism:

- Deployed **dark** at `/circuit-elements-lab/` from the first vertical slice (Phase 1). Reed
  and the harnesses test the real deployment. Unlisted, not secret.
- `apps/circuit-elements-lab/RELEASE_STATUS` reads `dark`. A test asserts that while it does,
  the splash, root README, and the other labs' LabNav contain **no** reference to
  Circuit Elements Lab; Circuit Elements Lab's own nav may link outward. Flip the word to `released`
  and the same test inverts: it demands the splash card (first position, "Start
  here" kicker — Decision 2), the README row, and the nav entries.
- The flip is **Reed's action**, after the Phase 6 gate.

On acceptance of this plan, `POWER_LAB_PLAN.md` §1.2–1.3 get a one-line amendment:
the propagator and event bisection live in `packages/network`, built by Circuit Elements Lab;
`packages/switched` imports them and adds the switch-state machine, periodic steady
state, and averaging.

---

## 8. Phasing (each phase ships green and deployable-dark)

1. **Phase 1 — Resistive.** `packages/network`: netlist, MNA stamps for R/V/I/
   dependent sources/ideal op-amp, LU, residual, equation printer, Thevenin three
   ways, refusals. `packages/ui/Schematic.jsx` renderer with live meters. App shell,
   dark deploy, `RELEASE_STATUS` test. **Groups A–E (E1–E8).** Exit: KCL/KVL/Tellegen/
   superposition invariants fuzzed green; all Group A–E numbers pinned. *Shipped
   dark 2026-08-30; Groups A and E2 added on review 2026-09-01.*
2. **Phase 2 — Dynamics.** State-space extraction, exact propagator (n = 1, 2, ≥ 3),
   step/square/ramp/sine inputs, switch-at-t = 0 with continuity, energy measures.
   Scope, energy and sweep views. **Groups F and G** — RC, RL and RLC with the
   differential equations written out, initial conditions, and the three damping
   faces. Exit: energy and continuity
   invariants; cross-lab pins against Circuit Lab's RK4 green. *Shipped dark
   2026-09-01: `dynamics`/`transient`/`energies` in `packages/network`, scope,
   energy, state-equation and damping-sweep views, F1–F7 and G1–G7, every note
   sentence measured in `experiments.test.js`.*
3. **Phase 3 — Phasors.** Complex MNA, phasor diagram view, long-time-limit
   agreement, AC power measures, hand-over to Circuit Lab. **Group H.** Exit:
   phasor-vs-time invariant; H6 hand-over exact and tested both ways. *Shipped dark
   2026-09-01: `complex`/`solveAC`/`readoutAC`/`acPower`/`drivingPointZ`/`sweepAC` in
   `packages/network`, the steady-state ghost in `transient`, phasor, impedance,
   Bode and AC-power views, H1–H6; the hand-over is `circuitLink.js` in
   `packages/ui` (one grammar, both ends) and `incoming.js` in Circuit Lab, which
   clamps-and-warns rather than loading a different circuit silently. The
   phasor-vs-time invariant is measured at 64 instants for every H circuit at the
   defaults and two random settings; the hand-over "there" (Circuit Lab's transfer
   function equals this lab's H at all 241 sweep points, 1e-9) and "back" (the link
   round-trips with values identical and no warning) both pass.*
4. **Phase 4 — Piecewise-linear.** Regions, events by bisection, assumed-state DC,
   Newton for the exponential diode (DC only, with the refusal in time), rails on the
   op-amp, i–v plane view. **Group I, E9.** Exit: I6's exact-vs-approximate; event
   continuity invariant.
5. **Phase 5 — Polish.** Stretch items (I8, GBW toggle) if cheap; mobile pass; the
   equations view's progressive disclosure tuned on a phone.
6. **Phase 6 — Release gate.** REVIEW_PLAYBOOK audit, screenshot pass, Reed's
   hands-on review, then Reed flips `RELEASE_STATUS`. Splash card goes first.
7. **Then Power Lab Phase 1**, starting from `packages/network`.

---

## 9. Non-goals (v1, stated so they are decisions rather than omissions)

- **A free-form schematic editor.** Curated circuits with editable values, as every
  other lab. The day a circuit is wanted that the library cannot express is the day
  an editor earns its keep — and it will be a large day.
- **Transistors** (BJT, MOSFET). That is the next lab — Electronics — and it reuses
  this engine (DC Newton for the bias point, then small-signal LTI) plus one more
  nonlinear element type. Not here.
- **The exponential diode in the time domain** (§1.6). Refused with the reason.
- **Coupled inductors / transformers** — Power Lab's Group D.
- **Three-phase, wire resistance, noise, temperature.**
- **Op-amp slew rate, offset, bias current.** Finite gain, rails and (stretch) GBW
  are the non-idealities that change the lessons; the rest are datasheet facts.
- **Laplace transforms as a topic.** The characteristic equation is reached by trying
  `e^{st}`, which is all a first course needs; the transform proper is Circuit Lab's
  and Control Lab's currency, and H6 is the door to it.

---

## 10. Risks, named

- **Two labs with "circuit" in their nature.** Readers may open the wrong one first.
  Mitigations: Decision 2's "Start here", H6's hand-over as the visible seam,
  cross-links in both directions, and the card texts stating the boundary in one
  line each.
- **The equations view as a wall of text.** MNA on a six-node circuit is six rows of
  fractions. Mitigation: one equation per row, expanded on tap, each lit on the
  schematic; the matrix form behind a fold. Checked on a phone before release.
- **Solver and printer are one path.** Both come from the stamps, so a stamp bug
  prints a wrong equation *and* solves it consistently. Mitigation: every experiment
  carries a hand closed form as the independent path (§1.1), and the residual check
  recomputes currents from element laws rather than from the matrix.
- **Degenerate topologies in the library.** Source loops, C loops, no-feedback
  op-amps. Mitigation: refusals are features with tested messages (§1.3), and the
  library is fuzzed for rank before any values are touched.
- **Scope creep toward SPICE.** The engine will be able to do more than the lessons
  need. Mitigation: `§9` and CORE_SCOPE; a new element type needs a new experiment
  that needs it, not the other way round.
- **The event solver's edge cases** (grazing events, simultaneous events, chattering
  at a rail). Mitigation: bisection on exact segments has no stiffness problem; cap
  events per render and say so, as Power Lab's plan already requires; fuzz the
  rectifier and Schmitt circuits specifically.
- **Cost.** Eight groups, forty-nine experiments, a new package and a shared
  renderer: this is the suite's largest lab. Phasing keeps every phase shippable dark
  and each phase's engine work pays into Power Lab; but the plan is honest that Phase
  2 (exact dynamics) is where the hard engine work lives, and it should not be
  hurried.
