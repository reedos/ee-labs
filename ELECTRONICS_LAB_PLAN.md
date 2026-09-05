# Electronics Lab: the plan

A sixth lab for the suite: **analog electronics**, the course that follows circuits.
It starts exactly where Circuit Elements Lab stops, at the op-amp with finite gain and
rails and the diode with four models. It leaves no step out between there and the
inside of an op-amp. Splash glyph `⊳`, directory `apps/electronics-lab`, engine as an
extension of `packages/network`.

The path, in order. The op-amp as a user meets it. The last diode circuits. The
junction, and where the exponential comes from. The transistor as a controlled source.
Bias, and the capacitor that separates it from the signal. The small-signal model as
the tangent at the point. Ports and loading. The single-stage amplifiers, mirrors and
differential pairs. Frequency response and the Miller effect. Feedback and its margins.
The op-amp from the inside. Oscillators. Noise.

This is a draft (2026-09-05, revised the same day) for Reed to settle. Where the
other plans say "decisions already made", this one says "recommended", and §0 lists
what needs a decision. §1 is the progression map. It lists every idea the lab leans
on, where the suite already teaches it, and where it does not.

The two rules that govern the other labs govern this one with no exemption. **Every
explanatory sentence is a claim about physics, and a test must measure it.** And
`CORE_SCOPE.md` decides what the engine may state exactly, what it may approximate
behind a guard, and what it declines with a reason. Electronics is where the second
rule earns its keep. A transistor is not a rational function of s. Its tangent at an
operating point is one, and the label on that tangent is the content of the course.

---

## 0. Open decisions

### Decision 1: the name (recommended: Electronics Lab)

`CIRCUIT_ELEMENTS_LAB_PLAN.md` §9 already calls the transistor lab "Electronics", and
the course it mirrors is called that in most catalogues. LabNav short form
**"Electronics"**. The splash card names the path in one line: "the op-amp's limits,
the junction, the transistor, the amplifier, the op-amp from the inside".

Alternatives considered. *Analog Lab* reads as the opposite of Signal Lab's digital
half and would mislead a reader looking for phasors. *Amplifier Lab* names half the
content and none of the junction, the oscillators or the noise. *Transistor Lab* names
the element rather than the course.

### Decision 2: one lab or two

Recommended: **one codebase and one dark URL, and the split decided at release.**
Groups A to J are the first electronics course (the op-amp's limits, diodes finished,
the junction, devices, bias, small signals, ports, stages, mirrors, pairs). Groups K to
O are the second (frequency response, feedback, the op-amp inside, oscillators, noise).
At 77 experiments this is the suite's longest sidebar, and the sittings (§7) will say
whether one nav row can hold it. The split point is named so that cutting the lab in
two later moves no experiment.

### Decision 3: where the two orphan diode circuits live

The clamper and the voltage doubler are the last two diode circuits of a first course.
Circuit Elements Lab's plan deferred the clamper and never scheduled the doubler. They
need nothing this lab adds, only the event engine that lab already has. Recommended:
**build them there, as I9 and I10**, and this lab's Group B specifies them so the gap is
closed by whichever lab ships first. The count below includes them.

### Decision 4: where the engine lives

Recommended: **extend `packages/network`** rather than open `packages/devices`. The
Elements plan reserved exactly this: "reuses this engine (DC Newton for the bias point,
then small-signal LTI) plus one more nonlinear element type". The new files are named in
§2, and each is one module beside `diode.js` and `pwl.js`. A separate package would
have to import the stamps, the propagator and the event machinery anyway.

### Decision 5: six labs in a phone-width nav

The Elements plan fitted five labs in 390 px with one short form. Six needs a decision:
short forms for every lab, or a nav that folds past four. Recommended: **fold**. The
current lab and its two neighbours in the course order stay visible, and a "More" chip
opens the rest. The course order is Elements, Circuit, Electronics, Signal, Control,
Power. This is a shared-surface change and lands in the release commit only (§8).

---

## 1. The progression map

The first draft of this plan opened on the transistor's curves. Between the Elements
lab's last experiment and that point a course teaches five things, and the suite had
none of them. This section lists every idea the lab leans on, the experiment that
teaches it, and whether that experiment exists. Each "gap" row names the group in this
plan that closes it.

| Idea the lab leans on | Needed by | Taught at | Status |
| --- | --- | --- | --- |
| The two laws, series and parallel, nodal analysis, Thévenin | everything | Elements A to D | built |
| Dependent sources, the op-amp as a black box with `R_in`, A, `R_out` | A, G2, M1 | Elements E1, E2 | built |
| Finite gain, rails, the comparator, the Schmitt trigger | A, N3 | Elements E3, E4, E9 | built |
| Thévenin of a port with a dependent source inside | G1, every `R_in` and `R_out` | nowhere | **gap, G1** |
| The capacitor as an open at DC and a short at signal frequencies | E1 | Elements F1, H3 | built, joined by E1 |
| First-order and second-order response, damping | K, L5 | Elements F, G | built |
| Phasors, impedance, one sine at a time | K | Elements H | built |
| The diode's four models, the tangent `r_d`, Newton, assumed state | C, D1, F1 | Elements I1 to I3 | built |
| Rectifiers, the peak rectifier, the clipper, the Zener | A6, B | Elements I4 to I8 | built |
| The clamper and the voltage doubler | B | nowhere | **gap, B** |
| Offset, bias current, gain-bandwidth, slew, CMRR, output limits | A, M | nowhere (Elements §9 deferred them) | **gap, A** |
| Where the exponential, `C_π`, `C_μ` and the temperature law come from | C, E4, K1 | nowhere | **gap, C** |
| The transistor | D onward | nowhere (Elements §9 names this lab) | **gap, D** |
| H(s), poles and zeros, dB, the corner, Q, active filters | K, L | Circuit Lab, 15 built | built |
| Loop gain, margins, root locus, the step's overshoot | L5, M3, N1 | Control Lab, 13 built | built |
| Spectra, harmonics, clipping, two tones in one nonlinearity | F5, H7, M6 | Signal Lab, Fourier and Nonlinearity groups | built |
| Noise as a signal with a spectral density | O | nowhere | **gap, O1** |
| The switch with `R_on`, efficiency as a ceiling | D5, M6 | Power Lab A, B | built |
| Coupled inductors | N4 (stretch) | Power Lab Group D, planned | not built, not blocking |

Two things the map shows that this plan does not fix, so that they are decisions and
not omissions. **Coupled inductors and transformers** have no built home. Power Lab's
Group D is their plan, and only N4 here would use them. **Laplace transforms as a
topic** were declined by the Elements plan, and Circuit Lab is the door to H(s). This
lab uses H(s) throughout and adds nothing about the transform itself. The map across
all six labs, with the seams between them, is `CURRICULUM.md`.

The order of the groups follows the map. Nothing in a group leans on an experiment
that comes later in this lab or in a lab that is not built. The four bridging groups
(A, B, C, G) are short, and each ends at the point where the draft began.

---

## 2. The engine: the operating point, the tangent, and the network around it

### 2.1 What exists, and what is missing

`packages/network` already has the three things a transistor needs. Newton's method
with junction limiting finds the exponential diode's operating point and keeps its
iterations (`pwl.js`). Region models with events give exact waveforms for
piecewise-linear elements in time. The VCCS stamp in `mna.js` is the small-signal
transistor's core, `g_m v_be`. What is missing is listed here, and nothing else is
built.

| Need | Today | This plan |
| --- | --- | --- |
| The op-amp with a speed and a slew limit | finite A and rails only | a macro of existing elements, and one PWL current limit (§2.2) |
| Junction closed forms | none | `junction.js` (§2.3) |
| A transistor element | `D` only | `Q` (BJT) and `M` (MOSFET) in `netlist.js` `KINDS` |
| Newton over any nonlinear element | diodes only, hard-coded | a companion interface any element implements (§2.5) |
| The small-signal netlist at a point | nothing | `smallSignal(net, op)` (§2.6) |
| H(s) from a linear netlist as polynomials | `sweepAC` (points only) | `transferOf(net, input, output)` (§2.7) |
| Loop gain of a feedback circuit | nothing | `returnRatio(net, source)` (§2.9) |
| Noise sources, a noise signal, and their sum | nothing | `noise.js` (§2.10) |

### 2.2 The op-amp with a speed, without a new stamp

The Elements plan declined the gain-bandwidth toggle because `A(s) = ω_t/s` would make
the op-amp a dynamic element. That would mean a new stamp in the complex solve and a
new state in time. It does not need one. The single-pole op-amp `A₀/(1 + s/ω_p)` is a **macro** of
elements the package already stamps. A VCCS of `g` from the input difference feeds a
resistor R in parallel with a capacitor C, and a unity VCVS carries that node to the
output through `R_out`. `A₀ = gR` and `ω_p = 1/RC`. The macro expands at `normalize`, so the
equations view prints it and every solver sees ordinary elements. The rails stay the
region model they are.

Slew rate is the one new element. The macro's VCCS is **current-limited** at `±I_max`,
a piecewise-linear region like a diode's, so `pwlTransient` solves the ramp exactly at
`I_max/C`. Offset is a battery at one input and bias current is two current sources,
both existing elements. Every non-ideality Group A shows is therefore a toggle on the
Elements E2 black box, and Group M derives each number from transistors.

### 2.3 The junction's closed forms

`junction.js` holds the four formulas Group C teaches. Each is a DC calculation from
doping and geometry. The built-in potential `V_0 = V_T ln(N_A N_D/n_i²)`. The depletion
capacitance `C_j = C_j0/√(1 − v/V_0)`. The diffusion capacitance `C_d = τ_F g_m`. And
`I_S(T)` with the SPICE temperature law, `I_S ∝ T³ e^{−E_g/kT}`. They are used in two
places: the C group's panels, and the defaults for `C_π`, `C_μ` and the temperature
toggle. A number in Group K can therefore be traced back to a formula in Group C.

The nonlinear capacitance is a small-signal value at the operating point. That is the
only way this lab uses it. A capacitance that varies with voltage in time is not LTI
within a region. It is declined with the reason `diode.js` gives.

### 2.4 The transistor's models, each labelled

The diode has four models, each an approximation of the next, and the lab teaches them
as such. The transistor gets the same treatment, two models each.

**BJT.** The **three-region model**: cutoff (open), active (`v_BE = 0.7 V`,
`i_C = β i_B`), saturation (`v_BE = 0.7 V`, `v_CE = 0.2 V`). It is piecewise-linear,
so every exact method in the package applies to it, in DC and in time. The
**exponential model** is Ebers–Moll in transport form: `i_T = I_S (e^{v_BE/V_T} −
e^{v_BC/V_T})`, with `β_F`, `β_R`, and the Early voltage `V_A`. D1 shows it as what it
is, two of Elements I1's diodes and one controlled source. It is solved by Newton for the
operating point and by the tangent for small signals, and in time it is declined with
the reason, exactly as the exponential diode is.

**MOSFET.** The **square-law model**: cutoff, triode (`i_D = k_n[(v_GS − V_t)v_DS −
v_DS²/2]`), saturation (`i_D = ½ k_n (v_GS − V_t)² (1 + λ v_DS)`). It is nonlinear
inside each region, so it is a Newton model with region tracking, not a PWL one. The
**switch model** is Power Lab's: `R_on` on, open off, piecewise-linear and exact in
time.

Which model is in use is always on screen, and every experiment that compares two
prints the difference at the operating point.

### 2.5 Newton's method over a companion interface

`newtonDC` in `pwl.js` linearises exponential diodes by hand. It becomes general. An
element with a nonlinear law provides one function, `companion(v)`, returning the
conductances and current sources that stamp its tangent at the vector `v` of its
controlling voltages. A diode returns one conductance and one source. A BJT returns two
junction conductances, a transconductance stamped as a VCCS, and their offset sources.
A MOSFET returns a conductance, a transconductance and an output conductance, and
reports which region it is in.

The iteration loop does not change. Junction limiting (`pnjlim`) applies to every
junction voltage. Region changes on a MOSFET are recorded per iteration so the view can
show them. Convergence failure raises the existing `newton` refusal with its message.
Two additions come from circuits the diode never needed. **Source stepping** ramps the
supplies from zero when the direct solve fails, which an active-loaded stage will do.
And a **bias-only-in-loop** flag names the case where an op-amp's open-loop operating
point sits at a rail, so the experiment closes the loop for the bias solve and says so.

### 2.6 Linearisation is a netlist

`smallSignal(net, op)` takes a circuit and its operating point and returns a **linear
netlist**. Every DC source becomes a wire or an open. Every transistor becomes its
hybrid-π: `r_π = β/g_m`, `g_m v_be` as a VCCS, `r_o = V_A/I_C`, and `C_π`, `C_μ` when
the frequency toggles are on. A MOSFET becomes `g_m`, `r_o`, `C_gs`, `C_gd`. The
returned netlist is an ordinary `packages/network` circuit, so `solveDC`, `sweepAC`,
`dynamics` and `transient` apply to it unchanged, and the equations view prints it.

This is the CORE_SCOPE worked example "linearized transistor stage" made concrete.
The small-signal network is exactly rational and is admitted to `systems` in full. The
label it carries states the operating point it was taken at, `(V_CE = 5.00 V,
I_C = 1.00 mA)`, and the amplitude guard of §2.8 says how far from that point the
tangent still describes the curve.

### 2.7 Exact transfer functions from a linear netlist

`sweepAC` gives H at a list of frequencies. Feedback, compensation and the Control Lab
hand-over need H(s) as two polynomials. `transferOf(net, input, output)` builds the
state-space form of §1.4 of the Elements plan, `(A, B, C, D)`, and converts it by
Faddeev–LeVerrier: the characteristic polynomial (`charPoly` already exists) and the
numerator `C adj(sI − A) B + D det(sI − A)`. The result is exact rational H(s), in the
currency `@ee-labs/systems` trades in. Poles and zeros come from `polesZeros`, margins
from `margins`, step response from `stepResponse`, all existing.

Conditioning is the risk (§11). A two-stage op-amp is six states with a gain of 10⁵,
and Faddeev–LeVerrier is known to lose digits there. The invariant that holds it is
§2.12 item 3: H(jω) from the polynomials must equal `sweepAC` at every point, and the
build fails when it does not.

### 2.8 Large signals in time: three routes, each labelled

An amplifier driven hard clips, and the lesson is in the clipping. There are three ways
this lab shows a large-signal waveform, and the panel names which one it is using.

1. **Piecewise-linear models, exact.** The three-region BJT, the switch MOSFET, the
   diode's region models, the op-amp's rails and its current limit are all PWL, and
   `pwlTransient` solves them exactly, events and all. Clipping (H7), class B crossover
   (M6), the slew-rate ramp (A4) and the oscillator's amplitude limit (N2) are all this
   route. The model is an approximation of the device, and the panel prints its error
   at the operating point. The solution is not an approximation of the model.
2. **The quasi-static sweep, guarded.** With the exponential model, the stage's
   **transfer characteristic** `v_out(v_in)` is a DC sweep, one Newton solve per
   point, each exact. A slow input maps through it point by point, and the FFT of the
   result gives harmonic distortion. The guard is a frequency: the input must sit
   below the stage's lowest pole by a factor of twenty, or the pane warns, and below a
   factor of five it declines. The threshold is stated on the pane and tested.
3. **The exponential model in time: declined.** The reason is the one `diode.js`
   already gives. A timestep solver's error cannot be told apart from physics in this
   suite, so it does not ship one.

The small-signal view carries its own guard. The tangent describes the exponential to
within the second harmonic `v_be/(4V_T)`: 4.8 % at 5 mV peak, 9.7 % at 10 mV. Past
5 mV the small-signal ghost on the scope turns amber and the readout prints the
estimate. F5 is the experiment that shows the guard being crossed.

### 2.9 Loop gain by breaking the loop

`returnRatio(net, source)` computes the return ratio T of one dependent source in the
small-signal netlist. Set the source's controlling signal to 1, solve, read what comes
back to its input. For a circuit with one controlled source in the loop this is exact,
and the closed-loop gain is `A_∞ · T/(1 + T) + d`, Blackman's form, with the direct
transmission `d` computed the same way. For a circuit with several transistors the loop
is broken at the one the experiment names, and T is that element's return ratio, which
is what a designer measures. T(s) comes out as polynomials through §2.7, and that is
what crosses to Control Lab.

### 2.10 Noise

Noise enters the suite here, so it enters twice. First as a **signal**: a seeded
white generator and the averaged periodogram, so that O1 can show that a random signal
has a density and not a spectrum, with the FFT `@ee-labs/dsp` already has. Then as
**sources**: each resistor carries a thermal source `4kTR` and each junction a shot
source `2qI`, as spectral densities. `noise.js` solves the small-signal netlist once
per source per frequency for the transfer to the output, and sums `|H_k(jω)|² S_k`.

The per-frequency density is exact. The integrated rms over a band is a numerical
integral with the band stated. The pin is the one case with a closed form. One resistor
into one capacitor integrates to `kT/C` whatever R is, and a first-order stage's noise
bandwidth is `(π/2) f_c`. Flicker noise is a labelled toggle (`K_f/f`), off by
default, because its constant is a datasheet fact rather than physics the lab can
derive.

### 2.11 Measures

Everything the Elements lab measures, plus: the operating point `(I_C, V_CE)` or
`(I_D, V_DS)` and the region. `g_m`, `r_π`, `r_o`. Voltage gain, `R_in`, `R_out`,
each by the definition (a test source at the port, the ratio read off). The −3 dB
corners, low and high, from the exact H(s). Harmonic distortion by the lab's FFT,
THD and HD2 separately. Loop gain magnitude and phase at any frequency, gain and phase
margins. Noise density at any frequency and rms over the band. Offset referred to the
input, and the slew of a ramp.

### 2.12 Invariants, the fuzzer's checklist

Across random component values and bias settings on every library circuit:

1. **The point satisfies the laws.** KCL at every node to floating point. Every
   transistor's currents equal its model's law at its voltages to floating point.
2. **The tangent is the derivative.** Small-signal gain from `smallSignal` equals the
   finite-difference slope of the quasi-static sweep at the point, to 10⁻⁶ relative.
3. **Polynomials agree with points.** `transferOf` evaluated at jω equals `sweepAC` at
   all 241 sweep points, to 10⁻⁹ relative.
4. **Two models agree where they claim to.** The three-region and exponential BJT
   models give operating points within the three-region model's stated error, and the
   error the panel prints is the measured one.
5. **Region consistency.** Every PWL element ends in a region whose guards it
   satisfies, and no event is missed (no guard is violated between events).
6. **Feedback closes.** The direct closed-loop solve equals Blackman's form from the
   return ratio, to floating point.
7. **The macro is the black box.** The op-amp macro with its pole at infinity and its
   limits off gives Elements E2's numbers, `A`, `R_in`, `R_out`, to floating point.
8. **Tellegen.** `Σ v_k i_k = 0` in DC and in the small-signal circuit at every
   frequency, with the dependent sources counted.
9. **Noise closes.** One resistor into one capacitor integrates to `kT/C` within
   0.1 % when the band runs to 1000 f_c, and the gap is the tail the pane prints.
10. **Cross-lab.** The CE stage's H(s) sent to Control Lab as a plant gives the same
    margins there as here. Its order-2 version sent to Signal Lab agrees at the corner.
    The two-stage op-amp's DC gain, `R_in` and `R_out` equal what Group A's macro shows
    when handed the same numbers.

---

## 3. Models: the element library

Everything in the Elements plan's §2 table stays. These are added.

| Element | Ideal law | Non-ideality toggles (each labelled) |
| --- | --- | --- |
| Op-amp (macro) | Elements' nullor, finite A, rails | single pole `A₀/(1 + s/ω_p)`, admissible. Slew as a PWL current limit. Offset `V_OS`, bias current `I_B`, CMRR, output current limit |
| Junction (`junction.js`) | `V_0`, `C_j(v)`, `C_d`, `I_S(T)` from `N_A`, `N_D`, area, `τ_F` | none, these are the physics the toggles below are traced to |
| BJT (`Q`) | three-region model (`V_BE = 0.7 V`, `V_CEsat = 0.2 V`, β) | exponential model (`I_S`, `β_F`, `β_R`, `n`). Early `V_A`. `C_π`, `C_μ` (or `f_T`). Temperature `T`. `r_x` (stretch) |
| MOSFET (`M`) | square law (`V_t`, `k_n`), three regions | λ. `C_gs`, `C_gd`. Switch model (`R_on`), from Power Lab. `V_t` spread ±0.1 V |
| Noise sources | none | thermal on every R, shot on every junction, flicker `K_f/f` (off by default). A white noise source with a seed |

Sources gain one attribute: an AC source marked **small**, whose amplitude is judged
against `V_T` by the guard of §2.8. Every experiment that shows a small-signal ghost
uses one.

**Schematic description.** As the Elements lab: each library circuit is a netlist with
grid positions, drawn by `packages/ui/Schematic.jsx`. Two symbols are added (NPN and
PNP, NMOS and PMOS as four glyphs) with the same live-meter slots. The small-signal
overlay (§4.2) is the renderer's one new capability.

---

## 4. The app

### 4.1 Layout

The Elements lab's shape, unchanged: sidebar with LabNav, report link, experiment
groups, circuit picker, component NumFields with chips, model and toggle switches, and
the math panel. Main: topbar meters, the schematic always visible, and one pane below
with a pane selector. Phone-width first, no horizontal scroll at 390 px, harness-checked.

The topbar shows the operating point and its region first. Then come the
experiment's headline numbers (`g_m`, `A_v`, `R_in`, `f_H`, `PM`, `v_n`), and the
model in use.

### 4.2 Views

- **Schematic with two overlays.** DC values in one colour, small-signal amplitudes
  in another, with a toggle between them and a "both" mode that prints `5.00 V +
  0.184 V·sin`. Meters follow the time cursor as in the Elements lab.
- **Device curves.** `i_C` against `v_CE` at stepped `v_BE`, or `i_D` against `v_DS`
  at stepped `v_GS`, with the load line and the operating point on it, and the
  region boundaries drawn. Newton's iterations can be shown on the plane, as I2 of the
  Elements lab shows them for the diode.
- **Transfer characteristic.** `v_out` against `v_in` from the quasi-static sweep,
  the tangent at the point, and the input sine mapped through the curve to the output
  beside it. This is where "small signal" becomes a picture, and where the CMOS
  inverter's noise margins are read.
- **Scope.** The exact PWL waveform or the quasi-static one, with the small-signal
  prediction as a dashed ghost that turns amber past the guard.
- **Bode and pole-zero.** From `transferOf`, so poles are numbers and not pictures.
  The Miller estimate and the open-circuit-time-constant estimate are drawn as marks
  on the same axis with their error printed.
- **Loop.** T(jω) with the gain and phase margins marked, and the hand-over to Control
  Lab beside it.
- **Spectrum.** The output's harmonics from the lab's own FFT, with THD and HD2. For
  O1, the averaged periodogram with the number of averages on a knob.
- **Noise.** The output density as a stack, one band per source, and the rms over the
  band in the corner with the band stated.
- **Junction.** The depletion region drawn to scale against v, with `C_j` beside it,
  for Group C.
- **Equations.** The small-signal netlist printed as elements, then the MNA rows, as
  the Elements lab prints them.

### 4.3 Numbers

The defaults are chosen so that every quoted number is round enough to remember and
the pictures fit a phone.

- Op-amp as a user meets it: `A₀ = 10⁵`, `f_t = 1 MHz` (so `f_p = 10 Hz`),
  `SR = 0.5 V/µs`, `V_OS = 1 mV`, `I_B = 100 nA`, CMRR 90 dB, `I_out,max = 25 mA`,
  rails ±12 V. The 741's numbers, and Group M's targets.
- Junction: `N_A = 10¹⁷ cm⁻³`, `N_D = 10¹⁶ cm⁻³`, `n_i = 1.5 × 10¹⁰ cm⁻³`, so
  `V_0 = 753 mV`. `C_j0 = 2 pF`. `τ_F = 0.5 ns`. `E_g = 1.12 eV`.
- BJT: `I_C = 1 mA`, `β = 100`, `V_A = 100 V`, `V_T = 25.85 mV` at 300 K. So
  `g_m = 38.7 mA/V`, `r_π = 2.59 kΩ`, `r_o = 100 kΩ`. `C_π = 20 pF` (19.3 pF of it
  diffusion), `C_μ = 2 pF`, so `f_T = 280 MHz`.
- CE stage: `V_CC = 10 V`, `R_C = 5 kΩ`, `V_CE = 5 V`, `R_s = 1 kΩ`. Gain −184 with
  `r_o`, −193 without.
- MOSFET: `V_t = 0.7 V`, `k_n = 20 mA/V²`, `V_OV = 0.2 V`, so `I_D = 0.4 mA` and
  `g_m = 4 mA/V`. `λ = 0.02 V⁻¹`, so `r_o = 125 kΩ`. CMOS inverter at `V_DD = 5 V`,
  matched.
- Differential pair: tail 1 mA, `R_C = 5 kΩ`, so `g_m = 19.3 mA/V` per side and
  `A_d = 96.7`.
- Op-amp inside: `g_m1 = 0.19 mA/V`, `C_c = 30 pF`, tail 15 µA. So `f_t = 1.01 MHz`
  and `SR = 0.5 V/µs`, which is Group A's op-amp, derived.
- Wien bridge: `R = 10 kΩ`, `C = 10 nF`, `f = 1591.5 Hz`. Relaxation: `R = 4.55 kΩ`,
  `C = 100 nF`, `β = 0.5`, period 1.00 ms.
- Noise: `R = 1 kΩ` at 300 K is 4.07 nV/√Hz. 1 mA of shot noise is 17.9 pA/√Hz.
  `kT/C` at 1 nF is 2.04 µV rms. The white source: 1 mV rms at 48 kHz, 6.45 µV/√Hz.

---

## 5. Curriculum: 77 experiments in 15 groups

Format, as the other plans: **the claim** the note makes, what the reader turns, and
what is **measured** against what **formula**. Every quoted number becomes a pinned
test. The order is the progression map's. Each experiment ships with `see`, `try` and
`why` in the Elements lab's three registers, within the STYLE.md budgets. Groups A, B,
C and G are the bridges the first draft skipped, and each is marked.

### Group A: The op-amp as a user meets it (6) · bridge

Elements E2 drew the op-amp as a box with three numbers and said the rest were
datasheet facts. A user meets those facts on the first breadboard, before any
transistor, and every course teaches them here. Each is a toggle on the same box.

- **A1 · Offset voltage.** A 1 mV battery in series with one input. The
  non-inverting amplifier with gain 11 puts 11 mV at the output with nothing applied,
  and the integrator of Elements F7 ramps away on its own. Measured: the output offset
  at three gains, and the integrator's ramp slope `V_OS/RC`.
- **A2 · Bias current.** 100 nA into each input. Through `R_f = 100 kΩ` it makes
  10 mV of output. A resistor `R_f ∥ R_g` in the other input cancels it, and the pane
  shows the cancellation is exact only when the two currents match. Measured: 10 mV,
  the cancellation, and the residual from a 10 % mismatch.
- **A3 · Gain-bandwidth.** `A(s) = A₀/(1 + s/ω_p)` with `A₀ = 10⁵` and `f_p = 10 Hz`.
  Closed at gain 11 the bandwidth is `f_t/11 = 90.9 kHz`, at gain 101 it is 9.9 kHz,
  and the product is 1 MHz every time. This is the toggle Elements deferred, and that
  integrator now has a corner. Measured: the exact closed-loop pole at three gains.
- **A4 · Slew rate, and full-power bandwidth.** The output cannot move faster than
  0.5 V/µs, so a 10 V step is a 20 µs ramp, exactly, from the current limit. A 10 V
  sine turns into a triangle above `f_M = SR/(2π V_p) = 7.96 kHz`, while the
  small-signal bandwidth is still 1 MHz. Measured: the ramp slope, `f_M`, and the
  amplitude at which a 20 kHz sine first distorts.
- **A5 · Common-mode rejection, and the output's limits.** With CMRR at 90 dB a 5 V
  common-mode input appears as 158 µV of input error. Then the output current limit,
  25 mA into 100 Ω, clips at 2.5 V where the rails would have allowed 12 V. Measured:
  the input error, and both clip levels.
- **A6 · The precision rectifier.** A diode inside the loop. The op-amp adds the 0.7 V
  the diode needs, so the output tracks a 10 mV sine's positive half within
  `V_f/A₀ = 7 µV`, where Elements I4's bare diode passed nothing. Measured: the tracking error,
  and that diode's output at the same amplitude.

### Group B: Diode circuits, finished (2) · bridge

Elements I7 built the clipper alone and deferred the clamper. These two complete a
first course's diode chapter and need nothing this lab adds (Decision 3).

- **B1 · The clamper.** A diode and a capacitor shift the DC level, so the waveform's
  peak sits at `−V_f` and its mean at `V_p − V_f`. The capacitor charges once and the
  diode then never conducts, and the events view shows exactly one conduction.
  Measured: the peak, the mean, and the conduction count.
- **B2 · The voltage doubler.** A clamper into a peak rectifier. `2V_p − 2V_f =
  18.6 V` from a 10 V sine, reached over several cycles that the scope counts. Measured:
  the final level, and the number of cycles to 99 % of it.

### Group C: Inside the junction (4) · bridge

Elements I1 gave Shockley's law as a fact. Every later number in this lab that is not
a resistor value comes from the junction, and this group is where the reader sees
that. Four closed forms, each with a picture.

- **C1 · Where the exponential comes from.** Two doped regions meet and the built-in
  potential is `V_0 = V_T ln(N_A N_D/n_i²) = 753 mV`. Forward bias lowers the barrier
  and the current rises as `e^{v/V_T}`, which is Elements I1's curve with a reason. The
  depletion region is drawn to scale against v. Measured: `V_0`, and the width against
  the formula at three voltages.
- **C2 · Junction capacitance.** `C_j = C_j0/√(1 − v/V_0)`. 2 pF at zero bias is
  0.72 pF at −5 V and 3.45 pF at +0.5 V. This is the transistor's `C_μ`, and Group K
  reads it from here. Measured: the three values.
- **C3 · Diffusion capacitance and the transit time.** A forward junction stores
  charge `τ_F I`, so `C_d = τ_F g_m = 19.3 pF` at 1 mA with `τ_F = 0.5 ns`. This is
  most of `C_π`, and it is why `f_T` rises with current toward `1/(2π τ_F) = 318 MHz`.
  Measured: `C_d` at three currents, and the `f_T` limit.
- **C4 · Temperature.** `I_S ∝ T³ e^{−E_g/kT}` doubles every 4.5 K, so at fixed
  current `V_BE` falls 1.66 mV/K at 0.7 V (the textbook's 2 mV/K is at 0.6 V). The
  law is SPICE's and is labelled. Measured: the doubling interval, and the slope at both
  voltages.

### Group D: The transistor as a controlled source (7)

- **D1 · Two junctions and a thin base.** Ebers–Moll is two of Elements I1's diodes and one
  current source, drawn as such. Forward bias the emitter junction and almost all of
  its current comes out of the collector, because the base is thin. `α = 0.99`,
  `β = α/(1 − α) = 100`. Measured: the model's currents equal the two-diode drawing's
  to floating point, and β from α.
- **D2 · The BJT's curves.** `i_C` against `v_CE` at stepped `v_BE`. The exponential
  law, 60 mV per decade of current (`V_T ln 10 = 59.5 mV`), and `β = i_C/i_B`. The
  Early voltage as the slope, every curve extrapolating back to `−V_A`. Measured: the
  decade slope, β, and the extrapolation at three bias points.
- **D3 · Three regions, and the model that has only three lines.** Sweep `v_CE` at
  fixed `i_B`. The knee near 0.2 V is saturation, the flat part is active, and below
  `v_BE = 0.5 V` nothing flows. The three-region model is overlaid with its error at the
  point. Measured: the two models agree within 5 % in the active region and disagree
  by more than 10 % inside 0.3 V of the knee.
- **D4 · The MOSFET's curves.** `i_D` against `v_DS` at stepped `v_GS`. The square
  law, `I_D = ½ k_n V_OV² = 0.4 mA` at `V_OV = 0.2 V`, and the triode-saturation
  boundary at `v_DS = V_OV`, drawn as the parabola through every knee. λ as the slope.
  Measured: the current, the boundary and the slope.
- **D5 · The transistor as a switch.** Drive a load from cutoff to saturation. The base
  needs more than `I_C/β`, and the overdrive sets `V_CE = 0.2 V` under the three-region
  model. The MOSFET's `R_on` is the same lesson, and Power Lab's every switch is this
  element. Measured: the forced β, the on-state drop, and the load current.
- **D6 · The CMOS inverter.** Two switches that are never on together. The transfer
  characteristic from the quasi-static sweep, `V_M = V_DD/2 = 2.5 V` when matched, and
  the noise margins `V_IL = 2.05 V`, `V_IH = 2.95 V`. No current at either end, which
  is the door to digital. Measured: `V_M`, both margins, and the supply current at
  0 V and 5 V.
- **D7 · The load line.** `V_CC = 10 V`, `R_C = 5 kΩ`. The resistor's line
  `i_C = (V_CC − v_CE)/R_C` meets the curve for the `v_BE` set. Turn `v_BE` and the
  point slides along the line from cutoff to saturation. Measured: the point lies on
  the line to floating point, and the swing limits are 10 V and 0.2 V.

### Group E: Signal and bias take different paths (6)

- **E1 · The coupling capacitor.** Elements F1 said a capacitor is open at DC and Elements H3
  said its impedance falls with frequency. Put both together: a 10 µF capacitor
  between the source and the base carries the 1 kHz signal (16 Ω) and blocks the bias.
  The DC overlay and the AC overlay show two different circuits. Measured: the base's
  DC voltage unchanged by the source, and the signal's loss through the capacitor.
- **E2 · Fixed bias depends on β.** `I_C = β(V_CC − 0.7)/R_B`. With `R_B = 1.3 MΩ`
  from 15 V, β from 50 to 200 moves `I_C` from 0.55 mA to 2.2 mA, and the point slides
  into saturation. Measured: `I_C` at each β, and the region at β = 200.
- **E3 · Emitter degeneration holds it.** The four-resistor bias with `R_E = 1 kΩ`,
  `R_B = 10 kΩ`, `V_BB = 1.8 V`: `I_C = (V_BB − 0.7)/(R_E + R_B/(β + 1))`. The same β
  range moves it from 0.92 mA to 1.05 mA. The rule `R_B ≤ 0.1 (β + 1) R_E` is stated
  and tested. Measured: `I_C` at each β.
- **E4 · Temperature.** C4's 1.66 mV/K over 50 K is 83 mV. The degenerated circuit
  moves `I_C` by `ΔV_BE/(R_E + R_B/(β + 1)) = 75 µA`, 7.5 %, and fixed bias runs away.
  Measured: both shifts.
- **E5 · MOSFET bias and the threshold spread.** A divider and `R_S = 2.5 kΩ` set
  `I_D = 0.4 mA`. Toggle a +0.1 V threshold shift: `I_D` falls 9 % with `R_S` and 75 %
  without it, because `V_OV` halves and the square law squares it. Measured: both
  shifts.
- **E6 · Bias from a current source.** An ideal source in the emitter sets `I_E`, so
  `I_C = α I_E` whatever β or temperature does. This is what a mirror is for, and I1
  builds one. Measured: `I_C` moves under 1 % over β 50 to 200 and 50 K.

### Group F: Small signals, the tangent at the point (6)

- **F1 · The tangent, again.** Elements I1 drew the diode's `r_d = nV_T/I` as the
  curve's local slope. The transistor's `g_m = I_C/V_T` is the same slope, of the same
  exponential, read as a current per volt. Both on one plane. Measured: `r_d` at 1 mA
  is 25.9 Ω, and `1/g_m` at 1 mA is 25.9 Ω.
- **F2 · DC plus AC.** `v_BE = V_BE + v_be`, `i_C = I_C + i_c`. The scope shows the
  total and the meters show both parts, and Elements D4's superposition is what
  allows the split. At 1 mV peak, `i_c` is `g_m × 1 mV = 38.7 µA` peak. Measured: the
  AC part of the quasi-static waveform against `g_m v_be`, within 1 %.
- **F3 · Transconductance is the slope.** Double `I_C` and `g_m` doubles. The
  MOSFET's `g_m = 2I_D/V_OV` is 4 mA/V at 0.4 mA, against the BJT's 15.5 mA/V at the
  same current. Measured: `g_m` equals the finite-difference slope of the sweep to
  10⁻⁶ (invariant 2 on screen).
- **F4 · The hybrid-π, printed.** `r_π = β/g_m = 2.59 kΩ`, `r_o = V_A/I_C = 100 kΩ`,
  `g_m v_be` as a VCCS, and every DC source a wire. The small-signal netlist appears in
  the equations view as elements. Measured: the printed netlist's gain equals the
  sweep's slope.
- **F5 · How small is small.** HD2 of the exponential is about `v_be/(4V_T)`: 4.8 % at
  5 mV peak, 9.7 % at 10 mV. Raise the amplitude and watch the ghost turn amber at
  5 mV and the spectrum grow a second harmonic. Measured: HD2 from the FFT within 10 %
  of the estimate at 5 mV, and the gap growing with amplitude.
- **F6 · The MOSFET's small-signal model.** `g_m = 4 mA/V`, no `r_π`, `r_o =
  1/(λ I_D) = 125 kΩ`. The gate draws no current, which is the whole reason for the
  device, and the price is a fifth of the BJT's `g_m` at the same current. Measured:
  both numbers, and the input current at zero.

### Group G: Ports, and what loads them (2) · bridge

Every amplifier from here on is described by three numbers, `R_in`, `A_vo` and
`R_out`. Elements D5 found a Thévenin resistance by killing the sources and looking
in, and that method fails the moment a dependent source is inside. This group teaches
the method that works, and then the loading rule every cascade obeys.

- **G1 · A port with a dependent source inside.** A 1 kΩ resistor across a VCCS of
  10 mA/V controlled by its own voltage. Killing the independent sources says 1 kΩ. A
  test source says `R/(1 + g_m R) = 90.9 Ω`, and that is the answer. Flip the sign
  and the port reads −111 Ω, which Group N will use. Measured: both readings, and the
  negative one.
- **G2 · The amplifier as a two-port, and loading.** Elements E2's box with `R_in`, `A_vo`,
  `R_out`, now measured by test source at each port. Source into `R_in`, `R_out` into
  load, each a divider, so the overall gain is `A_vo` times two fractions. Two boxes in
  cascade multiply, with the middle divider counted once. Measured: the three numbers
  by test source, and the cascade against the direct solve.

### Group H: Single-stage amplifiers (7)

- **H1 · Common emitter.** `A_v = −g_m (R_C ∥ r_o) = −184` (−193 without `r_o`). The
  scope shows the inversion. `R_in = r_π = 2.59 kΩ`, `R_out = R_C ∥ r_o = 4.76 kΩ`,
  each by G1's test source. Measured: all four.
- **H2 · Emitter degeneration trades gain for linearity.** `R_E = 100 Ω`:
  `A_v = −g_m R_C/(1 + g_m R_E) = −39.7`, `R_in = r_π + (β + 1) R_E = 12.7 kΩ`, and
  HD2 falls by the same factor `1 + g_m R_E = 4.87`. This is feedback, and L4 names
  it. Measured: gain, `R_in`, and the HD2 ratio from the spectrum.
- **H3 · The emitter follower.** Gain `R_L/(R_L + 1/g_m) = 0.975` into 1 kΩ. `R_out =
  1/g_m + R_s/(β + 1) = 35.8 Ω` from `R_s = 1 kΩ`, `R_in = (β + 1)(1/g_m + R_L) =
  104 kΩ`. Elements E8's buffer, built from one transistor. Measured: all three.
- **H4 · Common base.** `R_in = 1/g_m = 25.9 Ω`, no inversion, gain `g_m R_C = 193`,
  current gain α. Useless alone from a 1 kΩ source, and K6 shows what it is for on top
  of a common emitter. Measured: `R_in`, gain, and the gain from 1 kΩ.
- **H5 · Common source.** `A_v = −g_m (R_D ∥ r_o) = −37.0` with `R_D = 10 kΩ`. `R_in`
  is infinite and the equations view shows why (no `r_π` row). Measured: gain and the
  zero input current.
- **H6 · Source follower and common gate.** Follower gain `g_m R_L/(1 + g_m R_L) =
  0.8` into 1 kΩ, `R_out = 1/g_m = 250 Ω`. Common gate `R_in = 250 Ω`. Ten times the
  BJT follower's output resistance at this current, and F6 said why. Measured: all
  three.
- **H7 · Swing, and where it clips.** The point sets the limits: `V_CE = 5 V` can rise
  to 10 V and fall to 0.2 V. A 30 mV input at gain 184 asks for 5.5 V peak and clips.
  The three-region model shows flat tops in time, exactly. The exponential's transfer
  characteristic shows the soft side. Measured: both clip levels, and the two routes
  agreeing within the model's stated error.

### Group I: Mirrors, active loads, and stacking stages (5)

- **I1 · The current mirror.** `I_out = I_ref/(1 + 2/β)`, 1.96 % low at β = 100. Early
  adds `ΔI/I = ΔV_CE/V_A`, 5 % per 5 V of output voltage. `R_out = r_o`. Measured:
  the two errors and `R_out`.
- **I2 · The Widlar source.** 10 µA from a 1 mA reference with `R_E = V_T ln(100)/
  10 µA = 11.9 kΩ`, and `R_out` raised to about `(1 + g_m R_E) r_o`. Measured: the
  current and `R_out`.
- **I3 · The active load.** A PNP mirror replaces `R_C`: `A_v = −g_m (r_on ∥ r_op) =
  −1934` with both Early voltages at 100 V. The intrinsic gain `g_m r_o = V_A/V_T =
  3868` is the ceiling one stage has. The bias is a knife edge, and the panel shows
  the output moving 1 V for a 1 % current mismatch. Measured: gain, ceiling, and the
  sensitivity.
- **I4 · The cascode.** A common base on top of a common emitter. `R_out` rises from
  `r_o` to about `β r_o = 10 MΩ`, and the gain with an active load goes with it.
  Measured: `R_out` by test source, and the gain.
- **I5 · Two stages, and loading.** CE into CE, G2's rule in copper. The first stage's
  `R_out = 4.76 kΩ` meets the second's `R_in = 2.59 kΩ`, so its loaded gain is −64.9,
  not −184. Total 11,900 (81.5 dB). Measured: the direct solve, and the product of
  loaded gains agreeing with it.

### Group J: The differential pair (5)

- **J1 · Steering.** `i_C1 = I/(1 + e^{−v_id/V_T})`. At `v_id = 4V_T = 103 mV`, 98.2 %
  of the tail is in one side. The curve is linear within 7.6 % out to `±V_T`. Measured:
  the sweep against the formula at every point, and both numbers.
- **J2 · The half-circuit.** Each side is a common emitter at half the tail:
  `g_m = 19.3 mA/V`. Differential gain `v_od/v_id = g_m R_C = 96.7`, single-ended
  `−g_m R_C/2`. Measured: both, and the emitter node's zero signal swing under
  differential drive.
- **J3 · Common-mode rejection.** `A_cm = −R_C/(2R_EE)`. With a 100 kΩ tail source,
  `A_cm = −0.025` and CMRR is 3868, 71.8 dB. An ideal tail source gives zero. The tail's
  output resistance sets the rejection, and I1's mirror is the tail. A5's 90 dB is
  what this becomes with an active load. Measured: both gains and the ratio.
- **J4 · Mismatch and offset.** 1 % in `R_C` gives `V_OS = V_T × 0.01 = 0.26 mV`. 5 %
  in `I_S` gives `V_T ln(1.05) = 1.26 mV`. A1's battery, explained. Measured: the input
  voltage that nulls the output, against each formula.
- **J5 · The active-loaded pair.** A mirror load converts differential to single-ended:
  `A_d = g_m (r_o2 ∥ r_o4)`. The MOS version beside it. This is the op-amp's first
  stage, and M1 assembles it. Measured: the gain.

### Group K: Frequency response (6)

- **K1 · The capacitors inside the device.** `C_π` from C3 and `C_μ` from C2. The
  short-circuit current gain falls at −20 dB/decade and crosses 0 dB at `f_T =
  g_m/(2π(C_π + C_μ)) = 280 MHz`. Measured: the crossing, and the slope over the decade
  below it.
- **K2 · The low end: coupling and bypass.** E1's capacitors, now as corners. Each
  makes a high-pass with the resistance it sees. The bypass capacitor sees the
  smallest, `R_E ∥ (1/g_m + R_s/(β + 1)) = 34.6 Ω`, so at 47 µF it sets the dominant
  corner near 98 Hz. Measured: each corner from the exact poles, and which one
  dominates.
- **K3 · The Miller effect.** `C_in = C_π + C_μ(1 + g_m R_L') = 390 pF`, and the
  estimate `f_H = 1/(2π R_in C_in) = 565 kHz`. The exact poles are 548 kHz and 337 MHz,
  so the estimate is 3.2 % high, and the pane prints that error (Rule 3). The zero at
  `g_m/C_μ = 3.08 GHz`. Measured: the exact poles, the estimate, and its error.
- **K4 · Open-circuit time constants.** `Σ τ = 291 ns`, so 547 kHz, 0.16 % from the
  exact dominant pole. The method is an approximation and the pane labels it, with
  its error growing as the second pole approaches the first. Measured: the sum and the
  error at two spacings.
- **K5 · No Miller effect: the follower and the common base.** The same transistor
  from the same source, without a gain across `C_μ`. Measured: the exact dominant
  poles of H3 and H4 at `R_s = 1 kΩ`, and their ratio to H1's.
- **K6 · The cascode's bandwidth.** The common emitter's collector sees `1/g_m`, so the
  Miller multiplier is 2 and `C_in = 24 pF`. `f_H` rises from 548 kHz to about 9.2 MHz,
  seventeen times, at the same gain. Measured: both exact poles.

### Group L: Feedback (6)

- **L1 · The loop, broken.** The return ratio T of the controlled source, and the
  closed-loop gain `A/(1 + T)`. Non-inverting op-amp with `A = 10⁵`, `β = 0.1`:
  `T = 10⁴`, gain 9.999. Measured: the direct solve equals Blackman's form to floating
  point.
- **L2 · Desensitivity.** Halve A to `5 × 10⁴` and the closed-loop gain moves 0.01 %.
  Put the CE stage inside a loop and its HD2 falls by `1 + T`. Measured: both, the HD2
  from the spectrum.
- **L3 · Gain-bandwidth is constant, from the loop's side.** A3's result derived: the
  closed-loop pole sits at `(1 + T) f_p`. Gain 10 gives 100 kHz, gain 100 gives 10 kHz,
  product 1 MHz every time. Measured: the exact pole from `transferOf` at three gains,
  equal to A3's.
- **L4 · What feedback does to the ports.** Series mixing raises `R_in` by `1 + T`,
  shunt sampling lowers `R_out` by `1 + T`. The four topologies on one table, each with
  a circuit already in the lab (H2's `R_E` is series-series). Measured: `R_in` and
  `R_out` by G1's test source against the formulas.
- **L5 · Two poles ring, three oscillate.** Add poles to A(s). With two the closed loop
  rings and its Q rises with T. With three it crosses into the right half plane at a
  gain the root locus names. The loop gain crosses to Control Lab (`plant=custom`,
  `ctrl=p:1`) and its margins are read there. Measured: the phase margin here equals
  Control Lab's for the same link, and the step overshoot matches the second-order
  metric.
- **L6 · The buffer from the inside.** Elements E8's follower has `R_out = 75 Ω`
  before the loop and `75 Ω/(1 + T) = 7.5 mΩ` after it. Measured: by test source.

### Group M: Inside the op-amp (6)

Group A showed the op-amp's limits as toggles on a box. This group builds the box from
transistors and derives every one of those numbers.

- **M1 · The two-stage op-amp, assembled.** J5's pair into an active-loaded common
  emitter into a follower. `A₀ ≈ 10⁵`, `R_in`, `R_out`, and the offset from J4's
  mismatch. Elements E2's black box, opened, and its three numbers recovered.
  Measured: all four, and A's macro given the same numbers agreeing at DC (invariant
  7).
- **M2 · Gain-bandwidth from one capacitor.** `C_c = 30 pF` across the second stage.
  `f_t = g_m1/(2π C_c) = 1.01 MHz` with `g_m1 = 0.19 mA/V`, and the dominant pole at
  `f_t/A₀`, about 10 Hz. A3's 1 MHz, derived. The `ω_t/s` fold is labelled, with its
  error printed at `10 f_p`. Measured: `f_t` and `f_p` from the exact H(s).
- **M3 · Phase margin and the second pole.** `PM = 90° − atan(f_t/f_p2)`: 71.6° at
  `f_p2 = 3 MHz`. Lower `C_c` and `f_t` rises, PM falls, and the unity-gain step rings.
  Hand-over to Control Lab. Measured: PM here and there, and the overshoot.
- **M4 · Slew rate.** The first stage can deliver at most its tail current into
  `C_c`, so `SR = I_tail/C_c = 0.5 V/µs`. A4's number, derived, and A4's ramp
  reproduced by the transistor circuit under the three-region model. Measured: the
  slope equals `I/C_c` to floating point.
- **M5 · Offset and bias current, derived.** J4's mismatch is A1's battery. The input
  transistors' base currents, `I_tail/(2β) = 75 nA`, are A2's sources. Measured: both,
  and A's macro with these values matching the transistor circuit.
- **M6 · The output stage.** Class B: a 0.7 V dead band each side, THD 59 % at 1 V
  peak and 4.3 % at 10 V, exactly, from the three-region model. Two diode drops bias it
  to class AB and the dead band goes. Class A tops out at 25 % efficiency and class B
  at `π/4 = 78.5 %`, Power Lab's genre. Measured: both THDs, and both efficiencies.

### Group N: Oscillators (4)

- **N1 · The Wien bridge at the threshold.** Gain 3 puts the poles on the jω axis at
  `f = 1/(2πRC) = 1591.5 Hz`. At 2.9 they sit left, at 3.1 right, and the root locus
  against gain shows the crossing. Barkhausen's `T(jω₀) = 1∠0°`, and G1's negative
  resistance is the same fact seen at a port. Measured: the exact poles at three gains,
  and T at `f₀`.
- **N2 · Amplitude needs a nonlinearity.** A diode limiter or the rails, both PWL,
  both exact. Start-up grows as `e^{σt}` with σ from N1's poles at gain 3.1, then the
  limiter holds the amplitude. Measured: the envelope's growth rate against σ, the
  steady amplitude against the limiter's design, and the THD.
- **N3 · The relaxation oscillator.** Elements E9's Schmitt trigger and an RC. `T = 2RC
  ln((1 + β)/(1 − β)) = 2.197 RC` at `β = 0.5`, 1.00 ms with `R = 4.55 kΩ` and
  `C = 100 nF`. Every edge is an event, so the period is exact. Measured: the period,
  and the capacitor's exponential between edges.
- **N4 · LC oscillators** *(stretch).* Colpitts with the three-region BJT,
  `f = 1/(2π√(L C₁C₂/(C₁ + C₂)))`. Stretch because the exponential is declined in
  time and the three-region model's amplitude limit is coarse, and the pane would have
  to say so.

### Group O: Noise (5)

- **O1 · A random signal has a density, not a spectrum.** A white source at 1 mV rms
  and 48 kHz. One FFT frame is spray. Average 100 frames and the floor is flat at
  6.45 µV/√Hz, and its integral over the band returns the 1 mV within 1 %. The unit
  V/√Hz is defined here and used from here on. Measured: the flatness against the
  estimator's `1/√M`, and the integral.
- **O2 · A resistor's noise.** `4kTR`: 4.07 nV/√Hz at 1 kΩ and 300 K. Through 1 nF
  the rms is `√(kT/C) = 2.04 µV` whatever R is, because R sets both the density and the
  bandwidth, and the noise bandwidth of a first-order stage is `(π/2) f_c`. Measured:
  the density, the integral within 0.1 %, and the bandwidth.
- **O3 · Shot noise.** `2qI`: 17.9 pA/√Hz at 1 mA, and 1.79 pA/√Hz at the base's
  10 µA. Measured: both.
- **O4 · The amplifier's noise, referred to the input.** The CE stage's output density
  as a stack: `R_s` thermal, base shot through `R_s`, collector shot divided by `g_m`.
  The optimum source resistance is `√β/g_m = 259 Ω`, where the noise figure is
  `1 + 1/√β = 1.1`, 0.41 dB. Measured: the stack's sum equals the direct total, the
  minimum of the sweep over `R_s` sits at 259 Ω, and its value is 0.41 dB.
- **O5 · Signal-to-noise after gain.** A 1 mV signal in a 20 kHz band. The first
  stage sets the ratio and the second cannot recover it (Friis). Measured: the SNR at
  each stage's output.

---

## 6. Hand-overs

- **→ Control Lab** (L5, M3, N1). The loop gain T(s) as `plant=custom` with
  `ctrl=p:1`, so Control Lab's margins are the amplifier's. The mapping is exact and
  is presented without hedge (CORE_SCOPE counter-rule). Tested both ways: the margins
  agree, and the link round-trips.
- **→ Signal Lab** (K3, O1). A small-signal H(s) of order two or less crosses as the
  raw coefficient tier, as Circuit Lab's does. Higher order is declined with the reason
  ("this stage has four poles, and the receiving block holds two"), and the refusal is
  tested. Distortion and class B spectra are computed in the lab with `@ee-labs/dsp`
  and cross-reference Signal Lab's Nonlinearity group by name, as Power Lab does.
- **→ Circuit Lab** (A3). The op-amp macro's single pole is the speed Circuit Lab's
  op-amp circuits lack. A stretch link opens the integrator or Sallen–Key there with
  the pole attached, if Circuit Lab grows the knob.
- **← Circuit Elements Lab.** Its E2 box gains Group A's toggles and opens into M1.
  Its E9 Schmitt trigger becomes N3. Its I1 `r_d` becomes F1's `g_m`, and its four
  diode models become D3's two transistor models. Its I2 Newton view is reused
  unchanged. Its I4 rectifier is A6's comparison. Its I7 clipper is completed by
  Group B.
- **↔ Power Lab.** D5's switch is Power Lab's switch. M6's efficiency ceilings are
  Power Lab's Group A argument, seen from the linear side.

---

## 7. Testing discipline

- **Unit** (`packages/network`): each model's law against hand values. The op-amp
  macro against Elements E2 and against a hand single-pole response. `junction.js` against the
  four closed forms. The companion interface against finite differences.
  `smallSignal` against a hand hybrid-π for the CE stage. `transferOf` against hand
  polynomials for RC, RLC and the CE stage with `C_μ`. `returnRatio` against the
  op-amp with resistive feedback. `noise.js` against `kT/C`, and the periodogram
  against the generator's variance.
- **Invariants** (§2.12), fuzzed across the library and the bias space. The hostile
  corners are included: the active load's knife edge, the op-amp open loop, β = 1000,
  and `V_A → ∞`.
- **Experiments**: every number in §5 pinned, the way every other lab pins its notes.
  Among them 90.9 kHz, 753 mV, 318 MHz, 2.05 V, 90.9 Ω, −184, 98.2 %, 3.2 %, 1.01 MHz,
  0.5 V/µs, 59 %, 2.197, 2.04 µV and 259 Ω.
- **The map's promises**: a test walks every experiment's `why` and every cross-
  reference in it, and requires the referenced experiment to exist in the named lab.
  The Elements lab already has this class of test, and it is copied. A reference to
  an experiment that is not built fails the suite.
- **Guards**: the quasi-static frequency guard, the amplitude guard, the order guard on
  the Signal Lab link, and every refusal message. Each is tested at both sides of its
  threshold.
- **Cross-lab pins**: the margins in Control Lab for L5's link. Elements E2's black box against
  Group A's macro and against M1. The order-2 CE stage against Signal Lab's biquad at
  the corner.
- **Playwright harness**: the DC/AC overlay follows the toggle. The transfer
  characteristic's tangent matches the topbar `A_v`. The amber ghost appears past
  5 mV. No horizontal scroll at 390 px.
- **REVIEW_PLAYBOOK audit** before release, all eleven classes, a screenshot pass, and
  the sittings script from `apps/circuit-elements-lab/SITTINGS.md` with three seats.
  One seat sits Group A, because a reader who arrives from Elements meets it first.

---

## 8. Integration and the dark launch

The mechanism is the one Power Lab and the Elements lab share, unchanged:

- Deployed **dark** at `/electronics-lab/` from the first vertical slice. Unlisted,
  not secret.
- `apps/electronics-lab/RELEASE_STATUS` reads `dark`. A test asserts that while it
  does, the splash, the root README and the other labs' LabNav contain no reference to
  Electronics Lab. Flip the word to `released` and the same test demands the splash
  card, the README row and the nav entries, with counts pinned.
- The nav fold of Decision 5 is part of the release commit. It touches every lab's
  nav, so it is the one change that cannot be dark.
- The flip is **Reed's action**, after the release gate in §9.

---

## 9. Phasing

Each phase ships green and deployable dark. The bridges come first, because a reader
arriving from the Elements lab meets them first. Two of them (the op-amp macro, the
junction) are cheap, and the third (the transistor) is the engine's work.

1. **The op-amp's limits and the last diodes.** The macro of §2.2, the current-limited
   VCCS, `junction.js`. App shell, schematic with both overlays, dark deploy and the
   `RELEASE_STATUS` test. **Groups A, B, C** (12). Exit: invariant 7 green, every A
   to C number pinned, and B1 and B2 either here or in Elements as I9 and I10.
2. **Engine.** `Q` and `M` elements, the companion interface, `smallSignal`,
   `transferOf`, `returnRatio`. Invariants 1 to 8 fuzzed green before any transistor
   is on screen. Exit: the CE stage's hand hybrid-π and its `transferOf` agree with
   `sweepAC`.
3. **Devices, bias, small signals, ports.** Curves view with the load line, the
   transfer characteristic, the DC/AC overlays in use. **Groups D, E, F, G** (21).
   Exit: every number pinned, the amplitude guard tested, D6's margins on the
   characteristic.
4. **Amplifiers.** Bode and pole-zero views, the spectrum view. **Groups H, I** (12).
   The Signal Lab raw-tier link with its order refusal. Exit: H and I numbers pinned,
   the link tested both ways.
5. **Pairs and frequency.** **Groups J, K** (11). The Miller and OCTC marks with their
   errors. Exit: K3's 3.2 % and K4's 0.16 % pinned from the exact poles.
6. **Feedback and the op-amp.** `returnRatio` in the loop view, the Control Lab link.
   **Groups L, M** (12). Exit: L5's margins agree with Control Lab's. M2, M4 and M5
   reproduce A3, A4, A1 and A2 from transistors.
7. **Oscillators and noise.** `noise.js`, the generator, the noise view. **Groups N,
   O** (9, N4 if cheap). Exit: `kT/C` within 0.1 %, N3's period exact, O1's integral
   within 1 %.
8. **The release gate**, in order, each blocking the next. The full audit (every
   option, every preset, every claim, fuzzing, both browsers). The student sittings,
   which also decide Decision 2. Reed's own pass against the dark deployment. Then the
   flip.

---

## 10. Non-goals (v1, stated so they are decisions rather than omissions)

- **SPICE-level device models.** Gummel–Poon and BSIM parameters are datasheet facts.
  The two models per device are the ones a course teaches, and the panel says what
  each leaves out.
- **Device physics past the four closed forms.** Carrier transport, the diffusion
  equation and the depletion approximation's derivation are a physics course. Group C
  states the results with their inputs, and the pane says which step is taken on trust.
- **The exponential model in time.** Declined with the reason, as in the Elements lab.
  The quasi-static sweep and the PWL models carry the large-signal lessons.
- **A voltage-dependent capacitance in time.** Declined with the same reason. `C_j(v)`
  is a small-signal value at the point.
- **Body effect, subthreshold conduction, velocity saturation.** Each changes a
  number, none changes a lesson in this course.
- **Two-port matrices (h, y, z, g).** The test-source method of G1 measures every
  port, and Blackman's form replaces the two-port analysis of feedback. A matrix
  formalism would add notation and no experiment.
- **Digital logic past the inverter.** D6 is the door, and the room behind it is not
  the signals half of the curriculum.
- **Flicker noise as physics.** A labelled toggle with a constant, off by default.
- **PLLs, data converters, switched-capacitor circuits.** Mixed-signal is Signal Lab's
  side of the boundary, and a later lab's if any.
- **Transmission lines and distributed parasitics.** CORE_SCOPE declines them at the
  `systems` boundary, and this lab does not reopen that.
- **A free-form schematic editor.** Curated circuits with editable values, as every
  other lab.
- **Layout, packaging, thermal coupling between devices.** Datasheet facts.

---

## 11. Risks, named

- **Newton on transistor circuits.** The diode never needed source stepping. An
  active-loaded stage and an open-loop op-amp will. Mitigation: source stepping and
  GMIN stepping in the companion loop, the bias-in-loop flag, and a refusal with a
  reason when both fail. Fuzz the hostile corners in Phase 2, not Phase 6.
- **`transferOf` conditioning.** Six states and a gain of 10⁵ lose digits in
  Faddeev–LeVerrier. Mitigation: balancing before the recurrence, invariant 3 at every
  sweep point, and a fallback that reports "poles from the eigenvalues, numerator from
  the points" with the reason, if the polynomials fail the check.
- **The quasi-static guard set too loosely.** A factor of twenty below the lowest pole
  is a choice. Mitigation: the guard's number is tested against the exact PWL waveform
  where both routes apply (H7), and moved if they disagree by more than 1 %.
- **The bridges read as a detour.** A reader who wants transistors meets six op-amp
  toggles first. Mitigation: Group A is the experiment set the Elements plan deferred,
  and its splash line says so. The sittings seat one student on A1 and one on D1 and
  compare.
- **Fifteen groups in one nav row.** The suite's longest sidebar. Mitigation:
  Decision 2's split point, the folding groups the other labs already use, and the
  sittings deciding the split.
- **Numbers that are right for one transistor.** Every quoted number is for the
  defaults in §4.3. Mitigation: each pin is a function of the parameters and is
  re-derived, not a constant in the test.
- **Curriculum sprawl.** An electronics textbook is a thousand pages. Mitigation: §10,
  and the rule that a new element type needs an experiment that needs it.
- **Cost.** A new element class, a generalised Newton, a polynomial extraction, and
  four bridging groups: the largest engine extension since the Elements lab's Phase 2.
  Phasing keeps every phase shippable dark, Phase 1 is cheap and useful on its own, and
  Phases 1 to 4 are a complete first electronics course.
