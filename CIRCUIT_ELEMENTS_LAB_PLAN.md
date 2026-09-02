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

  *Framed schematics (2026-09-01).* Every layout is drawn on the same 420 × 180 canvas
  so the placement rules can be shared, but the pane used to show the whole canvas at
  up to 720 px — half the screen for a one-element circuit ("taking up too much real
  estate"). Each experiment now carries a `layout.crop`: the padded box around
  everything it draws in any meter view, computed once with every reading and every
  number in a label at its widest plausible text (`−1.23 mV`, a switch always "closes")
  so the frame never moves when a knob turns; the layout test checks at random settings
  that nothing leaves it. The Schematic shows the crop as its viewBox and publishes
  its width and aspect ratio as CSS variables, and the pane sizes the frame at **one
  scale** (1.71 px per unit, 2 px above 1400 px wide) within a height budget of 30 vh —
  a one-element circuit gets a small frame and a six-element one a wide frame, with
  the same size resistor in each. On desktop the schematic pane takes only its own
  height (≤ 60 vh) and the Analysis pane gets the rest: at 1280 × 900 the pane went from
  428 px to 296–390 px. On a phone the budget is the height the old frame had (150 px),
  so nothing grew; the pane also no longer widens past the screen when its header does
  not fit, and a wide equation row scrolls inside its track instead of pushing the prose
  off the edge — `verify.mjs` fails on any pane, header or frame clipped at 390 px.
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
  to a megohm and 5 mA needs 5 kV; open the switch on the rail and an ideal current
  source into an open circuit has no solution — the solver refuses it
  (`current-cutset`) and says why. Measured: `i_R = I` at 1 kΩ and 1 MΩ, `v = 5 kV`
  at 1 MΩ, the refusal (code and reason) with the on-screen switch open.
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
- **H6 · Frequency response: one sine at a time.** RC,
  `H = 1/(1 + jωRC)` swept two decades either side of `f_c`: the Bode view, |H| in dB
  and ∠H, the drive marked from the same solve the meters use. Measured: −3.01 dB and
  −45° at `f_c`; −20 dB/decade (−19.96 for the first decade above, −19.9996 the next);
  −89.4° at 100 f_c; all 241 sweep points equal the closed form to 10⁻¹². The
  hand-over — **Open in Circuit Lab** — is exact and tested both ways (§8 Phase 3).

### Group I — The diode: the first nonlinear element (7 + 1 stretch) · built

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

*Built 2026-09-02 as I1–I7, with two changes worth naming. I3 is two diodes back
to back across a node rather than two in series: the same four assumed states and
the same three contradictions, but one knob walks the reader through all three
outcomes (clamped high, clamped low, and neither conducting), and one of the
rejections is refused by the solver itself rather than by a guard — two conducting
diodes in opposite directions are a short. And I7 is the clipper alone; the
clamper and the Zener are Phase 5's if they are cheap. The bridge's blocking
diodes carry ten megohms rather than an infinite resistance, because with four
perfect open circuits the source's own terminals connect to nothing and have no
voltage at all — the solver says so, by name.*

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
   *Student's-eye review 2026-09-02* (all 46 experiments scored as a new student
   would meet them: information 6, layout 5, flow 5, plots 7 of 10; a second
   opinion from Grok checked claim by claim against the source) set a 9.5/10 bar
   and a remediation plan in nine steps, each its own commit, the lab staying
   dark throughout and Group I waiting until the first three have landed:
   0 claim bugs · 1 the lesson under the student's eyes (knobs above the note,
   notes that pose a question, A1 without the matrix) · 2 the Analysis pane
   shows the lesson's own quantity (headline, bridge, theorem drawings) · 3
   finish the plots · 4 numbers and names · 5 content order and circuits · 6
   notes that are alive · 7 one plot language · 8 the screen as one composition
   (deep links are the parallel session's territory) · 9 students score it.
   **Step 0 — claim bugs — shipped 2026-09-02:** A2's refusal is now reachable
   from a switch knob on screen, not only from a test's private netlist; D2's
   "printed system" count is five (three node voltages and two source currents,
   the math panel computing the words from the unknown list); H1 points at F3,
   the RC experiment, not F2 (the RL one); the topbar gives a refusal's reason
   in words (`refusalReason`) and keeps the code for the report; H2, H4 and H6
   open with the source at its peak instead of a zero crossing, so H2's meters
   read KVL as 2.5 V + 2.5 V = 5 V; "turned 1080.0°" reads "3 cycles + 90.0°"
   (`turned`/`turnedLabel`). New test classes measure what the numeric check rows
   could not: every cross-reference in a note or math panel names an experiment
   that exists and holds what the sentence leans on (a table that must grow when
   a new reference appears), every count of unknowns in words equals the count
   the solver printed, refusals reach the student as a sentence, and every sine
   experiment opens with |v_s| ≥ A/2.
   **Step 1 — the lesson under the student's eyes (the opening experience and
   notes that pose a question) — shipped 2026-09-02:** the note is gone as a single block. Each experiment now
   has three registers in `src/lessons.js`: `see` (what the picture shows at the
   defaults, at most 70 words, so it and the schematic share a phone's first
   screen), `try` (two to four knob moves, each a sentence of at most 45 words
   with the setting it makes and the reading it produces) and `why` (the
   reasoning, folded under "Deeper" in a `details`). `experiments.js` keeps no
   prose; it takes the lesson by id and builds `note` as `see` + `why` for the
   places that still quote one paragraph. The sidebar shows the picker, `see`,
   the numbered `try` list and the "Deeper" fold; a phone gets a "Knobs ↓" pill
   because the knobs sit below the plots there. The tests measure the new
   registers the way they measured the note: every `set` names a knob and stays
   in its range, every `at` stays in the window, every `reads` entry is solved
   (`readQuantity` walks `v.`/`vd.`/`state.`/`thevenin.`/`mag.`/`deg.`/`lead.`/
   `energy.`/`H.`/`Z.`/`ac.` paths, or a function of the analysis), and every
   number-with-unit in `see`, `try` and `why` has to be one of those readings, a
   knob default, the cursor time or a value the step just set — a lesson cannot
   quote a number the solver does not produce. Exactly two steps ask for a
   refusal (A2 open, F6 ideal), and both get one. `verify.mjs` checks the first
   screen at 390 px holds the note and the Analysis switch, and at 1280×900 the
   note starts above 230 px with the first knob on screen, for all 46.
   **Step 4 — numbers and names (the copy and the package description) —
   shipped 2026-09-02:** every number a student reads now comes through
   `src/format.js`. `num(v, unit, sig, scale)` snaps a value under one part in
   1e9 of the scale it belongs to (or under a femto with no scale) to 0, so the
   topbar's residual reads "0 A" instead of "0.00087 fA", while E2's 9.9 nA and
   99 pW survive because they are real against their own scale; `forReading`
   rescales the math panel's theory/measured rows into the unit a first course
   writes (100 µA, 20 1/ms, 898 million ×) before they reach the shared
   `MathPanel`, which prints exponent notation outside 1e-3…1e4 and is a peer's
   file. A prediction under its row's own floor is zero as far as the row can
   tell (½Cv² at the end of three whole cycles is 2.7e-37 J from cos 6π), and a
   zero prediction met within its floor shows the zero. Σ power joins the topbar
   from B3, the experiment that introduces power; the "N nodes · M unknowns"
   chip explains both words on hover. Knobs take the drawing's names: Source V₁,
   V₁/V₂, I₁, Lift V₀, R_off of S₁ (`of: 'S1'`); preset chips carry their unit
   (1.59 kHz, not 1591.5); E3's op-amp is a switch, ideal by default, with a
   gain knob that applies when it is "finite gain" — no more "0 = ideal"; the
   hand-over keeps its URL fragment on `data-fragment` instead of printing it;
   H6 is "Frequency response: one sine at a time"; the package description
   covers F–H. Deliberately not renamed: the lesson prose and the matrix symbol
   still say E for the source's voltage (E₁ is what V₁ holds, and the legend says
   so) — roughly five hundred sentences, which Step 6's solver-bound notes will
   regenerate rather than hand-edit. No "non-linear elements come later" promise
   was found in the source to remove. Tests: `format.test.js` (noise floor,
   prefixes, agreement preserved through rescaling); every element token in a
   knob label is drawn on the schematic (a bare R/L/C allowed only when the
   drawing has one), no knob is called E, every preset chip is `fmt(value, unit,
   3)` inside the knob's range, E3 ideal refuses and finite gain solves with the
   gain set. `verify.mjs` scans every experiment × view for femto units, exponent
   notation and `#circuit=` (0 of each), checks Σ power is absent on A1 and
   present on B3, the size chip has its title, and every preset chip is one line
   ending in its unit.
   **Step 2 — the Analysis pane shows the lesson's own quantity — shipped
   2026-09-02:** every experiment names one number in `src/headlines.js` — the
   quantity its lesson is about (v_out for the amplifiers, R_eq for the ladders,
   τ, ζ, ω₀, |H| for the dynamic groups) — and `insight.jsx` prints it first in
   the Analysis pane as tag = value, read off the solution, not typed in; the
   test file carries a closed form for all 46 and checks the printed value
   against it at the defaults and 25 random settings (1e-9 static, 1e-6 dynamic,
   1e-7 dB absolute), and that E3 ideal and F6 ideal print a refusal in amber
   instead. The same number sits on the schematic as a callout, placed by
   `placeCallout` inside the crop and sized by a stand-in of the widest value the
   headline can take, so the live text never outgrows its box (a test measures
   both). Under the headline one "bridge" sentence joins the view to the lesson
   (the view's lead + the lesson's first sentence, accumulated to at least 20
   characters so F2's "The dual." is not the whole bridge). Groups A–E open on a
   `reading` view — a table of every drawn element's voltage and current, power
   once B3 has introduced it, then the node voltages, each column snapped to its
   own scale so E2's femtowatts read 0 W — with the solver's matrix folded under
   "The solver's own working — N equations in N unknowns" (a one-line KCL/KVL
   primer for A, the three-law card for B); D5 opens on its equivalent, G1 on
   the scope. Six experiments carry a drawing of their theorem in
   `src/theorems.js`: B2 the loop's three voltages adding to zero, D3 the two
   mesh rows with both sides read live, D4 one schematic per source with the
   other drawn dead as a switch labelled "I1 → 0 A" and the parts summing to the
   whole, D5 V_th behind R_th with the open-port meter reading beside the load
   line, E3 the two contradicting rows marked in the matrix (the fold opens to
   show them), H5 the power triangle with p(t) and its mean. Tags are typeset by
   `tagLatex` (v_out → v with a real subscript; ω₀, τ as Greek). Tests:
   `insight.test.jsx` renders every headline, bridge, table and theorem block to
   markup and reads the numbers back; `experiments.test.js` checks every theorem
   quantity against its closed form (B2 |Σv| < 1e-9·|E|, D3 rows balance, D4
   parts sum, D5 V_th/R_th and load-line points, H5 P/Q/S/pf/mean). `verify.mjs`
   walks every experiment × view: the headline is the first child of the pane,
   the bridge the second, the callout reads the headline's number with the
   typesetting undone, and a refusal draws no callout.
   **Step 3 — finish the plots — shipped 2026-09-02:** the plots now carry the
   lesson's own marks as data. `src/marks.js` gives eight experiments a list of
   marks computed from the solution — F3 the level E, the 63.2 % point at τ and
   the starting-slope tangent reaching E at τ; F4 the level, the exponential
   approach and v_A(0); F6 the spark v_S1(0⁺) and the trickle E/(R + R_off), none
   when the switch is ideal; G4 the first peak from `extrema`, the level alone
   when the ringing is gone; C3 the unloaded divider value E·R₂/(R₁ + R₂) from
   `x.thevenin.voc`; D6 the peak power at R_L = R_s and the 50 % efficiency
   there; H4 |Z| = R and |H| = Q at ω₀ with a curve of the resonant peak; H6 the
   −3.01 dB point at f_c, the −20 dB/decade asymptote and its slope — each a
   kind (level, point, segment, curve, time) with a label naming the quantity.
   One shared `drawDataMarks` in `timePlot.js` draws them on the scope, the
   frequency plots and the load sweep; rings are kept inside the frame and their
   labels move beside the ring when there is no room above; below 380 px of
   frame the marks lose their on-canvas labels and the caption `PlotMarks` under
   the plot names them — glyph, label, value in the plot's unit — so a phone
   reads the same lesson. Hidden traces are gone: a dimmed second trace is thin,
   dashed and translucent instead of a lighter copy of the first; F6's v_switch
   is dashed over i_L, F7 no longer draws an i_in that sat under i_L; the right
   axis takes its own span whenever zero-alignment would leave the trace under
   40 % of the frame (`rightSpan`), with its own dashed zero line when the zeros
   part, so G4–G7's v_C fills the frame (0.81) instead of a band. G3's damping
   sweep draws its settling-time curve from a closed form (`settleAnalytic`,
   bisection on the envelope's last band crossing) rather than the engine's
   step-limited transient, so the curve is smooth and the fastest-R argument
   sits at a real minimum inside (0.75·R_crit, R_crit); the engine still gives
   the dot at the knob's R and the test checks both agree to six places. C3's
   knob label ducks under the level line; D6 reads its ticks in mW and its
   efficiency on a 0–100 % right axis; H1's cursor sits near 2τ so the natural
   part is still visible; H2's angle reads as turns plus degrees
   (`turnedLabel`); the DampingCanvas dot now lands on its log axis. Tests:
   `marks.test.jsx` (18) checks every mark against the engine (F3's tangent
   slope, F6's spark as `tr.at(0).sol.volt.S1`, D6's efficiency as p_RL/−p_V1,
   H6's asymptote end within 0.001 dB of the real response), the caption's
   markup, the no-hidden-trace rules across all 46 (fill ≥ 0.4, no two
   same-styled traces within 1e-9 normalised), and the plot repairs; `verify.mjs`
   reads every caption back, requires a number in each entry, at least eight
   experiments captioned, and F3's caption to say 63.2 %.
   **Step 5 — content order and circuits — shipped 2026-09-02:** the words
   arrive in the order a first student needs them and no two experiments show
   the same picture. A1 opens on charge: the note's first two sentences define
   voltage as energy per coulomb and current as charge per second before any
   number, `charge` is the first term in `terms.js` and the first in A1's list,
   and the equations pane's primer is a new one-liner `OhmLine` (`primer="ohm"`)
   that builds the resistor's row from Ohm's law, names the KCL row as the
   junction rule Group B takes apart, and does not say KVL; `primerFor` in
   App.jsx picks it for A1, the brief line for the rest of A, the three-law card
   for B. Thévenin's name arrives with D5: `VIEW_LABELS` moved into
   experiments.js beside `viewLabel(view, exp)`, which gives every experiment
   before D5 the tab "Seen from the load" and plain rows in `TheveninPane`
   (`named={false}`: "the voltage with nothing connected", "the current a short
   would draw"), so C3 uses the equivalent one experiment before it is named.
   C4's note says why the bridge is not the textbook diamond and that each half
   is B2's loop — two resistors in series read at the midpoint. E7 drives both
   inputs (V₂ = 1.2 V on a stub of its own, its ground beside V₁'s) so no
   element sits dead at the defaults; the lower row was spread (V₂ at 97, in2
   at 140, R₃ at 190, riser at 215) so in2's name and reading clear both
   symbols at every seed. B3 is a three-resistor loop (R₃ = 3 kΩ) so its
   picture is not B2's, B4's source is 9 V so its picture is not A4's, and G3
   opens at 400 Ω — on the overdamped side, chips 800/400/160/50 — so its
   marker is not G2's critical point. Tests: no view label or title before D5
   matches /Th[ée]venin/ and every one from D5 on is the named label; no two
   experiments share `[layout.items, defaults]`; A1's terms start with charge
   and its note defines voltage and current before its first digit; C4's note
   says diamond, two dividers side by side and B2 (registered in the
   cross-reference table as "two resistors and a source"); E7's output is
   10·(1.2 − 1) and every |i| > 1 µA; the Ohm primer names Ohm's law and Group
   B and not KVL; G3's zeta at the defaults is 2 and `damping.Rcrit` is a
   quantity path the note's "200 Ω" is measured against.
   **Step 6 — notes that are alive — shipped 2026-09-02:** the lesson answers
   back instead of retiring. `live.js` binds every number in a note to what it
   measures: `quoted(see)` tokenises the unit-bearing figures (and the bare
   ones after = or ≈), `bindSee(exp)` ties each to a knob (a symbol named just
   before it, or its default value), to a `seeReads` path or function (with a
   `flip` for figures written with the other sign, like −α), or to the cursor,
   and leaves the rest literal (six allowed literals, listed in live.test.js);
   `liveSee(exp, x, p)` re-reads each binding and keeps the author's text while
   it still `stands` (within 0.6 % or half the last digit), reprinting it via
   `printLike` — in the note's own style — when it does not. `LiveNote.jsx`
   renders those segments (`b.live[data-changed]`) and the provenance line now
   says the numbers re-read, or that the settings have left the regime the note
   was written in (`regimeOf`: overdamped/critical/underdamped/refused). Terms
   moved from the "Terms used here" fold to where they first do work:
   `terms.js` gained `MATCH`, one pattern per term; `glossary.js` finds
   `firstUses(exp)` across see → try → why (longest match wins at a shared
   start, one placement per term), `Prose.jsx` marks each as a tappable `dfn`
   that opens a `DefCard` under its own paragraph (with a "since A3" chip back
   to the introducer), and terms the prose never spells out become chips under
   the note; `earlyUses()` is empty — no experiment uses a term before the one
   that lists it first, with the why allowed to point ahead by naming a later
   experiment or group (`pointsAhead`). `predict.js` turns the first
   knob-turning try step into a question posed in its place in the list:
   `predictFor(exp)` reads the quantity at the defaults and at the step's
   setting and offers the solver's answer beside the two nearest of a student's
   habits (same, proportional, inverse, double, half); picking one sets the knob
   and reveals the step's sentence with the habit named. 39 experiments pose
   one; the seven whose first knob step is a toggle or a refusal do not.
   `course.js` gives each group one sentence (`GROUP_INTRO`, folded on the
   experiment that opens the group and a blurb under each group in the picker)
   and the thread — `BUILDS`, what each experiment builds on, read the other
   way as `leadsTo` — shown as chips under the try list. Tests (live, predict,
   glossary, course): at the defaults every note renders as written; at five
   settings per experiment every live segment stands for the value it re-read;
   the right answer equals the solver at the step's setting and the three
   options are distinct; every MATCH has a term and vice versa; the intros are
   under thirty words; every experiment but A1 builds on an earlier one and all
   46 are reachable from A1. verify.mjs: after B1's R₂ move a marked `b.live`
   reprints, tapping "voltage" on A1 opens and closes its card, the "Terms used
   here" fold is gone, picking "12 mA" on A1's question reads as wrong, names
   the habit, sets R to 100 Ω and the meters read 120 mA, and the A2 chip
   opens A2.
   **Step 7 — one colour per quantity, every chart captioned — shipped
   2026-09-02:** the plots read without a legend. `palette.js` fixes one hue per
   physical quantity — voltage blue, current orange, power green, energy gold,
   angle purple (`HUE`, the first four the shared `COLORS` faces) — with three
   `SHADES` each, so a second voltage is a lighter blue with a dash and never a
   new colour; `familyOf(q)`/`familyOfLabel` classify every trace and
   `styleTraces` hands each its shade, dash and weight (a declared dim trace is
   thin, translucent and dotted). The schematic's meters, the readout strip
   (`.readout [data-q] b`) and the caption's bold numbers take the same hue
   through `--q-*` tokens, so a student who has learned "orange is current" is
   never told otherwise. Legends are gone: every canvas names its traces where
   they leave the frame (`drawEndLabels`, plates behind the words, the value
   swung to the left of the dot when the right is taken) and `frameArea` widens
   the gutters for the names. `captions.js` writes one sentence under every plot
   view — `captionFor(exp, view, x, params, marks, drive)` binds the words to the
   cursor's time, the bright trace's value, the energy ledger, |Z| at f, the
   sweep's knob and value, R_crit and the settle time — so what the picture
   shows is said in words with the live numbers in it (`PlotCaption`, ≤ 50
   words, every number re-formatted from the engine's value). Text never sits
   on text: `trackText(ctx)` wraps `fillText` to record every box the canvas
   writes, `placeLabels` moves a mark's name to the nearest clear row among the
   words already in its column (or the shorter way round), `clearRow` steps a
   single label over what it would cover, a pinned value is skipped when a
   labelled ring already names the point, and the phasor tip label tries
   fourteen positions and takes the least covered. Tests (palette 7, plotText
   14, captions 27, marks +4): the hues equal the shared faces and the CSS
   tokens; no two bright traces of one family share colour and dash; every
   scope trace is in its family's shades; the label placer clears, pushes apart,
   clamps, steps the shorter way round an obstacle and out from between two;
   every caption at the defaults and two seeded random settings names the
   values it claims and re-formats each from `x`; the bright features fill ≥ 40
   % of their frame on every view with three named exemptions (the drive is the
   tall one on F7 and H6, no bright trace on H5) and E8's flat sweep. verify.mjs
   reads back every plot canvas's recorded text boxes at 1920, 1280 and 390 px
   across all 43 plot views — no two overlap at a 1-px shrink and none runs off
   the canvas — requires a captioned sentence with a number under each, checks
   the meter hue matches the mode's token, and presses play on F3 and watches the
   cursor sweep to 5 ms and the button release.
   **Step 8 — the screen as one composition — shipped 2026-09-02:** the
   lesson, the knobs and the circuit are one thing on one screen. `progress.js`
   keeps where the student is: a step is done when the screen shows what it
   asked for (`stepMet` — a toggle exactly, a number within 0.5 %, the cursor
   within 2 % of the window, the meters in the mode the sentence names via
   `meterOf`), a watch step is done when the student ticks it or any later step
   is, done is sticky, and the record lives in localStorage under
   `ee-labs/elements/progress` (`load`/`save` shrug at a store that throws). The
   Try list is a path: done steps ticked and dim, the active step in full, the
   steps ahead one line each with an ellipsis and open on a tap; the posed
   prediction is the active step's question; a "next up" chip appears when every
   step is done; the picker ticks finished experiments (`data-done`), counts
   each group (`.group-arc`) and the course (`.picker-arc`). Knobs are one
   column with one knob open — the active step's, else the first — and the rest
   compact (`NumField compact`, label and entry on one row; `.knob-slot[data-named]`
   marks the step's knob); the window knob moved to the cursor row it scales.
   Deeper is one fold (why, the working, the hand-over) that refolds on a new
   experiment. The schematic answers back: `Schematic` (shared, additive props
   `lit`, `reference`, `onNode`, `onElement`) lights what the active step reads
   (`readsOf`) and what the pointer rests on in the Equations pane
   (`EquationsPane onHover`, rows carry `data-node`/`data-el`); on A3 a tapped
   node becomes the reference (`reference.js rereference` — node voltages shift
   together, element readings do not move, ground reads minus the shift and
   steps aside) and a tapped switch is thrown (`switchKnob` finds the toggle by
   flipping each; a time switch restarts the clock). The topbar speaks the
   student's words ("N numbers to find", "every node balances"; the solver's
   "unknowns" and "residual" stay in the hover text) and its outcome gives way
   with an ellipsis when the t / ω / τ chips crowd it. The sidebar is 380 px
   from 1200 px: at 1280×900 the whole Knobs section is on screen for all 46
   (before: every experiment overflowed, by 42–697 px). The phone gets a fixed
   tab bar — Lesson · Circuit · Plot · Knobs — lit by scroll position (the last
   part when a short page is at its foot), and a new experiment scrolls to its
   top. On a phone base.css makes `#root` the page's scroller, not the window,
   so the bar goes by `scrollIntoView` (with `scroll-margin-top` on its
   targets), reads the end of the page from `pageScroller()`, and listens for
   scroll in the capture phase on the document. The narrower plot frame put
   F6's spark label under the τ mark's name; `drawMark` now steps its name down
   a row through `clearRow` like every other label. At 390 px the cursor row is
   one line — "the circuit at t = 24 ms", the window knob as "− 40 cycles +",
   play — so the plot's view switch sits on the first screen for the fifteen
   experiments with a window knob (they overflowed by 1–14 px once the page
   truly scrolled to its top). Tests (progress 67,
   reference 8, plotText +1): every lesson's every measurable step is met by
   its own setting and by nothing at the defaults, the first step is active on
   arrival; A3's re-reference arithmetic; every switch is a knob's or a time
   switch and the knob really throws it; a time mark's name steps under a mark
   label already on the top row. verify.mjs drives it: the active step's knob
   is the marked open one and its element is lit; A1's three steps tick off by turning the knobs
   and switching the meters, the picker marks it and a reload keeps it; a node
   tapped on A3 reads 0 with the others shifted and the ammeters unmoved; the
   switch on F3 restarts the sweep; Equations rows light their node and element;
   the tab bar's Knobs and Lesson go where they say; Knobs ends above 900 px for
   all 46 at 1280×900; no solver-speak on the topbar's face. Deep links between
   labs are the parallel session's (`packages/ui/src/deeplink.js`) and are not
   part of this step.

   **Step 9 — students score it — built 2026-09-02, sittings Reed's:** the
   last half point of the 9.5 is not the lab's to award itself. Three people
   new to circuits sit with three experiments each (A1, then C2 or D5, then F3
   or G4), on Reed's phone and a laptop, with a four-line script read as
   written: open it; do what the lesson says; one sentence on what it showed
   you; 1–5 for clarity. Three numbers per sitting — seconds to the first act,
   whether the sentence matches the experiment's `see`, the rating — against
   three targets: first act ≤ 10 s in every sitting, recall ≥ 8 of 9, clarity
   mean ≥ 4.5 per experiment; under target anywhere blocks the 9.5 for that
   experiment's group, becomes a fix with a test, and that sitting is repeated
   once. `apps/circuit-elements-lab/SITTINGS.md` is the script, the seats, the
   rules and the recording format; `sittings.json` is the record Reed appends
   to; `src/sittings.js` validates each entry, scores the record (`score`) and
   prints the one status line the document may carry (`statusLine`).
   `sittings.test.js` (11) holds the record and the document to each other:
   every entry well-formed and naming an experiment in the course, the seats
   real experiments with a `see` to match and a first step the student acts
   on, the scoring rules as the document states them (a slow first knob blocks
   its group only; one recall miss allowed, a second blocks the groups the
   misses fell in; clarity a mean per experiment), and SITTINGS.md's `Status:`
   line equal to the computed one — so the document cannot claim what the
   record has not measured. The record is empty until Reed sits people down;
   the status line says so.
4. **Phase 4 — Piecewise-linear.** Regions, events by bisection, assumed-state DC,
   Newton for the exponential diode (DC only, with the refusal in time), rails on the
   op-amp, i–v plane view. **Group I, E9.** Exit: I6's exact-vs-approximate; event
   continuity invariant. *Shipped dark 2026-09-02.* `packages/network/src/diode.js`
   holds the four models (ideal switch, constant drop, V_f + r_d, Shockley), the
   regions each device can be in and the guard that holds each one; `pwl.js` holds
   the three ways a region is decided — `assumedState` (assume, solve, check, with
   every rejection's own contradiction kept), `newtonDC` (SPICE's junction limiting
   and GMIN, every iteration kept) and `pwlTransient` (exact inside a region, the
   instant it ends found by bisection on that exact solution, the states carried
   across). `mna.js` gains one stamp — `GI`, a conductance beside a current source —
   which is both the sloped diode and Newton's linearisation; `dynamics.js` returns
   the affine term a conducting diode adds, exactly zero for every circuit without
   one. Two new views: the **i–v plane** (the curve, the four models over it, the
   load line, the operating point, and Newton's iterates walking down to it) and
   **assumed states** (all four combinations, three rejecting themselves). I1–I7
   and E9 — 54 experiments. Three refusals carry their reason: an exponential diode
   asked for a response in time, an ideal diode reaching a capacitor with nothing
   between them, and a Schmitt trigger asked for one DC answer when it has three.
   Two engine bugs the measured claims caught: a guard already violated at a run's
   first sample never crossed inside it, so a bridge's second diode never turned on
   and half the output vanished (the peak was still right — only an average over
   more than one cycle saw it); and a stitched walk published overlapping segments,
   so the energy integral picked the wrong propagator. Tests: `pwl.test.js` (30) and
   Group I's own claims in `experiments.test.js`; 2528 in the monorepo.
5. **Phase 5 — Polish.** Stretch items (I8, GBW toggle) if cheap; mobile pass; the
   equations view's progressive disclosure tuned on a phone. *Shipped dark
   2026-09-02.* **I8, the Zener regulator**, was cheap — the engine already had
   breakdown as a third region — and it earns its place: the load sweep shows the
   output flat while it regulates and falling away below the knee at
   `R_L = V_z R_S/(E − V_z)`, which is the lesson drawn rather than stated. Its
   sweep re-decides the region at every load (`sweepKnob` solves through
   `solveRegions`), and the Thévenin equivalent is now withheld from any circuit
   with a region in it — a nonlinear circuit does not have one, and an `R_th`
   beside that knee would be a claim the circuit does not obey. A conducting
   diode's row in the equations pane says which region it is in rather than
   calling itself a voltage source. **The GBW toggle is not built**, and not
   because of time: `A(s) = ω_t/s` makes the op-amp a dynamic element, which
   means a new stamp in the complex solve and a new state in the time solve, both
   in the path every other experiment in Groups F–H already depends on. That is a
   phase, not a polish item. Finite gain and the rails — the two non-idealities
   that change the lessons — are built (E2, E3, E9); the plan's own §9 already
   calls slew rate and offset datasheet facts, and GBW belongs with them until
   there is an experiment that needs it.
6. **Phase 6 — Release gate.** REVIEW_PLAYBOOK audit, screenshot pass, Reed's
   hands-on review, then Reed flips `RELEASE_STATUS`. Splash card goes first.
   *Audit and screenshot pass done 2026-09-02; the review and the flag are
   Reed's.* Four defects the playbook's own classes found in Group I, each
   fixed with the test or the picture that would have caught it:
   **(1, sentences frozen while controls move)** a diode lesson is written
   about one arrangement of its diodes — "D₁ conducting, D₂ blocking", "it
   holds 5.1 V" — and a knob can move the circuit to another one. The
   provenance line already handled the damping regimes; it now reports the
   regions too, so I3 with its supply reversed says *written for a circuit with
   D1 conducting; at your settings it is D1 blocking*. **(4, a fixed range the
   content escaped)** the i–v plane started at 0 V, so a reverse-biased
   operating point was drawn outside its own frame; the frame now opens to hold
   it and the load line runs the width of it. **(6, rendering honesty)** the
   ideal and constant-drop models were drawn as functions of v — zero, then the
   top of the frame — which reads as "passes the maximum current at every
   voltage above V_f", the opposite of what a switch does; they are drawn as
   the two segments they are, and stop. **(4 again, axes)** the i–v plane had
   no ticks and its one x label collided with the axis title.
   Also from the pass: each of the four models is now named beside its own line
   rather than in a legend, and a conducting diode's row in the equations pane
   says which region it is in.

   *What is left before the flag: Reed's own hands-on review, on a phone and a
   laptop, and the three student sittings the 9.5 waits on (`SITTINGS.md`). The
   splash card, the README line and the LabNav entry are written by whoever
   flips `RELEASE_STATUS`; `release.test.js` fails while they exist and the
   flag says `dark`, which is what keeps the two in step.*
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
