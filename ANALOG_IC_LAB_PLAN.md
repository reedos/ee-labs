# Analog IC Lab: the plan

Tier 3 of `ANALOG_ROADMAP.md`. The same circuits as the Electronics Lab, made from
matched devices on one die, where a resistor costs area, a capacitor is small, and
every current comes from a mirror. Splash glyph `⊟`, directory `apps/analog-ic-lab`,
engine as `packages/network` plus one device model, one statistical parameter and one
view over the existing solve.

The path, in order. Devices on a die and the `g_m/I_D` method. Bias, from the
beta-multiplier to the bandgap and its start-up. Op-amp architectures on one table.
Fully differential circuits and their second loop. Compensation. Comparators and
metastability. Translinear circuits and multipliers. Integrated filters. Noise and
mismatch, designed rather than measured. Then Middlebrook's extra element theorem and
the trim that closes the offset.

This is a draft (2026-09-05) for Reed to settle. §0 lists what needs a decision. §1 is
the progression map, and it names every idea this lab leans on with the experiment
that teaches it. Most of those experiments are not built yet. Each such row is a
**dependency** with a named blocker, mirrored in `BACKLOG.md`, and no lesson here
references an experiment that does not exist.

The two rules that govern the other labs govern this one with no exemption. **Every
explanatory sentence is a claim about physics, and a test must measure it.** And
`CORE_SCOPE.md` decides what the engine may state exactly, what it may approximate
behind a guard, and what it declines with a reason. This lab adds a discipline of its
own. **Every device on screen has a size, and every size has a matching sigma, a
current and an area.**

---

## 0. Open decisions

### Decision 1: the name (recommended: Analog IC Lab)

`ANALOG_ROADMAP.md` §1 and `EE_LABS_MAP.md` both use it. LabNav short form
**"Analog IC"**. The splash card names the path in one line: "`g_m/I_D`, the mirror,
the bandgap, the op-amp architectures, the comparator, the noise budget".

Alternatives considered. *Analog Design Lab* is what an IC engineer means by the
subject, and it would collide with the Applied Analog Lab in a nav row. *CMOS Analog
Lab* names the process and excludes the bipolar bandgap and the translinear group.

### Decision 2: which process, and how many

Every number in §5 comes from one parameter set. Recommended: **one generic 0.18 µm
CMOS set with a bipolar option for the bandgap and the translinear group**, and no
second process. The set is in §3.1, and each of its constants is a textbook value with
its source named. A second process would double the pinned numbers and teach one
lesson, which the short-channel toggles of A5 already teach.

### Decision 3: the `g_m/I_D` device law

`g_m/I_D` needs a law that is continuous from weak to strong inversion. The square law
is not. Recommended: **the EKV interpolation as one labelled model**, with

```
g_m/I_D = (1/(n V_T)) · 2/(1 + √(1 + 4·IC)),   IC = I_D / (2 n µ C_ox V_T² (W/L))
```

Its two limits are pinned in the lab: 25.79 V⁻¹ as `IC → 0`, which is `1/(n V_T)`,
and the square law's `2/V_OV` as `IC → ∞`. At `V_OV = 200 mV` the square law gives
10.00 V⁻¹ and EKV gives 8.247 V⁻¹, a 21.3 % disagreement that A2 shows. The model is
labelled everywhere it is used, as `CORE_SCOPE.md` Rule 3 requires.

### Decision 4: whether mismatch is a parameter or a run mode

Pelgrom's law gives every device a matching sigma from its area. That sigma can be a
number the panel prints, or a distribution the solver samples. Recommended: **both,
with the number first**. `pelgrom(device)` returns the sigma as a printed quantity,
and the Applied Analog Lab's `monteCarlo` samples it when the reader asks for the
distribution. Nothing new is needed for the second, because the parameter path is the
same one `monteCarlo` already takes.

### Decision 5: whether the lab ships layout

It does not. `ANALOG_ROADMAP.md` §5 keeps layout, extraction and electromagnetic
simulation out, and this plan does not reopen that. Matching is an area, a centroid
rule stated in prose, and a sigma. Recommended: **area and sigma only**, with the
common-centroid arrangement named in a term definition and drawn in one static
figure.

---

## 1. The progression map

This section lists every idea the lab leans on, the experiment that teaches it, and
whether that experiment is built. The lab sits three tiers above the built suite, so
most rows are dependencies. A dependency row names the lab, the experiment and the
branch it is being built on. `BACKLOG.md` carries the same rows.

| Idea the lab leans on | Needed by | Taught at | Status |
| --- | --- | --- | --- |
| Nodal analysis, Thévenin, superposition, dependent sources | everything | Elements A to E | built |
| The capacitor as a state, first and second order response | E, H | Elements F, G | built |
| Phasors and impedance | H | Elements H | built |
| H(s), poles and zeros, dB, Q | C, E, H | Circuit Lab, 15 experiments | built |
| Loop gain, margins, root locus | D1, E, F | Control Lab, 13 experiments | built |
| Spectra, harmonics, two tones | G3, I4 | Signal Lab Fourier and Nonlinearity | built |
| The MOSFET's square law and its three regions | A1, A2 | Electronics D4 | **dependency, `lab/electronics-lab`** |
| `V_BE = V_T ln(I/I_S)` and `I_S(T)` | B3, G1 | Electronics C1, C4 | **dependency, `lab/electronics-lab`** |
| The small-signal model as the tangent at a point | A2, A3 | Electronics F1 to F6 | **dependency, `lab/electronics-lab`** |
| `R_in` and `R_out` by test source | C, D, F | Electronics G1, G2 | **dependency, `lab/electronics-lab`** |
| Common source, cascode, follower | C1 to C3 | Electronics H1 to H6 | **dependency, `lab/electronics-lab`** |
| The current mirror, the active load, the cascode's `R_out` | A6, B1, C | Electronics I1 to I4 | **dependency, `lab/electronics-lab`** |
| The differential pair and its half-circuit | D2, C, F | Electronics J1 to J5 | **dependency, `lab/electronics-lab`** |
| The Miller effect and open-circuit time constants | E, J1 | Electronics K3, K4 | **dependency, `lab/electronics-lab`** |
| Loop gain by breaking the loop, Blackman's form | D1, E, F | Electronics L1 to L6 | **dependency, `lab/electronics-lab`** |
| The two-stage op-amp, its compensation and its slew | C3, E1, E2 | Electronics M1 to M5 | **dependency, `lab/electronics-lab`** |
| Positive feedback and the Schmitt trigger | F2, F3 | Elements E9, Electronics N3 | built and **dependency** |
| Thermal and shot noise, the noise figure | I1 to I4 | Electronics O1 to O5 | **dependency, `lab/electronics-lab`** |
| The bandgap at board level, `M` and `V_ref` | B3 | Applied Analog D1 | **dependency, tier 2** |
| Monte Carlo over any parameter, and yield | A4, I4, J3 | Applied Analog §2.4 | **dependency, tier 2** |
| Sensitivity as an exact derivative | J1, J2 | Applied Analog §2.5 | **dependency, tier 2** |
| The subthreshold MOSFET and `g_m/I_D` | A1 to A3 | nowhere | **new here, §2.2** |
| Pelgrom's law as a statistical size | A4, F2, I3 | nowhere | **new here, §2.3** |
| Common-mode and differential decomposition as a view | D2, D3 | nowhere | **new here, §2.4** |
| Switched-capacitor common-mode feedback | D4 | Mixed-Signal Lab Group B | **dependency, tier 4** |

Three things the map shows that this plan does not fix, so that they are decisions
rather than omissions. **Eight of the Electronics Lab's groups gate this lab**, and
the phasing in §9 starts after that gate. **Two of the Applied Analog Lab's engine
functions are reused here**, so tier 2's Phase 1 gates this lab's Group J. **The
switched-capacitor common-mode feedback circuit** is the Mixed-Signal Lab's, and D4
here ships the continuous version with a note naming it.

The order of the groups follows the map. Nothing in a group leans on an experiment
that comes later in this lab.

---

## 2. The engine: one device law, one statistic, one view

### 2.1 What exists, and what is missing

`packages/network` after the Electronics Lab has the MOSFET as a Newton element with
region tracking, the small-signal netlist, `transferOf`, `returnRatio` and `noise.js`.
Three things are missing.

| Need | Today | This plan |
| --- | --- | --- |
| One current law from weak to strong inversion | square law only | `ekv.js`, `ekvCurrent`, `ekvCompanion` (§2.2) |
| A matching sigma on every device | nothing | `pelgrom.js`, `matching(device)` (§2.3) |
| Differential and common-mode halves as a view | nothing | `decompose(net, ports)` (§2.4) |
| A design view from `g_m/I_D` to a size | nothing | `sizeFor(spec, process)` (§2.5) |
| Short-channel effects as labelled toggles | nothing | three fields on the `M` element (§2.6) |

### 2.2 The EKV interpolation, as one more companion

The `M` element gains a third model, `model: 'ekv'`, beside `square` and `switch`. It
implements the same `companion(element, v)` interface `ELECTRONICS_LAB_PLAN.md` §2.5
defines, so `newtonDC`, `smallSignal` and the iteration view work unchanged.

```js
/**
 * The EKV interpolation, in its simplest one-equation form.
 *   I_D = 2 n mu C_ox V_T^2 (W/L) · ln^2(1 + exp((V_GS - V_TH - n V_SB)/(2 n V_T)))
 * @returns {{ id: number, ic: number, gm: number, gmb: number, go: number,
 *             region: 'weak' | 'moderate' | 'strong' }}
 */
export function ekvCurrent(device, { vgs, vds, vsb }, process)

/** The same, as the companion stamps newtonDC takes. */
export function ekvCompanion(device, v, process)

/**
 * The design quantity, in closed form, with no netlist.
 * @returns {{ gmId: number, ic: number, vov: number, jd: number }}
 *   jd is the current density I_D/(W/L), in amperes.
 */
export function gmOverId({ ic }, process)
export function icFor(gmId, process)     // the inverse, by bisection
```

The relation is `g_m/I_D = (1/(n V_T))·2/(1 + √(1 + 4·IC))`. At the process of §3.1
its limit is 25.79 V⁻¹, `IC = 1` gives 15.94 V⁻¹, `IC = 10` gives 6.967 V⁻¹, and
`IC = 100` gives 2.453 V⁻¹.

CORE_SCOPE: the EKV interpolation is a **labelled model**, admitted under Rule 3 with
its guard. The guard is the disagreement with the square law, printed whenever the
square law is also on screen. It is 21.3 % at `V_OV = 200 mV`, and it falls below 5 %
above `IC = 40`. The small-signal netlist taken at an EKV operating point is exactly
rational. It is admitted in full, with the operating point in its label, exactly as
the square-law tangent is.

### 2.3 Pelgrom's law, as a size on every device

```js
/**
 * The matching sigmas of one device, from its area.
 *   sigma(dV_TH) = A_VT / sqrt(W L)
 *   sigma(dbeta/beta) = A_beta / sqrt(W L)
 * @returns {{ sigVth: number, sigBeta: number, area: number,
 *             sigVos: number,      // a pair: hypot(sigVth, sigBeta/(g_m/I_D))
 *             sigMirror: number }} // a mirror: hypot((g_m/I_D) sigVth, sigBeta)
 */
export function matching(device, process, op)
```

The two output sigmas are the ones a designer reads. A pair's input offset is
`√(σ_VTH² + (σ_β/(g_m/I_D))²)`, and a mirror's fractional current error is
`√(((g_m/I_D)·σ_VTH)² + σ_β²)`. At `A_VT = 4 mV·µm`, `A_β = 1 %·µm` and an area of
2.5 µm², `σ_VTH = 2.530 mV` and `σ_β = 0.6325 %`, so a pair at `g_m/I_D = 10` has
`σ_VOS = 2.608 mV` and a mirror at the same point has `σ_ΔI/I = 2.608 %`. At
`g_m/I_D = 20` the mirror error rises to 5.099 % and the pair offset barely moves, to
2.550 mV.

CORE_SCOPE: Pelgrom's law is a **labelled statistical model**, admitted under Rule 3.
Its guard is the area range it was fitted over, stated on the pane, and the panel
declines an area below 0.25 µm² with the reason that the law's constant is not fitted
there. The sigma itself is exact arithmetic given the constants.

### 2.4 Differential and common-mode halves, as a view over the exact solve

```js
/**
 * The half-circuit decomposition of a symmetric netlist, and the exact solve
 * beside it.
 * @param net    a small-signal netlist
 * @param ports  { inputs: [p, n], outputs: [op, on], symmetry: [[a,a'],...] }
 * @returns {{
 *   symmetric: boolean,           // the pairing checked element by element
 *   dm: { net, gain, rout },      // the half-circuit with the axis grounded
 *   cm: { net, gain, rout },      // the half-circuit with the axis open
 *   exact: { ad, acm, cmrr },     // from the full solve, no decomposition
 *   error: { ad: number, acm: number }   // relative, halves against exact
 * }}
 */
export function decompose(net, ports)
```

The decomposition is exact when the circuit is symmetric and the tail is a two-port
that splits. It is an approximation when the common-mode half-circuit doubles the tail
resistance, which is the usual textbook step. The pane prints both. For the pair of
§4.5 the exact differential gain is −3.84615 and the half-circuit gives −3.84615, so
that half is exact. The exact common-mode gain is −0.0098756 and the textbook
`−R_D/(2R_tail)` gives −0.0100, which is 1.26 % high, and the pane prints that error.

CORE_SCOPE: the exact solve is admitted with no hedge. The half-circuit is a view over
it, and the common-mode approximation is guarded by the printed error, with a warning
above 5 %.

### 2.5 From a specification to a size

```js
/**
 * The design step the g_m/I_D method exists for.
 * @param spec     { gm, gmId, L }  or  { gm, fT, L }  or  { gm, sigVos, L }
 * @param process  the §3.1 set
 * @returns {{ id, wl, w, area, gmId, ic, vov, gmro, cgs, fT, sigVth, sigVos }}
 */
export function sizeFor(spec, process)
```

This is the design view's whole content. For `g_m = 500 µS` and `L = 1 µm` it gives
the table of §4.3, in which `g_m/I_D = 5` costs 100.0 µA and buys 1.189 GHz, and
`g_m/I_D = 20` costs 25.00 µA and buys 82.78 MHz. Every entry is one closed-form
evaluation, and the pane recomputes it while the reader drags.

### 2.6 Short-channel effects, as three toggles

Three fields on the `M` element, each off by default, each printed with the number it
changes.

| Toggle | Law | At the §3.1 process |
| --- | --- | --- |
| `esat` | `I_D` scaled by `1/(1 + V_OV/(E_sat L))` | `E_sat = 5.000 V/µm`. At `L = 0.18 µm` and `V_OV = 300 mV` the current is 0.750 of the long-channel value and `g_m` is 34.4 % lower |
| `gammaB` | `V_TH + γ(√(2φ_F + V_SB) − √(2φ_F))` | `γ = 0.4 √V`, `2φ_F = 0.7 V`. `V_SB = 0.5 V` raises `V_TH` by 103.5 mV, and `g_mb/g_m = 0.1826` |
| `dibl` | `V_TH − η_D V_DS` | `η_D = 100 mV/V` at `L = 0.18 µm`, so one volt of drain moves the threshold 100 mV |

Each is a labelled model under Rule 3. The guard on `esat` is the channel length: below
0.1 µm the pane declines the toggle, because velocity saturation is then not a
correction to a square law but the law itself.

### 2.7 Measures

Everything the Electronics Lab measures, plus the design quantities. `IC`, `g_m/I_D`,
current density, `W/L`, area, `g_m r_o` and `f_T`. Then the matching sigmas `σ_VTH`,
`σ_β`, `σ_VOS` and `σ_ΔI/I`. Then the differential and common-mode gains with the
half-circuit error, and the common-mode feedback loop's own margin. Then the
regeneration time constant and the resolvable input after a given time. Then the
input-referred noise density with its share per stage.

### 2.8 Invariants, the fuzzer's checklist

Across random sizes, currents and process corners on every library circuit:

1. **The point satisfies the laws.** KCL at every node to floating point, and every
   device's current equals its model's law at its voltages.
2. **EKV meets its limits.** `g_m/I_D` from `ekvCurrent` approaches `1/(n V_T)` below
   `IC = 0.01` to 1 %, and approaches `2/V_OV` above `IC = 100` to 5 %.
3. **The tangent is the derivative.** `g_m`, `g_mb` and `g_o` from `ekvCompanion`
   equal central finite differences of `ekvCurrent` to 10⁻⁶ relative at twenty random
   points.
4. **Sizing round-trips.** `sizeFor` followed by a Newton solve of the sized device
   gives the requested `g_m` to 10⁻⁶ relative.
5. **Matching scales.** `σ_VTH` halves when the area quadruples, to floating point,
   and `sigVos` matches the hypotenuse formula.
6. **The halves rebuild the whole.** `dm.gain + cm.gain` applied to the two inputs
   reproduces the exact solve's two outputs, to floating point, for a symmetric
   netlist.
7. **Symmetry is checked, not assumed.** `decompose` on a deliberately asymmetric
   netlist reports `symmetric: false` and declines to return halves.
8. **Polynomials agree with points.** `transferOf` at jω equals `sweepAC` at all 241
   points, to 10⁻⁹ relative, for every architecture in Group C.
9. **Feedback closes.** The direct closed-loop solve equals Blackman's form from the
   return ratio, to floating point, for both the differential loop and the common-mode
   loop.
10. **Regeneration is exact.** The latch's output from `pwlTransient` equals
    `V₀ e^{t/τ}` with `τ = C/g_m` inside the region, to 10⁻⁹ relative, and the region
    boundary is an event.
11. **Noise closes.** The stacked per-device densities sum to the direct total, and the
    input-referred total equals `√((8kTγ/g_m1)(1 + g_m3/g_m1))` for the pair.
12. **Cross-lab.** The two-stage op-amp's loop gain sent to Control Lab gives the same
    margins there as here. The bandgap's `M` and `V_ref` equal the Applied Analog Lab's
    D1. A `g_m`-C biquad's H(s) sent to Signal Lab agrees at `f_0` and at Q.

---

## 3. Models: the process and the device library

### 3.1 One process, with every constant sourced

| Constant | Value | Where it comes from |
| --- | --- | --- |
| `V_DD` | 1.80 V | a generic 0.18 µm node |
| `µ_n C_ox` | 200 µA/V² | textbook generic for the node |
| `µ_p C_ox` | 100 µA/V² | the same, at half the mobility |
| `C_ox` | 8.63 fF/µm² | `ε_ox/t_ox` at `t_ox = 4.0 nm` |
| `V_THN`, `V_THP` | 0.45 V, −0.45 V | the node's nominal |
| `n` | 1.50 | the subthreshold slope factor, so 89.29 mV/decade |
| `V_T` | 25.852 mV | `kT/q` at 300 K |
| `V_A'` | 10.0 V/µm | the Early voltage per micron of channel length |
| `A_VT` | 4.0 mV·µm | Pelgrom's threshold constant |
| `A_β` | 1.0 %·µm | Pelgrom's current-factor constant |
| `E_sat` | 5.00 V/µm | `2 v_sat/µ_n` at `v_sat = 10⁵ m/s` |
| `γ` | 0.4 √V | the body-effect coefficient |
| `K_f` | 1.0 × 10⁻²⁵ V²F | the flicker constant, NMOS |
| `I_S` per square | 0.4010 µA | `2 n µ C_ox V_T²`, the specific current |

The specific current is the one derived constant a reader needs. No textbook prints it
for a given process, so A1 computes it on screen.

### 3.2 The element library

Everything in the Electronics Lab's table stays. These change or are added.

| Element | Ideal law | Toggles, each labelled |
| --- | --- | --- |
| MOSFET (`M`) | square law, three regions | `model: 'ekv'` (§2.2). `esat`, `gammaB`, `dibl` (§2.6). `W`, `L` and area as first-class fields |
| BJT (`Q`) | the Electronics Lab's two models | a lateral PNP option for the bandgap, with `β_F = 5` |
| Matched pair | two devices with one area | `matching()` sigmas printed, sampled by `monteCarlo` |
| Unit device | one `W/L` repeated `m` times | `m` as a knob, so a mirror ratio is an integer count |
| Poly resistor | R with a tempco and a tolerance | 20 % absolute, 0.1 % matched, 1000 ppm/K |
| MIM capacitor | C | 20 % absolute, 0.1 % matched, 2 fF/µm² |

Two library facts drive most of the lab. An absolute value on a die is good to about
20 %, and a ratio is good to about 0.1 %. Every circuit here is built out of ratios for
that reason, and B1 is the experiment that shows it.

### 3.3 Schematic description

As the Electronics Lab: each library circuit is a netlist with grid positions, drawn
by `packages/ui/Schematic.jsx`. Each device carries `W/L` and `m` in its label, and the
DC overlay adds the operating point's `IC` and region word. One new symbol is added,
the unit-device array drawn as `m` boxes, so that a mirror ratio is visible as a count
rather than as a number.

---

## 4. The app

### 4.1 Layout

The Electronics Lab's shape, with one addition. Sidebar: LabNav, report link,
experiment groups, circuit picker, device NumFields with `W`, `L` and `m` chips, the
model and toggle switches, and the math panel. Main: topbar meters, the schematic
always visible, and one pane below with a pane selector. The **design view** of §4.3 is
one of the panes, and it is the default in Groups A and C. Phone-width first, no
horizontal scroll at 390 px, harness-checked.

The topbar shows `I_D`, `g_m/I_D`, `IC` and the region word first, then the
experiment's headline numbers, then the model in use.

### 4.2 Views

- **Schematic with three overlays.** DC, small-signal, and a sizing overlay that
  prints `W/L`, `m` and `IC` at each device.
- **Design view.** §4.3. New, and this lab's own.
- **Device curves.** `I_D` against `V_DS` at stepped `V_GS`, with the load line, the
  operating point and the region boundaries, reused from the Electronics Lab.
- **Architecture table.** Gain, unity-gain frequency, output swing, input noise density
  and power for every architecture in Group C, on one table against one specification.
- **Bode, pole-zero and loop.** From `transferOf` and `returnRatio`, reused. The loop
  view gains a second trace for the common-mode loop.
- **Halves.** The differential and common-mode half-circuits drawn beside the exact
  solve, with the error printed. §2.4.
- **Scope.** The exact piecewise-linear waveform, for the latch, the start-up circuit
  and the class AB output.
- **Noise.** The output density as a stack, one band per device, with the
  input-referred total and each device's share as a percentage.
- **Matching.** Each device's area against its sigma, with the pair and mirror sigmas
  derived, and a histogram when `monteCarlo` is run.
- **Equations.** The small-signal netlist printed as elements, then the MNA rows.

### 4.3 The design view

This is the lab's one new canvas. It lives in the app rather than in `packages/ui`,
because `PROGRAM.md` §4 asks for a second lab before a canvas is promoted. The VLSI
Lab is the candidate second lab. Its leakage group needs the same weak-inversion axis,
so the props below are written for it.

```jsx
/**
 * GmIdView — current efficiency against everything it costs.
 * Second lab: VLSI Lab, whose leakage group needs `extra` to plot I_off on the
 * same current-density axis.
 */
<GmIdView
  process={PROCESS}
  x="gmId"                          // or 'ic', or 'jd'
  curves={['jd', 'gmro', 'fT', 'sigVth']}
  target={{ gm: 500e-6, L: 1e-6 }}  // the design task's fixed points
  cursor={{ gmId: 15 }}             // the reader's pick, dragged
  extra={[{ key: 'ioff', label: 'I_off', unit: 'A/µm' }]}
  onPick={(row) => {}}              // returns the whole sizeFor row
/>
```

At `g_m = 500 µS` and `L = 1 µm` the view reads, for `g_m/I_D` of 5, 10, 15 and 20:

| `g_m/I_D` (V⁻¹) | `I_D` (µA) | `W/L` | `g_m r_o` | `C_gs` (fF) | `f_T` | `σ_VTH` (mV) |
| --- | --- | --- | --- | --- | --- | --- |
| 5 | 100.0 | 11.63 | 50.0 | 66.91 | 1.189 GHz | 1.173 |
| 10 | 50.00 | 30.63 | 100.0 | 176.2 | 451.6 MHz | 0.7228 |
| 15 | 33.33 | 67.23 | 150.0 | 386.8 | 205.7 MHz | 0.4878 |
| 20 | 25.00 | 167.1 | 200.0 | 961.3 | 82.78 MHz | 0.3095 |

Four columns move in four directions from one knob, and that is the whole reason the
method exists. Every row is one call to `sizeFor`, and every entry is pinned.

### 4.4 Quantity paths

Everything the Electronics Lab lists, plus:

```
dev.<id>.<w|l|m|area|wl>                        the size
dev.<id>.<ic|gmid|jd|vov|region>                the operating point in design terms
dev.<id>.<gm|gmb|go|ro|gmro|cgs|cgd|fT>         the small-signal device
match.<id>.<sigVth|sigBeta|sigVos|sigMirror>    Pelgrom, at that area
dm.<gain|rout>  cm.<gain|rout>  cmrr            the decomposition and the exact ratio
halves.error.<ad|acm>                           the approximation's own error
cmfb.<T|pm|fc>                                  the common-mode loop
latch.<tau|tres|vmin|pmeta>                     regeneration
arch.<name>.<a0|ft|swing|vn|power>              the architecture table's rows
noise.<id>.share                                each device's share of the total power
```

### 4.5 Numbers

- Input pair: `g_m1 = 200 µS`, `L = 1 µm`, `g_m/I_D = 20`, so `I_D = 10.0 µA` per side
  and a 20 µA tail. `g_m r_o = 200`, `r_o = 1.00 MΩ`.
- Second stage: `g_m2 = 500 µS` at `g_m/I_D = 10`, so `I_D = 50.0 µA`, `r_o = 200 kΩ`.
- Two-stage op-amp: `C_c = 1.00 pF`, `C_L = 2.00 pF`, `A₀ = 5000` (73.98 dB),
  `f_t = 31.83 MHz`, dominant pole 6.366 kHz, second pole 39.79 MHz, right-half-plane
  zero 79.58 MHz, `SR = 20.0 V/µs`.
- Telescopic and folded cascode: 40 µA tail, `g_m/I_D = 15`, `L = 1 µm`, so
  `g_m = 300 µS`, `g_m r_o = 150`, and a cascoded output resistance of 150 MΩ.
- Beta-multiplier: `K = 4`, `R = 10.0 kΩ`, `W/L = 10`, so `g_m = 100 µS` and
  `I = 2.50 µA`.
- Bandgap: the Applied Analog Lab's D1 set, `V_G0 = 1.206 V`, `V_BE = 0.650 V`,
  `η = 4`, `N = 8`, `M = 11.79`, `V_ref = 1.2836 V`, 17.69 ppm/K over −40 to 125 °C.
- Latch: `g_m = 1.00 mS`, `C = 50.0 fF`, so `τ = 50.0 ps`. The fast latch of F4:
  `τ = 20.0 ps`.
- Differential pair for §2.4: `g_m = 200 µS`, `r_o = 500 kΩ`, `R_D = 20.0 kΩ`,
  `R_tail = 1.00 MΩ`.
- `g_m`-C filter: `g_m = 100 µS`, `C = 10.0 pF`, so a unity-gain frequency of
  1.592 MHz.
- Common-mode feedback: error transconductance 100 µS, output resistance 500 kΩ,
  `C_L = 2.00 pF`.
- Extra element theorem: a common-source stage with `g_m = 200 µS`, `R_D = 20.0 kΩ`,
  `R_s = 10.0 kΩ`, `C_gd = 20.0 fF`.

---

## 5. Curriculum: 45 experiments in 10 groups

Format, as the other plans: **the claim** the note makes, what the reader turns, and
what is **measured** against what **formula**. Every quoted number becomes a pinned
test. Each experiment ships `see`, `try` and `why` in the three registers, within the
`STYLE.md` budgets.

### Group A: Devices on a die (6)

- **A1 · One law from weak to strong inversion.** The inversion coefficient
  `IC = I_D/(2 n µ C_ox V_T² (W/L))` divides the whole current range in two at
  `IC = 1`. The specific current per square is 0.4010 µA at this process. Below
  `IC = 0.01` the drain current is exponential and the slope is 89.29 mV per decade.
  Measured: the specific current, the decade slope, and the current at five inversion
  coefficients against the EKV law.
- **A2 · `g_m/I_D` is bounded, and the square law does not know it.** The efficiency
  cannot exceed `1/(n V_T) = 25.79 V⁻¹` however little current flows. At `IC = 1` it is
  15.94 V⁻¹, at `IC = 10` it is 6.967 V⁻¹. At `V_OV = 200 mV` the square law says
  10.00 V⁻¹ and EKV says 8.247 V⁻¹, a 21.3 % disagreement the pane prints. Measured:
  the ceiling, three values, and the disagreement at three overdrives.
- **A3 · Everything a device buys, from one knob.** Fix `g_m = 500 µS` and
  `L = 1 µm`, then move `g_m/I_D` from 5 to 20. The current drops from 100.0 µA to
  25.00 µA and `W/L` rises from 11.63 to 167.1. The intrinsic gain rises from 50.0 to
  200.0 and `f_T` drops from 1.189 GHz to 82.78 MHz. Measured: all four columns at four
  points, each against `sizeFor`.
- **A4 · Matching is an area.** `σ(ΔV_TH) = A_VT/√(WL)`. At 1 µm² it is 4.00 mV, at
  2.5 µm² it is 2.530 mV, at 100 µm² it is 0.400 mV. A pair at `g_m/I_D = 10` and
  2.5 µm² has an input offset sigma of 2.608 mV, and 16.0 µm² is needed for 1.00 mV.
  Measured: the sigma at four areas, the pair offset, and the area for a target.
- **A5 · A mirror's error grows with its efficiency.** A mirror's fractional current
  error is `(g_m/I_D)·σ_VTH` in quadrature with `σ_β`. At 2.5 µm², `g_m/I_D = 10` gives
  2.608 % and `g_m/I_D = 20` gives 5.099 %. The same devices at 100 µm² give 0.4123 %.
  Measured: the error at two efficiencies and two areas, each against the formula.
- **A6 · Short channels change numbers, and the toggles say so.** `E_sat = 5.00 V/µm`.
  At `L = 0.18 µm` and `V_OV = 300 mV` the current is 0.750 of the long-channel value
  and `g_m` is 34.4 % lower. At `L = 1 µm` the current is 0.943 of it. The body effect
  at `V_SB = 0.5 V` raises the threshold by 103.5 mV and gives `g_mb/g_m = 0.1826`.
  Measured: each toggle's number at three lengths.

### Group B: Bias (5)

- **B1 · A ratio is worth two hundred times an absolute value.** A poly resistor is
  good to 20 % and a resistor ratio to 0.1 %. Every circuit in this lab is built from
  ratios for that reason. Measured: the spread of a divider built from an absolute
  value and from a ratio, over the same Monte Carlo run.
- **B2 · The beta-multiplier sets a current from a resistor.** `g_m1 R = 2(1 − 1/√K)`,
  so `K = 4` and `R = 10.0 kΩ` give `g_m = 100 µS`. With `W/L = 10` the current is
  `g_m²/(2 µ C_ox (W/L)) = 2.50 µA`, and it does not move with the supply to first
  order. Measured: `g_m`, the current, and the current's change over a 1.6 to 2.0 V
  supply.
- **B3 · The bandgap, PTAT plus CTAT.** `V_BE` falls at −2.112 mV/K and `V_T ln 8`
  rises at 86.17 µV/K per unit of multiplier, so `M = 11.79` flattens the sum.
  `V_ref = 1.2836 V`, and over −40 to 125 °C it moves 3.746 mV, which is 17.69 ppm/K.
  The curvature is second order and is what the spread measures. Measured: the two
  slopes, `M`, the reference, the spread, and the equality with Applied Analog D1.
- **B4 · The start-up circuit, and the state without one.** The beta-multiplier has two
  consistent operating points, and zero current is one of them. `solvePWL` reports both
  and declines to pick, with the message the suite already gives for a circuit whose
  answer depends on its history. A start-up device removes the zero-current state, and
  the pane then shows one solution. Measured: both operating points, the refusal, and
  the single point after start-up.
- **B5 · A current is only as good as its reference.** The resistor's 1000 ppm/K
  tempco moves the beta-multiplier's current by −0.2 %/K, and its 20 % absolute
  tolerance moves it by 44 %. A bandgap-referenced current source replaces both with
  the reference's own 17.69 ppm/K. Measured: both drifts, and the tolerance spread from
  Monte Carlo.

### Group C: Op-amp architectures (6)

Every experiment in this group answers the same specification: 60 dB of gain, a
20 MHz unity-gain frequency into 2.00 pF, at least 1.0 V of differential output swing,
and under 200 µW. The architecture table is the answer sheet.

- **C1 · The telescopic cascode.** Four devices stacked, `g_m = 300 µS`, cascoded
  output resistance 150 MΩ. Gain 81.02 dB, unity gain 23.87 MHz on 40 µA, so 72.0 µW.
  Output swing 1.2 V single-ended, and the input common-mode range is narrow because
  the tail and the cascode share the rail. Measured: gain, unity gain, swing, power,
  and the input range.
- **C2 · The folded cascode.** The same gain and the same unity gain, with the input
  common-mode range reaching a rail and 1.2 V of swing, at twice the current, 144 µW.
  Measured: the same five, and the current the fold costs.
- **C3 · The two-stage Miller amplifier.** `g_m1 = 200 µS` into `g_m2 = 500 µS`, gain
  73.98 dB, `f_t = 31.83 MHz` with `C_c = 1.00 pF`, swing 1.5 V, 126 µW, and
  `SR = 20.0 V/µs`. Lower gain than the cascodes and more swing than either. Measured:
  all five, and the slew rate as `I_tail/C_c`.
- **C4 · Gain boosting.** An auxiliary amplifier of gain 40 around each cascode raises
  the output resistance by that factor and the gain to 113.1 dB, at 60 µA. The price is
  two more loops, each with its own margin, and D3 reads them. Measured: the gain, the
  output resistance, and the two auxiliary loops' margins.
- **C5 · The class AB output stage.** A follower output limits the swing to a threshold
  and a saturation voltage from each rail, and it wastes quiescent current. A class AB
  common-source pair swings to 1.5 V single-ended and delivers more than its quiescent
  current. Measured: the swing, the quiescent current, and the peak output current for
  both.
- **C6 · Rail-to-rail input.** Two pairs, one NMOS and one PMOS, hand over as the
  common mode crosses. `g_m` doubles in the overlap unless the tail currents are
  steered, and the unity-gain frequency doubles with it. Measured: `g_m` against the
  input common mode, with and without steering, and the resulting unity-gain frequency
  spread.

### Group D: Fully differential (4)

- **D1 · A differential output has no common-mode path.** With no common-mode
  feedback, a 1 % current mismatch moves the output common mode by `r_o·ΔI = 0.100 V`,
  and 5 % pushes a device out of saturation. Measured: the common-mode shift against
  the mismatch, and the mismatch at which the region word changes.
- **D2 · The half-circuits, and where each is exact.** The differential half-circuit
  gives −3.84615 and the exact solve gives −3.84615, so that half is exact. The
  common-mode half-circuit's `−R_D/(2R_tail) = −0.0100` against the exact −0.0098756 is
  1.26 % high. CMRR is 45.79 dB. Measured: both gains both ways, the error, and the
  CMRR.
- **D3 · The common-mode loop is a loop.** The common-mode feedback amplifier at 100 µS
  into 500 kΩ has 33.98 dB of loop gain and crosses at 7.958 MHz into 2.00 pF, against
  the differential loop's 23.87 MHz on the same node. Its margin is read the same way
  and crosses to Control Lab. Measured: the loop gain, the crossover, the margin, and
  the common-mode step's settling.
- **D4 · Which common-mode sensor, and what it costs.** A resistive sensor loads the
  output and lowers the differential gain. A source-follower sensor limits the swing. A
  switched-capacitor sensor loads nothing and is the Mixed-Signal Lab's, and its note
  names that lab. Measured: the differential gain and the swing with each sensor, and
  the loading each one adds.

### Group E: Compensation (4)

- **E1 · Miller compensation, and the zero it brings.** `C_c = 1.00 pF` puts `f_t` at
  31.83 MHz, the second pole at 39.79 MHz and a right-half-plane zero at 79.58 MHz. The
  zero's phase lag is what makes the margin 36.03° rather than 51°. Measured: the two
  poles, the zero, the crossover at 27.67 MHz and the margin.
- **E2 · The nulling resistor moves the zero.** `R_z = 1/g_m2 = 2.00 kΩ` sends the zero
  to infinity and the margin rises to 56.35°. `R_z = (1/g_m2)(1 + C_L/C_c) = 6.00 kΩ`
  puts a left-half-plane zero exactly on the second pole at 39.79 MHz, and the margin
  becomes 90.01°. Measured: the zero's position and the margin at four resistances.
- **E3 · Compensation is bandwidth traded for margin.** Raising `C_c` from 1.00 pF to
  5.00 pF drops `f_t` from 31.83 MHz to 6.366 MHz, raises the margin from 36.03° to
  57.06°, and drops the slew rate from 20.0 V/µs to 4.00 V/µs. Measured: all three at
  four capacitances, and the step response at each.
- **E4 · Nested Miller and feedforward.** A third stage needs a second compensation
  capacitor, and the inner loop's own margin becomes a constraint. A feedforward path
  puts a left-half-plane zero where the second pole sits without a resistor. Measured:
  the three-stage loop's margins with each scheme, and the pole and zero positions from
  `transferOf`.

### Group F: Comparators (4)

- **F1 · A preamplifier before a latch.** The preamplifier's gain divides the latch's
  offset and its own input-referred noise sets the resolution. Gain 10 costs one
  bandwidth and buys a factor of ten on both. Measured: the input-referred offset and
  noise with and without the preamplifier.
- **F2 · Regeneration is an exponential with an exact time constant.** The cross-coupled
  pair is positive feedback in a region model, so `v(t) = V₀ e^{t/τ}` with
  `τ = C/g_m`. At `g_m = 1.00 mS` and `C = 50.0 fF`, `τ = 50.0 ps`, and a 1.00 mV input
  reaches 500 mV in 311 ps. From 1.00 µV it takes 656 ps. Measured: the time constant,
  three resolution times, and the waveform against the exponential to 10⁻⁹.
- **F3 · Hysteresis by design.** A fraction of the output fed back to the input makes
  two consistent states, which `solvePWL` reports as hysteresis rather than as an
  error. A ratio of 1/10 on a 1.00 V swing gives 100 mV of hysteresis. Measured: the
  two thresholds, their difference, and the refusal message when the operating point is
  asked for without a history.
- **F4 · Metastability is a rate.** With `τ = 20.0 ps`, 100 ps of decision time
  resolves 3.37 mV and leaves a failure probability of 6.74 × 10⁻³ over a 1 V range.
  At 200 ps it is 22.7 µV and 4.54 × 10⁻⁵, and at 400 ps it is 1.03 pV and
  2.06 × 10⁻⁹. At 5 GS/s those are a failure every 29.7 ns, every 4.41 µs and every
  97.0 ms. A preamplifier of gain 10 buys 46.1 ps. Measured: the resolution and the
  rate at four times.

### Group G: Translinear circuits and multipliers (4)

- **G1 · The translinear principle.** Around a loop of an even number of junctions,
  half clockwise and half anticlockwise, the products of the currents are equal. It
  follows from `V_BE = V_T ln(I/I_S)` and KVL, with no approximation. A loop with
  `I₁ = 100 µA`, `I₂ = 50.0 µA` and `I₃ = 20.0 µA` gives `I₄ = 40.0 µA`. Measured: the
  loop's fourth current against the product law, over three decades of current.
- **G2 · The pair as a multiplier, and where it stops being one.** The bipolar pair's
  `tanh` law departs from a straight line by 1 % at 9.01 mV and 5 % at 20.7 mV. A MOS
  pair at `V_OV = 200 mV` departs by 1 % at 56.4 mV, six times further, and steers
  fully at 283 mV. Measured: both departures, both full-steering points, and the ratio.
- **G3 · The Gilbert cell.** Two pairs cross-coupled under a third make a four-quadrant
  multiplier. With a square-wave carrier the conversion gain is `2/π`, which is
  −3.922 dB. Its output spectrum crosses to Signal Lab's ring-modulation preset.
  Measured: the conversion gain, the two output tones, and the carrier feedthrough from
  a 1 % mismatch.
- **G4 · The variable-gain amplifier.** Steering the tail current between two paths
  gives a gain that follows a current ratio, and a 10:1 ratio is 20.00 dB of range.
  Exponential control comes from a translinear loop, so the gain is linear in decibels.
  Measured: the gain against the control current over the range, and its departure from
  a straight line in decibels.

### Group H: Integrated filters (4)

- **H1 · The `g_m`-C integrator.** A transconductor into a capacitor integrates with a
  unity-gain frequency of `g_m/(2πC) = 1.592 MHz` at 100 µS and 10.0 pF. Finite output
  resistance makes it leaky, with a DC gain of `g_m r_o = 150`. Measured: the unity-gain
  frequency, the DC gain, and the phase at the unity-gain frequency against 90°.
- **H2 · The `g_m`-C biquad.** Two integrators in a loop. `f_0 = √(g_m1 g_m2/(C1 C2))/2π`
  and `Q = √(g_m1 C2/(g_m2 C1))`, so equal parts give `f_0 = 1.592 MHz` and `Q = 1`.
  The integrators' finite DC gain raises Q, by 3.45 % at a design Q of 5. Measured:
  `f_0` and Q from `transferOf`, and the Q error against the leak.
- **H3 · Tuning against process spread.** A 20 % capacitor spread moves `f_0` by 20 %,
  and an active-RC biquad moves by 28.3 % because its resistor spreads too. A tuning
  loop that locks `g_m/C` to a reference clock removes both. Measured: the spread with
  and without tuning, over a Monte Carlo run.
- **H4 · The ladder, simulated by integrators.** A doubly terminated LC ladder has the
  lowest sensitivity of any realisation, because at the passband maxima the power
  delivered is stationary. Replacing each state with an integrator keeps that property.
  Measured: the sensitivity of `f_0` and of the passband ripple to each element, for the
  ladder and for a cascade of biquads with the same response.

### Group I: Noise and mismatch, designed (4)

- **I1 · Where the noise comes from, by device.** The input-referred noise of a loaded
  pair is `√((8kTγ/g_m1)(1 + g_m3/g_m1))`. At `g_m1 = 200 µS` and `g_m3 = 100 µS` it is
  12.87 nV/√Hz, of which the input pair is 66.67 % of the power and the loads are
  33.33 %. The second stage divided by the first stage's gain of 100 contributes
  0.0040 %. Measured: the total, each share, and the sum equalling the direct solve.
- **I2 · Halving the noise costs four times the current.** Raising `g_m1` from 200 µS
  to 800 µS at a fixed load ratio drops the noise from 12.87 nV/√Hz to 5.574 nV/√Hz.
  Lowering `g_m3` from 100 µS to 50.0 µS at `g_m1 = 800 µS` gets 5.417 nV/√Hz for
  nothing but the loads' own swing. Measured: the noise at four combinations, and the
  current each costs.
- **I3 · Flicker noise has a corner, and the corner is an area.** With
  `K_f = 1.0 × 10⁻²⁵ V²F`, a 10 × 1 µm device at `g_m = 200 µS` has a corner at
  20.98 kHz. Growing it to 40 × 2 µm moves the corner to 2.623 kHz, and eight times the
  area moves it one decade. Measured: the corner at two sizes, and the total noise over
  a 1 Hz to 1 MHz band at each.
- **I4 · The pair sized from the budget.** Given a 5.00 nV/√Hz target with
  `g_m3/g_m1 = 0.5`, the pair needs `g_m1 = 1.325 mS`, which is 66.27 µA at
  `g_m/I_D = 20` and 132.5 µA at `g_m/I_D = 10`. Over a 1 MHz band that is 5.00 µV rms.
  Measured: the required transconductance, both currents, and the integrated noise.

### Group J: The extra element theorem, and trimming (4)

- **J1 · One element added to a known circuit.** Middlebrook's theorem gives the exact
  answer without redoing the analysis. For a common-source stage with `g_m = 200 µS`,
  `R_D = 20.0 kΩ` and `R_s = 10.0 kΩ`, adding `C_gd = 20.0 fF` puts a pole at
  `1/(2π C_gd (R_s(1 + g_m R_D) + R_D)) = 113.7 MHz` and a right-half-plane zero at
  `g_m/(2π C_gd) = 1.592 GHz`. The direct solve gives 114.3 MHz. Measured: both, and
  the theorem's pole against the solve.
- **J2 · The theorem against the Miller estimate.** The Miller estimate for the same
  circuit gives 159.2 MHz, which is 40.0 % high, because it drops the `R_D` term the
  theorem keeps. The pane prints that error beside both. Measured: the estimate, the
  theorem, the exact pole, and the error.
- **J3 · The offset that trimming leaves.** A pair at 2.5 µm² has `σ_VOS = 2.608 mV`
  and a three-sigma spread of 7.823 mV. A 5-bit trim over ±8.00 mV has a 0.500 mV step
  and leaves 144 µV rms. A 6-bit trim leaves 72.2 µV. About 0.21 % of parts fall
  outside the range. Measured: the sigma, the residual at two trim resolutions, and the
  fraction out of range.
- **J4 · Calibration moves the cost to the digital side.** A digitally stored trim code
  removes the offset at one temperature and leaves the drift. The trim's own tempco is
  the new limit, and the Mixed-Signal Lab's converter calibration is the same idea one
  tier up. Measured: the offset before and after, the residual drift over 60 K, and the
  cross-reference to the Mixed-Signal Lab's calibration group.

---

## 6. Hand-overs

- **→ Control Lab** (C4, D3, E1 to E4, H3). Every loop gain T(s) as `plant=custom`
  with `ctrl=p:1`. The mapping is exact and is presented without hedge. The
  common-mode loop of D3 crosses as a second link from the same circuit, which is the
  first time one experiment sends two loops.
- **→ Signal Lab** (G3, H1, H2). The `g_m`-C biquad's H(s) crosses as the raw
  coefficient tier, exactly as Circuit Lab's does. A higher-order ladder crosses as a
  cascade of second-order sections with the order stated, and a section that is not
  second order is declined with the reason. G3's output spectrum cross-references
  Signal Lab's ring-modulation preset by name.
- **→ Power Lab.** Nothing. This lab's currents are microamperes and its efficiency
  question is a noise question. The link is named here so that its absence is a
  decision.
- **← Electronics Lab.** Its M1 two-stage op-amp is this lab's C3 with sizes. Its I1
  mirror gains an area and a sigma in A5. Its J1 pair gains `g_m/I_D` in A3 and an
  offset sigma in A4. Its K3 Miller estimate is J2's comparison. Its O4 noise stack is
  I1's, one device at a time.
- **← Applied Analog Lab.** Its D1 bandgap is B3 with a die's parts, and the two
  `V_ref` values are pinned equal. Its `monteCarlo` and `sensitivity` are imported
  unchanged, which is why Groups B, H and J wait on tier 2's Phase 1.
- **→ Mixed-Signal Lab** (tier 4). F1 to F4's comparator is the SAR's and the flash's.
  C3's two-stage amplifier is the switched-capacitor gain stage's, and its settling
  becomes a dynamic error there. D4's switched-capacitor sensor is that lab's. J4's
  calibration is that lab's converter calibration.
- **→ RF Lab** (tier 5). G3's Gilbert cell is the mixer. A3's `f_T` against `g_m/I_D`
  is the low-noise amplifier's first trade.
- **→ VLSI Lab.** A1's weak-inversion law is the leakage model, and the design view's
  `extra` prop is written for it (§4.3). F4's metastability rate is the Logic Lab's
  synchroniser.

---

## 7. Testing discipline

- **Unit** (`packages/network`): `ekvCurrent` against hand values at ten points across
  five decades of current. `ekvCompanion` against finite differences. `matching`
  against Pelgrom's law at four areas. `decompose` against a hand half-circuit for the
  pair of §4.5. `sizeFor` against the four rows of §4.3.
- **Invariants** (§2.8), fuzzed across sizes, currents and toggles. The hostile cases
  are included. An asymmetric netlist handed to `decompose`, a device at
  `IC = 10⁻⁴`, a cascode whose top device leaves saturation, and a latch started
  exactly at its metastable point.
- **Experiments**: every number in §5 pinned. Among them are 25.79 V⁻¹, 21.3 %,
  0.4010 µA, 89.29 mV/decade and 2.608 mV. Also 5.099 %, 103.5 mV, 2.50 µA, 1.2836 V
  and 17.69 ppm/K. Also 81.02 dB, 36.03°, 90.01°, 50.0 ps, 311 ps and 6.74 × 10⁻³.
  Also 40.0 µA, −3.922 dB, 56.4 mV, 12.87 nV/√Hz, 20.98 kHz, 113.7 MHz and 144 µV.
- **The map's promises**: a test walks every `why` and every cross-reference in it. It
  requires the referenced experiment to exist in the named lab. A reference to an
  Electronics Lab or Applied Analog Lab experiment that is not built fails the suite.
- **Guards**: the EKV against square-law disagreement, the Pelgrom area floor, the
  common-mode half-circuit's error, the `esat` length floor, and the Signal Lab order
  refusal. Each is tested at both sides of its threshold.
- **Cross-lab pins**: D3's common-mode margin in Control Lab, and H2's biquad in
  Signal Lab. Then B3's bandgap against Applied Analog D1, and C3's loop against
  Electronics M3.
- **Playwright harness**: the design view's four columns move together when the cursor
  is dragged. The architecture table's rows match the schematic on screen. The region
  word changes when a cascode leaves saturation. No horizontal scroll at 390 px.
- **REVIEW_PLAYBOOK audit** before release, all eleven classes, a screenshot pass, and
  a sittings script with three seats. One seat sits Group A, because `g_m/I_D` is the
  idea a reader arrives without.

---

## 8. Integration and the dark launch

The mechanism is the one Power Lab and the Elements lab share, unchanged.

- Deployed **dark** at `/analog-ic-lab/` from the first vertical slice. Unlisted, not
  secret.
- `apps/analog-ic-lab/RELEASE_STATUS` reads `dark`. A test asserts that while it does,
  the splash, the root README and the other labs' LabNav contain no reference to this
  lab. Flip the word to `released` and the same test demands the splash card, the
  README row and the nav entries, with counts pinned.
- `deploy.yml` gains one `cp` line, from this lab's `NEEDS.md`, added by the director
  at integration (`PROGRAM.md` §5).
- `progression.test.js` gains this lab's ids and counts, by the same route.
- The flip is **Reed's action**, after the release gate in §9.

---

## 9. Phasing

Each phase ships green and deployable dark. Phase 0 is a gate rather than work.

0. **The Electronics Lab gate.** Groups C, D, F, G, I, J, K, L, M and O built and
   merged. Exit: `smallSignal`, `transferOf`, `returnRatio` and `noise.js` merged and
   fuzzed green, with the `M` element's companion in place.
1. **The device engine.** `ekv.js`, `pelgrom.js`, `sizeFor`. Invariants 1 to 5 fuzzed
   green before any UI exists. Exit: the four rows of §4.3 pinned, and EKV's two limits
   met.
2. **The shell and the design view.** App skeleton, dark deploy, `RELEASE_STATUS` test,
   `GmIdView` with the VLSI Lab's `extra` prop. **Group A** (6). Exit: the design view
   moves four columns from one knob at 390 px, and A1 to A6 are pinned.
3. **Bias.** The Applied Analog Lab's `monteCarlo` imported. **Group B** (5). Exit:
   B3's `V_ref` equals Applied Analog D1's, and B4's two operating points are both
   reported.
4. **Architectures.** The architecture table view. **Group C** (6). Exit: five columns
   for four architectures pinned, and each against one specification.
5. **Differential circuits and compensation.** `decompose`, the halves view, the second
   loop trace. **Groups D, E** (8). Exit: D2's 1.26 % error pinned, D3's margin agrees
   with Control Lab's, and E2's 90.01° reached with the right resistor.
6. **Comparators and translinear circuits.** **Groups F, G** (8). Exit: F2's
   exponential matches `pwlTransient` to 10⁻⁹, and G1's product law holds over three
   decades.
7. **Filters, noise and the method group.** The matching view and the noise shares.
   **Groups H, I, J** (12). Exit: I1's shares sum to the direct total, J1's theorem
   matches the solve, and J3's residual is pinned.
8. **The release gate**, in order, each blocking the next. The full audit. The
   sittings. Reed's own pass against the dark deployment. Then the flip.

---

## 10. Non-goals (v1, stated so they are decisions rather than omissions)

- **Layout, extraction and electromagnetic simulation.** `ANALOG_ROADMAP.md` §5 keeps
  them out. Matching is an area and a sigma, and the common-centroid arrangement is a
  term definition with one figure.
- **BSIM and process design kits.** Hundreds of datasheet parameters. The EKV
  interpolation and three labelled toggles change the numbers a course changes.
- **A second process.** Decision 2. One set, sourced constant by constant.
- **Noise analysis past thermal and flicker.** Shot noise appears only in the bipolar
  bandgap. Burst noise and avalanche noise are datasheet facts.
- **Switched-capacitor circuits.** Tier 4's, including the switched-capacitor
  common-mode sensor of D4 and the settling of C3 as a dynamic error.
- **Time-domain simulation of the EKV model.** Declined with the reason `diode.js`
  already gives. The operating point and the tangent are what this lab uses, and the
  latch's region model carries the one large-signal transient.
- **Automatic sizing or optimisation.** The design view shows four columns against one
  knob. It does not search for the reader.
- **Digital circuits.** The VLSI Lab's, and A1's weak-inversion law is the door.
- **Reliability, aging and electromigration.** `ANALOG_ROADMAP.md` §5.
- **Yield economics.** Yield as a number belongs to tier 2. Its cost does not belong to
  this suite.

---

## 11. Risks, named

- **The dependency chain is two labs deep.** Ten of the Electronics Lab's groups and
  one of the Applied Analog Lab's phases gate this one. Mitigation: §1 lists them by
  id, `BACKLOG.md` mirrors them, and Phase 1 is device work that needs only the `M`
  element's companion.
- **EKV is a model, and a reader may take it for physics.** Mitigation: the label is on
  every pane that uses it, A2 shows the disagreement with the square law as a number,
  and both limits are pinned as tests rather than as prose.
- **Pelgrom's constants are process facts.** `A_VT = 4 mV·µm` is a plausible generic
  value and not a measurement. Mitigation: §3.1 says where each constant comes from,
  the area floor is a guard, and every sigma is stated as a scaling law rather than as
  an absolute promise.
- **The design view is the lab.** If `GmIdView` is slow or hard to read on a phone, the
  method the lab exists to teach does not land. Mitigation: it is built in Phase 2 with
  Group A, the sittings seat one reader on it, and the four-column table of §4.3 is the
  fallback that carries the same content.
- **The architecture table invites a verdict.** Five columns and four rows read as a
  score sheet, and `STYLE.md` S8 removes evaluative words about the work. Mitigation:
  every row answers one stated specification, the table prints margins rather than
  ranks, and no note says one architecture is better than another.
- **Two loops on one node.** D3's common-mode loop and the differential loop share the
  output, and a reader can confuse their margins. Mitigation: the loop view carries two
  traces with two colours and two named margins, and the invariant checks both against
  Blackman's form.
- **Metastability numbers span twenty decades.** A failure every 29.7 ns and a failure
  every 97.0 ms come from the same formula. Mitigation: F4 plots the rate on a log axis
  and states the time available, so that the exponential is the lesson rather than the
  surprise.
- **Cost.** One device model, one statistic, one decomposition, one design view, ten
  groups and 45 experiments, behind a ten-group gate. Mitigation: Phase 1's engine is
  small and independently useful to the VLSI Lab, and Phases 2 to 4 are a complete
  short course on sizing a device and choosing an architecture.
